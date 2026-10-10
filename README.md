<div align="center">

# 🎙️ VoicePraxis

### Vision shows *what* happened. Narration explains *why*.

**Task-level robot training data from narrated video: steps, sub-goals and the reasons behind them, checked against an expert, in about 30 seconds.**

[**▶ Live app**](https://voice-praxis-tau.vercel.app) · [How it works](#-how-it-works) · [Results](#-measured-results) · [Research](#-how-this-compares-to-existing-work) · [Run it](#-run-it-yourself)

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![FastAPI](https://img.shields.io/badge/FastAPI-Modal-009485) ![Gemini](https://img.shields.io/badge/Gemini-3.5_Flash_Lite_+_Transcribe-4285F4) ![Built in](https://img.shields.io/badge/built_in-12_hours-orange)

<img src="assets/review.png" alt="A take checked against an expert reference: three steps complete, 'Place the cap down' missed" width="900">

</div>

---

## 💡 The problem

Awign records **10,000+ hours of head-mounted video every day** to train robots. Today an AI tool pre-labels the video and **experts verify every label**. Robots don't need bounding boxes. They need **task-level** labels ("open the box"), the **order** of the steps, and **why** each step is done the way it is.

That *why* is never in the pixels. When a worker presses a stuck lid down before lifting it, the camera sees *a hand pressing*. Only the worker knows it's *"to take the tension off the clip."*

## ✨ The idea

**Let the worker say it while they work.** VoicePraxis turns the video plus the narration into structured annotations:

```text
Scene → Task (one-line summary, stated goal) → Sub-intents → Steps
                                                     ├─ verb · object · tool        (fixed vocabulary)
                                                     ├─ what the camera saw          (observed action)
                                                     ├─ robot-style instruction      ("Pump the tube slightly")
                                                     ├─ the reason the person SAID   (quoted, linked to the exact sentence)
                                                     └─ the model's own guess        (clearly labelled as a guess)
```

**What was seen, what was said, and what the model guessed are never mixed.** A reviewer always knows which is evidence and which is inference.

## 🎬 What it does

### 1. Record → reviewable episode in ~30 s
Record on a phone or iPad, or upload. Processing shows live stages (Listening → Watching → Linking reasons). The review page has the video, a seen/said/why timeline, sub-intents, and an editable panel for each step. Every correction is stored separately from the model output and audited in the JSON export.

<img src="assets/sub-intents.png" alt="Sub-intents with the goal the person stated for each phase" width="900">

### 2. Camera only vs with narration, side by side
The same clip goes through the same model with the same settings, and **the only difference is the audio**. On the bike-tube clip the camera-only run read **all 4 steps as different actions** and described the task **backwards** ("removes the inner tube… replaces it"). With narration, every step carries the reason the person actually gave.

<img src="assets/side-by-side.png" alt="Camera only guesses vs the reasons the person actually said" width="900">

### 3. Template check: record the expert once, check every take
Upload one narrated reference, confirm its steps, then record or upload any take. A text model compares the two **by intent** (actions and narration). **Our code, not the model,** decides each step:

| Status | Meaning |
|---|---|
| Complete | Done, and said |
| Not narrated | Done, but not mentioned |
| Said, not seen | Mentioned, but not visible |
| **Missed** | Not done and not mentioned |
| Skipped on purpose | Not done, and they said why |
| Unclear / Out of order / Extra | Needs a look |

<img src="assets/template-check.png" alt="Template check: 3 of 4 complete, one step missed" width="900">

### 4. Say "capture" … "finish"
Head-cam recordings start with adjusting the mount and small talk. The worker says **"capture"** when ready and **"finish"** when done, and VoicePraxis cuts to exactly that span using word-level timestamps. Reference recordings are never cut. This idea came from mentor feedback during the hackathon.

## ⚙️ How it works

```text
Phone / iPad (Next.js on Vercel)
   │ upload clip                                          ▲ live status · review · correct · export
   ▼                                                      │
FastAPI on Modal (CPU, Mumbai routing) ───────────────────┘
 1. ffmpeg → H.264 playback (+ 16 kHz audio)
 2. LISTEN   gemini-3.5-transcribe → word-level timestamps → sentences (the authoritative transcript)
 3. TRIM     optional "capture" … "finish" cut
 4. WATCH    gemini-3.5-flash-lite: video at 4 fps + the transcript → steps, sub-intents, reasons (strict JSON schema)
 5. LINK     our code: ids, every cited sentence must exist, sub-intent grouping, guards against model run-ons
 6. (opt.)   camera-only run in parallel · template check (text-only)
 7. store    Modal Volume (video, served with HTTP range requests) + Modal Dict (episodes, templates)
```

**Design choices that matter**

| Decision | Why |
|---|---|
| **Two-stage speech** (dedicated speech-to-text, then video) | On a noisy nail-gun clip, the video model's own transcript was fragments ("Yo", "watch the not bind yourself"). The speech-to-text model recovered *"it'll bind cuz it drops."* |
| **A reason must say *why*** | "Cap down." describes; "so it doesn't pinch" explains. Only explanations count as reasons |
| **Code decides, the model suggests** | The model matches steps; deterministic code assigns statuses, checks every reference exists, and writes the messages using the take's own timestamps |
| **Feature switches** | Side-by-side, templates and keywords each switch on or off per environment with no redeploy, so a failing feature never blocks the core |
| **Mumbai routing** | A 30 MB upload took ~3 s instead of ~18 s through the default US route |

## 📊 Measured results

All measured on the live system today (our own clips, exploratory, not a benchmark):

| | |
|---|---|
| ⏱️ **Upload → reviewable episode** (35 s clip) | 27–57 s, median ≈ **33 s** (32 runs) |
| 🎯 **Template check**, water-bottle task (each take checked twice) | Reference video: **4/4 Complete** · take that skipped "put the cap down": **3/4, that step Missed** |
| 👁️ **Camera only vs narration** (bike clip) | Camera only misread **4/4** steps; with narration, **3/4** steps carry a spoken *why* |
| 🗣️ **Narration timing** | Within ~1 s of the video's own caption timings |
| 💰 **Added cost of capturing the *why*** | **≈ $0.30 per hour of video**: the speech-to-text step (`gemini-3.5-transcribe`, $0.005/min list price). The video-model pass is left out: Awign already runs a vision pre-labeller |

**At Awign's scale:** adding narration to 10,000 h of video a day costs ≈ **$3K a day** in speech-to-text. Manual annotators can't recover intent at any price, because they weren't there. The expert's job stays *verifying*, and the data gains the one thing no camera captures: the reason.

## 🔬 How this compares to existing work

| Existing approach | Where its language comes from | What VoicePraxis does differently |
|---|---|---|
| Vision-only auto-labelling | The model's reading of the pixels | Adds the worker's stated reasons; the model's own guesses are kept separate and labelled |
| **Ego4D** dense narration | 2 third-party annotators per clip, 13.2 sentences/min, 3.85M sentences | No second annotation pass; comes from the person who did the task |
| **EPIC-KITCHENS** | Participants narrate their own videos *afterwards* | Narration happens **live**, aligned automatically with word timestamps |
| **Ego-Exo4D** expert commentary | Coaches comment on skilled activity | The *why* comes from the worker, at no extra labour |
| **HowTo100M** narrated video | Speech recognition of YouTube; ~50% of clip–narration pairs misaligned | Statements "explaining the consequence of actions" are discarded there as *not visually alignable*. **We keep exactly those**: they're the reasons |
| Crowdsourced robot instructions | ~$0.70 per annotation; noisy (104 unique instructions for 39,350 episodes) | Instruction **and** reason from the demonstrator, at capture time |
| Mistake detection (Assembly101, EgoPER, CaptainCook4D) | Models trained per dataset | **No training**: one reference recording; statuses map to their error types (omission → Missed, addition → Extra) plus a narration dimension |

<details>
<summary><b>Sources</b></summary>

[Ego4D](https://arxiv.org/pdf/2110.07058) · [NaQ (Ego4D narration stats)](https://arxiv.org/pdf/2301.00746) · [EPIC-KITCHENS](https://arxiv.org/pdf/2005.00343) · [Ego-Exo4D](https://openaccess.thecvf.com/content/CVPR2024/html/Grauman_Ego-Exo4D_Understanding_Skilled_Human_Activity_from_First-_and_Third-Person_Perspectives_CVPR_2024_paper.html) · [MIL-NCE](https://arxiv.org/pdf/1912.06430) · [Temporal Alignment Networks](https://openaccess.thecvf.com/content/CVPR2022/papers/Han_Temporal_Alignment_Networks_for_Long-Term_Video_CVPR_2022_paper.pdf) · [ALFRED](https://arxiv.org/pdf/1912.01734) · [MolmoAct2](https://arxiv.org/pdf/2605.02881) · [Dense language annotations](https://arxiv.org/pdf/2605.17077) · [CaptainCook4D](https://arxiv.org/html/2312.14556v4) · [Mistake analysis review](https://arxiv.org/pdf/2510.19292) · [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) · Awign context: [StartupFeed](https://startupfeed.in/?p=5493), [ThirdAI case study](https://www.thirdaiautomation.com/case-studies/awign-robotics-training-data-annotation)
</details>

## 🧾 The data

One step from a real production episode (JSON export, schema 0.2):

```json
{
  "id": "action-03",
  "start": 17.0, "end": 23.6,
  "verb": "take", "object": "inner tube", "tool": "pump",
  "observed_action": "The person picks up the inner tube and begins to pump it slightly.",
  "instruction": "Pump up the inner tube slightly so it becomes round.",
  "stated_reason": {
    "text": "make sure that you pump up the tube slightly just so it becomes round",
    "source": "narration",
    "evidence_ref": "speech-07"
  },
  "inferred_reason": "to give the tube shape for easier installation",
  "attempt": "first", "outcome": "success",
  "review_status": "unreviewed", "human_corrections": []
}
```

Each episode also carries: the word-timed `narration`, `subtasks` (each with a stated or guessed intent), `pending_questions` (decision steps with no reason), `template_check`, the camera-only `video_only` run, and a `pipeline` block (models, frame rate, prompt version, the keyword cut) so every label is traceable. Download it as JSON, or as a zip with the video.

## ⏱️ Built in one day

Hackathon rules: nothing built before October 10. Everything here happened during the event (IST):

| Time | Milestone |
|---|---|
| 11:39 | First commit |
| 12:50 | Hour-0 test of 7 Gemini settings → **Flash Lite, 4 fps** chosen on measured quality and speed |
| 13:16 | Live pipeline on Modal: upload → ffmpeg → Gemini → episode JSON |
| 14:31 | Task-level labels: `verb · object · tool` |
| 14:57 | **Two-stage speech** (dedicated speech-to-text), sub-intents, one-line summary |
| 15:03 | Enterprise UI pass |
| **15:19** | **`mvp-v1`**: all 10 MVP checks pass on the live site; first phone recording end to end |
| **15:47** | **`v1.1`**: camera only vs narration, side by side |
| **17:21** | **`v1.2`**: template mode + "capture/finish" trimming |
| 17:38 | Prompt v4: a reason must say *why* |

Every feature went **branch → separate test backend → PR → production → smoke test → tag**. Production was never broken.

## 🚀 Run it yourself

<details>
<summary><b>Backend</b> (Python 3.12, uv, Modal)</summary>

```bash
cd backend
uv sync
cp .env.example .env                       # add GEMINI_API_KEY (comma-separate several keys to rotate)
modal secret create gemini GEMINI_API_KEY=<key> --env main
modal secret create vp-flags SIDE_BY_SIDE=1 TEMPLATES=1 KEYWORDS=1 COPILOT=0 REVIEW_QUEUE=0 INDIC=0 VISION_OVERLAY=0 --env main
modal deploy app.py --env main             # prints the API URL
scripts/smoke.sh <api-url>                  # end to end: upload → analysis → edit → export
```
</details>

<details>
<summary><b>Frontend</b> (Next.js)</summary>

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_BASE=<api-url>" > .env.local
npm run dev                                 # http://localhost:3000
```
On Vercel: Root Directory `frontend`, environment variable `NEXT_PUBLIC_API_BASE`.
</details>

<details>
<summary><b>API</b></summary>

| Method | Path | Purpose |
|---|---|---|
| POST | `/episodes` | Upload a clip (`file`; optional `template_id`, `purpose=reference`) → `{id}` |
| GET | `/episodes/{id}` | Live status (`converting → listening → trimming → analysing → linking → checking → ready`) + episode |
| PATCH | `/episodes/{id}` | Corrections: `{"changes": [{"target": "action-03", "field": "observed_action", "value": "…"}]}` |
| GET | `/episodes/{id}/export?format=json\|zip` | Download |
| GET | `/episodes/{id}/video` | Playback (range requests) |
| GET/POST/PATCH/DELETE | `/templates…` | References |
| POST | `/episodes/{id}/check` | (Re)check an episode against a template |
| GET | `/config` | Feature switches |
</details>

## 🧭 Roadmap

- **Automated QC (Awign problem a):** flag bad recordings before human review (hands out of frame, no narration, wrong task), using the same pipeline plus hand tracking
- **Diversity filtering (problem c):** the `verb · object` vocabulary makes "100 hours of the same scenario" countable
- **Indian-language narration:** keep the worker's own words, label in English
- **Ask the worker "why?" on the spot:** questions for steps that matter but have no reason, answered before they leave the bench
- **Export formats:** EPIC-KITCHENS-style action CSV and language-segment JSONL for robot-policy training

## ⚖️ Honest boundaries

- These are **language and reason annotations for human demonstration video**, not robot-control data (no robot states or actions; not LeRobot- or RLDS-ready).
- **Results are exploratory:** our own clips, scored by us.
- **The model varies between runs,** which is why references are confirmed by a human, and why model guesses are labelled as guesses.
- **Confidence is not a calibrated probability.**

---

<div align="center">
<b>Built solo at the Awign Physical AI Hackathon, Bengaluru · October 10–11, 2026</b>
</div>
