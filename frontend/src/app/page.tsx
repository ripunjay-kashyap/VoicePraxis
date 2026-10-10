"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { uploadEpisode, isMockMode, UploadProgress, getApiBase } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Camera,
  Upload,
  AlertCircle,
  Sparkles,
  ArrowRight,
  FileVideo,
  Cpu,
} from "lucide-react";

const MAX_FILE_SIZE_BYTES = 250 * 1024 * 1024; // 250 MB max limit

function CapturePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forceMock = isMockMode(searchParams.get("mock"));

  const recordInputRef = React.useRef<HTMLInputElement>(null);
  const uploadInputRef = React.useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<UploadProgress | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const apiBase = getApiBase();

  // Validate selected file (mime type and size)
  const validateFile = (file: File): boolean => {
    setFileError(null);

    const isVideoType =
      file.type.startsWith("video/") ||
      /\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(file.name);

    if (!isVideoType) {
      setFileError("Please select a valid video file (.mp4, .mov, or .webm).");
      return false;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setFileError(`File is too large (${sizeMb} MB). Maximum allowed size is 250 MB.`);
      return false;
    }

    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      setSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && validateFile(file)) {
      setSelectedFile(file);
    }
  };

  const startUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setFileError(null);
    setUploadProgress({ percent: 0, loaded: 0, total: selectedFile.size });

    try {
      const result = await uploadEpisode(selectedFile, (progress) => {
        setUploadProgress(progress);
      });

      // Navigate to the episode page
      const mockQuery = forceMock || !apiBase ? "?mock=1" : "";
      router.push(`/e/${result.id}${mockQuery}`);
    } catch (err: unknown) {
      setIsUploading(false);
      const errorMessage =
        err instanceof Error ? err.message : "Upload failed. Please try again.";
      setFileError(errorMessage);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <main className="flex-1 flex flex-col justify-between max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8">
      {/* Hidden file inputs: one with capture="environment" for phone camera, one standard */}
      <input
        ref={recordInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#1b212f] pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold text-sm shadow-[0_0_12px_rgba(34,197,94,0.2)]">
            VP
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              VoicePraxis
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                v0.2
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Robotic task capture · Multimodal intent &amp; why-reasoning
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {apiBase ? (
            <Badge variant="outline" className="text-[11px] gap-1.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              API Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[11px] gap-1.5 py-1 text-orange-400 border-orange-900/60 bg-orange-950/20">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              Mock Mode (?mock=1)
            </Badge>
          )}
        </div>
      </header>

      {/* Hero Guidance Card */}
      <div className="mb-6 rounded-xl border border-[#202738] bg-gradient-to-r from-[#121622] via-[#0f141f] to-[#121622] p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-emerald-400">
              <Sparkles className="w-3.5 h-3.5" />
              Performer Prompt Card
            </div>
            <p className="text-sm font-medium text-slate-200">
              &ldquo;Do any small task with these. Talk as you go: what you&rsquo;re doing and why.&rdquo;
            </p>
            <p className="text-xs text-slate-400">
              Say the intent before you start, narrate decisions while acting, and explain recoveries.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-2 text-[11px] font-mono">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-sky-950/80 text-sky-300 border border-sky-800/60">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              Seen (Actions)
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-orange-950/80 text-orange-300 border border-orange-800/60">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              Said (Words)
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-600/60 shadow-[0_0_8px_rgba(34,197,94,0.25)] font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Why (Reason)
            </span>
          </div>
        </div>
      </div>

      {/* Main Capture Zone */}
      <Card className="border-[#1e2433] bg-[#11141d]/95 shadow-2xl relative overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Video Capture &amp; Ingest</span>
            <span className="text-xs font-mono text-slate-400 font-normal">
              Target: 25–35 s @ 1080p
            </span>
          </CardTitle>
          <CardDescription>
            Record directly from your phone camera or select a pre-recorded demonstration clip.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {/* Action buttons (Record vs Upload) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              type="button"
              variant="why"
              size="lg"
              className="h-16 flex-col items-center justify-center gap-1 rounded-xl cursor-pointer"
              onClick={() => recordInputRef.current?.click()}
              disabled={isUploading}
            >
              <div className="flex items-center gap-2 text-sm font-bold">
                <Camera className="w-5 h-5" />
                Record Demonstration
              </div>
              <span className="text-[11px] font-normal text-emerald-950">
                Opens phone camera directly (environment)
              </span>
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="h-16 flex-col items-center justify-center gap-1 rounded-xl border-[#2a3449] hover:border-[#3d4b68] cursor-pointer"
              onClick={() => uploadInputRef.current?.click()}
              disabled={isUploading}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Upload className="w-5 h-5 text-sky-400" />
                Upload Existing Clip
              </div>
              <span className="text-[11px] font-normal text-slate-400">
                Browse MP4 or MOV files from library
              </span>
            </Button>
          </div>

          {/* Drag & drop dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-all ${
              isDragging
                ? "border-emerald-500 bg-emerald-950/20 shadow-[0_0_20px_rgba(34,197,94,0.15)]"
                : "border-[#22293a] bg-[#0c0e14]/60 hover:border-[#2f3950]"
            }`}
          >
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-300 mb-3">
              <FileVideo className="w-6 h-6 text-sky-400" />
            </div>
            <p className="text-sm font-medium text-slate-200 mb-1">
              {selectedFile ? selectedFile.name : "Drop demonstration video here"}
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {selectedFile ? (
                <span className="text-emerald-400 font-mono font-medium">
                  {formatFileSize(selectedFile.size)} · Ready to ingest
                </span>
              ) : (
                "Compatible with iPhone MOV, Android MP4, and WebM up to 250 MB"
              )}
            </p>
          </div>

          {/* Error alert */}
          {fileError && (
            <div className="rounded-lg border border-red-800/80 bg-red-950/40 p-3 text-xs text-red-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-200">Upload Issue</p>
                <p>{fileError}</p>
              </div>
            </div>
          )}

          {/* Upload Progress Indicator */}
          {isUploading && uploadProgress && (
            <div className="space-y-2 rounded-xl border border-[#232b3d] bg-[#0d1017] p-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-slate-200 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Uploading with XHR progress...
                </span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {uploadProgress.percent}%
                </span>
              </div>
              <Progress value={uploadProgress.percent} />
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>{formatFileSize(uploadProgress.loaded)}</span>
                <span>{formatFileSize(uploadProgress.total)}</span>
              </div>
            </div>
          )}

          {/* Upload confirmation action */}
          {selectedFile && !isUploading && (
            <div className="pt-2 flex items-center justify-between border-t border-[#1a1f2c]">
              <div className="text-xs text-slate-400">
                File: <span className="font-mono text-slate-200">{selectedFile.name}</span> (
                {formatFileSize(selectedFile.size)})
              </div>
              <Button
                type="button"
                variant="why"
                onClick={startUpload}
                className="gap-2"
              >
                Ingest &amp; Analyze
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Access Mock Shell & Links */}
      <footer className="mt-8 pt-4 border-t border-[#1b212f] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-slate-400" />
          <span>Gemini 3.8 Flash Multimodal Engine</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/e/ep_20261010_container_001?mock=1")}
            className="text-emerald-400 hover:text-emerald-300 underline font-mono cursor-pointer flex items-center gap-1"
          >
            <span>View Reference Container Episode (Mock)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>
    </main>
  );
}

export default function Page() {
  return (
    <React.Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-[60vh] text-slate-400 font-mono text-sm">
          Loading capture...
        </div>
      }
    >
      <CapturePageContent />
    </React.Suspense>
  );
}
