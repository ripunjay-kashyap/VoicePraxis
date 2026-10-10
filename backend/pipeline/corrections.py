"""Human corrections, stored apart from the model output and applied on read (PLAN §5).

A correction is {target: "task" | "action-NN", field, value}. The stored list keeps
the old value and a timestamp, so the export shows exactly what a person changed.
"""

import copy
import time

ACTION_TEXT = {"observed_action", "instruction", "inferred_reason"}
ACTION_ENUMS = {
    "outcome": {"success", "failed", "unresolved"},
    "attempt": {"first", "retry", "recovery"},
    "review_status": {"unreviewed", "accepted", "needs_review"},
}
ACTION_TIMES = {"start", "end"}
TASK_TEXT = {"name"}
TASK_ENUMS = {"outcome": {"success", "failed", "unresolved"}}


class CorrectionError(ValueError):
    pass


def _check_value(target: str, field: str, value, duration: float):
    is_task = target == "task"
    text_fields = TASK_TEXT if is_task else ACTION_TEXT | {"stated_reason"}
    enums = TASK_ENUMS if is_task else ACTION_ENUMS
    if field in text_fields:
        if value is not None and not isinstance(value, str):
            raise CorrectionError(f"{field} must be text")
        value = value.strip() if isinstance(value, str) else None
        if field in {"name", "observed_action", "instruction"} and not value:
            raise CorrectionError(f"{field} can't be empty")
        return value or None
    if field in enums:
        if value not in enums[field]:
            raise CorrectionError(f"{field} must be one of {sorted(enums[field])}")
        return value
    if not is_task and field in ACTION_TIMES:
        if not isinstance(value, (int, float)):
            raise CorrectionError(f"{field} must be a number of seconds")
        return round(min(max(float(value), 0.0), duration), 2)
    raise CorrectionError(f"{field} can't be edited on {target}")


def validate(episode: dict, changes: list[dict]) -> list[dict]:
    """Check incoming changes against the current episode; returns stored correction records."""
    ids = {a["id"] for a in episode["actions"]}
    duration = float(episode.get("duration_seconds") or 0)
    now = time.time()
    out = []
    for c in changes:
        target, field = c.get("target"), c.get("field")
        if target != "task" and target not in ids:
            raise CorrectionError(f"Unknown target {target!r}")
        value = _check_value(target, field, c.get("value"), duration)
        out.append({"target": target, "field": field, "value": value, "at": now})
    return out


def _get(obj: dict, field: str):
    if field == "stated_reason":
        return (obj.get("stated_reason") or {}).get("text")
    return obj.get(field)


def apply(model_output: dict, corrections: list[dict]) -> dict:
    """The episode a person sees: model output + corrections, in order. Never mutates the input."""
    episode = copy.deepcopy(model_output)
    actions = {a["id"]: a for a in episode["actions"]}
    for c in corrections:
        obj = episode["task"] if c["target"] == "task" else actions.get(c["target"])
        if obj is None:
            continue
        field, value = c["field"], c["value"]
        old = _get(obj, field)
        if old == value:
            continue
        if field == "stated_reason":
            if value is None:
                obj["stated_reason"] = None
            elif obj.get("stated_reason"):
                obj["stated_reason"]["text"] = value
            else:
                obj["stated_reason"] = {"text": value, "source": "human", "evidence_ref": None}
        else:
            obj[field] = value
        if c["target"] != "task":
            obj.setdefault("human_corrections", []).append({"field": field, "old": old, "new": value, "at": c["at"]})
            if field != "review_status" and obj.get("review_status") == "unreviewed":
                obj["review_status"] = "corrected"
        else:
            episode["task"].setdefault("human_corrections", []).append({"field": field, "old": old, "new": value, "at": c["at"]})
    for a in actions.values():
        if a["end"] < a["start"]:
            a["end"] = a["start"]
    episode["actions"].sort(key=lambda a: a["start"])
    # A question is answered once the step has any stated reason.
    episode["pending_questions"] = [
        q for q in episode.get("pending_questions", [])
        if not (actions.get(q["action_ref"]) or {}).get("stated_reason")
    ]
    return episode
