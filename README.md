# VoicePraxis

**Task-level annotation for robot training data, from narrated video.**

A worker does a physical task while saying what they're doing and why. VoicePraxis turns the video and the narration into structured annotation: the task, its sub-intents, each step with a task-level label (`verb · object · tool`), a robot-style instruction, and the reason the person gave. An expert reviews and corrects it in the browser, then downloads it as JSON.

Built at the Awign Physical AI hackathon (October 10–11, 2026) for Awign's problem statement on **automated task-level annotation**, where the current tool auto-annotates and experts verify.

**Live app:** https://voice-praxis-tau.vercel.app

## What it produces

```text
Scene ─► Task (summary, declared intent, outcome)
          └─► Sub-intents (goal, intent the person said, or the model's labelled guess)
                └─► Actions: start/end, verb · object · tool, observed action, instruction,
                             stated reason (linked to the exact words), inferred reason (labelled),
                             attempt (first/retry/recovery), outcome, uncertainty, review status
Narration: word-timed transcript; each sentence that explains a step is linked to it
Human corrections: stored separately from the model output; the export shows what was changed
```

What the camera shows, what the person said, and the model's own guesses are kept in separate fields and never mixed.

## How it works

```text
Phone / browser (Next.js on Vercel)
   │ upload clip                                  ▲ poll status, review, correct, export
   ▼                                              │
FastAPI on Modal (CPU, Mumbai routing) ───────────┘
   1. store original (Modal Volume)
   2. ffmpeg → H.264 playback.mp4 (+ 16 kHz audio)
   3. Listening: gemini-3.5-transcribe → word-level timestamps → utterances
   4. Watching: gemini-3.5-flash-lite, video at 4 fps + the transcript → steps, sub-intents, reasons (JSON schema)
   5. Linking: our code assigns ids, checks every cited utterance exists, groups steps into sub-intents
   6. save (Modal Dict); serve video with HTTP range requests
```

A 35 s clip takes about 35–45 s from upload to a reviewable episode.

## Run it

### Backend (`backend/`, Python 3.12, [uv](https://docs.astral.sh/uv/), [Modal](https://modal.com))
```bash
cd backend
uv sync
cp .env.example .env                       # add GEMINI_API_KEY (comma-separate several keys to rotate)
modal secret create gemini GEMINI_API_KEY=<key> --env main
modal secret create vp-flags SIDE_BY_SIDE=0 COPILOT=0 TEMPLATES=0 INDIC=0 VISION_OVERLAY=0 --env main
modal deploy app.py --env main             # prints the API URL
scripts/smoke.sh <api-url>                  # end-to-end check: upload → analysis → edit → export
uv run python scripts/seed.py --env main --from <episode-id> --id saved-example-01 --label "Saved episode · …"
```

### Frontend (`frontend/`, Next.js)
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_BASE=<api-url>" > .env.local
npm run dev                                 # http://localhost:3000
```
On Vercel: Root Directory `frontend`, environment variable `NEXT_PUBLIC_API_BASE`.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/episodes` | Upload a clip (multipart field `file`) → `{id}`; processing starts automatically |
| GET | `/episodes/{id}` | Status (`uploaded → converting → listening → analysing → linking → ready / failed`) and the episode |
| PATCH | `/episodes/{id}` | Corrections: `{"changes": [{"target": "action-03", "field": "observed_action", "value": "…"}]}` |
| GET | `/episodes/{id}/export?format=json\|zip` | Download the episode JSON, or JSON + video |
| GET | `/episodes/{id}/video` | Playback video (range requests) |
| GET | `/episodes?saved=true` | Saved episodes |
| POST | `/episodes/{id}/reset` | Reset edits on a saved episode |

## Claim boundary

This produces **language and reason annotations for human demonstration video**. It is not robot-control data: there are no robot states or actions, so it is not LeRobot- or RLDS-ready. Model guesses are labelled as guesses, and the confidence of a step is shown as review flags, not as a calibrated probability.
