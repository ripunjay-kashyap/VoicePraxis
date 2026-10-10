"use client";

import * as React from "react";
import { Mic, Sparkles, Layers } from "lucide-react";
import { EpisodeAction, EpisodeSubtask, formatTimestamp } from "@/lib/episode";
import { cn } from "@/lib/utils";

interface SubtaskStripProps {
  subtasks: EpisodeSubtask[];
  actions: EpisodeAction[];
  currentTime: number;
  selectedActionId: string | null;
  onSelectAction: (id: string) => void;
  onSeek: (time: number) => void;
}

/** Sub-intents: the task split into phases, each with its own said/guessed intent and its steps. */
export function SubtaskStrip({
  subtasks,
  actions,
  currentTime,
  selectedActionId,
  onSelectAction,
  onSeek,
}: SubtaskStripProps) {
  if (!subtasks.length) return null;
  const byId = new Map(actions.map((a) => [a.id, a]));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs uppercase font-medium tracking-wider text-slate-500">
        <Layers className="w-3.5 h-3.5" />
        Sub-intents · {subtasks.length} phases
      </div>
      <ol className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {subtasks.map((st, i) => {
          const active = currentTime >= st.start && currentTime < st.end;
          return (
            <li
              key={st.id}
              className={cn(
                "rounded-lg border p-3 space-y-2 transition-colors",
                active ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"
              )}
            >
              <button
                type="button"
                onClick={() => onSeek(st.start)}
                className="w-full text-left flex items-start justify-between gap-2 cursor-pointer"
              >
                <span className="text-sm font-semibold text-slate-900 leading-snug">
                  <span className="font-mono text-slate-500 mr-1.5">{i + 1}</span>
                  {st.goal}
                </span>
                <span className="font-mono text-[10px] text-slate-500 shrink-0 pt-0.5">
                  {formatTimestamp(st.start)}–{formatTimestamp(st.end)}
                </span>
              </button>

              {st.stated_intent ? (
                <p className="text-xs text-orange-700 flex gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-orange-700 shrink-0 mt-0.5" />
                  <span>&ldquo;{st.stated_intent.text}&rdquo;</span>
                </p>
              ) : st.inferred_intent ? (
                <p className="text-xs text-slate-500 flex gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <span>
                    <span className="font-mono text-[10px] uppercase text-slate-500 mr-1">Guess</span>
                    {st.inferred_intent}
                  </span>
                </p>
              ) : null}

              <div className="flex flex-wrap gap-1.5">
                {st.action_refs.map((id) => {
                  const a = byId.get(id);
                  if (!a) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        onSelectAction(id);
                        onSeek(a.start);
                      }}
                      className={cn(
                        "font-mono text-[10px] px-1.5 py-0.5 rounded border cursor-pointer",
                        selectedActionId === id
                          ? "border-sky-400 bg-sky-50 text-sky-800"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300",
                        a.stated_reason && "ring-1 ring-emerald-300"
                      )}
                      title={a.observed_action}
                    >
                      {a.verb ?? "step"} · {a.object ?? a.id}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
