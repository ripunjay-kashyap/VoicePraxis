"use client";

import * as React from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  fetchEpisode,
  getVideoUrl,
  isMockMode,
  patchEpisodeChanges,
  resetSavedEpisode,
  PatchChange,
} from "@/lib/api";
import {
  Episode,
  ProcessingStage,
} from "@/lib/episode";
import { VideoPlayer } from "@/components/episode/VideoPlayer";
import { ThreeLaneTimeline } from "@/components/episode/ThreeLaneTimeline";
import { SidePanel } from "@/components/episode/SidePanel";
import { ProcessingView } from "@/components/episode/ProcessingView";
import { ExportModal } from "@/components/episode/ExportModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  HelpCircle,
  FileCode,
  Mic,
  Cpu,
  RotateCcw,
  AlertTriangle,
  FileCheck2,
  Loader2,
} from "lucide-react";

function EpisodeShellPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const episodeId = (params?.id as string) || "mock";
  const forceMock = isMockMode(searchParams.get("mock"));

  const [episode, setEpisode] = React.useState<Episode | null>(null);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [isSlowLoading, setIsSlowLoading] = React.useState(false);
  const [isResetting, setIsResetting] = React.useState(false);
  const [selectedActionId, setSelectedActionId] = React.useState<string | null>(null);
  const [currentTime, setCurrentTime] = React.useState<number>(0);
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = React.useState<boolean>(false);
  const [playbackEndTarget, setPlaybackEndTarget] = React.useState<number | null>(null);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      const data = await fetchEpisode(episodeId, forceMock);
      setEpisode(data);
      setFetchError(null);

      // Auto select first action if none selected
      if (data.actions && data.actions.length > 0) {
        setSelectedActionId((prev) => prev || data.actions[0].id);
      }

      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load episode";
      setFetchError(msg);
      return null;
    }
  }, [episodeId, forceMock]);

  // Slow loading notification after 3s cold start
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsSlowLoading(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Polling for episode status when processing
  React.useEffect(() => {
    let mounted = true;
    let pollTimeout: NodeJS.Timeout | null = null;

    const poll = async () => {
      const data = await loadData();
      if (!mounted || !data) return;

      // If not ready and not failed, poll every 1.5s
      if (data.status.stage !== "ready" && data.status.stage !== "failed" && !forceMock) {
        pollTimeout = setTimeout(poll, 1500);
      }
    };

    poll();

    return () => {
      mounted = false;
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, [loadData, forceMock]);

  // Designed error state when fetch fails (Rule 6: No fake data, ever)
  if (fetchError && !episode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center max-w-lg w-full mx-auto p-4 sm:p-6 min-h-[60vh]">
        <div className="w-full rounded-2xl border border-red-800/80 bg-[#11141d] p-6 shadow-2xl text-center space-y-5">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white">Episode Load Failed</h2>
            <p className="text-xs font-mono text-slate-400 mt-1">
              ID: <span className="text-slate-200">{episodeId}</span>
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-red-900/60 bg-red-950/30 text-xs text-red-300 font-mono text-left">
            {fetchError}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setFetchError(null);
                loadData();
              }}
              className="flex-1 gap-1.5 cursor-pointer text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Try again
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="flex-1 gap-1.5 cursor-pointer text-xs border-slate-700"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to capture
            </Button>
            <Button
              variant="why"
              onClick={() => router.push("/e/saved-example-01")}
              className="flex-1 gap-1.5 cursor-pointer text-xs"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              Open saved episode
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Loading spinner with cold start server waking note
  if (!episode) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-mono">Loading episode {episodeId}...</p>
          {isSlowLoading && (
            <p className="text-xs text-amber-400 font-mono animate-pulse">
              Waking the server (first load may take ~5–10 s)...
            </p>
          )}
        </div>
      </div>
    );
  }

  // 1. If currently in processing stage (uploaded, converting, analysing, linking, or failed), render ProcessingView
  if (episode.status.stage !== "ready") {
    return (
      <ProcessingView
        stage={episode.status.stage as ProcessingStage}
        error={episode.status.error}
        episodeId={episode.episode_id || episodeId}
      />
    );
  }

  const selectedActionIndex = episode.actions.findIndex((a) => a.id === selectedActionId);
  const selectedAction = selectedActionIndex !== -1 ? episode.actions[selectedActionIndex] : null;
  const videoUrl = getVideoUrl(episodeId, forceMock);

  // Video seeking interaction
  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
    if (playbackEndTarget !== null && time >= playbackEndTarget) {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setIsPlaying(false);
      setPlaybackEndTarget(null);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Play single utterance from start to end
  const handlePlayUtterance = (start: number, end: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = start;
      setCurrentTime(start);
      setPlaybackEndTarget(end);
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  // Patch changes using real backend contract: PATCH /episodes/{id}
  const handlePatchChanges = async (
    changes: PatchChange[]
  ): Promise<{ success: boolean; detail?: string }> => {
    const res = await patchEpisodeChanges(episode.episode_id || episodeId, changes);
    if (res.success && res.episode) {
      // Replace episode state with response.episode (source of truth)
      setEpisode(res.episode);
      return { success: true };
    }
    return { success: false, detail: res.detail };
  };

  // Set step start/end via keyboard shortcuts ([ and ]) or phone buttons
  const handleSetStartAtPlayhead = async () => {
    if (!selectedAction) return;
    const rounded = parseFloat(currentTime.toFixed(2));
    await handlePatchChanges([
      { target: selectedAction.id, field: "start", value: rounded },
    ]);
  };

  const handleSetEndAtPlayhead = async () => {
    if (!selectedAction) return;
    const rounded = parseFloat(currentTime.toFixed(2));
    await handlePatchChanges([
      { target: selectedAction.id, field: "end", value: rounded },
    ]);
  };

  // Reset human edits on a saved episode
  const handleResetEdits = async () => {
    setIsResetting(true);
    const res = await resetSavedEpisode(episode.episode_id || episodeId);
    setIsResetting(false);
    if (res.success && res.episode) {
      setEpisode(res.episode);
    }
  };

  return (
    <div className="flex-1 flex flex-col max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-6">
      {/* Top Header Bar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1c2230] pb-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="gap-1.5 text-slate-400 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Capture
          </Button>

          <div className="h-4 w-px bg-slate-800" />

          <div>
            <h1 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <span>Episode</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800/90 text-emerald-400 border border-slate-700">
                {episode.episode_id}
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Scene: <span className="text-slate-200 font-medium">{episode.scene || "demonstration"}</span> ·{" "}
              {episode.duration_seconds}s duration
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {forceMock && (
            <Badge variant="outline" className="border-amber-500/80 bg-amber-950/60 text-amber-300 font-mono text-xs">
              Mock data (?mock=1)
            </Badge>
          )}

          {episode.pipeline && (
            <Badge variant="outline" className="border-slate-700 bg-slate-900/60 text-slate-300 font-mono text-xs gap-1.5 hidden md:inline-flex">
              <Cpu className="w-3 h-3 text-slate-400" />
              {episode.pipeline.model} ({episode.pipeline.fps}fps)
            </Badge>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsExportOpen(true)}
            className="gap-1.5 text-xs font-mono cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
            Export / Download
          </Button>
        </div>
      </header>

      {/* Saved Episode Banner (Rule 3) */}
      {episode.saved && (
        <div className="rounded-xl border border-emerald-800/60 bg-gradient-to-r from-emerald-950/40 via-[#0e1614] to-emerald-950/30 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <Badge variant="why" className="text-[10px] font-mono uppercase tracking-wider">
              Saved Reference
            </Badge>
            <span className="text-xs sm:text-sm font-semibold text-emerald-200">
              {episode.label || "Saved episode · bike tube test clip (YouTube)"}
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={isResetting}
            onClick={handleResetEdits}
            className="h-7 text-xs font-mono border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-300 gap-1.5 cursor-pointer"
          >
            {isResetting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Resetting...
              </>
            ) : (
              <>
                <RotateCcw className="w-3 h-3 text-slate-400" />
                Reset edits
              </>
            )}
          </Button>
        </div>
      )}

      {/* Task Intent & Outcome Banner */}
      <div className="rounded-xl border border-[#1e2434] bg-[#0e121a] p-3.5 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400">
            <span>Demonstrated Task</span>
            <span className="text-emerald-400 font-semibold">• Outcome: {episode.task.outcome}</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white capitalize">
            {episode.task.name}
          </h2>
          {episode.task.declared_intent && (
            <p className="text-xs text-orange-300/90 flex items-center gap-1.5 pt-0.5">
              <Mic className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span>
                <strong className="text-orange-400 font-mono">Declared Intent:</strong> &ldquo;
                {episode.task.declared_intent.text}&rdquo;
              </span>
            </p>
          )}
        </div>

        <div className="text-xs text-slate-400 max-w-md bg-[#131722] p-2.5 rounded-lg border border-[#1b2230]">
          <p className="font-semibold text-slate-300 mb-0.5 text-[11px]">Outcome Evidence:</p>
          <p className="text-[11px] leading-relaxed text-slate-400">{episode.task.outcome_evidence}</p>
        </div>
      </div>

      {/* Main Grid: Video Player (Left) + Side Panel Inspector (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Player + Pending Question */}
        <div className="lg:col-span-7 space-y-4">
          <VideoPlayer
            videoUrl={videoUrl}
            duration={episode.duration_seconds}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onTimeUpdate={handleTimeUpdate}
            onPlayStateChange={(p) => setIsPlaying(p)}
            onSeek={handleSeek}
            onSetStartAtPlayhead={handleSetStartAtPlayhead}
            onSetEndAtPlayhead={handleSetEndAtPlayhead}
            videoRef={videoRef}
          />

          {/* Pending Questions Card */}
          {episode.pending_questions && episode.pending_questions.length > 0 && (
            <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/20 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-mono uppercase text-emerald-400 font-bold">
                  <HelpCircle className="w-4 h-4 text-emerald-400" />
                  Copilot Clarification Pending
                </span>
                <Badge variant="why" className="text-[10px]">
                  {episode.pending_questions.length} Active
                </Badge>
              </div>
              {episode.pending_questions.map((pq) => (
                <div key={pq.id} className="text-xs space-y-1 bg-[#101918]/80 p-3 rounded-lg border border-emerald-900/40">
                  <p className="text-slate-200 font-medium">&ldquo;{pq.question}&rdquo;</p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Target: {pq.action_ref} · Triggered because why_matters is true with no stated reason
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Step Inspector & Inline Editor */}
        <div className="lg:col-span-5">
          <SidePanel
            key={selectedAction ? `${selectedAction.id}-${selectedAction.human_corrections?.length || 0}` : "empty"}
            action={selectedAction}
            currentTime={currentTime}
            onPatchChanges={handlePatchChanges}
            onPrevAction={() => {
              if (selectedActionIndex > 0) {
                const prev = episode.actions[selectedActionIndex - 1];
                setSelectedActionId(prev.id);
                handleSeek(prev.start);
              }
            }}
            onNextAction={() => {
              if (selectedActionIndex < episode.actions.length - 1) {
                const next = episode.actions[selectedActionIndex + 1];
                setSelectedActionId(next.id);
                handleSeek(next.start);
              }
            }}
            hasPrev={selectedActionIndex > 0}
            hasNext={selectedActionIndex < episode.actions.length - 1}
          />
        </div>
      </div>

      {/* Three Lane Timeline Component */}
      <ThreeLaneTimeline
        duration={episode.duration_seconds}
        currentTime={currentTime}
        actions={episode.actions}
        narration={episode.narration}
        selectedActionId={selectedActionId}
        onSelectAction={(id) => setSelectedActionId(id)}
        onSeek={handleSeek}
        onPlayUtterance={handlePlayUtterance}
      />

      {/* Export / Download Modal */}
      <ExportModal
        episode={episode}
        selectedAction={selectedAction}
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <React.Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-[60vh] text-slate-400 font-mono text-sm">
          Loading episode...
        </div>
      }
    >
      <EpisodeShellPageContent />
    </React.Suspense>
  );
}
