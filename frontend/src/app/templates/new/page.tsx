"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { PageTitle } from "@/components/site/SiteHeader";
import { VideoPicker } from "@/components/capture/VideoPicker";
import { ProcessingView } from "@/components/episode/ProcessingView";
import { ProcessingStage } from "@/lib/episode";
import { useEpisode } from "@/lib/useEpisode";
import { TemplateStep, createTemplate } from "@/lib/api";

/** New reference: ① record/upload ② processing ③ confirm the steps ④ save. */
export default function NewTemplatePage() {
  const router = useRouter();
  const [episodeId, setEpisodeId] = React.useState<string | null>(null);
  const polled = useEpisode(episodeId).episode;
  // Ignore a previous upload's data (the hook keeps its last value until the next poll).
  const episode = polled && episodeId && polled.episode_id === episodeId ? polled : null;
  const [draft, setDraft] = React.useState<{ name: string; steps: TemplateStep[] } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Until the user edits, the draft is the processed reference's steps.
  const ready = episode?.status.stage === "ready";
  const base =
    ready && episode
      ? {
          name: episode.task.name || "",
          steps: episode.actions.map((a) => ({
            instruction: a.instruction || a.observed_action,
            verb: a.verb ?? null,
            object: a.object ?? null,
            reference_reason: a.stated_reason?.text ?? null,
            required: true,
          })),
        }
      : null;
  const current = draft ?? base;
  const steps = current?.steps ?? null;
  const name = current?.name ?? "";
  const setName = (n: string) => current && setDraft({ ...current, name: n });
  const setSteps = (f: (s: TemplateStep[]) => TemplateStep[]) => current && setDraft({ ...current, steps: f(current.steps) });

  const update = (i: number, patch: Partial<TemplateStep>) =>
    setSteps((s) => s.map((st, j) => (j === i ? { ...st, ...patch } : st)));

  const startOver = () => {
    setEpisodeId(null);
    setDraft(null);
    setError(null);
  };

  const confirm = async () => {
    if (!episodeId || !steps) return;
    const clean = steps.filter((s) => s.instruction.trim());
    if (!clean.length) {
      setError("Keep at least one step.");
      return;
    }
    setSaving(true);
    setError(null);
    const r = await createTemplate(episodeId, name.trim() || "Reference", clean);
    setSaving(false);
    if (r.ok && r.data && typeof r.data.id === "string") {
      const id = r.data.id;
      startOver(); // this page stays alive in the background; leave it blank for the next reference
      router.push(`/templates/${id}`);
    }
    else setError(r.detail || "Couldn't save the reference.");
  };

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <PageTitle
        back={{ href: "/templates", label: "Template check" }}
        title="New reference"
        subtitle="The task done once, the right way. It becomes the checklist every take is compared with."
        actions={
          episodeId ? (
            <button
              type="button"
              onClick={startOver}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Start over
            </button>
          ) : null
        }
      />

      <ol className="flex items-center gap-2 sm:gap-3 text-sm">
        {["Upload", "Confirm the steps", "Check takes"].map((label, i) => {
          const at = !episodeId ? 0 : 1;
          const state = i < at ? "done" : i === at ? "active" : "todo";
          return (
            <li key={label} className="flex items-center gap-2 sm:gap-3">
              {i > 0 && <span className="w-6 sm:w-10 h-px bg-slate-300" />}
              <span
                className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center ${
                  state === "active" ? "bg-slate-900 text-white" : state === "done" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                {i + 1}
              </span>
              <span className={state === "active" ? "text-slate-900 font-medium" : "text-slate-500 hidden sm:inline"}>{label}</span>
            </li>
          );
        })}
      </ol>

      {!episodeId && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Upload the reference video</h2>
            <p className="text-sm text-slate-500 mt-1">
              Say each step out loud as you do it. Reference videos are never trimmed.
            </p>
          </div>
          <VideoPicker onUploaded={setEpisodeId} purpose="reference" allowRecord={false} uploadLabel="Upload the reference video" />
        </section>
      )}

      {episodeId && episode && episode.status.stage !== "ready" && (
        <ProcessingView stage={episode.status.stage as ProcessingStage} error={episode.status.error} episodeId={episodeId} />
      )}
      {episodeId && !episode && <p className="text-sm text-slate-500">Starting…</p>}

      {steps && (
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="p-4 sm:p-5 border-b border-slate-200 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Confirm the steps</h2>
              <p className="text-sm text-slate-500">
                Edit any step, mark optional ones, remove what doesn&rsquo;t belong. The reason the expert said is kept
                as the reference reason.
              </p>
            </div>
            <label className="block text-sm">
              <span className="text-slate-600">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full h-9 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="e.g. Open the container (reference)"
              />
            </label>
          </div>

          <ol className="divide-y divide-slate-100">
            {steps.map((st, i) => (
              <li key={i} className="px-4 sm:px-5 py-3 flex items-start gap-3">
                <span className="text-xs text-slate-400 font-mono pt-2.5 w-5">{i + 1}</span>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <input
                    value={st.instruction}
                    onChange={(e) => update(i, { instruction: e.target.value })}
                    className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm"
                    aria-label={`Step ${i + 1}`}
                  />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    {st.verb && (
                      <span className="px-1.5 py-0.5 rounded border border-sky-200 bg-sky-50 text-sky-700">
                        {st.verb} · {st.object}
                      </span>
                    )}
                    {st.reference_reason ? (
                      <span className="text-orange-700">Reason: &ldquo;{st.reference_reason}&rdquo;</span>
                    ) : (
                      <span>No reason was said for this step</span>
                    )}
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 pt-2.5 shrink-0 cursor-pointer">
                  <input type="checkbox" checked={st.required} onChange={(e) => update(i, { required: e.target.checked })} />
                  Required
                </label>
                <button
                  type="button"
                  onClick={() => setSteps((s) => s.filter((_, j) => j !== i))}
                  className="pt-2 text-slate-400 hover:text-red-600 cursor-pointer"
                  aria-label={`Remove step ${i + 1}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ol>

          <div className="p-4 sm:p-5 border-t border-slate-200 flex items-center justify-between gap-3">
            <p className="text-xs text-red-700">{error}</p>
            <button
              type="button"
              onClick={confirm}
              disabled={saving}
              className="h-10 px-5 rounded-lg bg-slate-900 text-white text-sm font-medium inline-flex items-center gap-2 hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Confirm template
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
