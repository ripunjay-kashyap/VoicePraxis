"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Eye, Mic, RotateCcw } from "lucide-react";
import { Episode, EpisodeAction, formatTimestamp, stepLabel } from "@/lib/episode";
import { cn } from "@/lib/utils";

interface SideBySideProps {
  withNarration: Episode;
  cameraOnly: Episode;
  onSeek: (time: number) => void;
}

interface Row {
  narr: EpisodeAction;
  cam: EpisodeAction | null;
  reasonOnlyFromNarration: boolean;
  actionDiffers: boolean;
}

function bestMatch(a: EpisodeAction, candidates: EpisodeAction[]): EpisodeAction | null {
  let best: EpisodeAction | null = null;
  let bestOverlap = 0;
  for (const c of candidates) {
    const overlap = Math.min(a.end, c.end) - Math.max(a.start, c.start);
    if (overlap > bestOverlap) {
      best = c;
      bestOverlap = overlap;
    }
  }
  return best;
}

/**
 * The same clip analysed twice by the same model and settings; only the audio differs.
 * Highlights are mechanical (a reason exists / the verb differs), never a judgement of who is right.
 */
export function SideBySide({ withNarration, cameraOnly, onSeek }: SideBySideProps) {
  const [runKey, setRunKey] = React.useState(0);

  const rows: Row[] = withNarration.actions.map((narr) => {
    const cam = bestMatch(narr, cameraOnly.actions);
    return {
      narr,
      cam,
      reasonOnlyFromNarration: Boolean(narr.stated_reason),
      actionDiffers: Boolean(cam && narr.verb && cam.verb && cam.verb !== narr.verb),
    };
  });
  const stated = rows.filter((r) => r.reasonOnlyFromNarration).length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden break-words">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Camera only vs with narration</h3>
          <p className="text-xs text-slate-500">Same model and settings. The only difference is the audio.</p>
        </div>
        <button
          type="button"
          onClick={() => setRunKey((k) => k + 1)}
          className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Replay
        </button>
      </header>

      {/* Column headings + each run's one-line summary */}
      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)] text-xs border-b border-slate-200 bg-slate-50">
        <div />
        <div className="px-3 py-2.5 border-l border-slate-200">
          <p className="flex items-center gap-1.5 font-medium text-slate-700">
            <Eye className="w-3.5 h-3.5" /> Camera only
          </p>
          <p className="text-slate-500 mt-0.5 leading-snug">{cameraOnly.task.summary}</p>
        </div>
        <div className="px-3 py-2.5 border-l border-slate-200">
          <p className="flex items-center gap-1.5 font-medium text-slate-700">
            <Mic className="w-3.5 h-3.5 text-orange-700" /> With narration
          </p>
          <p className="text-slate-500 mt-0.5 leading-snug">{withNarration.task.summary}</p>
        </div>
      </div>

      <ol key={runKey} className="divide-y divide-slate-100">
        {rows.map((row, i) => (
          <li
            key={row.narr.id}
            className={cn(
              "grid grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)] text-xs",
              row.reasonOnlyFromNarration && "bg-emerald-50/40"
            )}
          >
            <button
              type="button"
              onClick={() => onSeek(row.narr.start)}
              className="px-2 py-3 text-left text-slate-500 font-mono whitespace-nowrap cursor-pointer hover:text-slate-900"
              title="Play from here"
            >
              {formatTimestamp(row.narr.start)}
            </button>

            {/* Camera only: appears first */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 * i, duration: 0.3 }}
              className="px-3 py-3 border-l border-slate-200 space-y-1"
            >
              {row.cam ? (
                <>
                  <span
                    className={cn(
                      "inline-block px-1.5 py-0.5 rounded border",
                      row.actionDiffers ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700"
                    )}
                  >
                    {row.cam.verb} · {row.cam.object}
                  </span>
                  <p className="text-slate-500">
                    {row.cam.inferred_reason ? (
                      <>
                        <span className="text-slate-400">Guess: </span>
                        {row.cam.inferred_reason}
                      </>
                    ) : (
                      "No reason"
                    )}
                  </p>
                </>
              ) : (
                <p className="text-slate-400">Not detected</p>
              )}
            </motion.div>

            {/* With narration: appears after the camera column */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 * rows.length + 0.4 + 0.15 * i, duration: 0.3 }}
              className={cn(
                "px-3 py-3 border-l space-y-1",
                row.reasonOnlyFromNarration ? "border-emerald-500 border-l-2" : "border-slate-200"
              )}
            >
              <span className="inline-block px-1.5 py-0.5 rounded border border-sky-200 bg-sky-50 text-sky-800">
                {row.narr.verb} · {row.narr.object}
              </span>
              {row.narr.stated_reason ? (
                <p className="text-orange-800">&ldquo;{row.narr.stated_reason.text}&rdquo;</p>
              ) : row.narr.inferred_reason ? (
                <p className="text-slate-500">
                  <span className="text-slate-400">Guess: </span>
                  {row.narr.inferred_reason}
                </p>
              ) : (
                <p className="text-slate-400">No reason</p>
              )}
              {row.actionDiffers && (
                <p className="text-amber-700">Camera-only saw a different action ({row.cam?.verb})</p>
              )}
            </motion.div>
          </li>
        ))}
      </ol>

      <footer className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
        {stated} of {rows.length} steps have a reason the person actually said. Camera only can only guess.
        {rows.some((r) => r.actionDiffers) && (
          <span className="text-amber-700">
            {" "}
            It also read {rows.filter((r) => r.actionDiffers).length} step
            {rows.filter((r) => r.actionDiffers).length === 1 ? "" : "s"} differently (
            {rows.filter((r) => r.actionDiffers).map((r) => stepLabel(r.narr.id).toLowerCase()).join(", ")}).
          </span>
        )}
      </footer>
    </section>
  );
}
