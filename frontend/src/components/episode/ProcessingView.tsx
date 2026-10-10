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
  Mic,
  ListChecks,
  Scissors,
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
    label: "Uploaded",
    description: "Your video is safely stored",
    icon: UploadCloud,
  },
  {
    stage: "converting",
    label: "Preparing video",
    description: "Preparing the video for playback",
    icon: Film,
  },
  {
    stage: "listening",
    label: "Listening",
    description: "Transcribing what the person says",
    icon: Mic,
  },
  {
    stage: "trimming",
    label: "Keeping the task",
    description: "Cutting to the part between \u201ccapture\u201d and \u201cfinish\u201d",
    icon: Scissors,
  },
  {
    stage: "analysing",
    label: "Watching",
    description: "Finding the steps, sub-goals and reasons",
    icon: Eye,
  },
  {
    stage: "linking",
    label: "Linking reasons",
    description: "Connecting each reason to its step",
    icon: Sparkles,
  },
  {
    stage: "checking",
    label: "Checking against template",
    description: "Comparing with the expert's reference, step by step",
    icon: ListChecks,
  },
];

const OPTIONAL_STAGES: ProcessingStage[] = ["trimming", "checking"];

interface ProcessingViewProps {
  stage: ProcessingStage;
  error: string | null;
  episodeId: string;
}

export function ProcessingView({
  stage,
  error,
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

  // Position in the ordered list; "ready" is past the end, unknown stages count as the first.
  // Optional stages only appear while they run; numbering uses the same visible list.
  const visibleStages = ORDERED_STAGES.filter((s) => !OPTIONAL_STAGES.includes(s.stage) || s.stage === stage);
  const getStageIndex = (s: ProcessingStage): number => {
    if (s === "ready") return visibleStages.length;
    const i = visibleStages.findIndex((st) => st.stage === s);
    return i === -1 ? 0 : i;
  };

  const currentIdx = getStageIndex(stage);
  const isFailed = stage === "failed";

  return (
    <div className="flex-1 flex flex-col items-center justify-center max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-6">
      <Card className="w-full border-slate-200 bg-white shadow-sm relative overflow-hidden">
        {/* Glow accent */}
        {!isFailed && (
          <div className="absolute top-0 left-0 right-0 h-1     animate-pulse" />
        )}
        {isFailed && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
        )}

        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-2">
            {!isFailed ? (
              <div className="w-12 h-12 rounded-xl bg-emerald-500 border border-emerald-300 flex items-center justify-center text-emerald-700">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-red-500 border border-red-300 flex items-center justify-center text-red-700">
                <AlertTriangle className="w-6 h-6 text-red-700" />
              </div>
            )}
          </div>

          <CardTitle className="text-lg">
            {!isFailed ? "Analysing your recording" : "Processing Failed"}
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            {formatElapsed(elapsedSeconds)} elapsed · usually under a minute
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          {/* Failed state message & actions */}
          {isFailed ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 space-y-1">
                <p className="font-semibold text-red-800">Error Details:</p>
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
                  onClick={() => router.push("/e/saved-example-01")}
                >
                  <FileCheck2 className="w-4 h-4" />
                  Open Saved Episode
                </Button>
              </div>
            </div>
          ) : (
            /* Progress Stepper */
            <div className="space-y-3">
              {visibleStages.map((step, idx) => {
                const StepIcon = step.icon;
                const isCompleted = currentIdx > idx;
                const isCurrent = currentIdx === idx;

                return (
                  <div
                    key={step.stage}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                      isCurrent
                        ? "border-emerald-300 bg-emerald-50"
                        : isCompleted
                        ? "border-slate-200 bg-white"
                        : "border-slate-200 bg-white opacity-60"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isCompleted ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-500 border border-emerald-300 flex items-center justify-center text-emerald-700">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      ) : isCurrent ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-500 border border-emerald-400 flex items-center justify-center text-emerald-700 animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                          <StepIcon className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p
                          className={`text-xs font-semibold ${
                            isCurrent
                              ? "text-emerald-700 font-mono"
                              : isCompleted
                              ? "text-slate-800 font-mono"
                              : "text-slate-500"
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
                          <span className="text-[10px] font-mono text-emerald-700">Done</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
