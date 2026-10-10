"use client";

import * as React from "react";
import { Episode, EpisodeAction } from "@/lib/episode";
import { getExportUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Download,
  Copy,
  Check,
  X,
  FileCode,
  Package,
} from "lucide-react";

interface ExportModalProps {
  episode: Episode;
  selectedAction: EpisodeAction | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModal({
  episode,
  selectedAction,
  isOpen,
  onClose,
}: ExportModalProps) {
  const [viewMode, setViewMode] = React.useState<"step" | "episode">("step");
  const [isCopied, setIsCopied] = React.useState(false);

  if (!isOpen) return null;

  const displayData =
    viewMode === "step" && selectedAction
      ? {
          step_id: selectedAction.id,
          timestamps: { start: selectedAction.start, end: selectedAction.end },
          instruction: selectedAction.instruction,
          observed_action: selectedAction.observed_action,
          stated_reason: selectedAction.stated_reason,
          inferred_reason: selectedAction.inferred_reason,
          why_matters: selectedAction.why_matters,
          attempt: selectedAction.attempt,
          outcome: selectedAction.outcome,
          visual_evidence: selectedAction.visual_evidence,
          corrections_applied: selectedAction.human_corrections || [],
        }
      : episode;

  const jsonString = JSON.stringify(displayData, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const jsonExportUrl = getExportUrl(episode.episode_id, "json");
  const zipExportUrl = getExportUrl(episode.episode_id, "zip");

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="max-w-3xl w-full border-slate-200 bg-white shadow-sm flex flex-col max-h-[85vh] overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-200 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-emerald-700" />
            <CardTitle className="text-base">Export</CardTitle>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </CardHeader>

        <CardContent className="p-4 space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Toggle View Mode */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-white border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode("step")}
                className={`px-3 py-1 rounded text-xs font-mono transition-all cursor-pointer ${
                  viewMode === "step"
                    ? "bg-emerald-500 text-white font-semibold shadow"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                This step
              </button>
              <button
                type="button"
                onClick={() => setViewMode("episode")}
                className={`px-3 py-1 rounded text-xs font-mono transition-all cursor-pointer ${
                  viewMode === "episode"
                    ? "bg-emerald-500 text-white font-semibold shadow"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Whole episode
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-8 gap-1.5 text-xs font-mono cursor-pointer border-slate-200 hover:border-emerald-300"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy JSON
                </>
              )}
            </Button>
          </div>

          {/* Syntax-highlighted code container */}
          <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 text-xs font-mono text-emerald-700 leading-relaxed">
            <pre className="whitespace-pre-wrap">{jsonString}</pre>
          </div>

          {/* Action Download Buttons with plain HTML links for Safari (P0.4) */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200">
            <p className="text-xs text-slate-500">Includes your edits.</p>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <a
                href={jsonExportUrl}
                download={`voicepraxis-${episode.episode_id}.json`}
                className="inline-flex items-center justify-center gap-2 rounded-lg text-xs font-mono font-medium h-9 px-4 bg-white text-slate-800 border border-slate-200 hover:bg-white hover:text-slate-900 transition-colors flex-1 sm:flex-initial"
              >
                <Download className="w-3.5 h-3.5 text-sky-700" />
                Download JSON
              </a>

              <a
                href={zipExportUrl}
                download={`voicepraxis-${episode.episode_id}.zip`}
                className="inline-flex items-center justify-center gap-2 rounded-lg text-xs font-mono font-semibold h-9 px-4 bg-emerald-500 text-white hover:bg-emerald-400 transition-colors flex-1 sm:flex-initial"
              >
                <Package className="w-3.5 h-3.5" />
                JSON + video (.zip)
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
