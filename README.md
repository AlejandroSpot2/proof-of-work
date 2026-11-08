# Proof of Work

A resume lists what you claim. Proof of Work shows what your files back up.

It reads a builder's own projects (READMEs, pull requests, commits, notes) and produces two outputs:

- **a portfolio a client can explore**, where every sentence cites a line in a file, and
- **a First Consultation Kit**: a typeset PDF to bring to a first meeting with an immigration attorney.

A statement is kept only when its quote appears in its source, character for character. Work by other people stays theirs. Each statement shows where its record stops.

## Try it (no keys, no network)

```bash
npm install
npm run dev          # http://localhost:3000
```

Click **Open the Studio**. The demo runs on Rin Okafor, a fictional builder: every file, commit, employer and number is synthetic and labeled EXAMPLE. The walkthrough is in [`docs/DEMO.md`](docs/DEMO.md).

## What the Studio does

- **Build.** It reads the sources. A cursor swarm then places the portfolio; this is labeled as an illustration and can be skipped.
- **Portfolio.** You can explore each project, see who did what by date, and open any quote in its file. It has EN | ES: translated text is marked, while quotes, files and names stay as written.
- **Discover.** A prepared EXAMPLE list of public signals passes through a stated relevance filter, giving a shortlist and "dropped, and why". Each card has the Rin evidence it relies on and a draft that is never sent. There is no live search.
- **Next steps.** Three paths:
  - *Apply for a role*: each requirement is backed by evidence or marked as a gap, computed from proof.
  - *Strengthen my portfolio*.
  - *Find a cofounder*, with a synthetic profile and a draft only.
- **Consultation kit.** A one-page summary, the dossier with exhibits, what is still missing, and questions for the attorney. The PDF has a table of contents and page references. It is not legal advice and makes no eligibility assessment.
- **Share.** A read-only, revocable link to the portfolio. It never carries attorney material or next steps.

## Demo and Live

The Studio header switches between **Demo**, the offline EXAMPLE, and **Live**, your own public GitHub projects.

In Live, the Studio lists what works today, feature by feature:

- **Live:** sources, review, portfolio and kit.
- **Need a model:** statements, Spanish translation, and Apply with a pasted posting.
- **Demo only:** strengthen and cofounder.
- **Discover:** needs a Treg token and a spend cap.

A missing key gives an empty state that says what to set; nothing falls back to the EXAMPLE. A real workspace's kit carries no EXAMPLE marks.

To set up Live, copy `.env.example` to `.env.local`. Then set `AI_MODEL` (for example `anthropic:claude-sonnet-5-5`) and the matching key. GitHub is read through the public API, read-only.

## Check it

```bash
npm run typecheck
npm test                              # domain rules, attribution, SSRF, kit, next steps, discover, live (mocked)
npm run build
node scripts/walkthrough-v4.mjs       # the demo end to end in Edge, including the PDF download
node scripts/walkthrough-next.mjs     # next steps in EN and ES, with a false-claim scan
node scripts/walkthrough-live.mjs     # Demo and Live, against a server whose model is unconfigured (see the file header)
```

## Where things are

- `lib/domain/rules.ts` holds the evidence rules: literal quotes, per-quote authorship and support ceilings.
- `lib/workspace.ts` holds the ledger: import, review, goal evaluation and presentations. `lib/deps.ts` provides each capability in a fixture version and a live version.
- `lib/portfolio.ts` builds the portfolio model. `lib/packet/` builds the kit and its PDF.
- `lib/next-paths.ts` holds Apply, Strengthen and Cofounder. `lib/discover.ts` holds the Discover rules. `lib/translate.ts` and `lib/requirements.ts` hold live translation and posting reading.
- `fixtures/example-rin/` holds the EXAMPLE builder, projects, recorded statements and prepared demo data.
- The landing is a static page, `public/index.html`.

Design decisions are in `docs/`: [`DECISIONS.md`](docs/DECISIONS.md), [`NEXT-STEPS-DESIGN.md`](docs/NEXT-STEPS-DESIGN.md), [`DISCOVER-DESIGN.md`](docs/DISCOVER-DESIGN.md) and [`SWARM-AUDIT.md`](docs/SWARM-AUDIT.md).
