# Decisions

Calls made during the build, with the reason for each. The contract is `docs/hackathon-plan.md` plus the two addenda (`docs/t3-addendum-fixtures.md`, `docs/t3-addendum-immigration.md`).

## Architecture

- **One ledger, derived views.** Claims, evidence, sources and reviews live in SQLite through Drizzle. Capabilities are stored as one JSON projection per goal that records the claim revisions it cited. `lib/views/project.ts` derives the portfolio and the dossier from the same `deriveEntrust` call, so a correction cannot reach one view and miss the other.
- **Withdrawal before re-evaluation.** A capability is live only while every claim it cites is still approved at the cited revision. A correction withdraws it from both views on the next read, with the reason. Re-evaluating runs the engine again on the new ledger. Two visible steps make the propagation legible on stage: the capability leaves, then comes back with its new support level and limit.
- **Support levels are computed, not chosen.** The engine (model or fixture rules) proposes a level. `supportCeiling` caps it from the cited claims. Skills, language-only evidence and claims that rest on the builder's word cap at inferred. A claim with no backing caps at unknown.
- **SQLite only today.** No Neon. `DATABASE_PATH` points at the file, default `data/proof-of-work.db`.

## Evidence rules

- **Literal quotes.** A quote must appear in its source after normalizing whitespace, curly quotes and dashes only. Case and wording must match. Quotes under 12 characters do not count. A claim with no surviving quote is discarded and listed in the import report.
- **Authorship is per quote, not per repository.** Inside a repository, a quote backs an authorship claim only if it is a line the person wrote: a commit whose author is their handle, or a PR or notes file whose header names them. Owner lines, contributor counts and READMEs that name them do not count. Outside a repository, a page that names them can. A repository where the handle has no commits never backs authorship. Quotes that fail this are kept as context evidence; a claim with none left becomes unverified, its attribution set to unknown, with the reason stored.
- **Independent sources.** Sources from one repository, or one host, are one origin. Corroborated needs two origins. A page the owner marks as their own counts as `user_attested`, not as an independent source.
- **Corrections.** Changing a claim's wording, or raising one's own attribution (contributor to author, say), makes it `user_attested`: the sources back the old reading and the new one rests on the builder's word. Narrowing the attribution re-derives the state from the existing evidence. Every correction bumps the claim revision and logs before and after. Visibility toggles are logged as `visibility`, not as corrections.
- **Changed sources.** When a re-import finds a source's text changed, every quote that cited it is re-checked. Quotes no longer in the source are dropped, the claim's state is re-derived, and its revision is bumped so capabilities built on it are withdrawn. Human corrections are kept.

## Budgets

- Max 3 projects, 5 sources per project (extra sources are listed as skipped), 2 follow-up questions per project, 8 claims per project.
- One claim call per project per distinct source content, with a hard ceiling of 3 per project so a page that changes on every fetch cannot loop. Re-import with unchanged content hashes makes no call and leaves sources and reviews alone. Model calls run with `maxRetries: 0`, so one budgeted call is one request.
- One capability call per goal per ledger revision. Asking again with nothing changed returns the stored answer, and resubmitting the same goal text keeps the goal and its reviewer decisions. After a correction the ledger revision moves, so re-evaluating is allowed one more call. This is how "regeneration" is read against the "1 per goal" budget.
- At most 3 capabilities and 1 question per goal.

## Privacy and security

- Owner session: random token in an HttpOnly, Secure, SameSite=Strict cookie, stored as a SHA-256 hash. Every mutation requires it and checks the target belongs to the session's workspace. Mutations accept JSON only.
- The portfolio drops a capability whose cited claims are all marked private and strips their text from limits. The dossier keeps everything approved.
- Presentation tokens are random, stored hashed, revocable, and open exactly one presentation. A portfolio token cannot open the dossier. A token can open a source only if its own view shows evidence from that source.
- SSRF: https only, no credentials in URLs, port 443 only, allowlist of github.com, api.github.com, raw.githubusercontent.com and the hosts the user typed for that project. Localhost, private, link-local, metadata and other non-public IPv4/IPv6 ranges are blocked at parse time and again at DNS connect time through an undici Agent lookup (closes the rebinding window). Every redirect is re-checked. 200 KB cap, 8 s timeout.
- Source text enters prompts inside delimited `<source>` blocks with an instruction to treat it as data.
- `.env.example` has placeholders only. The app never logs keys.

## Fixtures (Addendum 1)

