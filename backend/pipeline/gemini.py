"""One Gemini call per clip: video (+ audio) → model output JSON (contracts/model_output.schema.json).

Settings locked at G0 (Oct 10): gemini-3.5-flash-lite, 4 fps, default resolution,
thinking low, static mode, output cap, one retry on invalid JSON.
"""

import json
import os
import threading
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from google import genai
from google.genai import types

from pipeline.models import ModelOutput

HERE = Path(__file__).resolve().parent
# Same files locally (backend/…, contracts/…) and in the Modal image (/root/…)
SCHEMA_PATH = next(p for p in (HERE.parent / "contracts", HERE.parent.parent / "contracts") if p.exists()) / "model_output.schema.json"
PROMPTS = HERE.parent / "prompts"


@dataclass(frozen=True)
class Settings:
    model: str = "gemini-3.5-flash-lite"
    fps: float = 4
    media_resolution: str = "default"
    thinking_level: str = "low"
    mode: str = "static"
    prompt_version: str = "base_v2"
    max_output_tokens: int = 8192


SETTINGS = Settings()


class GeminiError(Exception):
    """Failure with a message that can be shown to the user."""


class KeyPool:
    """GEMINI_API_KEY may hold several comma-separated keys (separate projects); rotate on rate limits."""

    def __init__(self, raw: str | None = None) -> None:
        keys = [k.strip() for k in (raw or os.environ.get("GEMINI_API_KEY", "")).split(",") if k.strip()]
        if not keys:
            raise GeminiError("The server has no Gemini API key configured.")
        # 90 s per request: a hung call fails with a clear message instead of spinning forever
        self.clients = [genai.Client(api_key=k, http_options=types.HttpOptions(timeout=90_000)) for k in keys]
        self._next = 0
        self._lock = threading.Lock()

    def order(self) -> list[int]:
        """Start at the next key in turn, then try the others."""
        with self._lock:
            start = self._next
            self._next = (self._next + 1) % len(self.clients)
        return [(start + i) % len(self.clients) for i in range(len(self.clients))]


def _is_rate_limit(e: Exception) -> bool:
    text = f"{type(e).__name__} {e}"
    return "429" in text or "RESOURCE_EXHAUSTED" in text or "quota" in text.lower()


def _upload(client: genai.Client, path: Path, timeout_s: float = 120) -> types.File:
    f = client.files.upload(file=str(path))
    deadline = time.time() + timeout_s
    while f.state and f.state.name == "PROCESSING":
        if time.time() > deadline:
            raise GeminiError("Gemini took too long to receive the video.")
        time.sleep(1)
        f = client.files.get(name=f.name)
    if f.state and f.state.name == "FAILED":
        raise GeminiError("Gemini couldn't read this video.")
    return f


def _config(s: Settings) -> types.GenerateContentConfig:
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_json_schema=json.loads(SCHEMA_PATH.read_text()),
        max_output_tokens=s.max_output_tokens,
    )
    if s.media_resolution == "low":
        config.media_resolution = types.MediaResolution.MEDIA_RESOLUTION_LOW
    if s.thinking_level == "low":
        config.thinking_config = types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW)
    return config


def analyse(pool: KeyPool, video: Path, audio: bool, settings: Settings = SETTINGS) -> tuple[ModelOutput, dict]:
    """Returns the validated model output and the `pipeline` metadata block for this run."""
    prompt = (PROMPTS / f"{settings.prompt_version}.md").read_text()
    last: Exception | None = None
    for k in pool.order():
        client = pool.clients[k]
        try:
            t0 = time.time()
            file = _upload(client, video)
            upload_s = time.time() - t0
            part = types.Part(
                file_data=types.FileData(file_uri=file.uri, mime_type=file.mime_type),
                video_metadata=types.VideoMetadata(fps=settings.fps),
            )
            for attempt in range(2):  # one retry on invalid JSON
                t1 = time.time()
                resp = client.models.generate_content(
                    model=settings.model,
                    contents=[types.Content(role="user", parts=[part, types.Part(text=prompt)])],
                    config=_config(settings),
                )
                try:
                    output = ModelOutput.model_validate_json(resp.text or "")
                except ValueError as e:
                    last = e
                    continue
                usage = resp.usage_metadata
                meta = {
                    **asdict(settings),
                    "audio": audio,
                    "upload_s": round(upload_s, 1),
                    "generation_s": round(time.time() - t1, 1),
                    "attempts": attempt + 1,
                    "prompt_tokens": getattr(usage, "prompt_token_count", None),
                    "output_tokens": getattr(usage, "candidates_token_count", None),
                }
                try:
                    client.files.delete(name=file.name)
                except Exception:
                    pass
                return output, meta
            raise GeminiError("Gemini returned an unreadable answer twice.") from last
        except GeminiError:
            raise
        except Exception as e:
            last = e
            if not _is_rate_limit(e):
                raise GeminiError(f"Gemini request failed: {type(e).__name__}") from e
    raise GeminiError("Gemini is rate-limited on every key right now. Try again in a minute.") from last
