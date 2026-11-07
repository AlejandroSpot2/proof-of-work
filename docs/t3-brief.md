Build "Proof of Work" (working name), a hackathon app, in this repo (C:\Users\alejo\Documents\Repos\proof-of-work). The design is APPROVED: read docs/hackathon-plan.md fully and follow it as the contract, including every evidence, privacy, SSRF, budget and scope constraint. Do not stop to ask design questions; make reasonable decisions and note them in docs/DECISIONS.md.

Load and use the available skills: design-taste-frontend, brainstorming (design already approved: skip the approval gate), writing-plans/executing-plans, verification-before-completion.

Deadline: build closes 6:00 PM PT today, demos at 6:15 PM PT. Priority is a demo that truly works with real wow factor.

Order of work:
1. Working vertical slice end-to-end FIRST: import 3 project URLs → sources with status → claims with literal quotes → approve/correct → 1 goal → "What can you entrust to this person, and why?" with up to 3 capabilities (demonstrated / inferred / unknown, clickable evidence, limits, ≤1 question) → 2 views (client portfolio + private attorney dossier) where a human correction really changes both views and removes obsolete capabilities.
2. Fixture mode that runs with NO keys, clearly labeled EXAMPLE data (hypothetical person, never claim the user's skills). Live mode real per plan (GitHub public API, allowlisted fetch, AI SDK generateObject + Zod, configurable model via env).
3. Then elevate design: English UI for an SF stage, polished editorial explorer feel, instant hook in the first seconds, clear progression evidence → capabilities, strongest moment last (the entrust question + human correction propagating to both views). Short purposeful animations only. No fake charts, fake terminals, or invented stats.

Constraints: Next.js App Router + TypeScript; Drizzle with local SQLite for today (Neon later optional; don't run both). .env.example with placeholders only; never read, print or commit secrets. No public deploy, no git remote/push, no paid services, no messages to third parties. Jev optional relevance ranking only, never truth; skip if not clearly helpful. Commit locally in small steps.

Definition of done: `npm run build` and typecheck pass, tests for the acceptance cases in the plan (attribution, quote traceability, propagation, SSRF, privacy token, weak evidence, unsupported goal, regeneration) pass, and a scripted walkthrough of the demo works in fixture mode with screenshots or equivalent UI evidence. When ready, start the dev server and leave it running, and report the URL, what works, what is mocked, and any blockers.
