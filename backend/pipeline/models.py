"""Pydantic mirror of contracts/model_output.schema.json (what Gemini returns)."""

from typing import Literal

from pydantic import BaseModel, Field

Outcome = Literal["success", "failed", "unresolved"]


class SaidRef(BaseModel):
    text: str
    utterance_id: str


class Task(BaseModel):
    name: str
    declared_intent: SaidRef | None = None
    outcome: Outcome = "unresolved"
    outcome_evidence: str = ""


class Utterance(BaseModel):
    id: str
    start: float
    end: float
    text: str
    mode: Literal["before", "during", "after", "general"] = "general"


class Action(BaseModel):
    start: float
    end: float
    observed_action: str
    instruction: str
    visual_evidence: str = ""
    stated_reason: SaidRef | None = None
    inferred_reason: str | None = None
    why_matters: bool = False
    attempt: Literal["first", "retry", "recovery"] = "first"
    outcome: Outcome = "unresolved"
    uncertainty: list[str] = Field(default_factory=list)


class ModelOutput(BaseModel):
    scene: str = ""
    task: Task
    narration: list[Utterance] = Field(default_factory=list)
    actions: list[Action] = Field(default_factory=list)
