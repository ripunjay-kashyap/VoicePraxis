"use client";

import * as React from "react";
import { formatTimestamp } from "@/lib/episode";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  FastForward,
  Rewind,
} from "lucide-react";

interface VideoPlayerProps {
  videoUrl: string;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  onSeek: (time: number) => void;
  onSetStartAtPlayhead?: () => void;
  onSetEndAtPlayhead?: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function VideoPlayer({
  videoUrl,
  duration,
  currentTime,
  isPlaying,
  onTimeUpdate,
  onPlayStateChange,
  onSeek,
  onSetStartAtPlayhead,
  onSetEndAtPlayhead,
  videoRef,
}: VideoPlayerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = React.useState(false);
  const [playbackRate, setPlaybackRate] = React.useState(1);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [showControls, setShowControls] = React.useState(true);
  const controlsTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const togglePlay = React.useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  }, [isPlaying, videoRef]);

  const seekDelta = React.useCallback(
    (deltaSeconds: number) => {
      if (!videoRef.current) return;
      const newTime = Math.max(0, Math.min(duration || 100, currentTime + deltaSeconds));
      onSeek(newTime);
    },
    [currentTime, duration, onSeek, videoRef]
  );

  // Keyboard controls: space for play/pause, left/right arrows, [ and ] for start/end
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        seekDelta(-1);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        seekDelta(1);
      } else if (e.key === "[") {
        e.preventDefault();
        if (onSetStartAtPlayhead) onSetStartAtPlayhead();
      } else if (e.key === "]") {
        e.preventDefault();
        if (onSetEndAtPlayhead) onSetEndAtPlayhead();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, seekDelta, onSetStartAtPlayhead, onSetEndAtPlayhead]);

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    onSeek(newTime);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const cyclePlaybackRate = () => {
    if (!videoRef.current) return;
    const rates = [1, 1.25, 1.5, 0.5];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    videoRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2500);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative rounded-xl overflow-hidden border border-slate-200 bg-black aspect-video flex items-center justify-center shadow-2xl group select-none"
    >
      <video
        ref={videoRef}
        src={videoUrl}
        crossOrigin="anonymous"
        playsInline
        preload="metadata"
        onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
        onPlay={() => onPlayStateChange(true)}
        onPause={() => onPlayStateChange(false)}
        onClick={togglePlay}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Center play button overlay when paused */}
      {!isPlaying && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/60 backdrop-blur-md border border-white/40 text-white flex items-center justify-center hover:scale-105 hover:bg-black/80 transition-all cursor-pointer"
          aria-label="Play Video"
        >
          <Play className="w-8 h-8 fill-white translate-x-0.5" />
        </button>
      )}



      {/* Bottom control bar overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-3 pt-6 transition-opacity duration-300 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Scrubber bar */}
        <div className="relative flex items-center mb-2.5 group/scrub">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.05}
            value={currentTime}
            onChange={handleScrubberChange}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-white focus:outline-none"
            style={{
              background: `linear-gradient(to right, #22c55e ${progressPercent}%, #1e293b ${progressPercent}%)`,
            }}
          />
        </div>

        {/* Buttons row */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="p-1.5 rounded hover:bg-white/10 text-white transition-colors cursor-pointer"
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
            </button>

            <button
              type="button"
              onClick={() => seekDelta(-1)}
              className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Step back 1s (Left Arrow)"
            >
              <Rewind className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => seekDelta(1)}
              className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Step forward 1s (Right Arrow)"
            >
              <FastForward className="w-3.5 h-3.5" />
            </button>

            {/* Monospace Timecode */}
            <div className="font-mono text-xs text-slate-300 ml-1">
              <span className="text-white font-semibold">{formatTimestamp(currentTime, true)}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span>{formatTimestamp(duration, true)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Speed selector */}
            <button
              type="button"
              onClick={cyclePlaybackRate}
              className="px-2 py-0.5 rounded text-[11px] font-mono text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              title="Playback speed"
            >
              {playbackRate}x
            </button>

            {/* Mute toggle */}
            <button
              type="button"
              onClick={toggleMute}
              className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
