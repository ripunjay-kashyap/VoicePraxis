"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, ListChecks, Loader2, BookmarkPlus } from "lucide-react";
import { Episode, TemplateCheck, formatTimestamp } from "@/lib/episode";
import { TemplateSummary, checkEpisode, createTemplate, fetchTemplates } from "@/lib/api";
import { cn } from "@/lib/utils";

const SEVERITY = {
  ok: { icon: CheckCircle2, cls: "text-emerald-700", row: "" },
  gap: { icon: AlertTriangle, cls: "text-amber-700", row: "bg-amber-50/50" },
  problem: { icon: XCircle, cls: "text-red-700", row: "bg-red-50/50" },
  info: { icon: Info, cls: "text-sky-700", row: "" },
} as const;

interface TemplatePanelProps {
  episode: Episode;
  episodeId: string;
  onEpisodeUpdate: (episode: Episode) => void;
  onSeek: (time: number) => void;
}

/** TEMPLATES feature: checklist against a reference recording, plus "use as template". */
export function TemplatePanel({ episode, episodeId, onEpisodeUpdate, onSeek }: TemplatePanelProps) {
  const [templates, setTemplates] = React.useState<TemplateSummary[]>([]);
  const [selected, setSelected] = React.useState<string>("");
  const [busy, setBusy] = React.useState<"check" | "save" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saveName, setSaveName] = React.useState<string | null>(null);
  const [savedNote, setSavedNote] = React.useState<string | null>(null);
  const check: TemplateCheck | null = episode.template_check ?? null;

  const load = React.useCallback(() => {
    fetchTemplates().then((list) => {
      setTemplates(list);
      setSelected((cur) => cur || check?.template_id || list.find((t) => t.source_episode_id !== episodeId)?.id || "");
    });
  }, [check?.template_id, episodeId]);
  React.useEffect(load, [load]);

  const runCheck = async () => {
    if (!selected) return;
    setBusy("check");
    setError(null);
    const r = await checkEpisode(episodeId, selected);
    setBusy(null);
    if (r.ok && r.episode) onEpisodeUpdate(r.episode);
    else setError(r.detail || "The check failed. Try again.");
  };

  const saveAsTemplate = async () => {
    setBusy("save");
    setError(null);
    const r = await createTemplate(episodeId, saveName || episode.task.name);
    setBusy(null);
    if (r.ok) {
      setSaveName(null);
      setSavedNote(`Saved as template “${r.data?.name}”. New recordings can now be checked against it.`);
      load();
    } else setError(r.detail || "Couldn't save the template.");
  };

  const choices = templates.filter((t) => t.source_episode_id !== episodeId);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-slate-500" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {check ? `Checked against “${check.template_name}”` : "Check against a template"}
            </h3>
            <p className="text-xs text-slate-500">
              {check
                ? `${check.complete} of ${check.total} steps complete`
                : "Compare this recording with an expert's reference, step by step."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {choices.length > 0 && (
            <>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800"
                aria-label="Template"
              >
                <option value="" disabled>
                  Choose a template
                </option>
                {choices.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.steps} steps)
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={runCheck}
                disabled={!selected || busy !== null}
                className="h-8 px-3 rounded-md bg-slate-900 text-white text-xs font-medium disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {busy === "check" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {check ? "Check again" : "Check"}
              </button>
            </>
          )}
          {saveName === null ? (
            <button
              type="button"
              onClick={() => setSaveName(episode.task.name)}
              className="h-8 px-3 rounded-md border border-slate-200 text-xs text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <BookmarkPlus className="w-3.5 h-3.5" /> Use as template
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="h-8 w-48 rounded-md border border-slate-300 px-2 text-xs"
                aria-label="Template name"
                autoFocus
              />
              <button
                type="button"
                onClick={saveAsTemplate}
                disabled={busy !== null || !saveName.trim()}
                className="h-8 px-3 rounded-md bg-slate-900 text-white text-xs font-medium disabled:opacity-50 cursor-pointer"
              >
                {busy === "save" ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => setSaveName(null)} className="text-xs text-slate-500 px-1 cursor-pointer">
                Cancel
              </button>
            </span>
          )}
        </div>
      </header>

      {(error || savedNote) && (
        <p className={cn("px-4 py-2 text-xs border-b border-slate-200", error ? "text-red-700 bg-red-50" : "text-emerald-800 bg-emerald-50")}>
          {error || savedNote}
        </p>
      )}

      {check && (
        <ol className="divide-y divide-slate-100">
          {check.steps.map((s) => {
            const sev = SEVERITY[s.severity] ?? SEVERITY.info;
            const Icon = sev.icon;
            return (
              <li key={s.template_step_id} className={cn("flex items-start gap-3 px-4 py-2.5 text-sm", sev.row)}>
                <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", sev.cls)} />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-800">
                    <span className={cn("font-medium mr-1.5", sev.cls)}>{s.label}</span>
                    {!s.required && <span className="text-xs text-slate-400 mr-1.5">(optional)</span>}
                    {s.out_of_order && <span className="text-xs text-amber-700 mr-1.5">Out of order</span>}
                  </p>
                  <p className="text-xs text-slate-600 break-words">{s.message}</p>
                </div>
                {s.time !== null && (
                  <button
                    type="button"
                    onClick={() => onSeek(s.time as number)}
                    className="text-xs font-mono text-slate-500 hover:text-slate-900 cursor-pointer shrink-0"
                  >
                    {formatTimestamp(s.time)}
                  </button>
                )}
              </li>
            );
          })}
          {check.extras.length > 0 && (
            <li className="px-4 py-2.5 text-xs text-sky-800 bg-sky-50/40">
              <span className="font-medium">Not in the template:</span>{" "}
              {check.extras.map((e) => e.message.replace(/^Extra: /, "").replace(/\.$/, "")).join(" · ")}
            </li>
          )}
        </ol>
      )}

      {!check && choices.length === 0 && (
        <p className="px-4 py-3 text-xs text-slate-500">
          {templates.some((t) => t.source_episode_id === episodeId)
            ? `This recording is the reference for \u201c${templates.find((t) => t.source_episode_id === episodeId)?.name}\u201d. Open another recording to check it against this one.`
            : "No templates yet. Open an expert\u2019s recording and choose \u201cUse as template\u201d."}
        </p>
      )}
    </section>
  );
}
