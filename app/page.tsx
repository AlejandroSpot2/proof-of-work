import fs from "node:fs";
import path from "node:path";
import { loadCv, loadProfile } from "@/lib/fixtures/rin";
import { modelStatus } from "@/lib/ai/model";
import { StartExample, StartLive } from "@/components/Start";
import s from "@/components/landing.module.css";

export const dynamic = "force-dynamic";

type Commit = { sha: string; author: string; message: string };

function kerfEvidence() {
  const dir = path.join(process.cwd(), "fixtures", "example-rin", "kerf");
  const commits: Commit[] = JSON.parse(fs.readFileSync(path.join(dir, "commits.json"), "utf8"));
  const readme = fs.readFileSync(path.join(dir, "README.md"), "utf8");
  const maintainers = readme.split("\n").find((l) => l.startsWith("Maintainers:")) ?? "";
  return {
    maintainers,
    rin: commits.filter((c) => c.author === "rin"),
    other: commits.filter((c) => c.author !== "rin"),
  };
}

export default function Home() {
  const profile = loadProfile();
  const cv = loadCv()
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => l.replace(/^#+\s*/, "").replace(/^-\s*/, ""));
  const kerf = kerfEvidence();
  const live = modelStatus();

  return (
    <main className={s.page}>
      <header className={s.bar}>
        <span className={s.wordmark}>Proof of Work</span>
        <StartExample />
      </header>

      <section className={s.masthead} aria-label="A flat CV, the before">
        <div className={s.cvSheet} data-ui>
          {cv.map((line, i) => (
            <p key={i} className={i === 0 ? s.cvName : /^(Experience|Skills|About)$/.test(line) ? s.cvHead : s.cvLine}>
              {line}
            </p>
          ))}
        </div>
        <div className={s.cards}>
          <div className={s.card}>
            <p className={s.cardLine}>Kerf. Maintainer.</p>
            <p className={s.cardVerdict}>
              The sources show {kerf.rin.length} commits by Rin on docs and releases, and {kerf.other.length} by someone else on the deploy engine.
            </p>
          </div>
          <div className={s.card}>
            <p className={s.cardLine}>Conflict resolution.</p>
            <p className={s.cardVerdict}>A merged pull request and a commit by Rin, quoted word for word. Demonstrated, not claimed.</p>
          </div>
        </div>
      </section>

      <section className={s.titleBlock}>
        <p className={s.sideNote}>
          Above: the CV of {profile.name}, a fictional builder. Every line is a claim. None of them shows its proof.
        </p>
        <h1 className={s.h1}>A resume says what you claim.</h1>
        <div className={s.stand}>
          <p className={s.lead}>
            Proof of Work shows what your work proves. Every claim is traced to a literal quote in its source, every capability to the claims behind it, and every limit is stated.
          </p>
          <p className={s.body}>
            Bring three projects. Ask one question a client would ask: what can you entrust to this person, and why? Correct what the system got wrong, and watch the client portfolio and the private attorney dossier change together.
          </p>
          <StartExample />
          <p className="small muted">The example runs with no keys and no network. Rin Okafor and everything about Rin is synthetic and labeled EXAMPLE.</p>
        </div>
      </section>

      <section className={s.field} aria-labelledby="opened">
        <h2 id="opened" className={s.fieldTitle}>
          One CV line, opened
        </h2>
        <div className={s.split}>
          <div className={s.before}>
            <p className={s.flat}>Kerf. Preview-deploy CLI. Maintainer.</p>
            <p className={s.fieldSmall}>What the CV says.</p>
          </div>
          <div className={s.after} data-ui>
            <p className={s.fieldSmall}>What the EXAMPLE sources say</p>
            <blockquote className={s.quote}>{kerf.maintainers}</blockquote>
            <p>
              {kerf.other.length} commits by another contributor build the deploy engine, for example “{kerf.other[0]?.message}”.
            </p>
            <p>
              {kerf.rin.length} commits by Rin cover docs and releases, for example “{kerf.rin[0]?.message}”.
            </p>
            <p className={s.verdict}>Supported: co-maintains the release process. Not supported: built Kerf.</p>
          </div>
        </div>
      </section>

      <section className={s.shots} aria-labelledby="shots-title">
        <h2 id="shots-title" className={s.shotsTitle}>
          What a client gets
        </h2>
        <div className={s.mosaic}>
          <figure className={s.shot}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shots/entrust-answer.png" alt="The entrust answer for Rin Okafor (EXAMPLE): one capability demonstrated, one inferred after a correction, one unknown, each with quotes and limits" width={752} height={1091} loading="lazy" />
            <figcaption>Capabilities for one goal, each demonstrated, inferred or unknown, with its quotes and its limits.</figcaption>
          </figure>
          <figure className={s.shot}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shots/quote-in-source.png" alt="A quoted claim opened inside its source file, highlighted where it appears" width={760} height={516} loading="lazy" />
            <figcaption>Every quote opens in its source, highlighted where it appears.</figcaption>
          </figure>
          <figure className={s.shot}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shots/two-views.png" alt="The client portfolio and the private attorney dossier side by side, built from the same ledger" width={1378} height={1325} loading="lazy" />
            <figcaption>A client portfolio and a private attorney dossier from the same facts.</figcaption>
          </figure>
        </div>
      </section>

      <section className={s.stairs} aria-label="How it works">
        <div className={s.step} style={{ ["--col" as string]: 1 }}>
          <h2 className={s.stepLine}>First, bring three projects.</h2>
          <p className={s.stepNote}>Repositories through the public GitHub API, pages through an https allowlist. Each source is shown with its status.</p>
        </div>
        <div className={s.step} style={{ ["--col" as string]: 3 }}>
          <h2 className={s.stepLine}>Then every claim needs a quote.</h2>
          <p className={s.stepNote}>A claim survives only if its quote is in the source word for word. A repo you own is not code you wrote.</p>
        </div>
        <div className={s.step} style={{ ["--col" as string]: 5 }}>
          <h2 className={s.stepLine}>You correct what it got wrong.</h2>
          <p className={s.stepNote}>Corrections become new revisions. Anything built on the old one is withdrawn.</p>
        </div>
        <div className={s.step} style={{ ["--col" as string]: 7 }}>
          <h2 className={s.stepLine}>Both views change together.</h2>
          <p className={s.stepNote}>A client portfolio and a private attorney dossier, projected from the same approved facts.</p>
        </div>
      </section>

      <section className={s.liveBlock} aria-labelledby="live">
        <div>
          <h2 id="live" className={s.liveTitle}>
            Your own work, privately
          </h2>
          <p className={s.body}>
            Live mode reads public GitHub data read-only and asks a model for claims with quotes, then applies the same checks. Nothing is published. Share links are revocable.
          </p>
          <p className="small muted">{live.ready ? `Model ready: ${live.label}.` : `Live claims need a model. ${live.reason} See .env.example.`}</p>
        </div>
        <StartLive />
      </section>

      <footer className={s.footer}>
        <p className={s.footName}>Proof of Work</p>
        <p className="small">Support levels are qualitative readings of sources, not verification, scores or legal criteria. Not legal advice. No eligibility assessment.</p>
      </footer>
    </main>
  );
}
