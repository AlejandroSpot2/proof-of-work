# Next steps: design decisions

The flow is the portfolio, then next steps, then the consultation kit. Next steps answers one question, "What do you want to do next?", with three paths. Every path reads the portfolio model that is already built. Nothing is fetched, matched, sent or published.

## Where it lives

- The Studio's canvas gets two tabs, **Portfolio** and **Rin's next steps** (the name is the person's first name), followed by a **Consultation kit →** link. The order of the tabs is the order of the flow.
- "What Rin can do" exists only as a step label in the legacy guided tutorial (`/demo`), where it labels the capability list. The new tab carries the name "Rin's next steps". The legacy label is not renamed: its content is the capability list, not next steps.
- The language switch (EN | ES) sits at the right end of the tab bar. It changes the portfolio and the next-steps output together. Visitors of `/portfolio` and `/p/[token]` get the same switch in the portfolio's top bar.

## Data shape

One pure module, `lib/next-paths.ts`, takes `(model: PortfolioModel, fixture)` and returns a plan per path. It never touches the database and never invents a backing.

- **Requirement status** is a discriminated union. It is `backed`, with at least one model item (capability, next-build part or statement) that has proof. Otherwise it is `gap`, with a reason computed from the model. A gap reason is one of three kinds:
  - `not-shown`: a matching capability with support `unknown`, and its own limit text.
  - `others`: the matching work exists in the files, but another person wrote it (their commits are shown).
  - `nothing`: nothing in the files shows it.
- **Matching** uses the same rule as `lib/opportunities.ts`: whole-word stems from the fixture against model names. A requirement with no evidenced match is a gap. No fixture text can mark a requirement as backed.
- **Strengthen improvements** come from a prepared scenario. Each improvement is tied to files that exist in the model (`buildsOn`, resolved to source ids) and names the capability or gap it would change. Its "today" support is read from the model, never from the fixture.
- **The cofounder plan** takes Rin's side from `model.nextBuild.parts` (with proof) and the needs from `model.nextBuild.gaps` (the gap text is the model's own). The other person is a synthetic profile. Their skills are self-described and unverified, and labeled as such.

## Language

- `lib/i18n.ts` holds the interface words in EN and ES, plus a content dictionary for the EXAMPLE fixture (`fixtures/example-rin/i18n/es.json`). The dictionary is keyed by the exact English text.
- A content string with an ES entry renders translated and is marked as translated: `lang="es"`, a dotted underline and the title "Traducido del inglés". A string without an entry stays in English, unmarked. Interface words are the app's own language and are not marked.
- Never translated: quotes from files, commit messages, file names, posting lines, company and project names, numbers and dates. A test checks that every dictionary entry keeps the same numbers and proper nouns as its English key, so a translation cannot change a fact.
- Live workspaces get ES interface words. Their content stays in its original language.

## The three paths

1. **Apply for a role.**
   - Pick: the Fieldmark (EXAMPLE) founding engineer posting, reusing the existing opportunity record, and a language.
   - Output:
     - A requirement checklist. Each requirement shows **Backed by evidence**, with its file chips, or **Gap**, with the computed reason.
     - An adapted intro, composed from backed requirements only, plus the gaps.
     - The real portfolio component below it, with projects reordered by how many requirements they back and the relevant ones highlighted.
   - The posting's lines stay as written (English). In ES a marked translation sits under each line.
2. **Strengthen my portfolio.**
   - Pick a goal: Rin's own goal from the profile, or the Fieldmark role.
   - Output: up to four prioritized improvement cards, not paragraphs. Each card shows:
     - its kind (Demo, Document or New piece) and title;
     - one line of why, and one line of what it would prove;
     - the files it builds on, as chips;
     - a two-state preview, "Today" (read from the model) and "If done" (labeled as not true yet).
3. **Find a cofounder.**
   - Pick: the project, which is the evidenced next build ("Offline field-notes app with AI tagging").
   - Output, as three columns:
     - What Rin brings: evidenced parts, each with proof.
     - Who would complement Rin: needs tied to the model's gaps.
     - One possible cofounder: a synthetic profile, marked "Synthetic EXAMPLE profile, not a real person".
   - Below the columns:
     - A **build together** brief: contributions side by side, then open questions.
     - An **intro draft** with a Copy button. It is labeled "Draft. Nothing is sent." There is no send action, no consent state and no match score.

## Guardrails

- No new routes, keys, model calls or network. The fixtures are static JSON read by the client next to the model it already has.
- The consultation kit does not change. A test asserts that the packet model contains none of the offer, scenario or cofounder text.
- Every new string is EXAMPLE or prepared-demo data, and says so where it shows. No real companies or contacts, no endorsements, no visa outcomes.
- Motion only where it has a purpose: when a path is chosen, its panel enters with the existing curve, and reordered projects keep their place by view transition. Under reduced motion, nothing moves.

## Alternatives considered

| Question | Chosen | Not chosen, and why |
|---|---|---|
| Where next steps live | A Studio tab between the portfolio and the kit | A portfolio section, which visitors would see (this is Rin's private planning); the legacy `/demo`, which is a tutorial |
| How "backed" is decided | Computed from model proof by word match | Fixture flags, which could claim experience the files do not show |
| How ES is produced | A prepared dictionary for the EXAMPLE, marked | A model call (not allowed); machine translation at runtime (network) |
| How the tailored portfolio shows | The real portfolio component with order, highlight and intro props | A separate mock, which would drift from the real page |
