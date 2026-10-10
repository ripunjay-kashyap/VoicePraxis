"use client";

import * as React from "react";
import { Eye, Mic, Link2, Play } from "lucide-react";
import { EpisodeAction, NarrationUtterance, formatTimestamp } from "@/lib/episode";
import { cn } from "@/lib/utils";

interface ScriptViewProps {
  actions: EpisodeAction[];
  narration: NarrationUtterance[];
  currentTime: number;
  selectedActionId: string | null;
  onSelectAction: (id: string) => void;
  onSeek: (time: number) => void;
  onPlayUtterance: (start: number, end: number) => void;
}

type Row =
  | { kind: "seen"; t: number; action: EpisodeAction }
  | { kind: "said"; t: number; utterance: NarrationUtterance };

/** Seen vs Said: what the video shows next to what the person said, in time order. */
export function ScriptView({
  actions,
  narration,
  currentTime,
  selectedActionId,
  onSelectAction,
  onSeek,
  onPlayUtterance,
}: ScriptViewProps) {
  // Which steps each utterance explains (its reason or intent links)
  const explains = new Map<string, string[]>();
  for (const a of actions) {
    const ref = a.stated_reason?.evidence_ref;
    if (ref) explains.set(ref, [...(explains.get(ref) ?? []), a.id]);
  }

  const rows: Row[] = [
    ...actions.map((a) => ({ kind: "seen" as const, t: a.start, action: a })),
    ...narration.map((u) => ({ kind: "said" as const, t: u.start, utterance: u })),
  ].sort((x, y) => x.t - y.t || (x.kind === "seen" ? -1 : 1));

  return (
    <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="grid grid-cols-[3.25rem_1fr_1fr] text-[11px] uppercase font-medium tracking-wider border-b border-slate-200 bg-white">
        <div className="px-2 py-2 text-slate-500">Time</div>
        <div className="px-3 py-2 text-sky-700 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" /> Seen · video
        </div>
        <div className="px-3 py-2 text-orange-700 flex items-center gap-1.5">
          <Mic className="w-3.5 h-3.5" /> Said · narration
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">No steps or narration in this episode.</p>
      ) : (
        <ol className="divide-y divide-slate-200 max-h-[28rem] overflow-y-auto">
          {rows.map((row) => {
            if (row.kind === "seen") {
              const a = row.action;
              const active = currentTime >= a.start && currentTime < a.end;
              return (
                <li
                  key={a.id}
                  className={cn(
                    "grid grid-cols-[3.25rem_1fr_1fr]",
                    active && "bg-sky-50",
                    selectedActionId === a.id && "outline outline-1 outline-sky-300 -outline-offset-1"
                  )}
                >
                  <span className="px-2 py-2.5 font-mono text-[11px] text-slate-500">{formatTimestamp(a.start)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectAction(a.id);
                      onSeek(a.start);
                    }}
                    className="px-3 py-2.5 text-left space-y-1 cursor-pointer"
                  >
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-sky-200 bg-sky-50 text-sky-700">
                      {a.verb ?? "step"} · {a.object ?? "?"}
                      {a.tool ? ` · ${a.tool}` : ""}
                    </span>
                    <span className="block text-xs text-slate-800 leading-snug">{a.observed_action}</span>
                  </button>
                  <span />
                </li>
              );
            }
            const u = row.utterance;
            const active = currentTime >= u.start && currentTime < u.end;
            const linked = explains.get(u.id) ?? [];
            return (
              <li key={u.id} className={cn("grid grid-cols-[3.25rem_1fr_1fr]", active && "bg-orange-50")}>
                <span className="px-2 py-2.5 font-mono text-[11px] text-slate-500">{formatTimestamp(u.start)}</span>
                <span />
                <button
                  type="button"
                  onClick={() => onPlayUtterance(u.start, u.end)}
                  className="px-3 py-2.5 text-left space-y-1 cursor-pointer group"
                  title="Play these words"
                >
                  <span className="block text-xs text-orange-800 leading-snug">
                    <Play className="inline w-3 h-3 mr-1 text-orange-700 group-hover:text-orange-700" />
                    &ldquo;{u.text}&rdquo;
                  </span>
                  {linked.length > 0 && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-700">
                      <Link2 className="w-3 h-3" /> why for {linked.join(", ")}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
