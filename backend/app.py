"""VoicePraxis backend on Modal: FastAPI web app + the processing job.

    modal serve  app.py --env main     # temporary dev URL
    modal deploy app.py --env main
"""


import os
import re
import shutil
import time
import uuid
from pathlib import Path

import modal

APP_NAME = "voicepraxis"
VOL_PATH = Path("/data")
CACHE = Path("/tmp/cache")
VIDEO_EXTS = {".mov", ".mp4", ".m4v", ".webm", ".3gp", ".mkv"}
MAX_BYTES = 200 * 1024 * 1024
FLAG_NAMES = ("SIDE_BY_SIDE", "COPILOT", "TEMPLATES", "INDIC", "VISION_OVERLAY")

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg")
    .pip_install("fastapi[standard]>=0.115", "python-multipart", "google-genai>=2.29", "pydantic>=2")
    .add_local_python_source("pipeline")
    .add_local_dir(Path(__file__).parent / "prompts", "/root/prompts")
    .add_local_dir(Path(__file__).parent.parent / "contracts", "/root/contracts")
)

app = modal.App(APP_NAME, image=image)
volume = modal.Volume.from_name("vp-videos", create_if_missing=True)
episodes = modal.Dict.from_name("vp-episodes", create_if_missing=True)
flags_secret = modal.Secret.from_name("vp-flags")
gemini_secret = modal.Secret.from_name("gemini")


def flags() -> dict[str, bool]:
    return {name: os.environ.get(name, "0") == "1" for name in FLAG_NAMES}


def video_dir(episode_id: str) -> Path:
    return VOL_PATH / "videos" / episode_id


def update(episode_id: str, **fields) -> dict:
    record = episodes.get(episode_id) or {"id": episode_id}
    record.update(fields)
    episodes[episode_id] = record
    return record


@app.function(
    region="ap",
    volumes={VOL_PATH: volume},
    secrets=[gemini_secret, flags_secret],
    cpu=4,
    memory=4096,
    timeout=600,
)
def process_episode(episode_id: str) -> None:
    """uploaded → preparing/converting → analysing → linking → ready | failed (stage names are real steps)."""
    from pipeline.assemble import assemble
    from pipeline.gemini import GeminiError, KeyPool, analyse
    from pipeline.media import MAX_SECONDS, convert, probe

    t0 = time.time()
    volume.reload()  # see the upload committed by the web container (no files open yet)
    record = episodes[episode_id]
    src = video_dir(episode_id) / record["original"]
    try:
        update(episode_id, status="preparing", stage="converting")
        info = probe(src)
        if not info.has_video:
            raise GeminiError("This file has no video track.")
        playback, _noaudio = convert(src, Path("/tmp/work") / episode_id)
        # Duration from our own H.264 output: originals can carry extra streams that skew it.
        info.duration = probe(playback).duration
        if info.duration > MAX_SECONDS + 1:
            raise GeminiError(f"This clip is {info.duration:.0f} s long. Keep clips under {MAX_SECONDS} seconds.")
        shutil.copy(playback, video_dir(episode_id) / "playback.mp4")
        volume.commit()
        convert_s = time.time() - t0

        update(episode_id, status="analysing", stage="analysing")
        output, meta = analyse(KeyPool(), playback, audio=True)

        update(episode_id, stage="linking")
        episode = assemble(output, episode_id=episode_id, duration=info.duration, pipeline=meta)
        if info.hdr:
            episode["task"]["uncertainty"].append("Recorded in HDR; colours in playback may look washed out.")
        update(
            episode_id,
            status="ready",
            stage="ready",
            error=None,
            duration=round(info.duration, 2),
            model_output=episode,
            corrections=[],
            video_only_output=None,
            template_id=None,
            timings={"convert_s": round(convert_s, 1), "upload_s": meta["upload_s"],
                     "generation_s": meta["generation_s"], "total_s": round(time.time() - t0, 1)},
        )
    except GeminiError as e:
        update(episode_id, status="failed", stage="failed", error=str(e))
    except Exception as e:
        update(episode_id, status="failed", stage="failed",
               error="Processing failed. Try again, or open the saved episode.",
               debug=f"{type(e).__name__}: {e}"[:500])


