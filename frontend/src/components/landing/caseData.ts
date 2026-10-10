/**
 * Real pipeline output for the landing page visuals (no invented values).
 * Reference: episode da6a71bd1bd9 → template tpl-42668b58 "Open a water bottle".
 * Take: episode 35c92fd5b18f, checked against that template (3/4, one step missed).
 * Frames are stills from the two recordings at the given times.
 */

export interface CaseAction {
  start: number;
  end: number;
  verb: string;
  object: string;
  instruction: string;
}

export interface CaseUtterance {
  start: number;
  end: number;
  text: string;
}

export const REFERENCE = {
  duration: 15.21,
  task: "Open a water bottle",
  actions: [
    { start: 2.5, end: 4.0, verb: "take", object: "water bottle", instruction: "Pick up the water bottle." },
    { start: 5.6, end: 10.0, verb: "twist", object: "cap", instruction: "Twist and remove the cap from the bottle." },
    { start: 10.0, end: 12.5, verb: "place", object: "cap", instruction: "Place the cap down on the surface." },
    { start: 13.0, end: 14.2, verb: "place", object: "water bottle", instruction: "Place the water bottle back on the table." },
  ] as CaseAction[],
  narration: [
    { start: 3.6, end: 4.8, text: "Water bottle is picked up." },
    { start: 7.8, end: 8.4, text: "Opening the cap." },
    { start: 10.0, end: 10.7, text: "Cap opened." },
    { start: 12.2, end: 12.8, text: "Cap down." },
    { start: 13.9, end: 14.7, text: "Water bottle down." },
  ] as CaseUtterance[],
  frames: [
    { t: 1, src: "/case/ref-1.jpg" },
    { t: 2.5, src: "/case/ref-2_5.jpg" },
    { t: 4, src: "/case/ref-4.jpg" },
    { t: 5.5, src: "/case/ref-5_5.jpg" },
    { t: 7, src: "/case/ref-7.jpg" },
    { t: 8.5, src: "/case/ref-8_5.jpg" },
    { t: 10, src: "/case/ref-10.jpg" },
    { t: 11.5, src: "/case/ref-11_5.jpg" },
    { t: 13, src: "/case/ref-13.jpg" },
    { t: 14.5, src: "/case/ref-14_5.jpg" },
  ],
};

export type CheckStatus = "complete" | "missed";

/** The template check result, step by step, with the take's matching action. */
export const CHECK = {
  complete: 3,
  total: 4,
  steps: [
    {
      instruction: "Pick up the water bottle",
      status: "complete" as CheckStatus,
      refFrame: "/case/ref-2_5.jpg",
      take: { time: 1.5, instruction: "Pick up the water bottle.", said: "Pick up the water bottle.", frame: "/case/take-2_5.jpg" },
    },
    {
      instruction: "Twist and remove the cap from the bottle",
      status: "complete" as CheckStatus,
      refFrame: "/case/ref-7.jpg",
      take: { time: 4.5, instruction: "Twist the cap to open the water bottle.", said: "Open the cap.", frame: "/case/take-6.jpg" },
    },
    {
      instruction: "Place the cap down on the surface",
      status: "missed" as CheckStatus,
      refFrame: "/case/ref-11_5.jpg",
      take: null,
    },
    {
      instruction: "Place the water bottle back on the table",
      status: "complete" as CheckStatus,
      refFrame: "/case/ref-13.jpg",
      take: { time: 8.5, instruction: "Put the water bottle down.", said: "Put the water bottle down.", frame: "/case/take-9_4.jpg" },
    },
  ],
};
