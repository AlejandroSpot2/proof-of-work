# Demo script: The Studio (about 4 minutes, desktop, no keys)

**Setup.**
- The dev server runs on :3000. Open the browser at `http://localhost:3000/`, 1440 wide (or a projector at 1280x720).
- Everything shown is EXAMPLE data about Rin Okafor, a fictional builder.
- A fresh run is one click on **Open the Studio**; each click starts a new workspace.
- The Studio header shows **Demo | Live**. Stay on Demo for the recording.

## The script

**0:00 The promise.**
- The landing says "Portfolios for builders, built from their files".
- Point at the Studio window over the turning ASCII globe, and at its "Kerf, checked" card: Rin's 3 commits are docs and releases, and the deploy engine stays Contributor C's.
- If there is time, scroll once through the app frame with the commit log and its marked quotes, the quote check, the portfolio page and the kit.
- Click **Open the Studio**.

**0:15 Sources and the before.**
- On the left are Rin's three projects as sources. They are prepared EXAMPLE files, so the demo is reproducible; say so.
- On the right is the CV, "all a reader gets today".
- Click **Build portfolio**.

**0:30 The swarm.**
- The file chips light up as each file is read.
- Cursors labeled with those file names then place the portfolio block by block.
- The caption says it is an illustration of a result already built, and **Skip** ends it.
- You land on the portfolio: the name, the positioning line and the project index.

**0:55 Explore a project.**
- Click **Tidepool** in the index; it zooms into the project.
- Drag **Scrub time** to the end: two offline edits merge field by field.
- Scroll through Rin's part in plain words, then who did what by date (Contributor B's storage adapter stays theirs), then the project's own files.
- Click **Proof**, then a quote: the file opens with the quote highlighted.
- Close back to all work.

**1:35 English and Spanish.**
- Click **ES** in the tab bar. The portfolio's own words switch to Spanish, marked with a dotted underline.
- Open a proof: the quotes stay word for word in English. Facts and file names never change.
- Switch back to **EN**.

**1:50 Discover.**
- Open the **Discover** tab. The label reads "Prepared example · no live search"; Treg is only the planned source.
- With **Potential cofounders**, press **Check the signals**. Each card is checked in turn against stated rules (intent, evidence, complement, filters), then sorted into the shortlist and "Dropped, and why":
  - Tomás brings what Rin already shows.
  - Ari needs model training, which Rin's files don't show.
  - Noor doesn't match the intent.
- Select **Sol**: the need, what Rin brings with proof, what we don't know (availability: unknown), and a draft that is never sent.
- Press **Adapt portfolio**.

**2:30 Rin's next steps.**
- **Apply for a role**: the Fieldmark (EXAMPLE) posting.
  - 4 of 6 requirements are backed by evidence.
  - Production is a gap, because it is not shown yet.
  - Deploys are a gap, because Contributor C wrote them.
  - The portfolio below is reordered and badged for the role.
- Mention **Strengthen** and **Find a cofounder** in one line each.

**3:05 The First Consultation Kit.**
- Click **Next: consultation kit**. Show the one-page summary, the dossier with exhibits, what is still missing (projects alone decide no visa question), and the questions for a first meeting with an attorney.
- Click **Download PDF** and open it: the cover, the contents with page numbers, exhibits with page references, and annexes with the literal source text.

**3:40 Demo and Live, if asked.**
- **Live** is the same Studio on your own GitHub projects. It lists what works live today, per feature:
  - Live: sources, review, portfolio, kit.
  - Needs the model: statements, translation, Apply.
  - Demo only: strengthen and cofounder.
  - Discover: needs a Treg token and a spend cap.
- A real workspace's kit carries no EXAMPLE marks and names the person.
- Close on the two outputs: a portfolio worth sharing and a kit worth bringing to a consult, from the same facts.

## Direct entries

- The example portfolio as a visitor sees it: `/api/example/start?stage=published`. It has its own EN | ES switch and never shows next steps.
- The example consultation kit: `/api/example/start?stage=answered&to=/packet`.
- The Studio already built: `/api/example/start?stage=answered&to=/studio`. Discover and Rin's next steps are its tabs.
- The Demo/Live switch: `/api/mode?to=demo` and `/api/mode?to=live`. Live with no workspace yet goes to `/live`.
- Legacy routes: the guided tutorial at `/demo`, and the old one-page workbench at `/workbench`.
- The landing is a static page, `public/index.html`. It is built with the design kit in `public/assets` and served at `/` by a rewrite in `next.config.ts`.

## If something goes wrong

- The first build or the first PDF after a server start compiles routes and takes 10 to 20 seconds. Rehearse once before recording.
- Building in Live makes real model calls. It is not part of the recorded demo.
- Rehearsals, each in Edge:
  - `node scripts/walkthrough-v4.mjs` covers the core script and the PDF (12 checks).
  - `node scripts/walkthrough-next.mjs` covers next steps in EN and ES (52 checks).
  - `node scripts/walkthrough-live.mjs` covers Demo and Live against a server with no model configured (21 checks).
