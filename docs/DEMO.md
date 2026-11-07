# Demo script (3 minutes, fixture mode)

Start state: dev server running, browser at `http://localhost:3000/`, window at 1440 wide. No keys needed. To reset, open `/` again and click "Open the EXAMPLE workspace": each click starts a fresh workspace.

**0:00 The hook.** The landing page shows Rin Okafor's flat CV, labeled EXAMPLE. Say: "A resume says what you claim. This shows what your work proves." Point at the two olive cards: "Kerf. Maintainer." is struck through, with what the sources really show.

**0:20 Import.** Click "Open the EXAMPLE workspace", then "Import 3 projects". Fifteen sources appear, each with its status. Say: fixture mode reads only EXAMPLE files, no network, no model; live mode reads GitHub's public API through an allowlist.

**0:50 Claims with literal quotes.** Scroll to "Every claim carries its quote". Click any quote: the source opens with the quote highlighted where it appears. Say: a claim survives only if its quote is in the source word for word; a README naming you is not authorship; commits by someone else never count for you. Click "Approve all 8 quoted claims" (or approve one by hand, then the rest).

**1:20 The question.** The goal is prefilled: "Founding engineer for our field-inspection app: offline sync, releases, and running it in production". Click "Ask". Read the heading: "What can you entrust to Rin Okafor, and why?" Three answers:
- Demonstrated: offline-first sync with conflict resolution. Click a quote to show the PR.
- Demonstrated, with a "shared work" limit: own releases and preview deploys.
- Unknown: run it in production. One question would settle it.

**2:00 Human correction.** Under "Own releases and preview deploys", click `Correct "Co-maintains Kerf, including its release process"`. Click "Use Rin's correction (EXAMPLE)", then "Save correction". The page scrolls to "Two views, one ledger": the ribbon says the capability was withdrawn from both views, the client portfolio no longer shows it, and the dossier lists it as withdrawn after human review. Scroll up and click "Re-evaluate": it returns as Inferred, with the limit "Corrected by the builder (rev 2)". Both views agree.

**2:40 Close.** Scroll to "What could Rin build next?": an offline field-notes app with AI tagging, each part linked to its evidence, with the gaps stated. Beside it, three fictional employers with their sponsorship signal, labeled "Historical filings ≠ current policy" and "Not legal advice". Optionally click "Create private link" on the dossier and open it: "No eligibility assessment", questions for the attorney, the review log.

## If something goes wrong

- Blank studio: the owner cookie is missing. Go to `/` and click "Open the EXAMPLE workspace".
- Live mode on stage: only with `AI_MODEL` and a key in `.env.local`. Without them, import still shows GitHub sources and reports that the model is not configured. Say so; do not pretend.
- Scripted rehearsal: `npm run walkthrough` drives the whole flow and saves screenshots to `walkthrough/`.
