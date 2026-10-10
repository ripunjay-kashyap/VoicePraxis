"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ListChecks, Plus, ChevronRight } from "lucide-react";
import { TemplateSummary, fetchTemplates } from "@/lib/api";

export default function TemplatesPage() {
  const [templates, setTemplates] = React.useState<TemplateSummary[] | null>(null);

  React.useEffect(() => {
    fetchTemplates().then(setTemplates);
  }, []);

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-6">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-900 inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Capture
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <div>
            <h1 className="text-base font-semibold text-slate-900">Template check</h1>
            <p className="text-xs text-slate-500">Record the right way once, then check every take against it.</p>
          </div>
        </div>
        <Link
          href="/templates/new"
          className="h-9 px-3 rounded-md bg-slate-900 text-white text-sm font-medium inline-flex items-center gap-1.5 hover:bg-slate-800"
        >
          <Plus className="w-4 h-4" /> New reference
        </Link>
      </header>

      {templates === null ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-3">
          <ListChecks className="w-8 h-8 mx-auto text-slate-400" />
          <p className="text-sm text-slate-700 font-medium">No references yet</p>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Record an expert doing the task while explaining each step. You confirm the steps, then any take can be
            checked against it.
          </p>
          <Link
            href="/templates/new"
            className="inline-flex h-9 px-4 rounded-md bg-slate-900 text-white text-sm font-medium items-center gap-1.5 hover:bg-slate-800"
          >
            <Plus className="w-4 h-4" /> New reference
          </Link>
        </div>
      ) : (
        <ul className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
          {templates.map((t) => (
            <li key={t.id}>
              <Link href={`/templates/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.steps} steps</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
