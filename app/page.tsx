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

const STUDIO = "/api/example/start?to=/studio";
const PORTFOLIO = "/api/example/start?stage=published";
const PACKET = "/api/example/start?stage=answered&to=/packet";

export default function Home() {
  const k = kerf();
  const live = modelStatus();
  return (
    <main className={s.page}>
      <header className={s.bar}>
        <span className={s.wordmark}>
          <span className={s.mark} aria-hidden="true" />
          Proof of Work
        </span>
        <nav className={s.nav} aria-label="Examples">
          <a href={PORTFOLIO}>Example portfolio</a>
          <a href={PACKET}>Example consultation kit</a>
          <a className={s.navCta} href={STUDIO}>
            Open the Studio
          </a>
        </nav>
      </header>

      <section className={s.hero}>
        <div className={s.heroText}>
          <h1 className={s.h1}>Turn your projects into proof</h1>
          <p className={s.lead}>
            Proof of Work reads what you built and turns it into a portfolio worth sharing and a First Consultation Kit to bring to an immigration attorney. Every sentence links to the file it came from.
          </p>
          <div className={s.ctas}>
            <a className={s.cta} href={STUDIO}>
              Open the Studio
            </a>
            <a className={s.ctaSecondary} href={PORTFOLIO}>
              See Rin’s published portfolio
            </a>
          </div>
          <p className={s.small}>Rin Okafor is a fictional builder heading to San Francisco. Everything here is EXAMPLE data: no keys, no network.</p>
        </div>

        <figure className={s.transform} aria-label="One CV line, and what its files show">
          <div className={s.cvLine}>
            <p className={s.cvLabel}>On the CV</p>
            <p className={s.cvText}>Kerf. Preview-deploy CLI. Maintainer.</p>
          </div>
          <div className={s.proofCard} data-ui>
            <p className={s.proofLabel}>What Kerf’s own files show</p>
            <p className={s.proofTask}>Runs Kerf’s docs and release process</p>
            <ul className={s.proofList}>
              <li>
                <span className={s.who}>Rin</span> {k.rin.length} commits, like “{k.rin[0]?.message}”
              </li>
              <li>
                <span className={s.whoOther}>Contributor C</span> {k.other.length} commits on the deploy engine, not Rin’s
              </li>
            </ul>
            <figcaption className={s.proofFoot}>In the Studio, each line opens the file it came from.</figcaption>
          </div>
        </figure>
      </section>

      <section className={s.outputs} aria-labelledby="outputs-title">
        <h2 id="outputs-title" className={s.outputsTitle}>
          One set of facts, two outputs
        </h2>
        <div className={s.outputGrid}>
          <a className={s.output} href={STUDIO}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shots/studio.png" alt="The Studio placing Rin's portfolio from the files it just read" width={1440} height={900} loading="lazy" />
            <span className={s.outputName}>The Studio</span>
            <span className={s.outputLine}>Add sources, build, and watch the files become projects. Edit the words; the facts stay linked.</span>
          </a>
          <a className={s.output} href={PORTFOLIO}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shots/portfolio.png" alt="Rin's published portfolio, opened on the Tidepool project" width={1440} height={900} loading="lazy" />
            <span className={s.outputName}>A portfolio worth sharing</span>
            <span className={s.outputLine}>Big projects you can explore, Rin’s part kept apart from everyone else’s, proof one click away.</span>
          </a>
          <a className={s.output} href={PACKET}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shots/packet.png" alt="Rin's First Consultation Kit, prepared for a first meeting with an attorney" width={1440} height={900} loading="lazy" />
            <span className={s.outputName}>A First Consultation Kit</span>
            <span className={s.outputLine}>A typeset PDF Rin prepares for an attorney: a one-page summary, the dossier with exhibits, what is still missing, and questions to ask.</span>
          </a>
        </div>
      </section>

      <section className={s.liveBlock} aria-labelledby="live">
        <div>
          <h2 id="live" className={s.liveTitle}>
            Use your own projects
          </h2>
          <p className={s.body}>Live mode reads public GitHub data, read-only, and runs the same checks. Nothing is published; share links can be revoked.</p>
          <p className={s.small}>{live.ready ? `Model ready: ${live.label}.` : "Live mode needs a model key in .env.local. The example needs nothing."}</p>
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
