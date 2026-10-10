"""TEMPLATES: check a take against a reference episode ("record the expert once"; PLAN §7.1).

A text-only Gemini call matches template steps to the take's steps. Steps it can't
match get a second, targeted look at the take's video (the first annotation can skip
steps, especially without narration). Our code then decides each status from two
channels, did it (video) and said it (narration), checks every cited id exists, and
writes the messages using the take's timestamps.
"""

import json
import time
import uuid
from pathlib import Path

from google.genai import types

from pipeline.gemini import GeminiError, KeyPool, _is_rate_limit, _upload

JUDGE_MODEL = "gemini-3.5-flash-lite"
UNCLEAR_BELOW = 0.5
SEEN_AT_LEAST = 0.6  # a second look only counts a step as done when this sure
VERIFY_FPS = 4

# status → (severity, label); severity: action problem (red), data gap (orange), info (blue)
STATUS = {
    "complete": ("ok", "Complete"),
    "not_narrated": ("gap", "Not narrated"),
    "said_not_seen": ("gap", "Said, not seen"),
    "missed": ("problem", "Missed"),
    "deliberate_skip": ("info", "Skipped on purpose"),
    "unclear": ("gap", "Unclear"),
}

JUDGE_SCHEMA = {
    "type": "object",
    "required": ["matches"],
    "properties": {
        "matches": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["template_step_id", "matched_action_id", "did_it", "said_it", "skip_reason", "confidence"],
                "properties": {
                    "template_step_id": {"type": "string"},
                    "matched_action_id": {"type": ["string", "null"], "description": "The take action with the same intent as this step, or null."},
                    "did_it": {"type": "string", "enum": ["yes", "no", "unclear"], "description": "Is a step with the same intent visibly done in the take?"},
                    "said_it": {"type": "boolean", "description": "Does the take's narration mention doing this step (any wording)?"},
                    "skip_reason": {"type": ["string", "null"], "description": "If skipped, the reason the person SAID for skipping it (quote), else null."},
                    "confidence": {"type": "number", "description": "0-1: how sure you are about this match."},
                },
            },
        }
    },
}

JUDGE_PROMPT = """You compare a TAKE of a physical task with a TEMPLATE (an expert's reference recording of the same task).
Both were annotated from their video (actions) and narration (what the person said). Use only this data.

Match by INTENT, not wording: "unscrew the cap" and "open the bottle top" are the same step.
For EVERY template step, return one entry:
- matched_action_id: the take action with the same intent, or null if none.
- did_it: "yes" if that step is visibly done in the take, "no" if not, "unclear" if you can't tell.
- said_it: true if the take's narration mentions doing this step, in any words.
- skip_reason: if the person explicitly said why they skipped it, quote it; else null.
- confidence: 0-1.
Each take action can match at most one template step. Do not judge reasons or style, only whether each step happened and was said.

TEMPLATE STEPS (with what the expert said):
{template}

TEMPLATE NARRATION:
{template_narration}

TAKE ACTIONS (with what the person said):
{actions}

TAKE NARRATION:
{narration}
"""


VERIFY_SCHEMA = {
    "type": "object",
    "required": ["steps"],
    "properties": {
        "steps": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["template_step_id", "visible", "start", "confidence", "evidence"],
                "properties": {
                    "template_step_id": {"type": "string"},
                    "visible": {"type": "string", "enum": ["yes", "indirect", "no", "unclear"]},
                    "start": {"type": ["number", "null"], "description": "Seconds from the start of the video when the step begins, or null."},
                    "confidence": {"type": "number", "description": "0-1"},
                    "evidence": {"type": "string", "description": "One short sentence: what you see, or why it isn't there."},
                },
            },
        }
    },
}

VERIFY_PROMPT = """Watch this video of a person doing a physical task. For EACH step below, decide from what you SEE
whether the person performs it in this video. Ignore anything said; judge only the visible actions.

- "yes": you clearly see the step happen. Give the time it starts (seconds).
- "indirect": it happens just out of view, but what you see proves it: e.g. a hand carries the object
  out of frame and comes back empty, or the object is in its new place afterwards. Give the time it starts.
- "no": it doesn't happen, e.g. the person is still holding the object at the end, or does something else.
  Don't assume a step happened only because it usually follows another one.
- "unclear": the view doesn't show enough to tell either way.

STEPS:
{steps}
"""


