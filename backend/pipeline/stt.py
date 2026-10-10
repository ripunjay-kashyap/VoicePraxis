"""Stage 1, listening: gemini-3.5-transcribe with word timestamps → utterances.

The transcript is authoritative: the analysis call links reasons to these
utterance ids, and assembly uses this text and these timings for narration.
"""

import re
import time
from dataclasses import dataclass
from pathlib import Path

from google.genai import types

from pipeline.gemini import GeminiError, KeyPool, _is_rate_limit, _upload

STT_MODEL = "gemini-3.5-transcribe"
GAP_SPLIT_S = 1.2  # a pause this long starts a new utterance
MAX_UTTERANCE_S = 8.0


@dataclass
class Word:
    text: str
    start: float
    end: float


def _seconds(v) -> float:
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    if hasattr(v, "total_seconds"):
        return v.total_seconds()
    m = re.fullmatch(r"([\d.]+)s", str(v).strip())
    return float(m.group(1)) if m else 0.0


def group_words(words: list[Word]) -> list[dict]:
    """Words → utterances, split at sentence ends, long pauses or ~8 s."""
    utterances: list[dict] = []
    current: list[Word] = []

    def flush():
        if current:
            utterances.append({
                "id": f"u{len(utterances) + 1}",
                "start": round(current[0].start, 2),
                "end": round(current[-1].end, 2),
                "text": " ".join(w.text for w in current).strip(),
            })
            current.clear()

    for w in words:
        if current and (w.start - current[-1].end > GAP_SPLIT_S or w.end - current[0].start > MAX_UTTERANCE_S):
            flush()
        current.append(w)
        if re.search(r"[.?!]$", w.text):
            flush()
    flush()
    return utterances


def transcribe(pool: KeyPool, audio: Path) -> tuple[list[dict], dict]:
    """Returns utterances [{id, start, end, text}] and metadata for the pipeline block."""
    last: Exception | None = None
    for k in pool.order():
        client = pool.clients[k]
        try:
            t0 = time.time()
            file = _upload(client, audio)
            resp = client.models.generate_content(
                model=STT_MODEL,
                contents=[types.Part(file_data=types.FileData(file_uri=file.uri, mime_type=file.mime_type))],
                config=types.GenerateContentConfig(
                    audio_transcription_config=types.AudioTranscriptionConfig(word_timestamp=True),
                ),
            )
            words: list[Word] = []
            for part in resp.candidates[0].content.parts or []:
                tr = getattr(part, "audio_transcription", None)
                for w in (getattr(tr, "words", None) or []):
                    words.append(Word(w.word, _seconds(w.start_offset), _seconds(w.end_offset)))
            try:
                client.files.delete(name=file.name)
            except Exception:
                pass
            utterances = group_words(words)
            return utterances, {"stt_model": STT_MODEL, "stt_s": round(time.time() - t0, 1), "words": len(words)}
        except Exception as e:
            last = e
            if not _is_rate_limit(e):
                raise GeminiError(f"Transcription failed: {type(e).__name__}") from e
    raise GeminiError("Transcription is rate-limited on every key right now.") from last
