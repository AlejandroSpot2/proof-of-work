# Proof of Work — hackathon plan (working name)

Source of truth: Grok Bot Page "Portafolio con evidencia — plan de hackathon". Event: Anything Applied Agentic Hackathon, SF, Nov 7 2026. Build until 6:00 PM PT, demos 6:15 PM PT. Challenge 4 "Beyond the Resume: What if AI understood what you can actually do?" (our own product interpretation; the "what if" is not an official simulation requirement).

## Goal
Import 3 projects, extract up to 3 evidence-backed capabilities, answer for 1 target task "What can you entrust to this person, and why?" with support and limits, and project the same facts into 2 views (client/founding-engineer portfolio + private attorney-review dossier) where a human correction propagates to both.

## Architecture (chosen: fact ledger + derived projections)
- Claims and Evidence normalized in DB; capabilities and views are derived (pure queries + templates). No free-form LLM prose for views.
- LLM limited to 2 structured tasks (AI SDK generateObject + Zod): (1) propose claims with literal quotes per project; (2) infer capabilities for the goal citing claimIds/evidenceIds.
- Rejected: LLM-generated documents per view (diverge, hallucinate), multi-agent pipelines (no demo value).

## Tech stack
Next.js App Router + TypeScript + React, Vercel AI SDK + Zod, Drizzle. DB: Neon Postgres recommended for hosted; if not ready by 1:00 PM PT use local SQLite only (do not maintain both). selectedModel configurable via env; no assumed provider access.

## Global constraints
- Private by default. No auto-publishing. No public deploy today. No "verified" state.
- Owner session (HttpOnly/Secure cookie) required to import/review/edit. Read-only views via random revocable per-presentation token (store hash). Portfolio token never opens dossier or private claims. Obscure URL is not auth.
- Sources: HTTPS only, explicit allowlist (github.com / api.github.com / user-provided project domains), no credentials in URLs, reject localhost/private IPv4/IPv6/metadata, revalidate every redirect target, byte limit 200 KB, timeout. Source text enters prompts as delimited data, never instructions (prompt-injection safe).
- Budgets: max 3 projects, 5 sources/project, 2 follow-up questions/project, 1 LLM call per project for claims, 1 per goal for capabilities (max 3 capabilities, max 1 question). Discard any capability citing a nonexistent or unapproved ID. Discard claims whose quote is not literally in the source.
- Re-import idempotent by url+contentHash; never overwrite approved human corrections.
- Repo ownership ≠ authorship. Commits are contribution signals, not exclusive authorship. A language in a repo ≠ mastery.
- Legal flag is a suggestion requiring an attorney. Not a visa qualification tool. No letters from strangers. Attorney view is optional case presentation, not a verdict.
- No X scraping (future: connector). No secrets in repo; env placeholders only. No vectors, graph DB, RAG, rankings, recruiting, cron, OAuth, multi-agent.
- Jev (TypeSafe System One decision/scoring model, api.typesafe.ai/v1/systemone) is OPTIONAL, non-critical: only for relevance prioritization of snippets/questions; never verifies truth. Skip if no visible improvement.

## Data model
- Source: id, url, kind (github/web/user), fetchedAt, status (ok/unavailable/blocked), contentHash, snippetStore.
- Project: id, title, urls[], role.
- Claim: id, projectId, text, kind (contribution/impact/skill/recognition), state (fetched | corroborated | user_attested | unverified), reviewStatus (proposed/approved/rejected), revision, attribution, publishable, legalFlag.
- Evidence: id, claimId, sourceId, quote (must exist literally), locator, supportScore.
- Presentation: id, audience (portfolio/attorney), selectedClaimIds[], order, sourceRevision, tokenHash, revokedAt. Templates; any correction invalidates prior derived narrative.
- Capability projection (derived, no new table; JSON per revision): { goal, capabilities: [{ name, support: demonstrated|inferred|unknown, claimIds, evidenceIds, limits }], gaps, question }. Invalidated when any cited claim revision changes.
States: fetched = source says it; corroborated = two independent sources; user_attested = only the builder says it; unverified = no support. Support levels are qualitative, not truth, aptitude scores, or legal criteria. No invented confidence numbers.

## Layers
1 Source → 2 Approved claim → 3 Inferred capability (cites IDs) → 4 Hypothesis for target task (covered / not covered) → 5 Missing data (≤1 bounded validation question). A founder/attorney may confirm/reject a reading = recorded review, not signature/endorsement.

## Flow
URLs+identity → validate URL → deterministic fetch (GitHub public API read-only: repo, README, languages, contributors, author commits; allowlisted HTML→text) → bounded LLM claims w/ quotes (Zod) → quote check → human review (approve/correct/attest) → capabilities for goal → 2 views + print-CSS PDF.

## Proposed file map (greenfield)
lib/schema.ts, lib/ingest/url.ts (SSRF/allowlist), lib/ingest/github.ts, lib/ingest/web.ts, lib/claims/propose.ts, lib/capabilities/infer.ts, lib/views/project.ts, app/api/import/route.ts (streamed progress), app/p/[token]/page.tsx, app/review/page.tsx.

## Phases (PT) — DEMO PRIORITY
1. Vertical slice end-to-end first (fixture mode works with no keys, clearly labeled EXAMPLE; live mode real per plan).
2. Ingest + claims + quote check. 3. Review/correction/propagation. 4. Capabilities for 1 goal + 2 views. 5. 4:00–6:00 PM QA, design polish, demo rehearsal.
Cuts if late: drop web source (GitHub only) → dossier as HTML without PDF, drop Jev → preloaded labeled JSON import if live ingest fails (say so on stage).

## Tests / acceptance
- Foreign repo without user commits never yields fetched authorship claim.
- Every shown claim has Evidence with literal quote, or is user_attested/unverified.
- Correction propagates identically to portfolio and attorney views and removes obsolete capabilities.
- 404/timeout → Source unavailable, rest continues.
- SSRF cases above rejected. Privacy: no session no edit; token reads only its presentation; revoke cuts access.
- Weak evidence (language only) → at most inferred with limit. Unsupported goal → unknown + 1 question, no invented capability. Regeneration keeps human reviews.
- Demo acceptance: import → evidence → goal with 3 capabilities → correct a claim → both views updated, under 3 min, no hidden manual steps.

## Demo script (3 min, English on stage)
0:00 Hook: "A resume says what you claim. This shows what your work proves." 0:20 import 3 URLs, sources appear with status. 0:50 claims with literal quotes; approve one. 1:20 enter 1 goal → "What can you entrust to this person, and why?": 3 capabilities demonstrated/inferred/unknown with clickable evidence and limits. 2:00 human feedback: correct an attribution or a founder rejects a reading → capability changes in both views. 2:40 close: client portfolio + optional private attorney dossier from the same facts.
All examples hypothetical until real data imported. Never claim skills of the user not proven.