- The demo person is Rin Okafor (EXAMPLE). Fixture ids use `example://`, so nothing looks like a real website or GitHub account.
- Fixture claims are a recorded output (`fixtures/example-rin/recorded/claims.json`), labeled "recorded output (EXAMPLE)" in the UI. They contain no planted errors. They pass through the same quote check and attribution rules as live output.
- Fixture capabilities come from deterministic rules over the approved claims (`lib/capabilities/fixture-engine.ts`), labeled "fixture rules (no model)". The rules read the live ledger, so corrections change their output.
- `fixtures/example-rin/expected.json` is used only by tests.
- The Kerf correction text lives in `profile.json` as Rin's own correction in the story. The UI offers it as "Use Rin's correction (EXAMPLE)" inside the normal correction form. The README names two maintainers without saying who owns what, so the correction adds information the sources lack.
- Illustrations are local SVGs marked "EXAMPLE illustration".

## Opportunities and the dossier (Addendum 2)

- Three fictional employers in `fixtures/example-rin/employers/employers.json`. Each shows company, entity, location, role, source id, literal snippet, retrieved date, signal type and status. Missing fields render as "unknown".
- Signal copy is fixed in `lib/signals.ts`. Historical filings render as "Past filings only" with "Historical filings are not current policy".
- The panel is its own chapter between the capabilities and the two views, following the addendum's flow: work, capabilities, contribution to an opportunity, sponsorship signal, attorney questions. "What could Rin build next" stays as the close.
- Role fit is a proposal: it lists only live capabilities with evidence whose names match the record's keywords as whole words, shows each fit's evidence ids as links that open the quote in its source, and lists a body of evidence once per role.
- No real employer data is in the fixtures. If it is ever added, it goes in a visually separate panel and never into the claims ledger.
- The dossier opens with "No eligibility assessment" and generates attorney questions from the ledger (documented vs self-attested, shared work, corrections, gaps). A test checks that it contains no eligibility, visa-category or approval language.

## What next (Addendum 1 closing beat)

- The capability call also returns an optional `nextBuild` proposal. Its parts go through the same citation check as capabilities, take their support from the ledger ceiling, and are withdrawn on correction like capabilities. In fixture mode a rule assembles it from tags.

## Review

An independent review of the full diff found no blockers and eight issues: stale evidence after re-import, repository owner and contributor lines backing authorship, self-raised attribution staying source-backed, private claim text leaking into portfolio limits, goal resubmits costing calls and dropping rejected readings, SDK retries doubling budgeted calls, visibility toggles logged as corrections, and no hard cap on claim calls. All eight are fixed, each with a regression test in `tests/review-fixes.test.ts`.

## Skipped or deferred

- **Jev (TypeSafe System One)**: skipped. Nothing in the demo needed relevance ranking, and it can never verify truth.
- **Print-CSS PDF**: the dossier and CV pages have print styles. No PDF generation library.
- **Presentation `selectedClaimIds`/order**: stored as null, meaning every eligible claim. The portfolio shows approved, publishable claims; the dossier shows every approved claim.
- **Live mode** is wired end to end but needs `AI_MODEL` and a provider key in `.env.local`. Without them, live import still fetches and shows sources, and the claims step reports that the model is not configured.

## Redesign pass (guided demo)

Direction and before/after reasoning are in `docs/REDESIGN.md`.

- **Two modes.** `/demo` is the guided story in six steps, one view each, with Back, Next, a step list and arrow keys. `/studio` stays as the workbench with every control. Both read the same API and the same ledger.
- **Style.** App-screen rules, `framed-sheet` dealt with seed 1071196506, brand olive and Switzer kept. The frame is tinted from the olive; the olive sits only on "Shown in the work", the strongest sponsorship signal, proof counts and the finale panel.
- **Plain words.** Support levels read "Shown in the work", "Likely, not proven" and "Not shown yet" everywhere, including the shared view documents. Capabilities are tasks ("Build offline sync that merges conflicting edits"). "Statements" replaces "claims" in the guided screens and the dossier questions. The engine note moved to a footnote.
- **Proof on demand.** Every statement, task, role fit, MVP part and next step has a proof button opening a drawer of the literal quotes; each quote opens its file with the quote highlighted. Confirm and correct live in that drawer.
- **Honest progress.** "Read Rin's 3 projects" runs the real fixture import and lists each file as the server reports it. Confirming statements and answering the need are visible clicks.
- **Next steps.** `lib/next-steps.ts` builds the finale's steps from data already on screen: the evidenced MVP, the open question, the role whose current posting states sponsorship (with its caveat), and the dossier. Tested to cite only approved evidence and to promise nothing.
- **Rehearsal link.** `GET /api/example/start?stage=new|imported|answered&to=…` creates a fresh EXAMPLE workspace in fixture mode, optionally running the same import, confirm and answer steps, and sets the owner cookie. It exists for rehearsal and for the inspector, which cannot click through a session; it never touches the network.
- **Others' part** on a project card comes from that project's contributors file (names and commit counts only), exposed in the owner snapshot.
- **Desktop first.** The demo is judged on desktop and projector widths. Every guided step fits one 1440x900 screen (measured by the walkthrough). Phone layouts work but were not polished, at the owner's request.

