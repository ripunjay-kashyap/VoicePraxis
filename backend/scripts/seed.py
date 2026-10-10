"""Create or refresh a saved episode (works with no model call; PLAN §6).

Copies an already-processed episode (its video + model output) to a fixed id and
marks it saved, so the demo has a labelled fallback. Re-running resets it.

    uv run python scripts/seed.py --env main --from 765d39dab4c9 --id saved-example-01 \
        --label "Saved episode · bike tube (YouTube test clip)"
"""

import argparse
import copy
import time

import modal


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", required=True)
    ap.add_argument("--from", dest="src", required=True, help="processed episode id to copy")
    ap.add_argument("--id", required=True, help="fixed id for the saved episode")
    ap.add_argument("--label", required=True, help="shown in the UI; say that it's saved")
    args = ap.parse_args()

    episodes = modal.Dict.from_name("vp-episodes", environment_name=args.env)
    volume = modal.Volume.from_name("vp-videos", environment_name=args.env)

    src = episodes.get(args.src)
    if not src or src.get("status") != "ready":
        raise SystemExit(f"{args.src} is missing or not ready")

    data = b"".join(volume.read_file(f"videos/{args.src}/playback.mp4"))
    with volume.batch_upload(force=True) as batch:
        import io
        batch.put_file(io.BytesIO(data), f"videos/{args.id}/playback.mp4")

    model_output = copy.deepcopy(src["model_output"])
    model_output["episode_id"] = args.id
    episodes[args.id] = {
        **{k: src.get(k) for k in ("duration", "timings", "template_id", "video_only_output")},
        "id": args.id,
        "status": "ready",
        "stage": "ready",
        "error": None,
        "created_at": time.time(),
        "original": "playback.mp4",
        "model_output": model_output,
        "corrections": [],
        "saved": True,
        "label": args.label,
        "seeded_from": args.src,
    }
    print(f"saved episode {args.id} ← {args.src} ({len(data) / 1e6:.1f} MB video)")


if __name__ == "__main__":
    main()
