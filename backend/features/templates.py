"""TEMPLATES: check a take against a reference episode ("record the expert once"; PLAN §7.1).

A text-only Gemini call matches template steps to the take's steps. Our code then
decides each status from two channels, did it (video) and said it (narration),
checks every cited id exists, and writes the messages using the take's timestamps.
"""

import json
import time
import uuid

from google.genai import types

from pipeline.gemini import GeminiError, KeyPool, _is_rate_limit

JUDGE_MODEL = "gemini-3.5-flash-lite"
UNCLEAR_BELOW = 0.5

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


def check(pool: KeyPool, template: dict, take: dict) -> dict:
    """Returns template_check for the take (statuses decided by code, not the model)."""
    actions = {a["id"]: a for a in take["actions"]}
    by_step = {m.get("template_step_id"): m for m in _judge(pool, template, take)}
    used: set[str] = set()
    rows = []
    for step in template["steps"]:
        m = by_step.get(step["id"]) or {}
        act_id = m.get("matched_action_id")
        if act_id not in actions or act_id in used:  # cited ids must exist, once each
            act_id = None
        if act_id:
            used.add(act_id)
        act = actions.get(act_id) if act_id else None
        did = m.get("did_it", "unclear") if act or m.get("did_it") != "yes" else "unclear"
        said = bool(m.get("said_it")) or bool(act and act.get("stated_reason"))
        conf = float(m.get("confidence") or 0)
        skip = (m.get("skip_reason") or "").strip() or None
        where = f" at {_fmt_time(act['start'])}" if act else ""
        step = {**step, "instruction": step["instruction"].strip().rstrip(".")}

        if conf < UNCLEAR_BELOW or did == "unclear":
            status, msg = "unclear", f"Couldn't tell whether \u201c{step['instruction']}\u201d was done; check it."
        elif did == "yes":
            if said:
                status, msg = "complete", f"\u201c{step['instruction']}\u201d{where}: done and said."
            else:
                status, msg = "not_narrated", f"Did \u201c{step['instruction']}\u201d{where} but didn't say so."
        else:
            if skip:
                status, msg = "deliberate_skip", f"Skipped \u201c{step['instruction']}\u201d. They said: {skip}"
            elif said:
                status, msg = "said_not_seen", f"Said \u201c{step['instruction']}\u201d, but it isn't visible."
            elif step.get("required", True):
                status, msg = "missed", f"{step['instruction']}: not done and not mentioned."
            else:
                status, msg = "complete", f"Optional step not done: {step['instruction']}."
        severity, label = STATUS[status]
        rows.append({
            "template_step_id": step["id"], "instruction": step["instruction"], "required": step.get("required", True),
            "status": status, "label": label, "severity": severity, "message": msg,
            "action_ref": act_id, "time": act["start"] if act else None, "confidence": round(conf, 2),
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
