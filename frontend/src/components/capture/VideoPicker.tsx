"use client";

import * as React from "react";
import { Camera, Upload, Loader2 } from "lucide-react";
import { uploadEpisode } from "@/lib/api";

interface VideoPickerProps {
  /** Called with the new episode id once the upload is accepted */
  onUploaded: (episodeId: string) => void;
  templateId?: string | null;
  /** "reference" recordings are never cut by the capture/finish keywords */
  purpose?: "reference" | "take";
  recordLabel?: string;
  uploadLabel?: string;
  /** false = upload only (e.g. references, recorded and checked beforehand) */
  allowRecord?: boolean;
}

const MAX_BYTES = 200 * 1024 * 1024;

/** Record with the device camera or upload a clip; shows progress and readable errors. */
export function VideoPicker({
  onUploaded,
  templateId,
  purpose,
  recordLabel = "Record",
  uploadLabel = "Upload a video",
  allowRecord = true,
}: VideoPickerProps) {
  const recordRef = React.useRef<HTMLInputElement>(null);
  const uploadRef = React.useRef<HTMLInputElement>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [lastFile, setLastFile] = React.useState<File | null>(null);

  const send = async (file: File) => {
    setError(null);
    setLastFile(file);
    if (
      !file.type.startsWith("video/") &&
      !/\.(mov|mp4|m4v|webm|3gp|mkv)$/i.test(file.name)
    ) {
      setError("That file isn't a video. Record or choose a video clip.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That clip is too large. Keep clips under 90 seconds.");
      return;
    }
    setProgress(0);
    try {
      const r = await uploadEpisode(
        file,
        (p) => setProgress(p.percent),
        templateId || null,
        purpose,
      );
      onUploaded(r.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      const detail = msg.match(/"detail":"([^"]+)"/)?.[1];
      setError(detail || "Upload failed. Check the connection and try again.");
      setProgress(null);
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) send(f);
  };

  if (progress !== null && !error) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
        <p className="text-sm text-slate-700 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-slate-500" /> Uploading{" "}
          {lastFile?.name}
        </p>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-slate-900 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className={
          allowRecord
            ? "grid grid-cols-1 sm:grid-cols-2 gap-3"
            : "grid grid-cols-1 gap-3"
        }
      >
        {allowRecord && (
          <button
            type="button"
            onClick={() => recordRef.current?.click()}
            className="h-16 rounded-xl bg-slate-900 text-white font-semibold flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-800"
          >
            <Camera className="w-5 h-5" /> {recordLabel}
          </button>
        )}
        <button
          type="button"
          onClick={() => uploadRef.current?.click()}
          className={
            allowRecord
              ? "h-16 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-50"
              : "h-16 rounded-xl bg-slate-900 text-white font-semibold flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-800"
          }
        >
          <Upload className="w-5 h-5 text-slate-500" /> {uploadLabel}
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
          <span>{error}</span>
          {lastFile && (
            <button
              type="button"
              onClick={() => send(lastFile)}
              className="text-xs underline cursor-pointer shrink-0"
            >
              Try again
            </button>
          )}
        </p>
      )}
      <input
        ref={recordRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />
      <input
        ref={uploadRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={onPick}
      />
    </div>
  );
}
