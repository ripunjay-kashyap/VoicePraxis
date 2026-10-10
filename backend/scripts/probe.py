"""Hour-0 Gemini probe (IMPLEMENTATION §7.1).

Converts a clip with the production ffmpeg command, sends it to Gemini with the
model-output schema, and records timings and basic counts.

    uv run python scripts/probe.py ../clips/FIX01.mov --matrix
    uv run python scripts/probe.py ../clips/FIX01.mov --model gemini-3.8-flash --fps 4 --runs 2
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, replace
from pathlib import Path

from google import genai
from google.genai import types

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from pipeline.media import convert  # noqa: E402  (same command as production)

# Load backend/.env (KEY=value lines) without overriding variables already set.
_env = BACKEND / ".env"
if _env.exists():
    import os
    for _line in _env.read_text().splitlines():
        if "=" in _line and not _line.lstrip().startswith("#"):
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())


class KeyPool:
    """GEMINI_API_KEY may hold several comma-separated keys; rotate on rate limits.

    Uploaded files belong to one key's project, so each key uploads its own copy (lazily).
    """

    def __init__(self) -> None:
        import os, threading
        keys = [k.strip() for k in os.environ.get("GEMINI_API_KEY", "").split(",") if k.strip()]
        if not keys:
            sys.exit("GEMINI_API_KEY is not set (backend/.env)")
        self.clients = [genai.Client(api_key=k) for k in keys]
        self.files: dict[tuple[int, bool], types.File] = {}
        self.lock = threading.Lock()
        self.upload_s: dict[tuple[int, bool], float] = {}

    def __len__(self) -> int:
        return len(self.clients)

    def file(self, i: int, audio: bool, path: Path) -> types.File:
        with self.lock:
            if (i, audio) not in self.files:
                f, secs = upload(self.clients[i], path)
                self.files[(i, audio)] = f
                self.upload_s[(i, audio)] = secs
                print(f"  key {i + 1}: upload+ACTIVE ({'audio' if audio else 'no audio'}) {secs:.1f}s")
            return self.files[(i, audio)]


def is_rate_limit(e: Exception) -> bool:
    text = f"{type(e).__name__} {e}"
    return "429" in text or "RESOURCE_EXHAUSTED" in text or "quota" in text.lower()

ROOT = BACKEND.parent
SCHEMA = json.loads((ROOT / "contracts" / "model_output.schema.json").read_text())
PROMPT = (BACKEND / "prompts" / "base_v0.md").read_text()
OUT = BACKEND / "probe_out"

LITE = "gemini-3.5-flash-lite"  # main model (Oct 10): 15 RPM / 500 RPD per key on the free tier
FLASH = "gemini-3.8-flash"  # quality reference only: 5 RPM / 20 RPD


@dataclass(frozen=True)
class Run:
    name: str
    model: str = LITE
    fps: float = 4
    res: str = "default"  # default | low
    thinking: str = "default"  # default | low
    audio: bool = True


MATRIX = [
    Run("R1", fps=1),
    Run("R2"),
    Run("R3", res="low"),
    Run("R4", thinking="low"),
    Run("R5", model=FLASH),  # quality ceiling: is Lite giving much up?
    Run("R6", audio=False),  # R2 settings without audio: preview of the side-by-side gap
    Run("R7", fps=6),  # faster actions, if R2's timestamps are off
]


def upload(client: genai.Client, path: Path) -> tuple[types.File, float]:
    t0 = time.time()
    f = client.files.upload(file=str(path))
    while f.state and f.state.name == "PROCESSING":
        time.sleep(1)
        f = client.files.get(name=f.name)
    if f.state and f.state.name == "FAILED":
        raise RuntimeError(f"file processing failed: {path}")
    return f, time.time() - t0


def call(client: genai.Client, run: Run, file: types.File) -> dict:
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_json_schema=SCHEMA,
    )
    if run.res == "low":
        config.media_resolution = types.MediaResolution.MEDIA_RESOLUTION_LOW
    if run.thinking == "low":
        config.thinking_config = types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW)
    video = types.Part(
        file_data=types.FileData(file_uri=file.uri, mime_type=file.mime_type),
        video_metadata=types.VideoMetadata(fps=run.fps),
    )
    t0 = time.time()
    resp = client.models.generate_content(
        model=run.model, contents=[types.Content(role="user", parts=[video, types.Part(text=PROMPT)])],
        config=config,
    )
    gen_s = time.time() - t0
    usage = resp.usage_metadata
    result = {"generation_s": round(gen_s, 1),
              "prompt_tokens": getattr(usage, "prompt_token_count", None),
              "output_tokens": getattr(usage, "candidates_token_count", None),
              "raw": resp.text}
    try:
        data = json.loads(resp.text)
        result["valid_json"] = True
        result["n_actions"] = len(data.get("actions", []))
        result["n_utterances"] = len(data.get("narration", []))
        result["n_stated_reasons"] = sum(1 for a in data.get("actions", []) if a.get("stated_reason"))
        result["n_inferred_reasons"] = sum(1 for a in data.get("actions", []) if a.get("inferred_reason"))
        result["output"] = data
    except (json.JSONDecodeError, TypeError):
        result["valid_json"] = False
    return result


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("video", type=Path)
    ap.add_argument("--matrix", action="store_true", help="run R1–R7 concurrently")
    ap.add_argument("--model", default=LITE)
    ap.add_argument("--fps", type=float, default=4)
    ap.add_argument("--res", choices=["default", "low"], default="default")
    ap.add_argument("--thinking", choices=["default", "low"], default="default")
    ap.add_argument("--no-audio", action="store_true")
    ap.add_argument("--runs", type=int, default=1, help="repeat each config N times")
    args = ap.parse_args()

    clip = args.video.stem
    playback, noaudio = convert(args.video, OUT / clip / "media")
    pool = KeyPool()
    print(f"{len(pool)} API key(s); uploading media...")
    paths = {True: playback, False: noaudio}

    if args.matrix:
        runs = MATRIX
    else:
        runs = [Run("custom", args.model, args.fps, args.res, args.thinking, not args.no_audio)]
    runs = [replace(r, name=f"{r.name}-{i + 1}" if args.runs > 1 else r.name) for r in runs for i in range(args.runs)]

    def go(idx_run: tuple[int, Run]) -> tuple[Run, dict]:
        idx, run = idx_run
        last = None
        for attempt in range(len(pool)):
            k = (idx + attempt) % len(pool)  # spread runs across keys, rotate on rate limit
            try:
                r = call(pool.clients[k], run, pool.file(k, run.audio, paths[run.audio]))
                r["key"] = k + 1
                return run, r
            except Exception as e:
                last = e
                if not is_rate_limit(e):
                    break
                print(f"  {run.name}: rate limited on key {k + 1}, trying next key")
        return run, {"error": f"{type(last).__name__}: {last}"}

    with ThreadPoolExecutor(len(runs)) as ex:
        results = list(ex.map(go, enumerate(runs)))

    stamp = time.strftime("%H%M%S")
    print(f"\n{'run':8} {'model':24} {'fps':>4} {'res':7} {'think':7} {'audio':5} {'gen_s':>6} {'in_tok':>7} {'json':5} {'act':>3} {'utt':>3} {'said':>4} {'guess':>5} key")
    for run, r in results:
        (OUT / clip / f"{run.name}_{stamp}.json").write_text(json.dumps({"run": asdict(run), **r}, indent=2))
        if "error" in r:
            print(f"{run.name:8} {run.model:24} ERROR {r['error'][:120]}")
            continue
        print(f"{run.name:8} {run.model:24} {run.fps:>4} {run.res:7} {run.thinking:7} {str(run.audio):5} "
              f"{r['generation_s']:>6} {str(r['prompt_tokens']):>7} {str(r['valid_json']):5} "
              f"{r.get('n_actions', '-'):>3} {r.get('n_utterances', '-'):>3} {r.get('n_stated_reasons', '-'):>4} {r.get('n_inferred_reasons', '-'):>5} {r.get('key')}")
    print(f"\nFull outputs: {OUT / clip}")


if __name__ == "__main__":
    sys.exit(main())
