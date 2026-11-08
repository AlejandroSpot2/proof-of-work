# Discover: design decisions

Discover keeps one pattern from the Treg social-api demo: a question, a set of public signals, and a relevance filter that keeps or drops each signal with a visible reason, leaving a shortlist. Nothing else is taken from it: no branding, metrics, comparisons or terminal view.

**Flow:**
1. Public signals.
2. A relevance filter.
3. People or opportunities.
4. Why Rin's evidence fits.
5. A prepared action.

Everything runs over a prepared EXAMPLE list. Nothing is searched, fetched, contacted, sent or paid.

## Where it lives

- A third tab in the Studio canvas, in the order of the flow: **Portfolio**, **Discover**, **Rin's next steps**, then the link to the consultation kit.
- **Adapt portfolio**, the call to action, opens Rin's next steps on the matching path: the cofounder path for the cofounders view, the strengthen path for the clients view.
- A persistent label sits in the Discover header: "Prepared example · no live search". Next to it: "Planned source: Treg (not connected)". The words "Discovery via Treg" never appear.

## Data shape

One pure module, `lib/discover.ts`, takes `(model, intent, filters, fixture)` and returns, for each signal, a verdict. The verdict is `kept` or `dropped`, and each comes with its ordered list of checks. A check has an id, a pass or fail result, and a reason written from data.

**The checks** form a fixed EXAMPLE rubric shown on screen as rules, not a score. There is no number, no confidence and no "AI verified".
1. **Intent.** Do words of the intent match the signal's topics?
2. **Evidence.** Do Rin's evidenced capabilities or next-build parts (support shown or likely, with proof) cover what the signal asks for? This reuses the matching rule from `lib/next-paths.ts`.
3. **Complement** (cofounders only). Does the person bring something Rin's files do not show? This means one of Rin's `unknown` capabilities, or a next-build gap.
4. **Filters.** The skills, need and location chips the user set. A signal with no location fails a location filter with "Location not stated". That is not a judgment.

**Verdicts:**
- A signal is kept when every check passes.
- A dropped signal shows its first failed check as the reason, under the line "Dropping is about this intent and these files, not anyone's ability."
- The shortlist sorts kept signals by how many of Rin's evidenced items they rely on.

**The detail view** is made of five parts:
1. **Need**: from the fixture.
2. **What you bring**: Rin's backing items with proof chips.
3. **Why this connection**: the passed checks.
4. **What we don't know**: always includes availability (cofounders) or budget and interest (clients) as "Unknown", plus the signal's own unknowns.
5. **Build together draft**: a copyable draft. It is labeled "Draft only. Nothing is sent."

Selecting a signal lights up the Rin projects it relies on (Tidepool, Quietroom, Kerf). Each lit project links to its proof in the source viewer.

## Fixtures

The fixtures live in `fixtures/example-rin/discover/signals.json`. Every name is fictional and marked EXAMPLE. Every source is described as synthetic, with no URL, post id, handle or contact, and recency is marked fictional.

- **Cofounders (5):**
  - **Sol Arrieta.** This is the same identity as the Next steps cofounder. The card references `next-steps/cofounder.json` for the name, background and draft, so nothing is duplicated.
  - Plus one designer, one offline-sync engineer (dropped: brings what Rin already shows), one ML researcher (dropped: Rin's files do not show model training) and one consumer-app marketer (dropped: does not match the intent).
- **Clients (4):** a field-services team losing notes offline, a support desk drowning in feedback, a clinic network asking for HIPAA-compliant records (dropped: the files show neither compliance nor production), and a tools company with a manual release process.
- Budget, interest and availability never appear as known.

## Language

The interface words are in EN and ES, following the global switch. Fixture text has EN and ES. The ES text is a translation and is marked like the portfolio. The example quotes stay as written in English, with a marked translation under them in ES.

## Motion

When the intent is applied, each card is checked in turn: the passed or failed check lights up, about 180 ms per card. Then the list reorders into "Shortlist" and "Dropped, and why" with a view transition on the existing curve.
- **Skip** jumps to the result.
- Under reduced motion the result shows at once.
- Editing the intent or a filter re-runs it.

## Guardrails

- No new routes, no network, and no Treg, Jev or model calls. The rubric is code over the prepared list.
- Nothing from Discover enters the consultation kit. A test checks the packet for Discover text.
- The shared portfolio never shows Discover.
