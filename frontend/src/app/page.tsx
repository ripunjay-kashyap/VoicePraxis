import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  Mic,
  Eye,
  ClipboardCheck,
  Video,
  Download,
  PencilLine,
  Columns2,
  Layers,
  Scissors,
  Check,
} from "lucide-react";
import { SiteFooter } from "@/components/site/SiteHeader";
import { PhoneQr } from "@/components/landing/PhoneQr";

const HeroScene = dynamic(() => import("@/components/landing/HeroScene").then((m) => m.HeroScene));
const CaseStudyScene = dynamic(() => import("@/components/landing/CaseStudyScene").then((m) => m.CaseStudyScene));

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{children}</p>;
}

function Section({ id, children, className = "" }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-16 py-16 sm:py-24 ${className}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">{children}</div>
    </section>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

const STEPS = [
  {
    icon: Video,
    title: "Record and talk",
    body: "Do the task on a phone or head-cam and say what you're doing and why. Say “capture” when you're ready and “finish” when you're done.",
  },
  {
    icon: Mic,
    title: "We listen, then watch",
    body: "Speech is transcribed word by word. The video is then read alongside it to find the steps, the sub-goals and the reasons.",
  },
  {
    icon: ClipboardCheck,
    title: "Review and export",
    body: "Each step shows what was seen, what was said and what was guessed. Correct anything, then export the episode as JSON.",
  },
];

const RESULTS = [
  { value: "≈ 33 s", label: "From upload to a reviewable episode", note: "Median for a 35 s clip, 32 runs" },
  { value: "3 / 4", label: "Missed step caught on the take", note: "Reference matched itself 4 / 4; repeat checks agreed" },
  { value: "4 of 4", label: "Steps misread by the camera alone", note: "Same clip, same model, without the audio" },
  { value: "≈ $0.30", label: "Per hour of video to capture the why", note: "Speech-to-text only; vision labelling already exists" },
];

const COMPARE = [
  { who: "Vision-only auto-labelling", from: "The model's reading of the pixels", diff: "Adds the reasons the worker gave; model guesses stay labelled as guesses" },
  { who: "Third-party narration (Ego4D)", from: "Annotators describe the video afterwards", diff: "No second pass: the language comes from the person doing the task" },
  { who: "Participant narration (EPIC-KITCHENS)", from: "Workers narrate their own video afterwards", diff: "Narrated live and aligned automatically, word by word" },
  { who: "Narrated web video (HowTo100M)", from: "Speech discarded when it isn’t visible", diff: "Statements about consequences are kept: they are the reasons" },
];

export default function Home() {
  return (
    <>
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-slate-200 bg-white">
          <div
            className="absolute inset-0 pointer-events-none opacity-60"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, #e2e8f0 1px, transparent 0)",
              backgroundSize: "24px 24px",
              maskImage: "linear-gradient(to bottom, black, transparent 85%)",
            }}
          />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-10">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Task-level annotation for robot learning
              </span>
              <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900 text-balance leading-[1.05]">
                The camera shows <span className="text-slate-400">what</span> happened.
                <br className="hidden sm:block" /> The worker can tell you <span className="underline decoration-orange-300 decoration-4 underline-offset-[6px]">why</span>.
              </h1>
              <p className="mt-6 text-base sm:text-lg text-slate-600 leading-relaxed text-pretty max-w-2xl mx-auto">
                VoicePraxis turns a narrated recording into steps, sub-goals and the reasons behind them, so experts
                verify labels instead of writing them.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/capture"
                  className="h-11 px-5 rounded-lg bg-slate-900 text-white text-sm font-medium inline-flex items-center gap-2 hover:bg-slate-800 transition-colors w-full sm:w-auto justify-center"
                >
                  Record a task <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="#case"
                  className="h-11 px-5 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-medium inline-flex items-center gap-2 hover:bg-slate-50 transition-colors w-full sm:w-auto justify-center"
                >
                  See a real example
                </a>
              </div>
              <p className="mt-5 text-xs text-slate-500">Works on a phone or iPad · about 30 seconds per clip · JSON export</p>
            </div>

            <div className="mt-12 sm:mt-14 rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_40px_-12px_rgba(15,23,42,0.12)] overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-slate-200 bg-white/70 text-xs text-slate-500">
                <span className="font-medium text-slate-700">Open a water bottle · 15 s recording</span>
                <span className="flex items-center gap-4">
                  <LegendDot color="#2563eb" label="Seen" />
                  <LegendDot color="#c2410c" label="Said" />
                  <LegendDot color="#94a3b8" label="Linked" />
                </span>
              </div>
              <HeroScene className="w-full aspect-[4/3] sm:aspect-[16/8] lg:aspect-[16/7]" />
            </div>
            <p className="mt-3 text-center text-xs text-slate-400">Real output from a recording made during the build.<span className="hidden lg:inline"> Move the pointer to tilt.</span></p>
          </div>
        </section>

        {/* Problem */}
        <Section>
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="space-y-5">
              <Eyebrow>The problem</Eyebrow>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 text-balance">
                Robots need the task and the reason, not just the bounding box.
              </h2>
              <p className="text-slate-600 leading-relaxed">
                Teams record thousands of hours of head-cam video to teach robots everyday tasks. An AI tool pre-labels
                it and experts check every label. But the purpose of a step is never in the pixels: the camera sees a
                hand lift a tube, only the worker knows it&rsquo;s pumped up <em>so it doesn&rsquo;t pinch</em>.
              </p>
              <p className="text-slate-600 leading-relaxed">
                Annotators watching later can&rsquo;t recover that intent at any price. They weren&rsquo;t there.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">Same clip, same model. Only the audio differs.</span>
                <span className="text-slate-400">0:17 – 0:24</span>
              </div>
              <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                <div className="p-5 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> Camera only
                  </p>
                  <p className="text-sm font-medium text-slate-900">Lift the wheel up from the workbench.</p>
                  <p className="text-sm text-slate-500">
                    <span className="text-xs uppercase tracking-wider text-slate-400 mr-1.5">Guess</span>
                    to pull out the inner tube
                  </p>
                  <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-md px-2.5 py-1.5">
                    Read the whole task backwards: &ldquo;removes the inner tube and replaces it&rdquo;
                  </p>
                </div>
                <div className="p-5 space-y-3 bg-slate-50/50">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5" /> With narration
                  </p>
                  <p className="text-sm font-medium text-slate-900">Pump up the inner tube slightly so it becomes round.</p>
                  <p className="text-sm text-orange-800">
                    <span className="text-xs uppercase tracking-wider text-orange-600 mr-1.5">Said</span>
                    &ldquo;make sure that you pump up the tube slightly just so it becomes round&rdquo;
                  </p>
                  <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-md px-2.5 py-1.5">
                    Task: prepares the tire and inner tube for a flat repair
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* How it works */}
        <Section id="how" className="bg-white border-y border-slate-200">
          <div className="max-w-2xl">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 text-balance">
              One recording in. Reviewable annotations out.
            </h2>
          </div>
          <ol className="mt-10 grid md:grid-cols-3 gap-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                    <s.icon className="w-5 h-5 text-slate-700" />
                  </span>
                  <span className="text-sm font-medium text-slate-300">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-base font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-16 grid lg:grid-cols-5 gap-10 items-center">
            <div className="lg:col-span-2 space-y-4">
              <Eyebrow>What you get</Eyebrow>
              <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 text-balance">
                Evidence and inference, never mixed.
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Every step keeps what the camera saw, the reason the person said (quoted and linked to the exact
                sentence) and the model&rsquo;s own guess, labelled as a guess. A reviewer always knows which is which.
              </p>
              <p className="text-sm text-slate-500 font-mono bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                Scene → Task → Sub-goals → Steps
              </p>
            </div>
            <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">Step 3 · take · inner tube</span>
                <span className="text-xs text-slate-500 font-mono">0:17 – 0:23</span>
              </div>
              <dl className="divide-y divide-slate-100 text-sm">
                {[
                  { k: "Seen", c: "text-blue-700", v: "The person picks up the inner tube and begins to pump it slightly." },
                  { k: "Instruction", c: "text-slate-500", v: "Pump up the inner tube slightly so it becomes round." },
                  { k: "Said", c: "text-orange-700", v: "“make sure that you pump up the tube slightly just so it becomes round”", q: true },
                  { k: "Guess", c: "text-slate-400", v: "to give the tube shape for easier installation", g: true },
                ].map((r) => (
                  <div key={r.k} className="grid grid-cols-[6.5rem_1fr] gap-3 px-5 py-3.5">
                    <dt className={`text-xs font-semibold uppercase tracking-wider pt-0.5 ${r.c}`}>{r.k}</dt>
                    <dd className={r.q ? "text-orange-900" : r.g ? "text-slate-500 italic" : "text-slate-800"}>{r.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Section>

        {/* Case study */}
        <Section id="case">
          <div className="grid lg:grid-cols-3 gap-8 items-end">
            <div className="lg:col-span-2 space-y-4">
              <Eyebrow>Case study · Template check</Eyebrow>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 text-balance">
                Record the expert once. Catch the missed step on every take.
              </h2>
              <p className="text-slate-600 leading-relaxed max-w-2xl">
                The reference is a narrated recording of opening a water bottle, done the right way. Its four steps were
                confirmed once. The take below skipped putting the cap down. Steps are matched by intent, using both
                the actions and the narration, and the verdict for each step is decided by rules, not by the model.
              </p>
            </div>
            <div className="flex lg:justify-end">
              <Link
                href="/templates"
                className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-medium inline-flex items-center gap-2 hover:bg-slate-50"
              >
                Try template check <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.12)] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-slate-200 bg-white text-xs">
              <span className="font-medium text-slate-700">Open a water bottle · take checked against the reference</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 px-2.5 py-0.5 font-medium">
                3 of 4 complete · 1 missed
              </span>
            </div>
            <CaseStudyScene className="w-full aspect-[3/4] sm:aspect-[16/10] lg:aspect-[16/7]" />
          </div>

          <div className="mt-6 grid sm:grid-cols-3 gap-4">
            {[
              { t: "Reference against itself", v: "4 of 4 complete" },
              { t: "Take that skipped a step", v: "“Place the cap down” flagged as missed" },
              { t: "Checked twice", v: "Identical result both times" },
            ].map((x) => (
              <div key={x.t} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">{x.t}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{x.v}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Product */}
        <Section className="bg-white border-y border-slate-200">
          <div className="max-w-2xl">
            <Eyebrow>The review workspace</Eyebrow>
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 text-balance">
              Built for the expert who verifies.
            </h2>
          </div>
          <div className="mt-10 grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-slate-100 p-1.5 shadow-sm">
              <div className="flex items-center gap-1.5 px-2.5 py-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/screens/review.png"
                alt="Review page: a take checked against the reference, with the missed step flagged"
                className="w-full rounded-xl border border-slate-200 bg-white"
                loading="lazy"
              />
            </div>
            <ul className="lg:col-span-4 space-y-5">
              {[
                { icon: Columns2, t: "Camera only vs narration", d: "See exactly what the narration added, side by side." },
                { icon: Layers, t: "Sub-goals", d: "Phases of the task, each with the goal the person stated." },
                { icon: PencilLine, t: "Correct in place", d: "Edits are stored apart from the model output and kept in the export." },
                { icon: Scissors, t: "Capture … finish", d: "Mount adjusting and small talk are cut using word timings." },
                { icon: Download, t: "Export", d: "One JSON per episode, or a zip with the video." },
              ].map((f) => (
                <li key={f.t} className="flex gap-3.5">
                  <span className="w-9 h-9 shrink-0 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center">
                    <f.icon className="w-4 h-4 text-slate-700" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{f.t}</p>
                    <p className="text-sm text-slate-600">{f.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* Results */}
        <Section id="results">
          <div className="max-w-2xl">
            <Eyebrow>Results</Eyebrow>
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 text-balance">
              Measured on the live system.
            </h2>
          </div>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {RESULTS.map((r) => (
              <div key={r.label} className="rounded-2xl border border-slate-200 bg-white p-6">
                <p className="text-3xl font-semibold tracking-tight text-slate-900">{r.value}</p>
                <p className="mt-2 text-sm font-medium text-slate-800">{r.label}</p>
                <p className="mt-1 text-xs text-slate-500">{r.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-400">Our own clips, scored by us: exploratory, not a benchmark.</p>

          <div className="mt-16 rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">How it compares</h3>
              <p className="text-sm text-slate-500">Where existing approaches get the language for video, and what changes here.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {COMPARE.map((c) => (
                <div key={c.who} className="grid md:grid-cols-[1.1fr_1fr_1.3fr] gap-1 md:gap-6 px-5 sm:px-6 py-4 text-sm">
                  <p className="font-medium text-slate-900">{c.who}</p>
                  <p className="text-slate-500">{c.from}</p>
                  <p className="text-slate-800 flex gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    {c.diff}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Final call to action */}
        <Section className="pt-0 sm:pt-0">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm grid md:grid-cols-[1fr_auto] gap-8 items-center">
            <div className="space-y-4">
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 text-balance">
                Try it with any small task.
              </h2>
              <p className="text-slate-600 max-w-xl">
                Open a box, pour a glass, fix a tube. Talk as you go: what you&rsquo;re doing and why. Your episode is
                ready to review in about half a minute.
              </p>
              <Link
                href="/capture"
                className="h-11 px-5 rounded-lg bg-slate-900 text-white text-sm font-medium inline-flex items-center gap-2 hover:bg-slate-800 transition-colors"
              >
                Record a task <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <PhoneQr path="/capture" />
          </div>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
