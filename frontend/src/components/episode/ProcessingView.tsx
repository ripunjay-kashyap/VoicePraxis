"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ProcessingStage } from "@/lib/episode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Eye,
  Film,
  UploadCloud,
  FileCheck2,
} from "lucide-react";

interface ProcessingStep {
  stage: ProcessingStage;
  label: string;
  description: string;
  icon: React.ElementType;
}

const ORDERED_STAGES: ProcessingStep[] = [
  {
    stage: "uploaded",
    label: "Clip Uploaded",
    description: "Multi-part video ingested and committed to storage",
    icon: UploadCloud,
  },
  {
    stage: "converting",
    label: "Converting Media",
    description: "Encoding H.264 MP4 with faststart for instant streaming",
    icon: Film,
  },
  {
    stage: "analysing",
    label: "Watching & Listening",
    description: "Gemini 3.8 Flash analyzing video frames and spoken audio in one multimodal pass",
    icon: Eye,
  },
  {
    stage: "linking",
    label: "Linking Intent & Reasons",
    description: "Synthesizing declared intent, action boundaries, and why-moments",
    icon: Sparkles,
  },
];

interface ProcessingViewProps {
  stage: ProcessingStage;
  error: string | null;
  episodeId: string;
}

export function ProcessingView({
  stage,
  error,
  episodeId,
}: ProcessingViewProps) {
  const router = useRouter();
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const getStageIndex = (s: ProcessingStage): number => {
    switch (s) {
      case "uploaded":
        return 0;
      case "converting":
        return 1;
      case "analysing":
        return 2;
      case "linking":
        return 3;
      case "ready":
        return 4;
      default:
        return 0;
    }
  };

  const currentIdx = getStageIndex(stage);
  const isFailed = stage === "failed";

  return (
    <div className="flex-1 flex flex-col items-center justify-center max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-6">
      <Card className="w-full border-[#1e2433] bg-[#11141d]/95 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        {!isFailed && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 via-emerald-500 to-orange-500 animate-pulse" />
        )}
        {isFailed && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
        )}

        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-2">
            {!isFailed ? (
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_16px_rgba(34,197,94,0.25)]">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shadow-[0_0_16px_rgba(239,68,68,0.25)]">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
            )}
          </div>

          <CardTitle className="text-lg">
            {!isFailed ? "Processing Episode" : "Processing Failed"}
          </CardTitle>
          <CardDescription className="font-mono text-xs text-slate-400">
            ID: {episodeId} · Elapsed:{" "}
            <span className="text-emerald-400 font-semibold">
              {formatElapsed(elapsedSeconds)}
            </span>{" "}
            (Target ~60s)
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          {/* Failed state message & actions */}
          {isFailed ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-red-800/80 bg-red-950/40 text-xs text-red-300 space-y-1">
                <p className="font-semibold text-red-200">Error Details:</p>
                <p className="font-mono">{error || "An unexpected error occurred during processing."}</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  variant="secondary"
                  className="flex-1 gap-2 cursor-pointer"
                  onClick={() => router.push("/")}
                >
                  <RotateCcw className="w-4 h-4" />
                  Try Again
                </Button>
                <Button
                  variant="why"
                  className="flex-1 gap-2 cursor-pointer"
                  onClick={() => router.push("/e/ep_20261010_container_001?mock=1")}
                >
                  <FileCheck2 className="w-4 h-4" />
                  Open Saved Episode
                </Button>
              </div>
            </div>
          ) : (
            /* Progress Stepper */
            <div className="space-y-3">
              {ORDERED_STAGES.map((step, idx) => {
                const StepIcon = step.icon;
                const isCompleted = currentIdx > idx;
                const isCurrent = currentIdx === idx;

                return (
                  <div
                    key={step.stage}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                      isCurrent
                        ? "border-emerald-500/60 bg-emerald-950/20 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                        : isCompleted
                        ? "border-[#1e2637] bg-[#0c0e14]/70"
                        : "border-[#151922] bg-[#090b10]/40 opacity-60"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isCompleted ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      ) : isCurrent ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-800/40 border border-slate-700/40 flex items-center justify-center text-slate-500">
                          <StepIcon className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p
                          className={`text-xs font-semibold ${
                            isCurrent
                              ? "text-emerald-300 font-mono"
                              : isCompleted
                              ? "text-slate-200 font-mono"
                              : "text-slate-400"
                          }`}
                        >
                          {step.label}
                        </p>
                        {isCurrent && (
                          <Badge variant="why" className="text-[10px] py-0 px-2 font-mono">
                            In progress
                          </Badge>
                        )}
                        {isCompleted && (
                          <span className="text-[10px] font-mono text-emerald-400">Done</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Fallback button during testing */}
          {!isFailed && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => router.push(`/e/${episodeId}?mock=1`)}
                className="text-[11px] text-slate-400 hover:text-emerald-400 underline font-mono cursor-pointer"
              >
                Switch to mock preview if waiting on server
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
