"use client";

import * as React from "react";
import {
  EpisodeAction,
  TaskOutcome,
  ActionReviewStatus,
  formatTimestamp,
  HumanCorrection,
} from "@/lib/episode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Edit3,
  Check,
  Sparkles,
  Eye,
  Mic,
  Clock,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

interface SidePanelProps {
  action: EpisodeAction | null;
  currentTime: number;
  onUpdateAction: (actionId: string, updatedFields: Partial<EpisodeAction>, correction: HumanCorrection) => void;
  onPrevAction?: () => void;
  onNextAction?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export function SidePanel({
  action,
  currentTime,
  onUpdateAction,
  onPrevAction,
  onNextAction,
  hasPrev,
  hasNext,
}: SidePanelProps) {
  const [isEditing, setIsEditing] = React.useState(false);

  // Initialize form states directly from action props
  const [instruction, setInstruction] = React.useState(action?.instruction || "");
  const [observedAction, setObservedAction] = React.useState(action?.observed_action || "");
  const [statedReason, setStatedReason] = React.useState(action?.stated_reason?.text || "");
  const [outcome, setOutcome] = React.useState<TaskOutcome>(action?.outcome || "success");
  const [reviewStatus, setReviewStatus] = React.useState<ActionReviewStatus>(action?.review_status || "accepted");
  const [start, setStart] = React.useState<number>(action?.start || 0);
  const [end, setEnd] = React.useState<number>(action?.end || 0);

  if (!action) {
    return (
      <Card className="border-[#1e2434] bg-[#11141d] h-full flex items-center justify-center p-8 text-center text-slate-500">
        <p className="text-xs font-mono">Select a step in the timeline or video to inspect details.</p>
      </Card>
    );
  }

  const isFieldEdited = (field: string) => {
    return action.human_corrections?.some((c) => c.field === field);
  };

  const handleSave = () => {
    const nowIso = new Date().toISOString();

    // Check instruction
    if (instruction !== action.instruction) {
      onUpdateAction(
        action.id,
        { instruction },
        {
          field: "instruction",
          old_value: action.instruction,
          new_value: instruction,
          corrected_at: nowIso,
        }
      );
    }

    // Check observed action
    if (observedAction !== action.observed_action) {
      onUpdateAction(
        action.id,
        { observed_action: observedAction },
        {
          field: "observed_action",
          old_value: action.observed_action,
          new_value: observedAction,
          corrected_at: nowIso,
        }
      );
    }

    // Check stated reason
    if (statedReason !== (action.stated_reason?.text || "")) {
      const newStated = statedReason
        ? {
            text: statedReason,
            utterance_id: action.stated_reason?.utterance_id || "correction",
            source: "human_edit",
          }
        : null;
      onUpdateAction(
        action.id,
        { stated_reason: newStated },
        {
          field: "stated_reason",
          old_value: action.stated_reason?.text || null,
          new_value: statedReason || null,
          corrected_at: nowIso,
        }
      );
    }

    // Check outcome
    if (outcome !== action.outcome) {
      onUpdateAction(
        action.id,
        { outcome },
        {
          field: "outcome",
          old_value: action.outcome,
          new_value: outcome,
          corrected_at: nowIso,
        }
      );
    }

    // Check review status
    if (reviewStatus !== action.review_status) {
      onUpdateAction(
        action.id,
        { review_status: reviewStatus },
        {
          field: "review_status",
          old_value: action.review_status,
          new_value: reviewStatus,
          corrected_at: nowIso,
        }
      );
    }

    // Check timestamps
    if (start !== action.start || end !== action.end) {
      onUpdateAction(
        action.id,
        { start, end },
        {
          field: "timestamps",
          old_value: { start: action.start, end: action.end },
          new_value: { start, end },
          corrected_at: nowIso,
        }
      );
    }

    setIsEditing(false);
  };

  const setStartHere = () => {
    const rounded = parseFloat(currentTime.toFixed(2));
    setStart(rounded);
    if (!isEditing) {
      onUpdateAction(
        action.id,
        { start: rounded },
        {
          field: "start",
          old_value: action.start,
          new_value: rounded,
          corrected_at: new Date().toISOString(),
        }
      );
    }
  };

  const setEndHere = () => {
    const rounded = parseFloat(currentTime.toFixed(2));
    setEnd(rounded);
    if (!isEditing) {
      onUpdateAction(
        action.id,
        { end: rounded },
        {
          field: "end",
          old_value: action.end,
          new_value: rounded,
          corrected_at: new Date().toISOString(),
        }
      );
    }
  };

  return (
    <Card className="border-[#1e2434] bg-[#11141d] flex flex-col h-full shadow-2xl overflow-hidden">
      {/* Header bar */}
      <CardHeader className="p-4 border-b border-[#191f2c] bg-[#0d1017]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-bold border border-slate-700">
              {action.id}
            </span>
            <span className="font-mono text-xs text-slate-300">
              {formatTimestamp(action.start)} – {formatTimestamp(action.end)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Step navigation arrows */}
            {hasPrev && (
              <button
                type="button"
                onClick={onPrevAction}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                title="Previous step"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {hasNext && (
              <button
                type="button"
                onClick={onNextAction}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                title="Next step"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            <Button
              variant={isEditing ? "why" : "secondary"}
              size="sm"
              onClick={() => {
                if (isEditing) {
                  handleSave();
                } else {
                  setIsEditing(true);
                }
              }}
              className="h-7 px-2.5 text-xs gap-1 cursor-pointer ml-1"
            >
              {isEditing ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Save
                </>
              ) : (
                <>
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4 overflow-y-auto flex-1">
        {/* Badges bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="seen" className="gap-1">
            <Eye className="w-3 h-3" />
            🔵 Seen
          </Badge>

          {action.stated_reason && (
            <Badge variant="said" className="gap-1">
              <Mic className="w-3 h-3" />
              🟠 Said
            </Badge>
          )}

          {action.why_matters && (
            <Badge variant="why" className="gap-1">
              <Sparkles className="w-3 h-3" />
              🟢 Why Hero
            </Badge>
          )}

          {action.attempt === "recovery" && (
            <Badge variant="outline" className="border-purple-600/60 bg-purple-950/40 text-purple-300 font-mono text-[10px]">
              ↻ Recovery
            </Badge>
          )}

          <Badge
            variant={action.outcome === "success" ? "why" : "missed"}
            className="text-[10px] font-mono"
          >
            {action.outcome === "success" ? "✓ Success" : "✗ Failed"}
          </Badge>

          {action.human_corrections && action.human_corrections.length > 0 && (
            <Badge variant="outline" className="border-amber-600/60 bg-amber-950/50 text-amber-300 text-[10px] font-mono">
              Edited ({action.human_corrections.length})
            </Badge>
          )}
        </div>

        {/* 1. Instruction Command (Robot Target) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1">
              <span>Robot Instruction</span>
              {isFieldEdited("instruction") && (
                <span className="text-[9px] text-amber-400 font-bold">• Edited</span>
              )}
            </label>
          </div>
          {isEditing ? (
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={2}
              className="w-full text-xs font-mono p-2.5 rounded-lg border border-emerald-500/60 bg-[#0a0d14] text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          ) : (
            <p className="text-sm font-semibold text-slate-100 bg-[#0d1017] p-2.5 rounded-lg border border-[#1b2230] leading-snug">
              &ldquo;{action.instruction}&rdquo;
            </p>
          )}
        </div>

        {/* 2. Observed Physical Action */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-mono uppercase text-sky-400 flex items-center gap-1">
              <span>Observed Action (Visual Only)</span>
              {isFieldEdited("observed_action") && (
                <span className="text-[9px] text-amber-400 font-bold">• Edited</span>
              )}
            </label>
          </div>
          {isEditing ? (
            <textarea
              value={observedAction}
              onChange={(e) => setObservedAction(e.target.value)}
              rows={2}
              className="w-full text-xs p-2.5 rounded-lg border border-sky-500/60 bg-[#0a0d14] text-white focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
          ) : (
            <p className="text-xs text-slate-300 bg-[#0d1017] p-2.5 rounded-lg border border-sky-950/60 leading-relaxed">
              {action.observed_action}
            </p>
          )}
        </div>

        {/* 3. Stated & Inferred Reasons */}
        <div className="space-y-2">
          <label className="text-[11px] font-mono uppercase text-emerald-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Reasoning &amp; Intent Linkage</span>
          </label>

          <div className="text-xs bg-[#091510] p-3 rounded-lg border border-emerald-900/60 space-y-2.5">
            {/* Spoken reason */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-orange-400 uppercase font-semibold">
                  Spoken by Demonstrator {action.stated_reason?.utterance_id ? `(${action.stated_reason.utterance_id})` : ""}:
                </span>
                {isFieldEdited("stated_reason") && (
                  <span className="text-[9px] text-amber-400 font-bold font-mono">• Edited</span>
                )}
              </div>
              {isEditing ? (
                <textarea
                  value={statedReason}
                  placeholder="Enter verbatim spoken reason..."
                  onChange={(e) => setStatedReason(e.target.value)}
                  rows={2}
                  className="w-full text-xs p-2 rounded border border-orange-500/60 bg-[#080d12] text-white mt-1 focus:outline-none"
                />
              ) : action.stated_reason ? (
                <p className="text-slate-200 mt-1 italic">
                  &ldquo;{action.stated_reason.text}&rdquo;
                </p>
              ) : (
                <p className="text-slate-500 mt-1 italic">No reason verbalized during action.</p>
              )}
            </div>

            {/* Inferred reason (Model hypothesis - clearly labelled) */}
            <div className="pt-2 border-t border-emerald-950/80">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold">
                  Model Hypothesis (Visual Guess):
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 font-mono border border-emerald-800/80">
                  Inferred
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                {action.inferred_reason || "Unable to infer physical rationale from camera view."}
              </p>
            </div>
          </div>
        </div>

        {/* 4. Timestamp Adjustments (Keyboard [ and ] or Phone Tap Buttons) */}
        <div className="space-y-1.5 p-3 rounded-lg border border-[#1b2332] bg-[#0c0f16]">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[11px] text-slate-300 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              Step Boundaries
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              Keys: [ start · ] end
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={setStartHere}
              className="text-[11px] font-mono h-8 cursor-pointer border-[#283244]"
            >
              Set Start Here ({formatTimestamp(currentTime, true)})
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={setEndHere}
              className="text-[11px] font-mono h-8 cursor-pointer border-[#283244]"
            >
              Set End Here ({formatTimestamp(currentTime, true)})
            </Button>
          </div>
        </div>

        {/* 5. Review Status & Outcome Selectors in Edit Mode */}
        {isEditing && (
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#1b2230]">
            <div>
              <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                Outcome
              </label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as TaskOutcome)}
                className="w-full text-xs font-mono p-1.5 rounded border border-slate-700 bg-slate-900 text-white"
              >
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="unresolved">Unresolved</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                Review Status
              </label>
              <select
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value as ActionReviewStatus)}
                className="w-full text-xs font-mono p-1.5 rounded border border-slate-700 bg-slate-900 text-white"
              >
                <option value="accepted">Accepted</option>
                <option value="flagged">Needs Review</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        )}

        {/* 6. Visual Evidence & Uncertainty */}
        <div className="space-y-1.5 pt-1 text-xs">
          <span className="text-[10px] font-mono uppercase text-slate-400">Visual Evidence:</span>
          <p className="text-[11px] text-slate-400 bg-[#0d1017] p-2 rounded border border-[#181e2b]">
            {action.visual_evidence}
          </p>
        </div>

        {action.uncertainty && action.uncertainty.length > 0 && (
          <div className="space-y-1 rounded-lg border border-amber-900/60 bg-amber-950/20 p-2.5 text-xs">
            <span className="text-[10px] font-mono uppercase text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              Uncertainty Notes
            </span>
            {action.uncertainty.map((u, i) => (
              <p key={i} className="text-[11px] text-amber-300/90 font-mono">
                • {u}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
