"""ffmpeg/ffprobe helpers. One conversion command shared by the app and scripts/probe.py."""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

MAX_SECONDS = 90
HDR_TRANSFERS = {"arib-std-b67", "smpte2084"}  # HLG, PQ (iPhone HDR / Dolby Vision)


@dataclass
class MediaInfo:
    duration: float
    has_video: bool
    has_audio: bool
    width: int | None
    height: int | None
    hdr: bool


def probe(path: Path) -> MediaInfo:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)],
        capture_output=True, text=True, check=True,
    )
    data = json.loads(out.stdout)
    streams = data.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
    # Prefer the video/audio stream length: data tracks can make the container look longer.
    lengths = [float(x["duration"]) for x in (video, audio) if x and x.get("duration")]
    duration = max(lengths) if lengths else float(data.get("format", {}).get("duration") or 0)
    return MediaInfo(
        duration=duration,
        has_video=video is not None,
        has_audio=audio is not None,
        width=(video or {}).get("width"),
        height=(video or {}).get("height"),
        hdr=(video or {}).get("color_transfer") in HDR_TRANSFERS,
    )


def extract_audio(video: Path, workdir: Path) -> Path:
    """16 kHz mono AAC for speech-to-text (small upload, plenty for speech)."""
    out = workdir / "audio.m4a"
    if not out.exists():
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(video), "-vn", "-ac", "1", "-ar", "16000",
             "-c:a", "aac", "-b:a", "64k", str(out)],
            check=True,
        )
    return out


def convert(src: Path, workdir: Path) -> tuple[Path, Path]:
    """playback.mp4 (H.264, max 720p, faststart) and noaudio.mp4 (identical frames, no audio).

    Both side-by-side runs are sent these two files, so only the audio differs.
    """
    workdir.mkdir(parents=True, exist_ok=True)
    playback, noaudio = workdir / "playback.mp4", workdir / "noaudio.mp4"
    if not playback.exists():
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
             # first video + first audio only: phones/YouTube files can carry data tracks
             "-map", "0:v:0", "-map", "0:a:0?", "-dn", "-sn",
             "-vf", "scale=-2:'min(720,ih)'", "-c:v", "libx264", "-preset", "veryfast",
             "-crf", "26", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
             "-movflags", "+faststart", str(playback)],
            check=True,
        )
    if not noaudio.exists():
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(playback), "-an", "-c:v", "copy",
             "-movflags", "+faststart", str(noaudio)],
            check=True,
        )
    return playback, noaudio


def trim(playback: Path, start: float, end: float, workdir: Path) -> tuple[Path, Path]:
    """Frame-accurate cut of playback.mp4 to [start, end], plus its no-audio copy."""
    workdir.mkdir(parents=True, exist_ok=True)
    out, noaudio = workdir / "trimmed.mp4", workdir / "trimmed_noaudio.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{start:.2f}", "-i", str(playback), "-t", f"{end - start:.2f}",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
         "-movflags", "+faststart", str(out)],
        check=True,
    )
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(out), "-an", "-c:v", "copy", "-movflags", "+faststart", str(noaudio)],
        check=True,
    )
    return out, noaudio
