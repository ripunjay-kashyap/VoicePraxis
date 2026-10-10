"""Spoken markers: the person says "capture" when the task starts and "finish" when it ends.

Head-cam recordings start with adjusting the mount and filler talk. With word-level
timestamps we keep only the part between the markers. Missing markers fall back
gracefully: no "capture" → from the start; no "finish" → to the end; neither → no trim.
"""

import re

from pipeline.stt import Word

# Matched by prefix: "capture/captured/capturing", "finish/finished/finishing".
PAD_S = 0.3  # keep a little room so the first/last movement isn't cut
MIN_WINDOW_S = 3.0


def _norm(text: str) -> str:
    return re.sub(r"[^a-z]", "", text.lower())


def find_window(words: list[Word], duration: float) -> dict | None:
    """Returns {start, end, keyword_start, keyword_end} or None when there's nothing to trim."""
    # Position guards: "capture" in the first half, "finish" in the last third, so the same
    # words used naturally mid-task ("when you finish…") don't cut the recording short.
    start_word = next((w for w in words if _norm(w.text).startswith("captur") and w.start <= duration * 0.5), None)
    after = [w for w in words if start_word is None or w.start > start_word.end]
    end_word = next((w for w in reversed(after) if _norm(w.text).startswith("finish") and w.start >= duration * 2 / 3), None)
    if start_word is None and end_word is None:
        return None
    start = min(start_word.end + PAD_S, duration) if start_word else 0.0
    end = max(end_word.start - PAD_S, 0.0) if end_word else duration
    if end - start < MIN_WINDOW_S:
        return None  # markers too close together: safer to keep everything
    return {
        "start": round(start, 2),
        "end": round(end, 2),
        "keyword_start": round(start_word.start, 2) if start_word else None,
        "keyword_end": round(end_word.start, 2) if end_word else None,
        "original_duration": round(duration, 2),
    }


def shift_words(words: list[Word], window: dict) -> list[Word]:
    """Words inside the window, re-timed so the window starts at 0 (markers themselves drop out)."""
    s, e = window["start"], window["end"]
    return [Word(w.text, round(w.start - s, 2), round(w.end - s, 2)) for w in words if w.start >= s and w.end <= e]
