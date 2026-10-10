/**
 * VoicePraxis Episode Contract Types (v0.2)
 * Matches contracts/episode.v0.2.example.json and model_output.schema.json
 */

export type ProcessingStage =
  | "uploaded"
  | "converting"
  | "listening"
  | "analysing"
  | "linking"
  | "ready"
  | "failed";

export interface EpisodeStatus {
  stage: ProcessingStage;
  error: string | null;
}

export interface PipelineConfig {
  model: string;
  fps: number;
  res: "default" | "low" | string;
  mode: "static" | "agentic" | string;
  prompt_version: string;
  audio: boolean;
}

export interface DeclaredIntent {
  text: string;
  utterance_id?: string;
  evidence_ref?: string;
  source?: string;
}

export type TaskOutcome = "success" | "failed" | "unresolved";

export interface EpisodeTask {
  name: string;
  summary?: string;
  declared_intent: DeclaredIntent | null;
  outcome: TaskOutcome;
  outcome_evidence: string;
}

export type UtteranceMode = "before" | "during" | "after" | "general";

export interface NarrationUtterance {
  id: string;
  start: number;
  end: number;
  text: string;
  mode: UtteranceMode;
}

export interface StatedReason {
  text: string;
  utterance_id?: string;
  evidence_ref?: string;
  source?: string;
}

export type ActionAttempt = "first" | "retry" | "recovery";

export type ActionReviewStatus =
  | "unreviewed"
  | "accepted"
  | "needs_review"
  | "corrected"
  | "flagged"
  | "rejected"
  | string;

/** As stored by the backend: {field, old, new, at (unix seconds)} */
export interface HumanCorrection {
  field: string;
  old: unknown;
  new: unknown;
  at: number;
}

export interface EpisodeAction {
  id: string;
  start: number;
  end: number;
  observed_action: string;
  /** Task-level label: verb from a fixed vocabulary, object and tool (null = hands only) */
  verb?: string;
  object?: string;
  tool?: string | null;
  subtask_ref?: string | null;
  instruction: string;
  visual_evidence: string;
  stated_reason: StatedReason | null;
  inferred_reason: string | null;
  why_matters: boolean;
  attempt: ActionAttempt;
  outcome: TaskOutcome;
  uncertainty: string[];
  review_status: ActionReviewStatus;
  human_corrections: HumanCorrection[];
}

/** Sub-intent: a phase of the task grouping consecutive actions */
export interface EpisodeSubtask {
  id: string;
  start: number;
  end: number;
  goal: string;
  stated_intent: StatedReason | null;
  inferred_intent: string | null;
  uncertainty: string[];
  action_refs: string[];
}

export type PendingQuestionKind = "no_reason" | "unclear" | "failure";

export interface PendingQuestion {
  id: string;
  action_ref: string;
  kind: PendingQuestionKind;
  question: string;
  source: string;
}

export interface Clarification {
  action_ref: string;
  question: string;
  answer: string;
  asked_at: string;
}

export interface Episode {
  schema_version: "0.2" | string;
  episode_id: string;
  media_ref: string;
  duration_seconds: number;
  status: EpisodeStatus;
  pipeline: PipelineConfig | null;
  scene: string;
  task: EpisodeTask;
  narration: NarrationUtterance[];
  subtasks?: EpisodeSubtask[];
  actions: EpisodeAction[];
  pending_questions: PendingQuestion[];
  clarifications: Clarification[];
  template_check: unknown | null;
  video_only: Episode | null;
  human_corrections: HumanCorrection[];
  saved?: boolean;
  label?: string;
}

/**
 * Helper to check if an action has a why reason (either stated or inferred)
 */
export function getActionReason(action: EpisodeAction): {
  type: "stated" | "inferred" | "none";
  text: string | null;
} {
  if (action.stated_reason?.text) {
    return { type: "stated", text: action.stated_reason.text };
  }
  if (action.inferred_reason) {
    return { type: "inferred", text: action.inferred_reason };
  }
  return { type: "none", text: null };
}

/**
 * Format decimal seconds to MM:SS or MM:SS.s
 */
export function formatTimestamp(seconds: number, includeSubseconds = false): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (includeSubseconds) {
    return `${mins}:${secs.toFixed(1).padStart(4, "0")}`;
  }
  return `${mins}:${Math.floor(secs).toString().padStart(2, "0")}`;
}

/** "action-05" → "Step 5" (user-facing; ids stay internal) */
export function stepLabel(id: string): string {
  const n = parseInt(id.split("-").pop() || "", 10);
  return Number.isFinite(n) ? `Step ${n}` : id;
}
