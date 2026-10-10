"use client";

import * as React from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { fetchEpisode, getVideoUrl, isMockMode } from "@/lib/api";
import { Episode, formatTimestamp } from "@/lib/episode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Play,
  Sparkles,
  HelpCircle,
  Eye,
  Mic,
  Cpu,
  Layers,
} from "lucide-react";

function EpisodeShellPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const episodeId = (params?.id as string) || "mock";
  const forceMock = isMockMode(searchParams.get("mock"));

  const [episode, setEpisode] = React.useState<Episode | null>(null);
  const [selectedActionId, setSelectedActionId] = React.useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    let mounted = true;
    fetchEpisode(episodeId, forceMock).then((data) => {
      if (mounted) {
        setEpisode(data);
        if (data.actions.length > 0) {
          setSelectedActionId(data.actions[0].id);
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, [episodeId, forceMock]);

  if (!episode) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-mono">Loading episode {episodeId}...</p>
        </div>
      </div>
    );
  }

  const selectedAction = episode.actions.find((a) => a.id === selectedActionId);
  const videoUrl = getVideoUrl(episodeId, forceMock);

  const seekTo = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play().catch(() => {
        // autoplay may be restricted, seek is still performed
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Bar Navigation & Provenance */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1c2230] pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="gap-1.5 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Capture
          </Button>
          <div className="h-4 w-px bg-slate-800" />
          <div>
            <h1 className="text-base font-semibold text-white flex items-center gap-2">
              <span>Episode</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800/90 text-emerald-400 border border-slate-700">
                {episode.episode_id}
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Scene: <span className="text-slate-200 font-medium">{episode.scene}</span> ·{" "}
              {episode.duration_seconds}s total
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <Badge variant="outline" className="border-slate-700 bg-slate-900/60 text-slate-300 gap-1.5">
            <Cpu className="w-3 h-3 text-slate-400" />
            {episode.pipeline.model} ({episode.pipeline.fps}fps)
          </Badge>
          <Badge variant="why" className="gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Status: {episode.status.stage}
          </Badge>
        </div>
      </div>

      {/* Task Summary Banner */}
      <div className="rounded-xl border border-[#1e2434] bg-[#0e121a] p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400">
            <span>Demonstrated Task</span>
            <span className="text-emerald-400 font-semibold">• Outcome: {episode.task.outcome}</span>
          </div>
          <h2 className="text-lg font-bold text-white capitalize">
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
          <p className="font-semibold text-slate-300 mb-0.5">Outcome Evidence:</p>
          <p className="text-[11px] leading-relaxed text-slate-400">{episode.task.outcome_evidence}</p>
        </div>
      </div>

      {/* Main Grid: Video Player + Selected Action Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Video Player & Shell controls */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative rounded-xl overflow-hidden border border-[#202636] bg-black aspect-video flex items-center justify-center shadow-2xl">
            <video
              ref={videoRef}
              src={videoUrl}
              crossOrigin="anonymous"
              playsInline
              controls
              className="w-full h-full object-contain"
            />
            {/* Fallback label when playing mock without real video */}
            <div className="absolute top-3 left-3 pointer-events-none">
              <span className="px-2 py-1 rounded bg-black/75 backdrop-blur-md text-[10px] font-mono text-slate-300 border border-slate-700/60">
                crossOrigin=&quot;anonymous&quot; · playsInline
              </span>
            </div>
          </div>

          {/* Pending Questions Alert Card (Phase 0/1 Copilot Shell) */}
          {episode.pending_questions.length > 0 && (
            <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-mono uppercase text-emerald-400 font-bold">
                  <HelpCircle className="w-4 h-4 text-emerald-400" />
                  Copilot Clarification Pending
                </span>
                <Badge variant="why" className="text-[10px]">
                  {episode.pending_questions.length} Pending
                </Badge>
              </div>
              {episode.pending_questions.map((pq) => (
                <div key={pq.id} className="text-xs space-y-1 bg-[#101918]/80 p-3 rounded-lg border border-emerald-900/40">
                  <p className="text-slate-200 font-medium">&ldquo;{pq.question}&rdquo;</p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Target: {pq.action_ref} · Trigger: why_matters = true with no stated reason
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column: Action Details / Inspector */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-[#1e2434] bg-[#11141d]">
            <CardHeader className="pb-3 border-b border-[#191f2c]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span>Selected Action Detail</span>
                </CardTitle>
                {selectedAction && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {formatTimestamp(selectedAction.start)} – {formatTimestamp(selectedAction.end)}
                  </span>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {selectedAction ? (
                <>
                  {/* Action badges */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="seen" className="gap-1">
                      <Eye className="w-3 h-3" />
                      🔵 Seen Action
                    </Badge>

                    {selectedAction.stated_reason && (
                      <Badge variant="said" className="gap-1">
                        <Mic className="w-3 h-3" />
                        🟠 Stated Reason
                      </Badge>
                    )}

                    {selectedAction.why_matters && (
                      <Badge variant="why" className="gap-1">
                        <Sparkles className="w-3 h-3" />
                        🟢 Why Matters (Hero)
                      </Badge>
                    )}

                    {selectedAction.attempt === "recovery" && (
                      <Badge variant="outline" className="border-purple-600/60 bg-purple-950/40 text-purple-300 font-mono text-[10px]">
                        ↻ Recovery
                      </Badge>
                    )}

                    <Badge
                      variant={selectedAction.outcome === "success" ? "why" : "missed"}
                      className="text-[10px] font-mono"
                    >
                      {selectedAction.outcome === "success" ? "✓ Success" : "✗ Failed"}
                    </Badge>
                  </div>

                  {/* Instruction (Robot Command) */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono uppercase text-slate-400">
                      Robot Instruction Command
                    </span>
                    <p className="text-sm font-semibold text-slate-100 bg-[#0d1017] p-2.5 rounded-lg border border-[#1b2230]">
                      &ldquo;{selectedAction.instruction}&rdquo;
                    </p>
                  </div>

                  {/* Observed Action */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono uppercase text-sky-400">
                      Observed Movement (Visual Only)
                    </span>
                    <p className="text-xs text-slate-300 bg-[#0d1017] p-2.5 rounded-lg border border-sky-950/60">
                      {selectedAction.observed_action}
                    </p>
                  </div>

                  {/* Stated or Inferred Reason */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono uppercase text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Reasoning &amp; Intent Linkage
                    </span>
                    <div className="text-xs bg-[#091510] p-3 rounded-lg border border-emerald-900/60 space-y-1.5">
                      {selectedAction.stated_reason ? (
                        <div>
                          <span className="text-[10px] font-mono text-orange-400 uppercase font-semibold">
                            Spoken Reason ({selectedAction.stated_reason.utterance_id}):
                          </span>
                          <p className="text-slate-200 mt-0.5">
                            &ldquo;{selectedAction.stated_reason.text}&rdquo;
                          </p>
                        </div>
                      ) : (
                        <p className="text-slate-400 italic">No verbal explanation given during demonstration.</p>
                      )}

                      {selectedAction.inferred_reason && (
                        <div className="pt-1.5 border-t border-emerald-950">
                          <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold">
                            Inferred Hypothesis (Model):
                          </span>
                          <p className="text-slate-300 mt-0.5">
                            {selectedAction.inferred_reason}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Jump button */}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full gap-2 text-xs font-mono"
                    onClick={() => seekTo(selectedAction.start)}
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                    Jump Playhead to {formatTimestamp(selectedAction.start)}
                  </Button>
                </>
              ) : (
                <p className="text-xs text-slate-500">Select an action step to view breakdown.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Chronological Action Timeline & Narration Lanes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#1b212f] pb-2">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span>Action Steps Breakdown ({episode.actions.length} steps)</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            Click step to inspect &amp; seek video
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {episode.actions.map((act) => {
            const isSelected = act.id === selectedActionId;
            const hasReason = act.stated_reason || act.inferred_reason;

            return (
              <div
                key={act.id}
                onClick={() => {
                  setSelectedActionId(act.id);
                  seekTo(act.start);
                }}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all space-y-2.5 ${
                  isSelected
                    ? "border-emerald-500/80 bg-[#121b18] shadow-[0_0_15px_rgba(34,197,94,0.15)]"
                    : "border-[#1b2230] bg-[#0d1017] hover:border-[#273347]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-emerald-400 font-semibold">
                    {formatTimestamp(act.start)} – {formatTimestamp(act.end)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {act.why_matters && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                    )}
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {act.id}
                    </span>
                  </div>
                </div>

                <p className="text-xs font-medium text-slate-200 line-clamp-2">
                  {act.instruction}
                </p>

                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                  {act.attempt === "recovery" && (
                    <span className="text-purple-400 font-semibold">↻ Recovery</span>
                  )}
                  {act.outcome === "failed" && (
                    <span className="text-red-400 font-semibold">✗ Failed</span>
                  )}
                  {hasReason && (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      Why Reasoned
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Narration Utterance Lane */}
      <div className="rounded-xl border border-[#1b2230] bg-[#0c0f16] p-4 space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-orange-400 flex items-center gap-2">
          <Mic className="w-4 h-4 text-orange-400" />
          Verbatim Spoken Utterances ({episode.narration.length})
        </h3>
        <div className="space-y-2">
          {episode.narration.map((utt) => (
            <div
              key={utt.id}
              onClick={() => seekTo(utt.start)}
              className="flex items-start gap-3 p-2.5 rounded-lg border border-[#161d2a] bg-[#0f131d] hover:border-orange-500/40 cursor-pointer transition-colors text-xs"
            >
              <span className="font-mono text-orange-400 shrink-0 text-[11px] mt-0.5">
                [{formatTimestamp(utt.start)}]
              </span>
              <div className="flex-1 space-y-0.5">
                <p className="text-slate-200">&ldquo;{utt.text}&rdquo;</p>
                <span className="text-[10px] font-mono text-slate-500 uppercase">
                  mode: {utt.mode} · {utt.id}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <React.Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-[60vh] text-slate-400 font-mono text-sm">
          Loading episode shell...
        </div>
      }
    >
      <EpisodeShellPageContent />
    </React.Suspense>
  );
}