def _verify(pool: KeyPool, video: Path, steps: list[dict]) -> dict[str, dict]:
    """A second, targeted look at the take's video for steps the judge couldn't match."""
    lines = "\n".join(f"{s['id']}: {s['instruction']} [{s.get('verb')} · {s.get('object')}]" for s in steps)
    last = None
    for k in pool.order():
        client = pool.clients[k]
        try:
            f = _upload(client, video)
            part = types.Part(
                file_data=types.FileData(file_uri=f.uri, mime_type=f.mime_type),
                video_metadata=types.VideoMetadata(fps=VERIFY_FPS),
            )
            resp = client.models.generate_content(
                model=JUDGE_MODEL,
                contents=[types.Content(role="user", parts=[part, types.Part(text=VERIFY_PROMPT.format(steps=lines))])],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=VERIFY_SCHEMA,
                    thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW),
                    max_output_tokens=2048,
                ),
            )
            try:
                client.files.delete(name=f.name)
            except Exception:
                pass
            return {v.get("template_step_id"): v for v in json.loads(resp.text or "{}").get("steps", [])}
        except Exception as e:  # any failure: log it and try the next key
            last = e
            print(f"[templates] verify failed on key {k + 1}: {type(e).__name__}: {str(e)[:300]}")
            if not _is_rate_limit(e):
                time.sleep(0.5)
    print(f"[templates] verify gave up: {type(last).__name__ if last else 'no keys'}")
    return {}


def steps_from_episode(episode: dict) -> list[dict]:
    """A reviewed episode → template steps (the expert's reason becomes the reference reason)."""
    steps = []
    for i, a in enumerate(episode.get("actions", []), 1):
        steps.append({
            "id": f"t{i:02d}",
            "instruction": a.get("instruction") or a.get("observed_action", ""),
            "verb": a.get("verb"),
            "object": a.get("object"),
            "reference_reason": (a.get("stated_reason") or {}).get("text"),
            "required": True,
        })
    return steps


def new_template(name: str, episode_id: str, episode: dict, steps: list[dict] | None = None) -> dict:
    return {
        "id": "tpl-" + uuid.uuid4().hex[:8],
        "name": name.strip() or episode.get("task", {}).get("name", "Template"),
        "source_episode_id": episode_id,
        "task": episode.get("task", {}).get("name"),
        "created_at": time.time(),
        "steps": steps or steps_from_episode(episode),
        "narration": [u["text"] for u in episode.get("narration", [])],
    }


def _fmt_time(t: float) -> str:
    return f"{int(t // 60)}:{int(t % 60):02d}"


def _judge(pool: KeyPool, template: dict, take: dict) -> list[dict]:
    t_lines = "\n".join(
        f"{s['id']}: {s['instruction']} [{s.get('verb')} · {s.get('object')}]"
        f" | expert said: {s.get('reference_reason') or 'nothing'}"
        for s in template["steps"]
    )
    a_lines = "\n".join(
        f"{a['id']} [{a['start']:.1f}-{a['end']:.1f}s] {a.get('verb')} · {a.get('object')}: {a.get('observed_action')}"
        f" | said: {(a.get('stated_reason') or {}).get('text') or 'nothing'}"
        for a in take["actions"]
    )
    n_lines = "\n".join(f"[{u['start']:.1f}s] {u['text']}" for u in take.get("narration", [])) or "(no narration)"
    tn_lines = "\n".join(template.get("narration") or []) or "(not stored)"
    prompt = JUDGE_PROMPT.format(template=t_lines, template_narration=tn_lines, actions=a_lines, narration=n_lines)
    last = None
    for k in pool.order():
        try:
            resp = pool.clients[k].models.generate_content(
                model=JUDGE_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=JUDGE_SCHEMA,
                    thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW),
                    max_output_tokens=4096,
                ),
            )
            return json.loads(resp.text or "{}").get("matches", [])
        except Exception as e:  # any failure: log it and try the next key
            last = e
            print(f"[templates] judge failed on key {k + 1}: {type(e).__name__}: {str(e)[:300]}")
            if not _is_rate_limit(e):
                time.sleep(0.5)
    raise GeminiError("The template check couldn't run right now. Try again in a moment.") from last


