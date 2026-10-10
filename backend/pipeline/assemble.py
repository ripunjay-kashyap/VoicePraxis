"""Model output → episode JSON 0.2 (PLAN §5).

Adds ids, clamps and sorts times, checks that every narration reference points at
a real utterance, and fills pending_questions. Never invents content.
"""

import re

from pipeline.models import VERBS, ModelOutput

SCHEMA_VERSION = "0.2"


def _noun(text: str | None) -> str | None:
    """Lowercase noun phrase without leading articles, so labels group across clips."""
    if not text:
        return None
    t = re.sub(r"^(the|a|an|his|her|their|its|this|that)\s+", "", text.strip().lower())
    return t.strip(" .") or None


def _tidy(text: str | None, limit: int = 240) -> str:
    """Guard against model loops: collapse a phrase repeated 3+ times, then cap the length."""
    t = (text or "").strip()
    t = re.sub(r"(.{6,}?)\1{2,}", r"\1", t)
    if len(t) > limit:
        cut = t[:limit]
        t = cut[: cut.rfind(" ")].rstrip(" ,;") + "…" if " " in cut else cut + "…"
    return t


def _clamp(t: float, duration: float) -> float:
    return round(min(max(t, 0.0), duration), 2) if duration > 0 else round(max(t, 0.0), 2)


def assemble(output: ModelOutput, *, episode_id: str, duration: float, pipeline: dict,
             transcript: list[dict] | None = None) -> dict:
    # Narration: the speech-to-text transcript when we have one (authoritative),
    # otherwise the model's own. speech-01… in time order; map the cited ids.
    if transcript:
        from pipeline.models import Utterance
        utterances = [Utterance(id=u["id"], start=u["start"], end=u["end"], text=u["text"], mode="general") for u in transcript]
        modes = {u.id: u.mode for u in output.narration}
        for u in utterances:
            u.mode = modes.get(u.id, "general")
    else:
        utterances = sorted(output.narration, key=lambda u: u.start)
    id_map: dict[str, str] = {}
    narration = []
    for i, u in enumerate(utterances, 1):
        new_id = f"speech-{i:02d}"
        id_map[u.id] = new_id
        start = _clamp(u.start, duration)
        narration.append({
            "id": new_id,
            "start": start,
            "end": max(start, _clamp(u.end, duration)),
            "text": u.text.strip(),
            "mode": u.mode,
        })

    def link(ref, label: str, notes: list[str]):
        """Narration reference → {text, source, evidence_ref}, or None if it points nowhere."""
        if ref is None:
            return None
        evidence = id_map.get(ref.utterance_id)
        if evidence is None:
            notes.append(f"The {label} doesn't match any transcribed speech; check it.")
        return {"text": ref.text.strip(), "source": "narration", "evidence_ref": evidence}

    actions = []
    for i, a in enumerate(sorted(output.actions, key=lambda a: a.start), 1):
        uncertainty = list(a.uncertainty)
        start = _clamp(a.start, duration)
        actions.append({
            "id": f"action-{i:02d}",
            "start": start,
            "end": max(start, _clamp(a.end, duration)),
            "observed_action": _tidy(a.observed_action),
            "verb": a.verb if a.verb in VERBS else "other",
            "object": _noun(a.object) or "unknown",
            "tool": _noun(a.tool),
            "instruction": a.instruction.strip(),
            "visual_evidence": a.visual_evidence.strip(),
            "stated_reason": link(a.stated_reason, "stated reason", uncertainty),
            "inferred_reason": _tidy(a.inferred_reason) or None,
            "why_matters": a.why_matters,
            "attempt": a.attempt,
            "outcome": a.outcome,
            "uncertainty": uncertainty,
            "review_status": "unreviewed",
            "human_corrections": [],
        })

    # Subtasks (sub-intents): subtask-01…; each action joins the subtask it overlaps most.
    subtasks = []
    for i, st in enumerate(sorted(output.subtasks, key=lambda s: s.start), 1):
        notes: list[str] = []
        start = _clamp(st.start, duration)
        subtasks.append({
            "id": f"subtask-{i:02d}",
            "start": start,
            "end": max(start, _clamp(st.end, duration)),
            "goal": st.goal.strip(),
            "stated_intent": link(st.stated_intent, "stated intent", notes),
            "inferred_intent": (st.inferred_intent or "").strip() or None,
            "uncertainty": notes,
            "action_refs": [],
        })
    for a in actions:
        best, best_overlap = None, 0.0
        for st in subtasks:
            overlap = min(a["end"], st["end"]) - max(a["start"], st["start"])
            if overlap > best_overlap or (best is None and st["start"] <= a["start"] <= st["end"]):
                best, best_overlap = st, max(overlap, best_overlap)
        if best is None and subtasks:  # zero-length or outside every phase: nearest by start
            best = min(subtasks, key=lambda st: abs(st["start"] - a["start"]))
        a["subtask_ref"] = best["id"] if best else None
        if best:
            best["action_refs"].append(a["id"])

    task_notes: list[str] = []
    task = {
        "name": output.task.name.strip(),
        "summary": _tidy(output.task.summary, 200),
        "declared_intent": link(output.task.declared_intent, "declared intent", task_notes),
        "outcome": output.task.outcome,
        "outcome_evidence": _tidy(output.task.outcome_evidence),
        "uncertainty": task_notes,
    }
    if not narration:
        task["uncertainty"].append("No narration was heard in this clip.")

    # Ask about decision points that have no spoken reason (PLAN §3, F16).
    pending = [
        {
            "action_ref": a["id"],
            "kind": "no_reason",
            "question": f"Why did you {a['instruction'][0].lower()}{a['instruction'][1:].rstrip('.')}?",
            "source": "mvp_check",
        }
        for a in actions
        if a["why_matters"] and a["stated_reason"] is None
    ]
    # Failures and recoveries first: those are the reasons a robot most needs.
    rank = {"recovery": 0, "retry": 1, "first": 2}
    pending.sort(key=lambda q: rank[next(a["attempt"] for a in actions if a["id"] == q["action_ref"])])

    return {
        "schema_version": SCHEMA_VERSION,
        "episode_id": episode_id,
        "media_ref": "episode.mp4",
        "duration_seconds": round(duration, 2),
        "scene": output.scene.strip(),
        "task": task,
        "narration": narration,
        "subtasks": subtasks,
        "actions": actions,
        "pending_questions": pending,
        "clarifications": [],
        "template_check": None,
        "video_only": None,
        "pipeline": pipeline,
    }
