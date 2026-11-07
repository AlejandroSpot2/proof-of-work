# Redesign direction (approved pass, no blocking round)

## The problem

The studio answered every question at once on one 12.7-screen scroll: 1,749 words, 27 blocks, 3 of them on the first screen, a 68px question over three lines, and the system's own words (ledger, claim, fixture, deterministic) in front of the story. It read like a database admin tool.

## The argument, one screen per claim

| Screen | The claim it makes | Its proof |
| --- | --- | --- |
| Start (`/`) | Turn your projects into proof of what you can do. | A CV line beside the proof card it becomes. One button. |
| Before | A CV lists claims. It cannot show the work. | Rin's flat CV, short. |
| What Rin built | Three real projects, read from their files. Rin's part and others' part are kept apart. | Three project cards with their EXAMPLE artifact, plain summaries, proof on click. |
| What Rin can do | A client could hand Rin these tasks, and here is why. | Tasks in verbs, each marked "Shown in the work", "Likely, not proven" or "Not shown yet", sources one click away. |
| Where it could lead | Roles in San Francisco where that work fits, with what each source says about sponsorship. | Three EXAMPLE employers, match reasons citing proof, plain caveats. |
| For an attorney | A first-consult dossier: who did what, what is documented, what is only Rin's word, what to ask. | The dossier summary and the private link. |
| What Rin could build next | The finale: a bounded MVP from evidenced parts, and the concrete next step toward San Francisco. | MVP parts with proof, the gaps, and next steps built from the data. |

## Shell

App screen, `framed-sheet` style (seed 1071196506), brand palette and Switzer kept. A tinted green-grey L-frame holds the step list on the left (where am I) and a 48px bar with Back and Next (what next). Each step is its own view on a white sheet with one h1 at 28px. Arrow keys move between steps. The workbench (`/studio`) stays as the free-explore tool mode.

**Face:** the frame tinted from Rin's olive, and the olive as the one hue on the main data element of each step (the support mark of a task, the strongest signal of a role).
**Signature element:** the proof link. Every statement, task, match reason and MVP part carries a small "proof" control with its count, opening a drawer with the literal quotes, each openable in its source.

## Words

Plain English up front. "Statements" instead of claims; "Shown in the work / Likely, not proven / Not shown yet" instead of demonstrated / inferred / unknown; the engine and the ledger revision move to a footnote. Legal caveats sit in one short notice per screen, not in every paragraph.

## Honesty rules kept

Everything is EXAMPLE and labeled. The import runs for real against the fixture files and shows each file as it is read; nothing simulates progress. Confirming statements is a human click. No model is claimed: the footnote says the example uses rules, not AI.