def check(pool: KeyPool, template: dict, take: dict, video: Path | None = None) -> dict:
    """Returns template_check for the take (statuses decided by code, not the model).

    With `video`, steps the judge couldn't match get a second look at the take's video.
    """
    actions = {a["id"]: a for a in take["actions"]}
    by_step = {m.get("template_step_id"): m for m in _judge(pool, template, take)}

    # First pass: match each template step to a take action (cited ids must exist, once each).
    used: set[str] = set()
    matched: dict[str, dict] = {}
    for step in template["steps"]:
        m = by_step.get(step["id"]) or {}
        act_id = m.get("matched_action_id")
        if act_id not in actions or act_id in used:
            act_id = None
        if act_id:
            used.add(act_id)
        did = m.get("did_it", "unclear") if act_id or m.get("did_it") != "yes" else "unclear"
        matched[step["id"]] = {"m": m, "act_id": act_id, "did": did}

    # Second look at the video for unmatched steps that weren't skipped on purpose.
    seen: dict[str, dict] = {}
    todo = [
        st for st in template["steps"]
        if matched[st["id"]]["did"] != "yes" and not (matched[st["id"]]["m"].get("skip_reason") or "").strip()
    ]
    if video is not None and todo:
        seen = _verify(pool, video, todo)

    # With no speech at all, "not seen" is weak evidence (steps often happen just out of frame),
    # so an unseen step is flagged for a person to check instead of being called missed.
    silent_take = not take.get("narration")

    rows = []
    for step in template["steps"]:
        m, act_id, did = matched[step["id"]]["m"], matched[step["id"]]["act_id"], matched[step["id"]]["did"]
        act = actions.get(act_id) if act_id else None
        said = bool(m.get("said_it")) or bool(act and act.get("stated_reason"))
        conf = float(m.get("confidence") or 0)
        skip = (m.get("skip_reason") or "").strip() or None
        when = act["start"] if act else None
        v = seen.get(step["id"])
        second_look = None
        if v:
            vconf = float(v.get("confidence") or 0)
            if v.get("visible") in ("yes", "indirect") and vconf >= SEEN_AT_LEAST:
                did, conf = "yes", vconf
                start = v.get("start")
                when = float(start) if isinstance(start, (int, float)) else None
                second_look = "seen" if v.get("visible") == "yes" else "out_of_view"
            elif v.get("visible") == "no" and vconf >= SEEN_AT_LEAST:
                did, conf = "no", max(conf, vconf)
                second_look = "not_seen"
        where = f" at {_fmt_time(when)}" if when is not None else ""
        step = {**step, "instruction": step["instruction"].strip().rstrip(".")}

        if conf < UNCLEAR_BELOW or did == "unclear":
            status, msg = "unclear", f"Couldn't tell whether \u201c{step['instruction']}\u201d was done; check it."
        elif did == "yes":
            if said:
                status, msg = "complete", f"\u201c{step['instruction']}\u201d{where}: done and said."
            else:
                status, msg = "not_narrated", f"Did \u201c{step['instruction']}\u201d{where} but didn't say so."
            if second_look == "out_of_view":
                msg = msg.rstrip(".") + " (done just out of view)."
        else:
            if skip:
                status, msg = "deliberate_skip", f"Skipped \u201c{step['instruction']}\u201d. They said: {skip}"
            elif said:
                status, msg = "said_not_seen", f"Said \u201c{step['instruction']}\u201d, but it isn't visible."
            elif step.get("required", True) and silent_take:
                status, msg = "unclear", f"\u201c{step['instruction']}\u201d wasn't visible, and nothing was said to confirm it; check it."
            elif step.get("required", True):
                status, msg = "missed", f"{step['instruction']}: not done and not mentioned."
            else:
                status, msg = "complete", f"Optional step not done: {step['instruction']}."
        severity, label = STATUS[status]
        rows.append({
            "template_step_id": step["id"], "instruction": step["instruction"], "required": step.get("required", True),
            "status": status, "label": label, "severity": severity, "message": msg,
            "action_ref": act_id, "time": when, "confidence": round(conf, 2),
            **({"second_look": second_look, "second_look_evidence": (v or {}).get("evidence")} if second_look else {}),
        })

    # Order: matched take actions should appear in template order.
    matched = [r for r in rows if r["time"] is not None]
    for prev, cur in zip(matched, matched[1:]):
        if cur["time"] < prev["time"] and cur["status"] == "complete":
            cur["out_of_order"] = True
            cur["message"] += f" Done before “{prev['instruction']}” (out of order)."

    extras = [
        {"action_ref": a["id"], "time": a["start"], "severity": "info", "label": "Extra step",
         "message": f"Extra: {a.get('verb')} · {a.get('object')} at {_fmt_time(a['start'])}" + (" (recovery)" if a.get("attempt") == "recovery" else "") + "."}
        for a in take["actions"] if a["id"] not in used
    ]
    counts: dict[str, int] = {}
    for r in rows:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    return {
        "template_id": template["id"], "template_name": template["name"], "checked_at": time.time(),
        "steps": rows, "extras": extras, "counts": counts,
        "complete": counts.get("complete", 0), "total": len(rows),
    }
