"use client";

import * as React from "react";
import Link from "next/link";
import { ListChecks, Plus, ChevronRight, Upload, ClipboardCheck, Video } from "lucide-react";
import { TemplateSummary, fetchTemplates } from "@/lib/api";
import { PageTitle } from "@/components/site/SiteHeader";

const HOW = [
  { icon: Upload, t: "Upload the reference", d: "The task done once, the right way, with each step said out loud." },
  { icon: ClipboardCheck, t: "Confirm the steps", d: "Edit, remove or mark steps optional. This becomes the checklist." },
  { icon: Video, t: "Check any take", d: "Record or upload a take. Missed and out-of-order steps are flagged." },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = React.useState<TemplateSummary[] | null>(null);

  React.useEffect(() => {
    fetchTemplates().then(setTemplates);
  }, []);

  const newButton = (
    <Link
      href="/templates/new"
      className="h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium inline-flex items-center gap-1.5 hover:bg-slate-800"
    >
      <Plus className="w-4 h-4" /> New reference
    </Link>
  );

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <PageTitle
        title="Template check"
        subtitle="Record the right way once, then check every take against it."
        actions={newButton}
      />

      <ol className="grid sm:grid-cols-3 gap-3">
        {HOW.map((h, i) => (
          <li key={h.t} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <h.icon className="w-4 h-4 text-slate-500" /> Step {i + 1}
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">{h.t}</p>
            <p className="mt-1 text-sm text-slate-500 leading-relaxed">{h.d}</p>
          </li>
        ))}
      </ol>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">References</h2>
        {templates === null ? (
          <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
            {[0, 1].map((i) => (
              <div key={i} className="px-5 py-4 space-y-2">
                <div className="h-3.5 w-48 rounded bg-slate-100 animate-pulse" />
                <div className="h-3 w-20 rounded bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-3">
            <ListChecks className="w-8 h-8 mx-auto text-slate-400" />
            <p className="text-sm text-slate-900 font-semibold">No references yet</p>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Upload a video of an expert doing the task while explaining each step. You confirm the steps, then any
              take can be checked against it.
            </p>
            <div className="pt-1">{newButton}</div>
          </div>
        ) : (
          <ul className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden shadow-sm">
            {templates.map((t) => (
              <li key={t.id}>
                <Link href={`/templates/${t.id}`} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <ListChecks className="w-4 h-4 text-slate-600" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.steps} steps</p>
                    </div>
                  </div>
                  <span className="text-sm text-slate-500 inline-flex items-center gap-1 shrink-0">
                    Check a take <ChevronRight className="w-4 h-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
