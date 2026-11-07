"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PortfolioModel } from "@/lib/portfolio";
import type { SnapshotClaim } from "@/lib/views/project";
import { Portfolio } from "../portfolio/Portfolio";
import { CorrectionDialog } from "../CorrectionDialog";
import { SourceDialog, type SourceRequest } from "../SourceDialog";
import { post, useWorkspace } from "../guided/useWorkspace";
import { Swarm } from "./Swarm";
import s from "./studio2.module.css";

type LiveDraft = { title: string; url: string };
const ROLE: Record<string, string> = { author: "Rin's own", co_author: "Shared", contributor: "Contribution", reviewer: "Reviewed", unknown: "Unclear" };

export function StudioApp() {
  const ws = useWorkspace("/studio");
  const [model, setModel] = useState<PortfolioModel | null>(null);
  const [swarm, setSwarm] = useState(false);
  const [pendingReveal, setPendingReveal] = useState(false);
  const [review, setReview] = useState(false);
  const [share, setShare] = useState<{ id: string; path: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [correcting, setCorrecting] = useState<SnapshotClaim | null>(null);
  const [source, setSource] = useState<SourceRequest | null>(null);
  const [drafts, setDrafts] = useState<LiveDraft[]>([
    { title: "", url: "" },
    { title: "", url: "" },
    { title: "", url: "" },
  ]);
  const [reading, setReading] = useState<{ title: string; locator: string; status: string }[] | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);

  const loadModel = useCallback(async () => {
    const r = await fetch("/api/portfolio", { cache: "no-store" });
    if (r.ok) setModel(await r.json());
  }, []);

  useEffect(() => {
    void loadModel();
  }, [loadModel, ws.state?.snapshot.workspace.ledgerRevision]);

  const readyToReveal = pendingReveal && !!model && model.capabilities.length > 0 && (ws.state?.snapshot.projects.length ?? 0) > 0 && !ws.busy;
  useEffect(() => {
    if (!readyToReveal) return;
    const id = requestAnimationFrame(() => {
      setPendingReveal(false);
      setSwarm(true);
    });
    return () => cancelAnimationFrame(id);
  }, [readyToReveal]);

  const state = ws.state;
  if (!state) return <main className={s.loading}>{ws.error ? `Could not open the Studio: ${ws.error}` : "Opening the Studio"}</main>;

  const example = state.example;
  const person = state.snapshot.workspace.personName;
  const first = person.replace(/\s*\(EXAMPLE\)\s*/, "").split(" ")[0] ?? person;
  const projects = state.snapshot.projects;
  const built = projects.length > 0 && !!model && model.capabilities.length > 0;
  const building = ws.busy === "build";
  const claims = projects.flatMap((p) => p.claims);
  const confirmed = claims.filter((c) => c.reviewStatus === "approved").length;
  const filesRead = projects.flatMap((p) => p.sources).filter((x) => x.status === "ok").length;

  const sourceRows = example
    ? example.projects.map((p) => {
        const stored = projects.find((x) => x.title === p.title);
        const live = reading ? reading.filter((x) => x.title === p.title) : null;
        const files = live ?? stored?.sources.map((x) => ({ locator: x.locator, status: x.status })) ?? [];
        return { title: p.title, url: p.url, role: p.role, files };
      })
    : projects.map((p) => ({ title: p.title, url: p.urls[0] ?? "", role: p.role ?? "", files: p.sources.map((x) => ({ locator: x.locator, status: x.status })) }));

  const build = () =>
    ws.run("build", async () => {
      const list = example ? example.projects : drafts.filter((d) => d.title.trim() && d.url.trim()).map((d) => ({ title: d.title.trim(), role: "", url: d.url.trim() }));
      if (!list.length) throw new Error("Add at least one project with a link.");
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects: list.map((p) => ({ title: p.title, role: p.role, urls: [{ url: p.url }] })) }),
      });
      if (!res.ok || !res.body) throw new Error("Could not read the sources");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let failure: string | null = null;
      const titles: Record<string, string> = {};
      setReading([]);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) {
          const e = JSON.parse(line);
          if (e.type === "error") failure = e.message;
          if (e.type === "project") titles[e.projectId] = e.title;
          if (e.type === "source") setReading((r) => [...(r ?? []), { title: titles[e.projectId] ?? "", locator: e.locator, status: e.status }]);
        }
      }
      if (failure) throw new Error(failure);
      const st = await (await fetch("/api/state", { cache: "no-store" })).json();
      const proposed = (st.snapshot.projects as { claims: SnapshotClaim[] }[]).flatMap((p) => p.claims).filter((c) => c.reviewStatus === "proposed" && c.state !== "unverified");
      for (const c of proposed) await post(`/api/claims/${c.id}`, { action: "approve" });
      await post("/api/goal", { text: example?.goal ?? st.snapshot.goal?.text ?? "Founding engineer" });
      await post("/api/portfolio", { builtAt: Date.now() });
      await loadModel();
      setReading(null);
      setPendingReveal(true);
    });

  const edit = async (patch: { headline?: string; intro?: string; hidden?: string[] }) => {
    const r = await post("/api/portfolio", patch).catch(() => null);
    if (r) setModel(r);
  };

  const createShare = () =>
    ws.run("share", async () => {
      const r = await post("/api/presentations", { audience: "portfolio" });
      setShare({ id: r.id, path: r.path });
      setCopied(false);
    });

  const shareUrl = share ? `${window.location.origin}${share.path}` : "";

  return (
    <div className={s.app}>
      <header className={s.bar}>
        <a href="/" className={s.brand}>
          <span className={s.logo} aria-hidden="true" />
          Proof of Work
        </a>
        <span className={s.crumb}>Studio</span>
        <span className={s.scope}>
          {example && <span className={s.example}>EXAMPLE</span>} {person.replace(" (EXAMPLE)", "")}
        </span>
        <div className={s.barActions}>
          <a className={s.ghost} href="/packet" aria-disabled={!built} onClick={(e) => !built && e.preventDefault()}>
            Consultation kit
          </a>
          <a className={s.ghost} href="/portfolio" target="_blank" rel="noreferrer" aria-disabled={!built} onClick={(e) => !built && e.preventDefault()}>
            Preview as a visitor
          </a>
          <button type="button" className={s.primary} disabled={!built || !!ws.busy} onClick={createShare}>
            Share portfolio
          </button>
        </div>
        {share && (
          <div className={s.sharePop} role="dialog" aria-label="Share link">
            <p className={s.shareTitle}>Read-only link, revocable. Nothing is published anywhere else.</p>
            <div className={s.shareRow}>
              <input readOnly value={shareUrl} aria-label="Portfolio link" onFocus={(e) => e.currentTarget.select()} />
              <button
                type="button"
                className={s.primary}
                onClick={async () => {
                  await navigator.clipboard?.writeText(shareUrl).catch(() => {});
                  setCopied(true);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className={s.shareRow}>
              <a href={share.path} target="_blank" rel="noreferrer">
                Open it
              </a>
              <button
                type="button"
                className={s.textBtn}
                onClick={() =>
                  ws.run("revoke", async () => {
                    await fetch(`/api/presentations/${share.id}`, { method: "DELETE" });
                    setShare(null);
                  })
                }
              >
                Revoke
              </button>
              <button type="button" className={s.textBtn} onClick={() => setShare(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </header>

      <aside className={s.rail} ref={railRef} aria-label="Sources">
        <div className={s.railHead}>
          <h1 className={s.railTitle}>Sources</h1>
          <p className={s.railSub}>{example ? `${first}'s three projects, prepared as EXAMPLE files so the demo is reproducible. Nothing is fetched from the network.` : "Public GitHub repositories or https pages, read through the bounded importer."}</p>
        </div>

        {example || projects.length ? (
          <ol className={s.sources}>
            {sourceRows.map((p) => (
              <li key={p.title} className={s.source}>
                <div className={s.sourceHead}>
                  <span className={s.sourceTitle}>{p.title}</span>
                  {p.role && <span className={s.sourceRole}>{p.role}</span>}
                </div>
                <p className={s.sourceUrl}>{p.url}</p>
                <ul className={s.files}>
                  {(p.files.length ? p.files : [{ locator: "waiting", status: "idle" }]).map((f, i) => (
                    <li key={f.locator + i} data-status={f.status} data-swarm-origin={f.status === "ok" ? f.locator : undefined}>
                      {f.locator === "waiting" ? (building ? "Reading…" : "Not read yet") : f.locator}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        ) : (
          <div className={s.liveInputs}>
            {drafts.map((d, i) => (
              <div key={i} className={s.liveRow}>
                <input placeholder={`Project ${i + 1} name`} value={d.title} onChange={(e) => setDrafts(drafts.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} aria-label={`Project ${i + 1} name`} />
                <input placeholder="https://github.com/owner/repo" value={d.url} onChange={(e) => setDrafts(drafts.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))} aria-label={`Project ${i + 1} link`} />
              </div>
            ))}
          </div>
        )}

        <div className={s.buildBox}>
          <button type="button" className={s.build} disabled={!!ws.busy} onClick={build}>
            {building ? (reading && reading.length ? `Read ${reading.length} files…` : "Reading the sources…") : built ? "Rebuild from sources" : "Build portfolio"}
          </button>
          {built && (
            <button type="button" className={s.textBtn} onClick={() => setSwarm(true)} disabled={swarm}>
              Replay the reveal
            </button>
          )}
          <p className={s.buildNote}>
            {example ? "Uses the prepared EXAMPLE sources and the recorded statements, no AI model. " : "Live: claims come from the configured model; a failure is shown, never replaced. "}
            Building confirms {first}’s statements on {first}’s behalf; review or correct them anytime.
          </p>
          {ws.error && (
            <p className={s.error} role="alert">
              {ws.error}
            </p>
          )}
        </div>

        {built && model && (
          <>
            <section className={s.panel} aria-labelledby="show">
              <h2 id="show" className={s.panelTitle}>
                Shown in the portfolio
              </h2>
              {model.projects.map((x) => (
                <label key={x.slug} className={s.toggle}>
                  <input
                    type="checkbox"
                    checked={!model.hidden.includes(x.slug)}
                    onChange={(e) => edit({ hidden: e.target.checked ? model.hidden.filter((h) => h !== x.slug) : [...model.hidden, x.slug] })}
                  />
                  {x.title}
                </label>
              ))}
              <p className={s.hint}>Click the headline or the intro in the preview to rewrite them.</p>
            </section>
            <section className={s.panel} aria-labelledby="facts">
              <h2 id="facts" className={s.panelTitle}>
                What it rests on
              </h2>
              <p className={s.factLine}>
                <strong>{filesRead}</strong> files read · <strong>{confirmed}</strong> statements confirmed by {first}
              </p>
              <button type="button" className={s.ghostBtn} onClick={() => setReview(true)}>
                Review statements
              </button>
            </section>
            <section className={s.panel} aria-labelledby="out">
              <h2 id="out" className={s.panelTitle}>
                Outputs
              </h2>
              <a className={s.outLink} href="/packet">
                <span>First Consultation Kit</span>
                <span className={s.outMeta}>Summary, dossier, what is missing, questions for the attorney</span>
              </a>
              <a className={s.outLink} href="/api/packet/pdf">
                <span>Download the kit (PDF)</span>
                <span className={s.outMeta}>Typeset, with exhibits and page references</span>
              </a>
            </section>
          </>
        )}
      </aside>

      <main className={s.canvas} ref={canvasRef} aria-label="Portfolio preview">
        {built && model ? (
          <div className={s.preview}>
            <Portfolio model={model} mode="preview" onEdit={(patch) => void edit(patch)} />
          </div>
        ) : (
          <div className={s.before}>
            <p className={s.beforeLabel}>Before</p>
            <h2 className={s.beforeTitle}>This is all a reader gets today.</h2>
            <pre className={s.cv}>{(example?.cv ?? "").replace(/^#+ /gm, "").trim()}</pre>
            <p className={s.beforeNote}>
              Every line is a claim, and none of them shows who did what. Build the portfolio to see what {first}’s files actually show.
            </p>
            <button type="button" className={s.build} disabled={!!ws.busy} onClick={build}>
              {building ? "Reading the sources…" : "Build portfolio"}
            </button>
          </div>
        )}
      </main>

      {swarm && canvasRef.current && railRef.current && <Swarm canvas={canvasRef.current} rail={railRef.current} fileCount={filesRead} onDone={() => setSwarm(false)} />}

      {review && (
        <ReviewDrawer
          claims={projects.flatMap((p) => p.claims.map((c) => ({ ...c, projectTitle: p.title })))}
          onClose={() => setReview(false)}
          onCorrect={(c) => setCorrecting(c)}
          onOpen={(sourceId, quote) => setSource({ sourceId, quote })}
          onConfirm={(id) => ws.run("claim", () => post(`/api/claims/${id}`, { action: "approve" }))}
        />
      )}
      {source && <SourceDialog req={source} onClose={() => setSource(null)} />}
      {correcting && (
        <CorrectionDialog
          claim={correcting}
          suggestion={example && correcting.text === example.correction.claim ? example.correction : null}
          onClose={() => setCorrecting(null)}
          onSave={(body) =>
            ws.run("correct", async () => {
              await post(`/api/claims/${correcting.id}`, { action: "correct", ...body });
              await post("/api/goal", {});
              setCorrecting(null);
            })
          }
        />
      )}
    </div>
  );
}

function ReviewDrawer({
  claims,
  onClose,
  onCorrect,
  onOpen,
  onConfirm,
}: {
  claims: (SnapshotClaim & { projectTitle: string })[];
  onClose: () => void;
  onCorrect: (c: SnapshotClaim) => void;
  onOpen: (sourceId: string, quote: string) => void;
  onConfirm: (id: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className={s.drawer} onClose={onClose} aria-labelledby="review-title">
      <div className={s.drawerHead}>
        <h2 id="review-title" className={s.drawerTitle}>
          Statements behind the portfolio
        </h2>
        <button type="button" className={s.ghostBtn} onClick={() => ref.current?.close()} autoFocus>
          Close
        </button>
      </div>
      <p className={s.hint}>Each one is quoted word for word from a file. A correction reaches the portfolio and the consultation kit at once.</p>
      <ul className={s.claims}>
        {claims
          .filter((c) => c.state !== "unverified")
          .map((c) => (
            <li key={`${c.id}-${c.revision}`}>
              <p className={s.claimText}>{c.text}</p>
              <p className={s.claimMeta}>
                {c.projectTitle} · {ROLE[c.attribution] ?? c.attribution} · {c.reviewStatus === "approved" ? "confirmed" : c.reviewStatus}
              </p>
              <div className={s.claimQuotes}>
                {c.evidence.slice(0, 2).map((e) => (
                  <button key={e.id} type="button" onClick={() => onOpen(e.sourceId, e.quote)}>
                    “{e.quote}” <span>{e.locator}</span>
                  </button>
                ))}
              </div>
              <div className={s.claimActions}>
                {c.reviewStatus !== "approved" && (
                  <button type="button" className={s.ghostBtn} onClick={() => onConfirm(c.id)}>
                    Confirm
                  </button>
                )}
                <button type="button" className={s.textBtn} onClick={() => onCorrect(c)}>
                  Correct
                </button>
              </div>
            </li>
          ))}
      </ul>
    </dialog>
  );
}
