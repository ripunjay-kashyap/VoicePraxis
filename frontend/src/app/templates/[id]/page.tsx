"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { PageTitle } from "@/components/site/SiteHeader";
import { VideoPicker } from "@/components/capture/VideoPicker";
import { TemplateDetail, deleteTemplate, fetchTemplate } from "@/lib/api";

/** A confirmed reference: its steps, and "record the same task" to check a take. */
function TemplateDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");
  const [template, setTemplate] = React.useState<TemplateDetail | null | undefined>(undefined);

  React.useEffect(() => {
    fetchTemplate(id).then(setTemplate);
  }, [id]);

  const remove = async () => {
    if (await deleteTemplate(id)) router.push("/templates");
  };

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <PageTitle
        back={{ href: "/templates", label: "Template check" }}
        title={template?.name ?? "Reference"}
        subtitle={template ? `${template.steps.length} steps · confirmed reference` : undefined}
        actions={
          template ? (
            <button
              type="button"
              onClick={remove}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:text-red-700 hover:border-red-200 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          ) : null
        }
      />

      {template === undefined && <p className="text-sm text-slate-500">Loading…</p>}
      {template === null && (
        <p className="text-sm text-slate-600">
          This template doesn&rsquo;t exist any more. <Link href="/templates" className="underline">Back to templates</Link>
        </p>
      )}

      {template && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4 shadow-sm">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Check a take</h2>
              <p className="text-sm text-slate-500">
                Record or upload the same task. Each reference step is checked: was it done, and was it said.
              </p>
            </div>
            <VideoPicker
              templateId={template.id}
              onUploaded={(episodeId) => router.push(`/e/${episodeId}?mode=check`)}
              recordLabel="Record the task"
              uploadLabel="Upload a take"
            />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <h2 className="px-4 sm:px-5 py-3 border-b border-slate-200 text-sm font-semibold text-slate-900">
              Reference steps ({template.steps.length})
            </h2>
            <ol className="divide-y divide-slate-100">
              {template.steps.map((st, i) => (
                <li key={st.id || i} className="px-4 sm:px-5 py-3 flex items-start gap-3">
                  <span className="text-xs text-slate-400 font-mono pt-0.5 w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900">
                      {st.instruction}
                      {!st.required && <span className="ml-2 text-xs text-slate-400">optional</span>}
                    </p>
                    {st.reference_reason && <p className="text-xs text-orange-700 mt-0.5">&ldquo;{st.reference_reason}&rdquo;</p>}
                  </div>
                  {st.verb && (
                    <span className="text-xs px-1.5 py-0.5 rounded border border-sky-200 bg-sky-50 text-sky-700 shrink-0">
                      {st.verb} · {st.object}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </main>
  );
}

export default function TemplateDetailPage() {
  return (
    <React.Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      <TemplateDetailContent />
    </React.Suspense>
  );
}
