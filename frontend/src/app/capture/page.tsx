"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { uploadEpisode, isMockMode, UploadProgress, getApiBase, fetchSavedEpisodes, SavedEpisodeListItem } from "@/lib/api";
import { useFlags } from "@/lib/useFlags";
import { PageTitle } from "@/components/site/SiteHeader";
import { PhoneQr } from "@/components/landing/PhoneQr";
import { Camera, Upload, AlertCircle, ArrowRight, FileVideo, RotateCcw, X, ListChecks, PlayCircle } from "lucide-react";

// Backend limit: 200 MB and up to 90 seconds
const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024;

const TIPS = [
  { k: "Say “capture”", d: "when you’re ready. Anything before it, like adjusting the camera, is cut." },
  { k: "Talk as you go", d: "say what you’re doing and why: “I press it down so the clip releases.”" },
  { k: "Say “finish”", d: "when the task is done. Both words are optional." },
];

const formatFileSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

function CapturePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forceMock = isMockMode(searchParams.get("mock"));
  const flags = useFlags();

  const recordInputRef = React.useRef<HTMLInputElement>(null);
  const uploadInputRef = React.useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<UploadProgress | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [savedEpisode, setSavedEpisode] = React.useState<SavedEpisodeListItem | null>(null);
  const apiBase = getApiBase();

  React.useEffect(() => {
    fetchSavedEpisodes().then((list) => {
      if (list.length > 0) setSavedEpisode(list[0]);
    });
  }, []);

  const validateFile = (file: File): boolean => {
    setFileError(null);
    const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(file.name);
    if (!isVideo) {
      setFileError("That file isn’t a video. Choose an MP4, MOV or WebM clip.");
      return false;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(`That clip is ${formatFileSize(file.size)}. Keep clips under 90 seconds.`);
      return false;
    }
    return true;
  };

  const pick = (file?: File | null) => {
    if (file && validateFile(file)) setSelectedFile(file);
  };

  const startUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setFileError(null);
    setUploadProgress({ percent: 0, loaded: 0, total: selectedFile.size });
    try {
      const result = await uploadEpisode(selectedFile, setUploadProgress);
      // This page stays mounted in the background after navigating; leave it ready for the next recording.
      setIsUploading(false);
      setUploadProgress(null);
      setSelectedFile(null);
      router.push(`/e/${result.id}${forceMock ? "?mock=1" : ""}`);
    } catch (err: unknown) {
      setIsUploading(false);
      setFileError(err instanceof Error ? err.message : "Upload failed. Check the connection and try again.");
    }
  };

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <input ref={recordInputRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={uploadInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />

      <PageTitle
        title="New recording"
        subtitle="Record a task on this device, or upload a clip up to 90 seconds."
        actions={
          forceMock ? (
            <span className="text-xs rounded-full border border-amber-200 bg-amber-50 text-amber-800 px-2.5 py-1">Sample data</span>
          ) : !apiBase ? (
            <span className="text-xs rounded-full border border-red-200 bg-red-50 text-red-700 px-2.5 py-1">Service not connected</span>
          ) : null
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Capture */}
        <section className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            className={`m-4 sm:m-5 rounded-xl border-2 border-dashed px-5 py-10 sm:py-14 text-center transition-colors ${
              isDragging ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-slate-50/50"
            }`}
          >
            <div className="mx-auto w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
              <FileVideo className="w-6 h-6 text-slate-600" />
            </div>
            <p className="mt-4 text-base font-semibold text-slate-900">Record the task, or drop a video here</p>
            <p className="mt-1 text-sm text-slate-500">MP4, MOV or WebM · up to 90 seconds</p>
            <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => recordInputRef.current?.click()}
                disabled={isUploading}
                className="h-12 px-5 rounded-lg bg-slate-900 text-white font-medium inline-flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50 cursor-pointer sm:flex-1"
              >
                <Camera className="w-5 h-5" /> Record
              </button>
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                disabled={isUploading}
                className="h-12 px-5 rounded-lg border border-slate-200 bg-white text-slate-800 font-medium inline-flex items-center justify-center gap-2 hover:bg-slate-50 disabled:opacity-50 cursor-pointer sm:flex-1"
              >
                <Upload className="w-5 h-5 text-slate-500" /> Choose a file
              </button>
            </div>
          </div>

          {(selectedFile || fileError) && (
            <div className="border-t border-slate-200 px-4 sm:px-5 py-4 space-y-3">
              {selectedFile && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <FileVideo className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500">
                      {isUploading && uploadProgress
                        ? `Uploading · ${uploadProgress.percent}% of ${formatFileSize(uploadProgress.total)}`
                        : formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                  {!isUploading && (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="w-9 h-9 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center cursor-pointer"
                        aria-label="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={startUpload}
                        className="h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium inline-flex items-center gap-2 hover:bg-slate-800 cursor-pointer"
                      >
                        Analyse <ArrowRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
              {isUploading && uploadProgress && (
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-slate-900 transition-all" style={{ width: `${uploadProgress.percent}%` }} />
                </div>
              )}
              {fileError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800 flex items-start justify-between gap-3">
                  <span className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {fileError}
                  </span>
                  {selectedFile && (
                    <button type="button" onClick={startUpload} className="text-xs font-medium inline-flex items-center gap-1 shrink-0 cursor-pointer hover:underline">
                      <RotateCcw className="w-3 h-3" /> Try again
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Guidance */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">How to record</h2>
            <ol className="mt-4 space-y-4">
              {TIPS.map((t, i) => (
                <li key={t.k} className="flex gap-3">
                  <span className="w-6 h-6 shrink-0 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    <span className="font-semibold text-slate-900">{t.k}</span> {t.d}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {savedEpisode && (
            <Link
              href={`/e/${savedEpisode.id}`}
              className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300"
            >
              <PlayCircle className="w-9 h-9 text-slate-400 group-hover:text-slate-700 shrink-0" strokeWidth={1.5} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Open the example</p>
                <p className="text-xs text-slate-500 truncate">Saved episode · {savedEpisode.task}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 ml-auto" />
            </Link>
          )}

          {flags?.TEMPLATES && (
            <Link
              href="/templates"
              className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300"
            >
              <ListChecks className="w-9 h-9 text-slate-400 group-hover:text-slate-700 shrink-0" strokeWidth={1.5} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Check against a reference</p>
                <p className="text-xs text-slate-500">Find missed steps in a take</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 ml-auto" />
            </Link>
          )}

          <div className="hidden lg:block">
            <PhoneQr path="/capture" size={120} />
          </div>
        </aside>
      </div>
    </main>
  );
}

export default function CapturePage() {
  return (
    <React.Suspense fallback={<div className="flex-1" />}>
      <CapturePageContent />
    </React.Suspense>
  );
}
