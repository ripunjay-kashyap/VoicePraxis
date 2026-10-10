"use client";

import * as React from "react";
import {
  EpisodeAction,
  TaskOutcome,
  ActionReviewStatus,
  formatTimestamp,
  stepLabel,
} from "@/lib/episode";
import { PatchChange } from "@/lib/api";
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
  Loader2,
  X,
} from "lucide-react";

interface SidePanelProps {
  action: EpisodeAction | null;
  currentTime: number;
  onPatchChanges: (changes: PatchChange[]) => Promise<{ success: boolean; detail?: string }>;
  onPrevAction?: () => void;
  onNextAction?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export function SidePanel({
  action,
  currentTime,
  onPatchChanges,
  onPrevAction,
  onNextAction,
  hasPrev,
  hasNext,
}: SidePanelProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // Initialize form states directly from action props
  const [instruction, setInstruction] = React.useState(action?.instruction || "");
  const [observedAction, setObservedAction] = React.useState(action?.observed_action || "");
  const [statedReason, setStatedReason] = React.useState(action?.stated_reason?.text || "");
  const [inferredReason, setInferredReason] = React.useState(action?.inferred_reason || "");
  const [outcome, setOutcome] = React.useState<TaskOutcome>(action?.outcome || "success");
  const [reviewStatus, setReviewStatus] = React.useState<ActionReviewStatus>(action?.review_status || "accepted");

  const startEditing = () => {
    if (!action) return;
    setInstruction(action.instruction || "");
    setObservedAction(action.observed_action || "");
    setStatedReason(action.stated_reason?.text || "");
    setInferredReason(action.inferred_reason || "");
    setOutcome(action.outcome || "success");
    setReviewStatus(action.review_status || "accepted");
    setSaveError(null);
    setIsEditing(true);
  };

  if (!action) {
    return (
      <Card className="border-slate-200 bg-white h-full flex items-center justify-center p-8 text-center text-slate-500">
        <p className="text-xs font-mono">Select a step in the timeline or video to inspect details.</p>
      </Card>
    );
  }

  const isFieldEdited = (field: string) => {
    return action.human_corrections?.some((c) => c.field === field);
  };

  const handleSave = async () => {
    setSaveError(null);
    const changes: PatchChange[] = [];

    if (instruction !== action.instruction) {
      changes.push({ target: action.id, field: "instruction", value: instruction });
    }

    if (observedAction !== action.observed_action) {
      changes.push({ target: action.id, field: "observed_action", value: observedAction });
    }

    if (statedReason !== (action.stated_reason?.text || "")) {
      changes.push({
        target: action.id,
        field: "stated_reason",
        value: statedReason.trim() ? statedReason.trim() : null,
      });
    }

    if (inferredReason !== (action.inferred_reason || "")) {
      changes.push({
        target: action.id,
        field: "inferred_reason",
        value: inferredReason.trim() ? inferredReason.trim() : null,
      });
    }

    if (outcome !== action.outcome) {
      changes.push({ target: action.id, field: "outcome", value: outcome });
    }

    if (reviewStatus !== action.review_status) {
      changes.push({ target: action.id, field: "review_status", value: reviewStatus });
    }

    if (changes.length === 0) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    const result = await onPatchChanges(changes);
    setIsSaving(false);

    if (result.success) {
      setSaveError(null);
      setIsEditing(false);
    } else {
      // Keep the user's text and show detail message (P0.1)
      setSaveError(result.detail || "Save failed. Please check inputs and retry.");
    }
  };

  const setStartHere = async () => {
    const rounded = parseFloat(currentTime.toFixed(2));
    const result = await onPatchChanges([
      { target: action.id, field: "start", value: rounded },
    ]);
    if (!result.success && result.detail) {
      setSaveError(result.detail);
    }
  };

  const setEndHere = async () => {
    const rounded = parseFloat(currentTime.toFixed(2));
    const result = await onPatchChanges([
      { target: action.id, field: "end", value: rounded },
    ]);
    if (!result.success && result.detail) {
      setSaveError(result.detail);
    }
  };

  return (
    <Card className="border-slate-200 bg-white flex flex-col h-full shadow-sm overflow-hidden">
      {/* Header bar */}
      <CardHeader className="p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{stepLabel(action.id)}</span>
            {action.verb && (
              <span className="text-xs px-1.5 py-0.5 rounded border border-sky-200 bg-sky-50 text-sky-700">
                {action.verb} · {action.object}
                {action.tool ? ` · ${action.tool}` : ""}
              </span>
            )}
            <span className="font-mono text-xs text-slate-600">
              {formatTimestamp(action.start)} – {formatTimestamp(action.end)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Step navigation arrows */}
            {hasPrev && (
              <button
                type="button"
                onClick={onPrevAction}
                className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer"
                title="Previous step"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {hasNext && (
              <button
                type="button"
                onClick={onNextAction}
                className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer"
                title="Next step"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            <Button
              variant={isEditing ? "why" : "secondary"}
              size="sm"
              disabled={isSaving}
              onClick={() => {
                if (isEditing) {
                  handleSave();
                } else {
                  startEditing();
                }
              }}
              className="h-7 px-2.5 text-xs gap-1 cursor-pointer ml-1"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
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
        {/* Error notification on failed PATCH (P0.1) */}
        {saveError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800">Save Failed</p>
                <p>{saveError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSaveError(null)}
              className="text-red-700 hover:text-slate-900 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Badges bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="seen" className="gap-1">
            <Eye className="w-3 h-3" />
            Seen
          </Badge>

          {action.stated_reason && (
            <Badge variant="said" className="gap-1">
              <Mic className="w-3 h-3" />
              Said
            </Badge>
          )}

          {action.why_matters && (
            <Badge variant="why" className="gap-1">
              <Sparkles className="w-3 h-3" />
              Why Hero
            </Badge>
          )}

          {action.attempt === "recovery" && (
            <Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-700 font-mono text-[10px]">
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
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-[10px] font-mono">
              Edited ({action.human_corrections.length})
            </Badge>
          )}
        </div>

        {/* 1. Instruction Command (Robot Target) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] uppercase font-medium text-slate-500 flex items-center gap-1">
              <span>Instruction</span>
              {isFieldEdited("instruction") && (
                <span className="text-[11px] text-amber-700 font-bold">• Edited</span>
              )}
            </label>
          </div>
          {isEditing ? (
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={2}
              className="w-full text-xs font-mono p-2.5 rounded-lg border border-emerald-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          ) : (
            <p className="text-sm font-semibold text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200 leading-snug">
              &ldquo;{action.instruction}&rdquo;
            </p>
          )}
        </div>

        {/* 2. Observed Physical Action */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] uppercase font-medium text-sky-700 flex items-center gap-1">
              <span>What happened</span>
              {isFieldEdited("observed_action") && (
                <span className="text-[11px] text-amber-700 font-bold">• Edited</span>
              )}
            </label>
          </div>
          {isEditing ? (
            <textarea
              value={observedAction}
              onChange={(e) => setObservedAction(e.target.value)}
              rows={2}
              className="w-full text-xs p-2.5 rounded-lg border border-sky-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
          ) : (
            <p className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-sky-200 leading-relaxed">
              {action.observed_action}
            </p>
          )}
        </div>

        {/* 3. Stated & Inferred Reasons */}
        <div className="space-y-2">
          <label className="text-[11px] uppercase font-medium text-emerald-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Why</span>
          </label>

          <div className="text-xs bg-white p-3 rounded-lg border border-emerald-200 space-y-2.5">
            {/* Spoken reason */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-orange-700 uppercase font-semibold">
                  {action.stated_reason?.source === "human"
                    ? "Added by reviewer"
                    : action.stated_reason?.source === "clarification"
                      ? "Answered by the person (after recording)"
                      : "Said by the person"}
                </span>
                {isFieldEdited("stated_reason") && (
                  <span className="text-[11px] text-amber-700 font-bold font-mono">• Edited</span>
                )}
              </div>
              {isEditing ? (
                <textarea
                  value={statedReason}
                  placeholder="Why was this step done?"
                  onChange={(e) => setStatedReason(e.target.value)}
                  rows={2}
                  className="w-full text-xs p-2 rounded border border-orange-300 bg-white text-slate-900 mt-1 focus:outline-none"
                />
              ) : action.stated_reason ? (
                <p className="text-slate-800 mt-1 italic">
                  &ldquo;{action.stated_reason.text}&rdquo;
                </p>
              ) : (
                <p className="text-slate-500 mt-1 italic">No reason given.</p>
              )}
            </div>

            {/* Inferred reason (Model hypothesis - clearly labelled as a guess) */}
            <div className="pt-2 border-t border-emerald-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 uppercase font-medium">
                    Model&rsquo;s guess
                  </span>
                </div>
                {isFieldEdited("inferred_reason") && (
                  <span className="text-[11px] text-amber-700 font-bold font-mono">• Edited</span>
                )}
              </div>
              {isEditing ? (
                <textarea
                  value={inferredReason}
                  placeholder="Model's guess"
                  onChange={(e) => setInferredReason(e.target.value)}
                  rows={2}
                  className="w-full text-xs p-2 rounded border border-emerald-300 bg-white text-slate-900 mt-1 focus:outline-none"
                />
              ) : (
                <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                  {action.inferred_reason || "Unable to infer physical rationale from camera view."}
                </p>
              )}
            </div>
          </div>
        </div>

        {isEditing && (
          <>
        {/* 4. Timestamp Adjustments (Keyboard [ and ] or Phone Tap Buttons) */}
        <div className="space-y-1.5 p-3 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[11px] text-slate-600 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              Adjust timing
            </span>

          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={setStartHere}
              className="text-[11px] font-mono h-8 cursor-pointer border-slate-200"
            >
              Set Start Here ({formatTimestamp(currentTime, true)})
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={setEndHere}
              className="text-[11px] font-mono h-8 cursor-pointer border-slate-200"
            >
              Set End Here ({formatTimestamp(currentTime, true)})
            </Button>
          </div>
        </div>
          </>
        )}

        {/* 5. Review Status & Outcome Selectors in Edit Mode */}
        {isEditing && (
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
            <div>
              <label className="text-[10px] uppercase font-medium text-slate-500 block mb-1">
                Outcome
              </label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as TaskOutcome)}
                className="w-full text-xs font-mono p-1.5 rounded border border-slate-200 bg-slate-50 text-slate-900"
              >
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="unresolved">Unresolved</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-medium text-slate-500 block mb-1">
                Review Status
              </label>
              <select
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value as ActionReviewStatus)}
                className="w-full text-xs font-mono p-1.5 rounded border border-slate-200 bg-slate-50 text-slate-900"
              >
                <option value="accepted">Accepted</option>
                <option value="needs_review">Needs Review</option>
                <option value="unreviewed">Unreviewed</option>
              </select>
            </div>
          </div>
        )}


        {action.uncertainty && action.uncertainty.length > 0 && (
          <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs">
            <span className="text-[10px] uppercase font-medium text-amber-700 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-700" />
              Check this
            </span>
            {action.uncertainty.map((u, i) => (
              <p key={i} className="text-xs text-amber-800">
                • {u}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
