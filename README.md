# Proof of Work (working name)

A resume says what you claim. This shows what your work proves.

Import three projects. Every claim the system keeps carries a quote that appears word for word in its source. Ask one goal: what can you entrust to this person, and why? Each answer is demonstrated, inferred or unknown, cites its evidence, and states its limits. Correct a claim and both the client portfolio and the private attorney dossier change together.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Fixture mode needs no keys and makes no network calls. Click "Open the EXAMPLE workspace". Rin Okafor and everything about Rin is synthetic and labeled EXAMPLE.

Live mode: copy `.env.example` to `.env.local`, set `AI_MODEL` (for example `anthropic:claude-sonnet-5-5`) and the matching key. GitHub data is read through the public API, read-only.

## Check it

```bash
npm run typecheck
npm test             # acceptance, SSRF, ingest and opportunities tests
npm run build
npm run walkthrough  # needs the dev server; drives the demo in a browser and saves screenshots to walkthrough/
```

## Where things are

- `lib/domain/rules.ts` owns the evidence rules: literal quotes, per-quote authorship, claim states, support ceilings, derived limits.
- `lib/workspace.ts` owns the ledger: import, review, goal evaluation, presentations.
- `lib/views/project.ts` derives the entrust answer and both views from one snapshot.
- `lib/ingest/` holds the SSRF-safe fetcher, the GitHub reader and the HTML-to-text reader.
- `fixtures/example-rin/` holds the EXAMPLE builder, projects, recorded claims and fictional employers.

Decisions and their reasons are in `docs/DECISIONS.md`.
