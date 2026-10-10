"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  uploadEpisode,
  isMockMode,
  UploadProgress,
  getApiBase,
  fetchSavedEpisodes,
  SavedEpisodeListItem,
} from "@/lib/api";
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
  QrCode,
  FileCheck2,
  Smartphone,
  RotateCcw,
} from "lucide-react";

// Backend limit: 200 MB and up to 90 seconds (P0.5)
const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024;

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
  const [savedEpisode, setSavedEpisode] = React.useState<SavedEpisodeListItem | null>(null);

  const [currentUrl] = React.useState<string>(() => {
    return typeof window !== "undefined" ? window.location.href : "https://voicepraxis.vercel.app";
  });

  const apiBase = getApiBase();

  // Load real saved episode from server (P0.3)
  React.useEffect(() => {
    fetchSavedEpisodes().then((list) => {
      if (list && list.length > 0) {
        setSavedEpisode(list[0]);
      }
    });
  }, []);

  // Validate selected file (mime type and size)
  const validateFile = (file: File): boolean => {
    setFileError(null);

    const isVideoType =
      file.type.startsWith("video/") ||
      /\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(file.name);

    if (!isVideoType) {
      setFileError("Invalid video format. Please select an MP4, MOV, or WebM file.");
      return false;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setFileError(`File exceeds limit (${sizeMb} MB). Maximum size is 200 MB (up to 90 s).`);
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
      const mockQuery = forceMock ? "?mock=1" : "";
      router.push(`/e/${result.id}${mockQuery}`);
    } catch (err: unknown) {
      setIsUploading(false);
      // Keep selectedFile so user can retry directly
      const errorMessage =
        err instanceof Error ? err.message : "Upload failed. Please check network and try again.";
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
    <main className="flex-1 flex flex-col justify-between max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
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
      <header className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white font-semibold text-sm">
            VP
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 flex items-center gap-2">
              VoicePraxis
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200">
                MVP
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Task-level annotation from narrated video
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {forceMock ? (
            <Badge variant="outline" className="text-[11px] gap-1.5 py-1 text-orange-700 border-orange-200 bg-orange-50 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              Mock data
            </Badge>
          ) : apiBase ? (
            <Badge variant="outline" className="text-[11px] gap-1.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              API Connected
            </Badge>
          ) : (
            <Badge variant="missed" className="text-[11px] gap-1.5 py-1">
              Backend Not Configured
            </Badge>
          )}
        </div>
      </header>

      {/* Hero Guidance Card & Saved Episode Link */}
      <div className="rounded-xl border border-slate-200     p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs uppercase font-medium tracking-wider text-emerald-700">
              <Sparkles className="w-3.5 h-3.5" />
              How to record
            </div>
            <p className="text-sm font-medium text-slate-800">
              &ldquo;Do any small task with these. Talk as you go: what you&rsquo;re doing and why.&rdquo;
            </p>
            <p className="text-xs text-slate-500">
              State intent before starting, explain decisions while acting, and narrate recoveries.
            </p>
          </div>

          {/* Real Saved Episode Link (P0.3) */}
          {savedEpisode && (
            <button
              type="button"
              onClick={() => router.push(`/e/${savedEpisode.id}`)}
              className="shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200 hover:bg-emerald-50 text-emerald-700 transition-all cursor-pointer text-xs font-mono"
            >
              <FileCheck2 className="w-4 h-4 text-emerald-700" />
              <div className="text-left">
                <div className="font-semibold text-emerald-800">{savedEpisode.label}</div>
                <div className="text-[10px] text-emerald-700">Task: {savedEpisode.task}</div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Capture Area + Desktop QR Code */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Big Record & Upload Actions */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="border-slate-200 bg-white shadow-sm relative overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>New recording</span>
                <span className="text-xs font-mono text-slate-500 font-normal">
                  Target: 25–35 s (up to 90 s) · Max 200 MB
                </span>
              </CardTitle>
              <CardDescription>
                Record live using your smartphone or upload a pre-recorded demonstration video.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pt-2">
              {/* Big Record and Upload Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Button
                  type="button"
                  variant="why"
                  size="lg"
                  className="h-20 flex-col items-center justify-center gap-1.5 rounded-xl cursor-pointer"
                  onClick={() => recordInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <div className="flex items-center gap-2 text-base font-bold">
                    <Camera className="w-5 h-5" />
                    Record a task
                  </div>
                  <span className="text-xs font-normal text-slate-300">
                    Opens the phone camera
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="h-20 flex-col items-center justify-center gap-1.5 rounded-xl border-slate-200 hover:border-slate-200 cursor-pointer"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <div className="flex items-center gap-2 text-base font-semibold text-slate-800">
                    <Upload className="w-5 h-5 text-sky-700" />
                    Upload Video File
                  </div>
                  <span className="text-[11px] font-normal text-slate-500">
                    Browse MP4 / MOV from local library
                  </span>
                </Button>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-all ${
                  isDragging
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-white hover:border-slate-200"
                }`}
              >
                <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 mb-3">
                  <FileVideo className="w-6 h-6 text-sky-700" />
                </div>
                <p className="text-sm font-medium text-slate-800 mb-1">
                  {selectedFile ? selectedFile.name : "Drag & drop video clip here"}
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {selectedFile ? (
                    <span className="text-emerald-700 font-mono font-medium">
                      {formatFileSize(selectedFile.size)} · Ready to upload
                    </span>
                  ) : (
                    "Supports iPhone MOV, Android MP4, and WebM (up to 200 MB, up to 90 s)"
                  )}
                </p>
              </div>

              {/* Validation Error Message */}
              {fileError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-800">Upload Issue</p>
                      <p>{fileError}</p>
                    </div>
                  </div>
                  {selectedFile && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={startUpload}
                      className="shrink-0 h-7 text-xs gap-1 border-red-200 bg-red-50 text-red-800 hover:bg-red-50 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Retry
                    </Button>
                  )}
                </div>
              )}

              {/* Upload Progress Bar with XHR Progress */}
              {isUploading && uploadProgress && (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-800 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Uploading demonstration clip...
                    </span>
                    <span className="font-mono text-emerald-700 font-semibold">
                      {uploadProgress.percent}%
                    </span>
                  </div>
                  <Progress value={uploadProgress.percent} />
                  <div className="flex justify-between text-[11px] font-mono text-slate-500">
                    <span>{formatFileSize(uploadProgress.loaded)}</span>
                    <span>{formatFileSize(uploadProgress.total)}</span>
                  </div>
                </div>
              )}

              {/* Upload Confirmation Action */}
              {selectedFile && !isUploading && (
                <div className="pt-2 flex items-center justify-between border-t border-slate-200">
                  <div className="text-xs text-slate-500">
                    Selected: <span className="font-mono text-slate-800">{selectedFile.name}</span> (
                    {formatFileSize(selectedFile.size)})
                  </div>
                  <Button
                    type="button"
                    variant="why"
                    onClick={startUpload}
                    className="gap-2 cursor-pointer"
                  >
                    Ingest &amp; Analyze
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Desktop QR Code */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-slate-200 bg-white p-5 shadow-sm hidden lg:block text-center">
            <div className="flex items-center justify-center gap-2 text-xs uppercase font-medium text-slate-500 mb-3">
              <QrCode className="w-4 h-4 text-emerald-700" />
              <span>Record from Phone</span>
            </div>

            <div className="bg-white p-3 rounded-xl inline-block mx-auto shadow-sm">
              <QRCodeSVG
                value={currentUrl}
                size={160}
                bgColor="#ffffff"
                fgColor="#090a0f"
                level="M"
              />
            </div>

            <div className="mt-3.5 space-y-1">
              <p className="text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-sky-700" />
                <span>Scan with mobile camera</span>
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs mx-auto">
                Open VoicePraxis directly on your phone to record with the back camera and neck mount.
              </p>
            </div>
          </Card>

          {/* Three Token Legend */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs font-mono space-y-2">
            <span className="text-[10px] uppercase text-slate-500 block font-bold">
              Color Language
            </span>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2 text-sky-700">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                <span>Seen · what the video shows</span>
              </div>
              <div className="flex items-center gap-2 text-orange-700">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                <span>Said · what the person says</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span>Why · reasons and intent, linked to steps</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-slate-500" />
          <span>Scene → Task → Sub-intent → Action · JSON export</span>
        </div>
        {savedEpisode && (
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push(`/e/${savedEpisode.id}`)}
              className="text-emerald-700 hover:text-emerald-700 underline font-mono cursor-pointer flex items-center gap-1"
            >
              <span>{savedEpisode.label}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </footer>
    </main>
  );
}

export default function Page() {
  return (
    <React.Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-[60vh] text-slate-500 font-mono text-sm">
          Loading capture...
        </div>
      }
    >
      <CapturePageContent />
    </React.Suspense>
  );
}
