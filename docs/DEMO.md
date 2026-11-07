# Demo script: The Studio (3 minutes, desktop, no keys)

Start: dev server on :3000, browser at `http://localhost:3000/`, 1440 wide or a projector at 1280x720. Everything shown is EXAMPLE data about Rin Okafor, a fictional builder. A fresh run is one click on **Open the Studio**; each click starts a new workspace.

**0:00 The promise.** The landing says "Portfolios for builders, built from their files". Point at the Studio window over the turning ASCII globe and its "Kerf, checked" card: Rin's 3 commits are docs and releases; the deploy engine stays Contributor C's. If there is time, scroll once: the app frame with the commit log and its marked quotes, the quote check, the portfolio page, the kit. Click **Open the Studio**.

**0:15 Sources and the before.** Left: Rin's three projects as sources, prepared EXAMPLE files so the demo is reproducible (say so). Right: the CV, "all a reader gets today". Click **Build portfolio**.

**0:30 The swarm.** The file chips light up as each file is really read. Then cursors labeled with those file names place the portfolio block by block. The caption says it is an illustration of a result already built; Skip ends it. Land on the portfolio: name, positioning line, the project index.

**0:55 Explore a project.** Click **Tidepool** in the index: it zooms into the project. Drag **Scrub time** to the end: two offline edits merge field by field. Scroll: Rin's part in plain words, who did what by date (Contributor B's storage adapter stays theirs), the project's own files. Click **Proof**, then a quote: the file opens with the quote highlighted. Close back to all work.

**1:40 What it adds up to.** Scroll the canvas to "What you can hand Rin": tasks marked shown in the work or not shown yet, each with proof. Then "What Rin could build next": an offline field-notes app with AI tagging, assembled from parts already shown in Tidepool and Quietroom. Then "Heading to San Francisco": three fictional roles, one whose posting says it sponsors, one with past filings only, one unknown. Not legal advice.

**2:15 Share.** Click **Share portfolio**: a read-only, revocable link. Open it if time allows; it carries no attorney material.

**2:30 The First Consultation Kit.** Click **Consultation kit**: the one-page summary, the dossier with exhibits, what is still missing (projects alone decide no visa question), and the questions for a first meeting with an attorney. Click **Download PDF** and open it: cover, contents with page numbers, exhibits with page references, annexes with the literal source text. Close on the two outputs: a portfolio worth sharing and a kit worth bringing to a consult, from the same facts.

## Direct entries

- Example portfolio as a visitor sees it: `/api/example/start?stage=published`
- Example consultation kit: `/api/example/start?stage=answered&to=/packet`
- The Studio already built: `/api/example/start?stage=answered&to=/studio`
- Legacy guided tutorial: `/demo`. Old one-page workbench: `/workbench`. Live mode (your own GitHub links): `/live`.
- The landing is a static page, `public/index.html`, built with the design kit in `public/assets` and served at `/` by a rewrite in `next.config.ts`.

## If something goes wrong

- The first build or the first PDF after a server start compiles routes and takes 10 to 20 seconds. Rehearse once before going on stage.
- Live mode (your own GitHub links) works with the configured model but is not part of the demo; say so if asked.
- Rehearsal: `node scripts/walkthrough-v4.mjs` drives this whole script in Edge, downloads the PDF and saves screenshots to `walkthrough-v4/`.
