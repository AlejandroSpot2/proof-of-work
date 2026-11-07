import { modelStatus } from "@/lib/ai/model";
import { StartLive } from "@/components/Start";
import s from "@/components/landing.module.css";

export const dynamic = "force-dynamic";

// Live mode's entry. The landing itself is the static page in public/index.html, served at "/".
export default function Live() {
  const live = modelStatus();
  return (
    <main className={s.page}>
      <header className={s.bar}>
        <a className={s.wordmark} href="/">
          <span className={s.mark} aria-hidden="true" />
          Proof of Work
        </a>
        <nav className={s.nav} aria-label="Examples">
          <a href="/api/example/start?to=/studio">Open the example Studio</a>
        </nav>
      </header>
      <section className={s.liveBlock} aria-labelledby="live" style={{ paddingTop: "clamp(48px, 8vw, 120px)" }}>
        <div>
          <h1 id="live" className={s.liveTitle}>
            Use your own projects
          </h1>
          <p className={s.body}>Live mode reads public GitHub data, read-only, and runs the same checks. Nothing is published; share links can be revoked.</p>
          <p className={s.small}>{live.ready ? `Model ready: ${live.label}.` : "Live mode needs a model key in .env.local. The example needs nothing."}</p>
        </div>
        <StartLive />
      </section>
    </main>
  );
}
