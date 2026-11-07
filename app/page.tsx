import fs from "node:fs";
import path from "node:path";
import { modelStatus } from "@/lib/ai/model";
import { StartLive } from "@/components/Start";
import s from "@/components/landing.module.css";

export const dynamic = "force-dynamic";

type Commit = { sha: string; author: string; message: string };

function kerf() {
  const commits: Commit[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "fixtures", "example-rin", "kerf", "commits.json"), "utf8"));
  return { rin: commits.filter((c) => c.author === "rin"), other: commits.filter((c) => c.author !== "rin") };
}

const START = "/api/example/start?to=/demo";

export default function Home() {
  const k = kerf();
  const live = modelStatus();
  return (
    <main className={s.page}>
      <header className={s.bar}>
        <span className={s.wordmark}>Proof of Work</span>
        <a className={s.barLink} href="/studio">
          Workbench
        </a>
      </header>

      <section className={s.hero}>
        <div className={s.heroText}>
          <h1 className={s.h1}>Turn your projects into proof</h1>
          <p className={s.lead}>
            Proof of Work reads what you actually built and shows what a client can trust you with. Every statement links to the file it came from.
          </p>
          <a className={`btn ${s.cta}`} href={START}>
            See the 3-minute example
          </a>
          <p className={s.small}>Rin Okafor is a fictional builder heading to San Francisco. EXAMPLE data, no keys, no network.</p>
        </div>

        <div className={s.transform} aria-label="One CV line, and what its sources show">
          <div className={s.cvLine}>
            <p className={s.cvLabel}>On the CV</p>
            <p className={s.cvText}>Kerf. Preview-deploy CLI. Maintainer.</p>
          </div>
          <p className={s.arrow} aria-hidden="true">
            ↓
          </p>
          <div className={s.proofCard} data-ui>
            <p className={s.proofLabel}>What the files show</p>
            <p className={s.proofTask}>Runs Kerf’s docs and release process</p>
            <ul className={s.proofList}>
              <li>
                {k.rin.length} commits by Rin, like “{k.rin[0]?.message}”
              </li>
              <li>The deploy engine: {k.other.length} commits by Contributor C (EXAMPLE), not Rin</li>
            </ul>
            <p className={s.proofFoot}>Each line opens the file it came from.</p>
          </div>
        </div>
      </section>

      <section className={s.shots} aria-labelledby="shots-title">
        <h2 id="shots-title" className={s.shotsTitle}>
          What the example shows
        </h2>
        <div className={s.mosaic}>
          <figure className={s.shot}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shots/built.png" alt="Rin's three EXAMPLE projects, each with Rin's part, others' part and the outcome" width={1376} height={700} loading="lazy" />
            <figcaption>Three projects, with Rin’s part kept apart from everyone else’s.</figcaption>
          </figure>
          <figure className={s.shot}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shots/can-do.png" alt="Tasks a client could hand Rin, each marked shown in the work, likely, or not shown yet" width={1376} height={700} loading="lazy" />
            <figcaption>Tasks a client could hand Rin, each with its proof.</figcaption>
          </figure>
          <figure className={s.shot}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shots/next.png" alt="What Rin could build next, and a next step toward San Francisco" width={1376} height={700} loading="lazy" />
            <figcaption>What Rin could build next, and a next step toward San Francisco.</figcaption>
          </figure>
        </div>
      </section>

      <section className={s.liveBlock} aria-labelledby="live">
        <div>
          <h2 id="live" className={s.liveTitle}>
            Use your own projects
          </h2>
          <p className={s.body}>Live mode reads public GitHub data, read-only, and runs the same checks. Nothing is published; share links can be revoked.</p>
          <p className={s.small}>{live.ready ? `Model ready: ${live.label}.` : "Live mode needs a model key in .env.local. The example above needs nothing."}</p>
        </div>
        <StartLive />
      </section>

      <footer className={s.footer}>
        <p className={s.footName}>Proof of Work</p>
        <p className={s.small}>Not legal advice. No eligibility assessment. Support levels describe what the sources show, not a person’s worth.</p>
      </footer>
    </main>
  );
}
