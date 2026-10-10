"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
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
  QrCode,
  FileCheck2,
  Smartphone,
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
  const [currentUrl] = React.useState<string>(() => {
    return typeof window !== "undefined" ? window.location.href : "https://voicepraxis.vercel.app";
  });

  const apiBase = getApiBase();

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
      setFileError(`File exceeds limit (${sizeMb} MB). Maximum size is 250 MB.`);
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
      <header className="flex items-center justify-between border-b border-[#1b212f] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold text-sm shadow-[0_0_12px_rgba(34,197,94,0.2)]">
            VP
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              VoicePraxis
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                MVP
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Multimodal Robot Imitation · Spoken Intent &amp; Why-Reasoning
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
              Mock Active (?mock=1)
            </Badge>
          )}
        </div>
      </header>

      {/* Hero Guidance Card & Saved Episode Link */}
      <div className="rounded-xl border border-[#202738] bg-gradient-to-r from-[#121622] via-[#0f141f] to-[#121622] p-4 sm:p-5 shadow-lg">
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
              State intent before starting, explain decisions while acting, and narrate recoveries.
            </p>
          </div>

          {/* Saved Episode Link Requirement */}
          <button
            type="button"
            onClick={() => router.push("/e/ep_20261010_container_001?mock=1")}
            className="shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-950/70 border border-emerald-700/80 hover:bg-emerald-900/80 text-emerald-300 transition-all cursor-pointer shadow-[0_0_12px_rgba(34,197,94,0.2)] text-xs font-mono"
          >
            <FileCheck2 className="w-4 h-4 text-emerald-400" />
            <div className="text-left">
              <div className="font-semibold text-emerald-200">Saved episode · recorded Oct 10</div>
              <div className="text-[10px] text-emerald-400/80">Container microwave rehearsal</div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>
      </div>

      {/* Main Grid: Capture Area + Desktop QR Code */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Big Record & Upload Actions */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="border-[#1e2433] bg-[#11141d]/95 shadow-2xl relative overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Demonstration Ingest</span>
                <span className="text-xs font-mono text-slate-400 font-normal">
                  Ideal runtime: 25–35 s @ 1080p
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
                  className="h-20 flex-col items-center justify-center gap-1.5 rounded-xl border-[#2a3449] hover:border-[#3d4b68] cursor-pointer"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <div className="flex items-center gap-2 text-base font-semibold text-slate-200">
                    <Upload className="w-5 h-5 text-sky-400" />
                    Upload Video File
                  </div>
                  <span className="text-[11px] font-normal text-slate-400">
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
                    ? "border-emerald-500 bg-emerald-950/20 shadow-[0_0_20px_rgba(34,197,94,0.15)]"
                    : "border-[#22293a] bg-[#0c0e14]/60 hover:border-[#2f3950]"
                }`}
              >
                <div className="mx-auto w-12 h-12 rounded-full bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-300 mb-3">
                  <FileVideo className="w-6 h-6 text-sky-400" />
                </div>
                <p className="text-sm font-medium text-slate-200 mb-1">
                  {selectedFile ? selectedFile.name : "Drag & drop video clip here"}
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {selectedFile ? (
                    <span className="text-emerald-400 font-mono font-medium">
                      {formatFileSize(selectedFile.size)} · Ready to upload
                    </span>
                  ) : (
                    "Supports iPhone MOV, Android MP4, and WebM (up to 250 MB)"
                  )}
                </p>
              </div>

              {/* Validation Error Message */}
              {fileError && (
                <div className="rounded-lg border border-red-800/80 bg-red-950/40 p-3.5 text-xs text-red-300 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-200">Upload Issue</p>
                    <p>{fileError}</p>
                  </div>
                </div>
              )}

              {/* Upload Progress Bar with XHR Progress */}
              {isUploading && uploadProgress && (
                <div className="space-y-2 rounded-xl border border-[#232b3d] bg-[#0d1017] p-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-200 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Uploading demonstration clip...
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

              {/* Upload Confirmation Action */}
              {selectedFile && !isUploading && (
                <div className="pt-2 flex items-center justify-between border-t border-[#1a1f2c]">
                  <div className="text-xs text-slate-400">
                    Selected: <span className="font-mono text-slate-200">{selectedFile.name}</span> (
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

        {/* Right Column: Desktop QR Code (requirement 3) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-[#1e2433] bg-[#11141d]/95 p-5 shadow-xl hidden lg:block text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-mono uppercase text-slate-400 mb-3">
              <QrCode className="w-4 h-4 text-emerald-400" />
              <span>Record from Phone</span>
            </div>

            <div className="bg-white p-3 rounded-xl inline-block mx-auto shadow-md">
              <QRCodeSVG
                value={currentUrl}
                size={160}
                bgColor="#ffffff"
                fgColor="#090a0f"
                level="M"
              />
            </div>

            <div className="mt-3.5 space-y-1">
              <p className="text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                <span>Scan with mobile camera</span>
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                Open VoicePraxis directly on your phone to record with the back camera and neck mount.
              </p>
            </div>
          </Card>

          {/* Three Token Legend */}
          <div className="rounded-xl border border-[#1b2230] bg-[#0c0f16] p-4 text-xs font-mono space-y-2">
            <span className="text-[10px] uppercase text-slate-400 block font-bold">
              Color Language
            </span>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2 text-sky-300">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                <span>🔵 Seen · Objective physical action</span>
              </div>
              <div className="flex items-center gap-2 text-orange-300">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                <span>🟠 Said · Verbatim spoken transcript</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                <span>🟢 Why · The hero reason &amp; intent</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="pt-4 border-t border-[#1b212f] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-slate-400" />
          <span>Gemini 3.8 Flash Multimodal Pipeline · Awign Labelling Hierarchy</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/e/ep_20261010_container_001?mock=1")}
            className="text-emerald-400 hover:text-emerald-300 underline font-mono cursor-pointer flex items-center gap-1"
          >
            <span>Saved Reference Episode</span>
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
