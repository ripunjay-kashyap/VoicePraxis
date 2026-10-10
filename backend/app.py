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
    """uploaded → preparing/converting → listening → analysing → linking → ready | failed (real steps)."""
    from pipeline.assemble import assemble
    from pipeline.gemini import GeminiError, KeyPool, analyse
    from pipeline.media import MAX_SECONDS, convert, extract_audio, probe
    from pipeline.stt import transcribe

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

        pool = KeyPool()
        transcript, stt_meta = None, {"stt_model": None}
        if info.has_audio:
            update(episode_id, status="analysing", stage="listening")
            try:
                transcript, stt_meta = transcribe(pool, extract_audio(playback, Path("/tmp/work") / episode_id))
            except GeminiError as e:  # fall back to the single-pass transcript
                stt_meta = {"stt_model": None, "stt_error": str(e)}

        update(episode_id, status="analysing", stage="analysing")
        output, meta = analyse(pool, playback, audio=True, transcript=transcript or None)
        meta.update(stt_meta)

        update(episode_id, stage="linking")
        episode = assemble(output, episode_id=episode_id, duration=info.duration, pipeline=meta,
                           transcript=transcript or None)
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
            timings={"convert_s": round(convert_s, 1), "stt_s": meta.get("stt_s"), "upload_s": meta["upload_s"],
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
        # Vercel previews/production, any localhost port, and LAN dev servers (phone testing)
        allow_origin_regex=r"https://.*\.vercel\.app|http://(localhost|127\.0\.0\.1)(:\d+)?|http://(192\.168|10)\.\d+\.\d+(\.\d+)?(:\d+)?",
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Range", "Accept-Ranges", "Content-Length", "Content-Disposition"],
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

    def public(record: dict) -> dict:
        from pipeline.corrections import apply

        out = {k: record.get(k) for k in ("id", "status", "stage", "error", "created_at", "duration", "timings", "template_id")}
        out["saved"] = bool(record.get("saved"))
        out["label"] = record.get("label")
        model_output = record.get("model_output")
        out["episode"] = apply(model_output, record.get("corrections") or []) if model_output else None
        out["video_only"] = record.get("video_only_output")
        return out

    @web.get("/episodes")
    def list_episodes(limit: int = 20, saved: bool = False):
        rows = []
        for key, record in episodes.items():
            if saved and not record.get("saved"):
                continue
            task = (record.get("model_output") or {}).get("task") or {}
            rows.append({"id": key, "status": record.get("status"), "created_at": record.get("created_at"),
                         "saved": bool(record.get("saved")), "label": record.get("label"),
                         "task": task.get("name"), "duration": record.get("duration")})
        rows.sort(key=lambda r: (not r["saved"], -(r["created_at"] or 0)))
        return rows[: max(1, min(limit, 100))]

    @web.get("/episodes/{episode_id}")
    def get_episode(episode_id: str):
        return public(get_record(episode_id))

    @web.patch("/episodes/{episode_id}")
    def correct_episode(episode_id: str, body: dict):
        from pipeline.corrections import CorrectionError, apply, validate

        record = get_record(episode_id)
        if record.get("status") != "ready":
            raise HTTPException(409, "This episode isn't ready to edit yet.")
        changes = body.get("changes")
        if not isinstance(changes, list) or not changes:
            raise HTTPException(422, 'Send {"changes": [{"target", "field", "value"}]}')
        current = apply(record["model_output"], record.get("corrections") or [])
        try:
            stored = validate(current, changes)
        except CorrectionError as e:
            raise HTTPException(422, str(e))
        record = update(episode_id, corrections=(record.get("corrections") or []) + stored)
        return public(record)

    @web.post("/episodes/{episode_id}/reset")
    def reset_episode(episode_id: str):
        """Saved (demo) episodes only: drop human corrections; the model output is untouched."""
        record = get_record(episode_id)
        if not record.get("saved"):
            raise HTTPException(403, "Only saved episodes can be reset.")
        return public(update(episode_id, corrections=[]))

    @web.get("/episodes/{episode_id}/export")
    def export_episode(episode_id: str, format: str = "json"):
        import io
        import json
        import zipfile

        from fastapi.responses import JSONResponse, StreamingResponse

        record = get_record(episode_id)
        episode = public(record)["episode"]
        if episode is None:
            raise HTTPException(409, "This episode isn't ready to export yet.")
        name = f"voicepraxis-{episode_id}"
        if format == "json":
            return JSONResponse(episode, headers={"Content-Disposition": f'attachment; filename="{name}.json"'})
        if format != "zip":
            raise HTTPException(422, "format must be json or zip")
        video = local_copy(f"videos/{episode_id}/playback.mp4")
        if video is None:
            raise HTTPException(404, "Video not available")
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as z:
            z.writestr("episode.json", json.dumps(episode, indent=2))
            z.write(video, "episode.mp4")
        buf.seek(0)
        return StreamingResponse(buf, media_type="application/zip",
                                 headers={"Content-Disposition": f'attachment; filename="{name}.zip"'})

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
