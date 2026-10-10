"use client";

import * as React from "react";
import { Episode, EpisodeAction } from "@/lib/episode";
import { downloadEpisodeJson, getApiBase } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  const handleDownloadZip = () => {
    const apiBase = getApiBase();
    if (apiBase && episode.episode_id !== "mock") {
      const a = document.createElement("a");
      a.href = `${apiBase}/episodes/${episode.episode_id}/bundle.zip`;
      a.download = `${episode.episode_id}_bundle.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      // In mock mode, download episode.json
      downloadEpisodeJson(episode, `${episode.episode_id || "episode"}.json`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="max-w-3xl w-full border-[#222a3c] bg-[#0d1017] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        <CardHeader className="p-4 border-b border-[#1b2230] flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-emerald-400" />
            <CardTitle className="text-base">Export Training Data</CardTitle>
            <Badge variant="why" className="text-[10px] font-mono">
              v0.2 Standard
            </Badge>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </CardHeader>

        <CardContent className="p-4 space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Toggle View Mode */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#141924] border border-[#1f2738]">
              <button
                type="button"
                onClick={() => setViewMode("step")}
                className={`px-3 py-1 rounded text-xs font-mono transition-all cursor-pointer ${
                  viewMode === "step"
                    ? "bg-emerald-500 text-black font-semibold shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Selected Step Preview
              </button>
              <button
                type="button"
                onClick={() => setViewMode("episode")}
                className={`px-3 py-1 rounded text-xs font-mono transition-all cursor-pointer ${
                  viewMode === "episode"
                    ? "bg-emerald-500 text-black font-semibold shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Full Episode JSON
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-8 gap-1.5 text-xs font-mono cursor-pointer border-slate-700 hover:border-emerald-500"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
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
          <div className="flex-1 overflow-y-auto rounded-lg border border-[#1b2332] bg-[#07090e] p-3 text-xs font-mono text-emerald-300/90 leading-relaxed">
            <pre className="whitespace-pre-wrap">{jsonString}</pre>
          </div>

          {/* Action Download Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#1a1f2c]">
            <p className="text-[11px] text-slate-400 font-mono">
              Schema version: {episode.schema_version} · RT-2 / Imitation Learning Ready
            </p>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => downloadEpisodeJson(episode)}
                className="gap-2 cursor-pointer flex-1 sm:flex-initial"
              >
                <Download className="w-4 h-4 text-sky-400" />
                Download episode.json
              </Button>

              <Button
                variant="why"
                size="sm"
                onClick={handleDownloadZip}
                className="gap-2 cursor-pointer flex-1 sm:flex-initial"
              >
                <Package className="w-4 h-4" />
                Training Bundle (.zip)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
