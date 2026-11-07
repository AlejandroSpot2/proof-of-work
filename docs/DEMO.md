# Demo script (3 minutes, desktop, no keys)

Start state: dev server running, browser at `http://localhost:3000/`, window 1440 wide or a projector at 1280 or more. Everything is EXAMPLE data. The rehearsal link `http://localhost:3000/api/example/start?to=/demo` starts a fresh run at any time; "Start over" in the step list does the same.

Move with the **Next** button (top right), **Back**, the step list on the left, or the arrow keys.

**0:00 Start.** The landing page says "Turn your projects into proof", with a CV line beside what its files really show. Say: "A resume says what you claim. This shows what your work proves." Click **See the 3-minute example**.

**0:15 The CV (step 1).** Rin Okafor's flat CV, fictional. Say: every line is a claim, none shows who did what. Point at the three things Proof of Work does instead. Click **Read Rin's 3 projects**.

**0:35 What Rin built (step 2).** The fifteen files appear as they are read, then three project cards: what each project is, Rin's part, others' part (by name, from the commit history), and the outcome or what is not shown yet. Click **See the proof** on Tidepool: the quotes, word for word; click one to open its file with the quote highlighted. Close it. Click **Rin confirms all 8**: nothing reaches a client before Rin confirms it.

**1:05 What Rin can do (step 3).** Click **Answer for this client**. Three tasks for the client's need: two **Shown in the work**, one **Not shown yet** with the one question that would settle it. Each task has **See the proof**. Say: the level is capped by the proof; no AI model in this example.

**1:35 Where it could lead (step 4).** Rin is outside the US. Three fictional San Francisco roles: one whose current posting says it sponsors visas, one with past filings only, one unknown. Each lists which of Rin's tasks fit, with proof. The caveats sit in one row: not legal advice, historical filings ≠ current policy, one role's sponsorship ≠ all visa types.

**2:00 For an attorney (step 5).** Rin's contributions with Rin's part, and the questions for a first consult. "No eligibility assessment." Optional trust beat: **Try Rin's Kerf correction** → **Use Rin's correction (EXAMPLE)** → **Save correction**; then **Compare both views** shows the client portfolio and the dossier changed together. **Open the private dossier** opens the revocable link.

**2:30 What Rin builds next (step 6, the close).** An offline field-notes app with AI tagging, built from parts already shown in Tidepool and Quietroom, each with proof, and what it still needs. On the right, the next steps toward San Francisco: build it as a public demo, close the biggest gap, show it to the role whose posting says it sponsors (with its caveat), take the dossier to a first consult. Say: a proposal, not a promise.

If the Kerf correction was made, step 3 shows it: the release task is taken out of both views until **Check again**, then returns as **Likely, not proven**.

## If something goes wrong

- Blank screen or "Opening Rin's example" stuck: open the rehearsal link above.
- Live mode is not part of the demo: keys are not set. Say so if asked.
- The workbench (`/studio`) has every control on one page for free exploring.
- Rehearse with `npm run walkthrough` (guided demo, screenshots to `walkthrough-v2/`) or `npm run walkthrough:workbench`.

## Live mode (verified, not part of the 3-minute demo)

The owner's Anthropic key is in `.env.local` (gitignored, never printed). `AI_MODEL=anthropic:claude-sonnet-5-5` was checked against Anthropic's model list endpoint: the ID is available to this key, so the config stays as it is.

`npm run test:live` runs one bounded smoke: Rin's EXAMPLE files as sources (no web fetch), three claim calls and one capability call to the model, about 35 seconds. It fails loudly on any model error; there is no fallback to the recorded output. The last run is in `docs/LIVE-SMOKE.md`:

- Every project's claims came from `model:anthropic:claude-sonnet-5-5` (17 kept).
- Every kept quote was re-checked word for word against its file.
- The attribution rules held back two model over-reaches: "Rin authored Quietroom" (a README and a commit count are not authorship) and "Rin is a maintainer of Kerf with 3 commits" (a README line and a contributor count).
- Capabilities cite only confirmed statements: offline conflict resolution and the release process shown in the work, production operation not shown, with one question.

If asked on stage, say the demo runs on the recorded EXAMPLE output so it works offline, and that the live path was verified today with the same checks. The landing shows "Model ready: anthropic:claude-sonnet-5-5" when the key is present.
