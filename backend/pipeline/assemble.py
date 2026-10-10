"""Model output → episode JSON 0.2 (PLAN §5).

Adds ids, clamps and sorts times, checks that every narration reference points at
a real utterance, and fills pending_questions. Never invents content.
"""

from pipeline.models import ModelOutput

SCHEMA_VERSION = "0.2"


def _clamp(t: float, duration: float) -> float:
    return round(min(max(t, 0.0), duration), 2) if duration > 0 else round(max(t, 0.0), 2)


def assemble(output: ModelOutput, *, episode_id: str, duration: float, pipeline: dict) -> dict:
    # Narration: speech-01… in time order; keep a map from the model's ids.
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
            "observed_action": a.observed_action.strip(),
            "instruction": a.instruction.strip(),
            "visual_evidence": a.visual_evidence.strip(),
            "stated_reason": link(a.stated_reason, "stated reason", uncertainty),
            "inferred_reason": (a.inferred_reason or "").strip() or None,
            "why_matters": a.why_matters,
            "attempt": a.attempt,
            "outcome": a.outcome,
            "uncertainty": uncertainty,
            "review_status": "unreviewed",
            "human_corrections": [],
        })

    task_notes: list[str] = []
    task = {
        "name": output.task.name.strip(),
        "declared_intent": link(output.task.declared_intent, "declared intent", task_notes),
        "outcome": output.task.outcome,
        "outcome_evidence": output.task.outcome_evidence.strip(),
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
        "actions": actions,
        "pending_questions": pending,
        "clarifications": [],
        "template_check": None,
        "video_only": None,
        "pipeline": pipeline,
    }
