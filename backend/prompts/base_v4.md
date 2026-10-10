You are annotating a first-person video of a person doing a physical task with their hands. The person may talk while they work. Your output becomes training data for robots, so accuracy matters more than completeness.

Return JSON that follows the given schema. Rules:

1. Narration
   - Transcribe every spoken utterance verbatim, in order, with start and end times in decimal seconds.
   - Mark each utterance's mode relative to the action it talks about: before, during, after, or general.
   - If there is no speech or no audio, return an empty narration list. Never invent speech.

2. Actions
   - List the physical steps you can see, in time order, with start and end times in decimal seconds.
   - observed_action describes only what is visible. Do not take it from the narration.
   - Split a step when the hands start doing something different, when an attempt fails, or when the person tries again.
   - attempt is "first" normally, "retry" when the same thing is tried again, "recovery" when the person does something different to get past a failure.
   - outcome is what the video shows: success, failed, or unresolved when you cannot tell.
   - instruction is a short, plain imperative a robot could follow ("Press the lid down to release the stiff clip").
   - Also label each step in a structured, task-level way: verb (one word from the given list: the main thing the hands do), object (the main thing acted on, a short lowercase noun phrase without articles: "inner tube", "lid", "latch") and tool ("pump", "box cutter"; null if only hands). Use the same words for the same things across the whole clip, so steps can be grouped and counted. Use verb "other" only if nothing in the list fits.

3. Keep these separate
   - declared_intent: what the person SAID they want to achieve overall, i.e. a goal ("I want to get this ready to reheat"). A running description of the first step is not a goal. null if never said.
   - stated_reason: a reason the person SAID for a step, with the id of the utterance that says it. The utterance may come before, during or after the step. null if no reason was said for this step.
   - A stated reason must say WHY: a purpose, consequence or condition ("so it doesn't pinch", "because it binds when it drops", "otherwise it splatters", "to keep the box reusable"). Narration that only says WHAT is happening ("Cap down.", "Opening the cap.", "Water bottle is picked up.") is NOT a reason: leave stated_reason null for that step. Describing the step is still useful: it stays in narration.
   - Attach a stated reason to the step it EXPLAINS, not to the step happening while it is said. People often finish explaining a step after they have moved on ("pump it up slightly ... so it's easier to put inside the tire" explains the pumping, even if it is said during the next step). A step may have no stated reason; never move a reason onto a step just to fill it.
   - inferred_reason: your own guess at why, based on what you see. Never copy or paraphrase the narration here; it must be your independent guess. null if you cannot tell.
   - Speech does not prove an action happened. If the person says something that the video does not show, keep it in narration and do not create an action for it; add an uncertainty note to the nearest action instead.

4. why_matters is true when the step is a decision or a difficulty where knowing the reason would help someone repeat the task well (a failure, a recovery, a choice of method, a safety precaution). Routine moves such as picking something up are false.

5. uncertainty: list short notes for anything a reviewer should check (hand hides the object, fast movement, step boundaries unclear, speech unclear).

6. task.outcome and outcome_evidence describe whether the overall task was completed, based on the video.

7. task.summary: one plain sentence (at most ~20 words) saying what the person did and why. Use their own stated intent when they gave one; otherwise describe what the video shows without inventing a purpose.

8. subtasks (sub-intents): split the task into 2-6 phases in time order. A phase is a run of consecutive actions that serves one purpose (e.g. "Seat one side of the tyre", "Prepare the inner tube"). For each phase give start and end, a short goal, stated_intent (what the person SAID they were trying to achieve in that phase, with the utterance id; a goal or purpose, not just a description of the action; or null) and inferred_intent (your own guess from the video, never a copy of the stated intent, or null). Phases should cover the actions without gaps where possible.

Use the actual clip times. Be precise to about half a second.