@app.function(
    region="ap",  # F10: Mumbai routing measured ~3 s vs ~18 s (default) for a 30 MB upload
    routing_region="ap-south",  # can only be set on the first deploy of this function
    volumes={VOL_PATH: volume},
    secrets=[flags_secret],
    max_containers=1,  # one container: video cache and uploads in one place
    scaledown_window=300,
    timeout=600,
)
@modal.concurrent(max_inputs=50)
@modal.asgi_app()
def api():
    from fastapi import FastAPI, File, HTTPException, UploadFile
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import FileResponse

    web = FastAPI(title="VoicePraxis")
    web.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Range", "Accept-Ranges", "Content-Length"],
    )

    def get_record(episode_id: str) -> dict:
        if not re.fullmatch(r"[a-z0-9-]{1,64}", episode_id):
            raise HTTPException(404, "Episode not found")
        record = episodes.get(episode_id)
        if record is None:
            raise HTTPException(404, "Episode not found")
        return record

    @web.get("/health")
    def health():
        return {"ok": True, "app": APP_NAME, "time": time.time()}

    @web.get("/config")
    def config():
        return {"flags": flags(), "version": "mvp-dev"}

    @web.post("/episodes", status_code=201)
    async def create_episode(file: UploadFile = File(...)):
        ext = Path(file.filename or "").suffix.lower()
        if not ((file.content_type or "").startswith("video/") or ext in VIDEO_EXTS):
            raise HTTPException(415, "That file isn't a video. Record or choose a video clip.")
        episode_id = uuid.uuid4().hex[:12]
        dest_dir = video_dir(episode_id)
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / f"original{ext or '.mp4'}"
        size = 0
        t0 = time.time()
        with dest.open("wb") as out:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_BYTES:
                    out.close()
                    shutil.rmtree(dest_dir, ignore_errors=True)
                    raise HTTPException(413, "That clip is too large (over 200 MB). Keep clips under 90 seconds.")
                out.write(chunk)
        receive_s = time.time() - t0
        volume.commit()
        episodes[episode_id] = {
            "id": episode_id,
            "status": "uploaded",
            "stage": "uploaded",
            "error": None,
            "created_at": time.time(),
            "original": dest.name,
            "bytes": size,
        }
        process_episode.spawn(episode_id)
        return {"id": episode_id, "bytes": size, "receive_s": round(receive_s, 2)}

    @web.get("/episodes/{episode_id}")
    def get_episode(episode_id: str):
        record = get_record(episode_id)
        public = {k: record.get(k) for k in ("id", "status", "stage", "error", "created_at", "duration", "timings", "template_id")}
        public["episode"] = record.get("model_output")  # corrections applied on read: next step
        public["video_only"] = record.get("video_only_output")
        return public

    @web.api_route("/episodes/{episode_id}/video", methods=["GET", "HEAD"])
    def get_video(episode_id: str):
        record = get_record(episode_id)
        name = "playback.mp4" if record.get("status") == "ready" else record["original"]
        path = local_copy(f"videos/{episode_id}/{name}")
        if path is None:
            raise HTTPException(404, "Video not available yet")
        media_type = "video/mp4" if path.suffix in {".mp4", ".m4v"} else "video/quicktime"
        return FileResponse(path, media_type=media_type)  # Starlette handles Range → 206

    return web


def local_copy(rel: str) -> Path | None:
    """A readable local path for a Volume file, without Volume.reload().

    reload() fails while any Volume file is open (e.g. a video being streamed),
    so files written by other containers are copied once into /tmp/cache.
    """
    mounted = VOL_PATH / rel
    if mounted.exists():
        return mounted
    cached = CACHE / rel
    if cached.exists():
        return cached
    cached.parent.mkdir(parents=True, exist_ok=True)
    tmp = cached.with_suffix(cached.suffix + ".part")
    try:
        with tmp.open("wb") as f:
            for chunk in volume.read_file(rel):
                f.write(chunk)
    except Exception:
        tmp.unlink(missing_ok=True)
        return None
    tmp.rename(cached)
    return cached
