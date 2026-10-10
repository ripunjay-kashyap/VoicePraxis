"use client";

import * as React from "react";
import { EpisodeAction, NarrationUtterance, formatTimestamp } from "@/lib/episode";
import { Mic } from "lucide-react";

interface ThreeLaneTimelineProps {
  duration: number;
  currentTime: number;
  actions: EpisodeAction[];
  narration: NarrationUtterance[];
  selectedActionId: string | null;
  onSelectAction: (actionId: string) => void;
  onSeek: (time: number) => void;
  onPlayUtterance: (start: number, end: number) => void;
}

export function ThreeLaneTimeline({
  duration,
  currentTime,
  actions,
  narration,
  selectedActionId,
  onSelectAction,
  onSeek,
  onPlayUtterance,
}: ThreeLaneTimelineProps) {
  const timelineRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const safeDuration = duration > 0 ? duration : 30;
  const playheadPercent = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));

  // Handle click or drag scrub on the timeline
  const handleSeekFromEvent = React.useCallback(
    (clientX: number) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const ratio = clickX / rect.width;
      const newTime = ratio * safeDuration;
      onSeek(newTime);

      // Auto-select the action covering this time
      const matchingAction = actions.find(
        (a) => newTime >= a.start && newTime <= a.end
      );
      if (matchingAction) {
        onSelectAction(matchingAction.id);
      }
    },
    [actions, onSeek, onSelectAction, safeDuration]
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleSeekFromEvent(e.clientX);
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleSeekFromEvent(e.clientX);
      }
    };
    const handleMouseUp = () => {
      if (isDragging) setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleSeekFromEvent]);

  // Generate ruler tick marks
  const tickInterval = safeDuration > 45 ? 10 : 5;
  const numTicks = Math.floor(safeDuration / tickInterval);
  const tickTimes = Array.from({ length: numTicks + 1 }, (_, i) => i * tickInterval);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm select-none space-y-3">
      {/* Header with lane indicators */}
      <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-200">
        <div className="flex items-center gap-4 text-xs font-mono font-medium">
          <span className="flex items-center gap-1.5 text-sky-700">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            Seen · steps from video
          </span>
          <span className="flex items-center gap-1.5 text-orange-700">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            Said · narration
          </span>
          <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Why · stated reasons
          </span>
        </div>

      </div>

      {/* Main Timeline Interactive Canvas Area */}
      <div
        ref={timelineRef}
        onMouseDown={handleMouseDown}
        className="relative cursor-pointer py-1 group/timeline"
      >
        {/* Ruler Tick Marks */}
        <div className="relative h-4 w-full border-b border-slate-200 mb-1.5">
          {tickTimes.map((t) => {
            const leftPct = (t / safeDuration) * 100;
            return (
              <div
                key={t}
                className="absolute top-0 flex flex-col items-center -translate-x-1/2"
                style={{ left: `${leftPct}%` }}
              >
                <div className="h-2 w-px bg-slate-200" />
                <span className="text-[11px] font-mono text-slate-500 mt-0.5">
                  {formatTimestamp(t)}
                </span>
              </div>
            );
          })}
        </div>

        {/* 1. SEEN Lane */}
        <div className="relative h-10 w-full bg-white rounded-md border border-slate-200 mb-1.5 overflow-hidden">
          <span className="absolute left-2 top-2 text-[11px] font-mono text-sky-700 uppercase tracking-wider font-bold pointer-events-none opacity-40">
            Seen
          </span>
          {actions.map((act) => {
            const leftPct = (act.start / safeDuration) * 100;
            const widthPct = Math.max(3, ((act.end - act.start) / safeDuration) * 100);
            const isSelected = act.id === selectedActionId;
            const isUnderPlayhead = currentTime >= act.start && currentTime <= act.end;

            return (
              <div
                key={act.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAction(act.id);
                  onSeek(act.start);
                }}
                className={`absolute top-1 bottom-1 rounded px-1.5 flex items-center justify-between text-[10px] font-mono truncate transition-all border cursor-pointer ${
                  isSelected
                    ? "bg-sky-500 border-sky-400 text-sky-800 ring-1 ring-sky-400 z-10"
                    : isUnderPlayhead
                    ? "bg-sky-500 border-sky-400 text-sky-800"
                    : "bg-sky-50 border-sky-200 text-sky-700 hover:border-sky-300 hover:bg-sky-50"
                }`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                title={`${act.id}: ${act.instruction} (${formatTimestamp(act.start)}–${formatTimestamp(act.end)})`}
              >
                <span className="truncate font-semibold">{act.instruction}</span>
                {act.attempt === "recovery" && (
                  <span className="text-[11px] bg-purple-50 text-purple-800 px-1 rounded ml-1 shrink-0">
                    ↻
                  </span>
                )}
                {act.outcome === "failed" && (
                  <span className="text-[11px] bg-red-50 text-red-800 px-1 rounded ml-1 shrink-0">
                    ✗
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* 2. SAID Lane */}
        <div className="relative h-8 w-full bg-white rounded-md border border-slate-200 mb-1.5 overflow-hidden">
          <span className="absolute left-2 top-1.5 text-[11px] font-mono text-orange-700 uppercase tracking-wider font-bold pointer-events-none opacity-40">
            Said
          </span>
          {narration.map((utt) => {
            const leftPct = (utt.start / safeDuration) * 100;
            const widthPct = Math.max(2, ((utt.end - utt.start) / safeDuration) * 100);
            const isPlayingUtterance = currentTime >= utt.start && currentTime <= utt.end;

            return (
              <div
                key={utt.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayUtterance(utt.start, utt.end);
                }}
                className={`absolute top-1 bottom-1 rounded-full px-2 flex items-center gap-1 text-[11px] font-mono truncate transition-all border cursor-pointer ${
                  isPlayingUtterance
                    ? "bg-orange-500 border-orange-400 text-orange-800 z-10"
                    : "bg-orange-50 border-orange-200 text-orange-700 hover:border-orange-300 hover:bg-orange-50"
                }`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                title={`Play speech [${utt.id}]: "${utt.text}"`}
              >
                <Mic className="w-2.5 h-2.5 shrink-0 text-orange-700" />
                <span className="truncate">{utt.text}</span>
              </div>
            );
          })}
        </div>

        {/* 3. WHY Lane (Hero reasoning dots) */}
        <div className="relative h-7 w-full bg-white rounded-md border border-emerald-200 overflow-hidden flex items-center">
          <span className="absolute left-2 text-[11px] font-mono text-emerald-700 uppercase tracking-wider font-bold pointer-events-none opacity-50">
            Why
          </span>
          {actions.map((act) => {
            if (!act.why_matters && !act.stated_reason && !act.inferred_reason) {
              return null;
            }
            const midPoint = (act.start + act.end) / 2;
            const leftPct = (midPoint / safeDuration) * 100;
            const isSelected = act.id === selectedActionId;

            return (
              <div
                key={`why-${act.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAction(act.id);
                  onSeek(act.start);
                }}
                className={`absolute -translate-x-1/2 flex items-center justify-center p-1 cursor-pointer group/dot ${
                  isSelected ? "z-20 scale-125" : "z-10 hover:scale-125"
                } transition-all`}
                style={{ left: `${leftPct}%` }}
                title={`Why Decision: ${act.stated_reason?.text || act.inferred_reason || "Key decision point"}`}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-emerald-300 flex items-center justify-center text-[11px] text-white font-bold">
                  ●
                </div>
              </div>
            );
          })}
        </div>

        {/* Vertical Playhead Scrub Needle */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 z-30 pointer-events-none transition-all"
          style={{ left: `${playheadPercent}%` }}
        >
          {/* Top scrubber thumb flag */}
          <div className="w-3 h-3 bg-emerald-400 border border-white rounded-sm -translate-x-1/2 -top-1 absolute rotate-45" />
        </div>
      </div>
    </div>
  );
}
