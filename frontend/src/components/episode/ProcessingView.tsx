"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ProcessingStage } from "@/lib/episode";
import { Button } from "@/components/ui/button";
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

  const progress = isFailed ? 0 : Math.round((Math.min(currentIdx, visibleStages.length) / visibleStages.length) * 100);

  return (
    <div className="flex-1 flex flex-col items-center justify-center max-w-xl w-full mx-auto px-4 sm:px-6 py-10">
      <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="h-1 bg-slate-100">
          <div
            className={`h-full transition-all duration-700 ${isFailed ? "bg-red-500 w-full" : "bg-slate-900"}`}
            style={isFailed ? undefined : { width: `${Math.max(progress, 6)}%` }}
          />
        </div>

        <div className="px-6 pt-6 pb-4 text-center">
          <div className="flex justify-center mb-3">
            {!isFailed ? (
              <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-slate-700" />
              </div>
            ) : (
              <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
            )}
          </div>
          <h2 className="text-lg font-semibold text-slate-900">
            {!isFailed ? "Analysing your recording" : "We couldn\u2019t process this recording"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {!isFailed ? `${formatElapsed(elapsedSeconds)} elapsed \u00b7 usually under a minute` : "Try again, or open the saved example."}
          </p>
        </div>

        <div className="px-4 sm:px-6 pb-6">
          {isFailed ? (
            <div className="space-y-4">
              {error && (
                <p className="p-3.5 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800">{error}</p>
              )}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="secondary" className="flex-1 gap-2 cursor-pointer" onClick={() => router.push("/capture")}>
                  <RotateCcw className="w-4 h-4" />
                  Try again
                </Button>
                <Button className="flex-1 gap-2 cursor-pointer" onClick={() => router.push("/e/saved-example-01")}>
                  <FileCheck2 className="w-4 h-4" />
                  Open the example
                </Button>
              </div>
            </div>
          ) : (
            <ol className="space-y-1">
              {visibleStages.map((step, idx) => {
                const StepIcon = step.icon;
                const isCompleted = currentIdx > idx;
                const isCurrent = currentIdx === idx;
                return (
                  <li
                    key={step.stage}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isCurrent ? "bg-slate-50" : ""}`}
                  >
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${
                        isCompleted
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : isCurrent
                            ? "bg-white border-slate-900 text-slate-900"
                            : "bg-white border-slate-200 text-slate-400"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : isCurrent ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <StepIcon className="w-3.5 h-3.5" />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${isCurrent ? "font-semibold text-slate-900" : isCompleted ? "text-slate-700" : "text-slate-400"}`}>
                        {step.label}
                      </p>
                      {isCurrent && <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>}
                    </div>
                    {isCompleted && <span className="text-xs text-slate-400">Done</span>}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