## Live model verification

- `AI_MODEL=anthropic:claude-sonnet-5-5` verified against `GET /v1/models` with the owner's key (no tokens generated). Config unchanged.
- The first live smoke failed on all three projects with "response did not match schema". With the schema rule named in the error (a 9-character quote, a 230-character claim), the cause was that length limits lived in the Zod schema, so one bad field rejected a whole project's answer. Root fix: the schemas keep only structure; lengths and counts are enforced per item in `commitProposal` and `validateProposal`, which drop the offending item with a reason. `lib/ai/errors.ts` names the broken schema path in model errors, never the content or the key. Covered by `tests/limits.test.ts`.
- Model calls keep `maxRetries: 0`, so one budgeted call is one request.
- The AI SDK warns that `generateObject` is deprecated in favour of `generateText` with an output setting. It still works; migrating is left for after the hackathon.

## The Studio overhaul

Direction and idea: `docs/design-studio.md`. Throughput and status: `docs/studio-checkpoint.md`.

- **Main navigation is the Studio** (`/studio`): sources on the left, the live portfolio on the right. The six-step tutorial stays at `/demo` as a legacy route; the old one-page tool moved to `/workbench`.
- **Building confirms the statements on the owner's behalf.** The Studio's Build reads the sources (real fixture import, files light up as the server reports them), confirms the proposed statements, answers the stored goal and records the build time. The rail says so and links to the review drawer, where any statement can be corrected; a correction re-answers the goal and reaches the portfolio and the kit at once.
- **The swarm is an illustration of a finished result.** It runs only after the build has returned and the portfolio has rendered, animates only blocks already on screen, never blocks input for more than about three seconds, is skippable (button or Escape), plays once per build or on "Replay the reveal", and does nothing under reduced motion. Cursor labels are the real file names that were read. Own WAAPI implementation; only the principles of the Neviza reference were reused.
- **One portfolio model** (`lib/portfolio.ts`) feeds the Studio preview, `/portfolio` and shared links. The public audience shows only confirmed, publishable statements and hides projects the owner unticked; the owner audience shows everything for editing. Headline, intro and hidden projects live in `workspaces.portfolio_settings` (migration `0001`).
- **Others' work is drawn from the commit history**, not written: "Contributor B wrote 2 changes here: …" comes from the commits file. EXAMPLE handles display as names ("contributor-b" → "Contributor B"); real handles keep their @.
- **Concept art is drawn, interactive and labeled.** Tidepool's merge timeline scrubs; Quietroom's clusters highlight their feedback and issues; Kerf shows Rin's release artifacts beside Contributor C's deploy engine. Every piece carries "Concept illustration".
- **Kerf scope narrowed** to docs and the release process everywhere: the capability reads "Run the release process: changelog, version tags, release docs", the recorded claim reads "Co-maintains Kerf's docs and release process", and no deploy or infrastructure wording is attributed to Rin.
- **Synthetic dates** were added to the EXAMPLE commits and pull requests so the portfolio and the kit can show a dated record.
- **Paper and cobalt, Geist and Geist Mono** (from the official `geist` package, so neither the app nor the PDF needs the network). Mono only for file names, IDs, hashes and dates.
- **The legal output is the First Consultation Kit** (owner follow-up `docs/t3-consult-kit.md`): one PDF with a one-page summary, the dossier with exhibits and annexes, a checklist of what is missing (projects alone decide no visa question), and questions and notes for the consult; an in-app preview with expandable sections and a working download. The PDF is rendered by Playwright through the installed Microsoft Edge (Playwright's own Chromium is not installed), with a two-pass table of contents read back with pdfjs-dist.
