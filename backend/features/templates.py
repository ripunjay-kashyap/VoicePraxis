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
    "no_reason": ("gap", "No reason given"),
    "said_not_seen": ("gap", "Said, not seen"),
    "missed": ("problem", "Missed"),
    "deliberate_skip": ("info", "Skipped on purpose"),
    "different_reason": ("info", "Different reason"),
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
                "required": ["template_step_id", "matched_action_id", "did_it", "said_what", "said_why",
                             "reason_matches", "skip_reason", "confidence"],
                "properties": {
                    "template_step_id": {"type": "string"},
                    "matched_action_id": {"type": ["string", "null"], "description": "The take action that performs this step, or null."},
                    "did_it": {"type": "string", "enum": ["yes", "no", "unclear"], "description": "Is the step visibly done in the take?"},
                    "said_what": {"type": "boolean", "description": "Does the take's narration mention doing this step?"},
                    "said_why": {"type": "boolean", "description": "Does the take's narration give a reason for this step?"},
                    "reason_matches": {"type": "string", "enum": ["yes", "no", "na"], "description": "Is the take's reason the same idea as the reference reason? na if either is missing."},
                    "skip_reason": {"type": ["string", "null"], "description": "If the step was skipped, the reason the person SAID for skipping it (quote), else null."},
                    "confidence": {"type": "number", "description": "0-1: how sure you are about this match."},
                },
            },
        }
    },
}

JUDGE_PROMPT = """You compare a TAKE of a physical task against a TEMPLATE (an expert's reference recording).
Both were already annotated from video and narration. Use only the data given; do not invent anything.

For EVERY template step, return one entry:
- matched_action_id: the take action that performs the same step (same purpose; wording may differ), or null.
- did_it: "yes" if a take action clearly performs it, "no" if no action does, "unclear" if unsure.
- said_what / said_why: whether the take's narration mentions doing it / gives a reason for it.
- reason_matches: whether the take's stated reason is the same idea as the template's reference reason.
- skip_reason: if the person explicitly said why they skipped the step, quote it; else null.
- confidence: 0-1.
Each take action can match at most one template step.

TEMPLATE STEPS:
{template}

TAKE ACTIONS:
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
    }


def _fmt_time(t: float) -> str:
    return f"{int(t // 60)}:{int(t % 60):02d}"


def _judge(pool: KeyPool, template: dict, take: dict) -> list[dict]:
    t_lines = "\n".join(
        f"{s['id']}: {s['instruction']} [{s.get('verb')} · {s.get('object')}]"
        f" | reference reason: {s.get('reference_reason') or 'none'}"
        for s in template["steps"]
    )
    a_lines = "\n".join(
        f"{a['id']} [{a['start']:.1f}-{a['end']:.1f}s] {a.get('verb')} · {a.get('object')}: {a.get('observed_action')}"
        f" | stated reason: {(a.get('stated_reason') or {}).get('text') or 'none'}"
        for a in take["actions"]
    )
    n_lines = "\n".join(f"[{u['start']:.1f}s] {u['text']}" for u in take.get("narration", [])) or "(no narration)"
    prompt = JUDGE_PROMPT.format(template=t_lines, actions=a_lines, narration=n_lines)
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
        said_what, said_why = bool(m.get("said_what")), bool(m.get("said_why"))
        if act and act.get("stated_reason"):
            said_what = said_why = True  # the pipeline already linked a spoken reason
        conf = float(m.get("confidence") or 0)
        skip = (m.get("skip_reason") or "").strip() or None
        where = f" at {_fmt_time(act['start'])}" if act else ""
        step = {**step, "instruction": step["instruction"].strip().rstrip(".")}
        ref = step.get("reference_reason")

        if conf < UNCLEAR_BELOW or did == "unclear":
            status, msg = "unclear", f"Couldn't tell whether “{step['instruction']}” was done; check it."
        elif did == "yes":
            if not said_what:
                status, msg = "not_narrated", f"Did “{step['instruction']}”{where} but didn't say so."
            elif not said_why:
                status = "no_reason"
                msg = f"Did “{step['instruction']}”{where} but didn't say why." + (f" Reference: {ref}" if ref else "")
            elif ref and m.get("reason_matches") == "no":
                status, msg = "different_reason", f"Gave a different reason for “{step['instruction']}”{where} (noted, not an error)."
            else:
                status, msg = "complete", f"“{step['instruction']}”{where}: done and explained."
        else:
            if skip:
                status, msg = "deliberate_skip", f"Skipped “{step['instruction']}”. They said: {skip}"
            elif said_what:
                status, msg = "said_not_seen", f"Said they'd “{step['instruction']}”, but it isn't visible."
            else:
                status = "missed" if step.get("required", True) else "complete"
                msg = (f"{step['instruction']}: not seen and not mentioned." if step.get("required", True)
                       else f"Optional step not done: {step['instruction']}.")
        severity, label = STATUS[status]
        rows.append({
            "template_step_id": step["id"], "instruction": step["instruction"], "required": step.get("required", True),
            "status": status, "label": label, "severity": severity, "message": msg,
            "action_ref": act_id, "time": act["start"] if act else None, "confidence": round(conf, 2),
        })

    # Order: matched take actions should appear in template order.
    matched = [r for r in rows if r["time"] is not None]
    for prev, cur in zip(matched, matched[1:]):
        if cur["time"] < prev["time"] and cur["status"] in ("complete", "different_reason"):
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
