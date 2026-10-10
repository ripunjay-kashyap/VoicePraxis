"""SIDE_BY_SIDE: the same clip analysed by camera only (PLAN §7, D4).

Same model, prompt, fps and resolution as the main run. The only differences:
no audio track and no transcript. Runs in parallel with the main run, so it
adds no waiting time; if it fails, the episode is still delivered without it.
"""

from pathlib import Path

from pipeline.assemble import assemble
from pipeline.gemini import KeyPool, analyse


def camera_only(pool: KeyPool, noaudio: Path, *, episode_id: str, duration: float) -> dict:
    output, meta = analyse(pool, noaudio, audio=False, transcript=None)
    episode = assemble(output, episode_id=episode_id, duration=duration, pipeline=meta)
    # Without audio nothing can have been said; drop anything the model put there.
    episode["narration"] = []
    episode["pending_questions"] = []
    for a in episode["actions"]:
        a["stated_reason"] = None
    for st in episode["subtasks"]:
        st["stated_intent"] = None
    episode["task"]["declared_intent"] = None
    return episode
