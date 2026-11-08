"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import type { PortfolioModel } from "@/lib/portfolio";
import type { SnapshotClaim } from "@/lib/views/project";
import type { Lang, PathId } from "@/lib/i18n";
import { Portfolio } from "../portfolio/Portfolio";
import { CorrectionDialog } from "../CorrectionDialog";
import { SourceDialog, type SourceRequest } from "../SourceDialog";
import { LangSwitch } from "../Choice";
import { post, useWorkspace } from "../guided/useWorkspace";
import { Discover } from "./Discover";
import { NextSteps } from "./NextSteps";
import { Swarm } from "./Swarm";
import s from "./studio2.module.css";

type LiveDraft = { title: string; url: string };
type Tab = "portfolio" | "discover" | "next";
const TABS: Tab[] = ["portfolio", "discover", "next"];
const ROLE: Record<string, string> = { author: "Rin's own", co_author: "Shared", contributor: "Contribution", reviewer: "Reviewed", unknown: "Unclear" };

const READY_WORD = { ready: "Live", "needs-setup": "Needs setup", "demo-only": "Demo only", planned: "Planned" } as const;

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
  const [tab, setTab] = useState<Tab>("portfolio");
  /** Set only by Discover's call to action; choosing a tab yourself opens next steps as before. */
  const [adapt, setAdapt] = useState<{ path: PathId; n: number } | null>(null);
  const [lang, setLang] = useState<Lang>("en");
  const [goalText, setGoalText] = useState<string | null>(null);
  const [cvText, setCvText] = useState<string | null>(null);
  const workspaceId = ws.state?.snapshot.workspace.id;
  const draftKey = workspaceId ? `pow-live-drafts:${workspaceId}` : null;
  useEffect(() => {
    if (!draftKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) ?? "null");
      if (Array.isArray(saved?.drafts) && saved.drafts.length) setDrafts(saved.drafts);
      if (typeof saved?.goal === "string") setGoalText(saved.goal);
    } catch {}
  }, [draftKey]);
  useEffect(() => {
    if (!draftKey) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ drafts, goal: goalText }));
    } catch {}
  }, [draftKey, drafts, goalText]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);

  /** Layout effect: the canvas is back at the top before the swarm measures its targets. */
  useLayoutEffect(() => {
    canvasRef.current?.scrollTo({ top: 0 });
  }, [tab]);

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
      setTab("portfolio");
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
  const needsModel = !example && state.model?.ready === false;
  const beforeCv = example ? example.cv : (cvText ?? model?.cv ?? "");
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
      const goalNow = (goalText ?? ws.state?.snapshot.goal?.text ?? "").trim();
      const cvNow = cvText ?? model?.cv ?? "";
      if (!example && !goalNow) throw new Error("Add the role you are aiming for. It is never filled in for you.");
      if (!example && ws.state?.model && !ws.state.model.ready) throw new Error(`Statements need a model. ${ws.state.model.reason} Add it to .env.local and restart the server.`);
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
      await post("/api/goal", { text: example?.goal ?? goalNow });
      await post("/api/portfolio", { builtAt: Date.now(), ...(example ? {} : { cv: cvNow }) });
      await loadModel();
      setTab("portfolio");
      setReading(null);
      setPendingReveal(true);
    });

  const edit = async (patch: { headline?: string; intro?: string; hidden?: string[]; cv?: string }) => {
    const r = await post("/api/portfolio", patch).catch(() => null);
    if (r) setModel(r);
  };

  const chooseTab = (t: Tab) => {
    setAdapt(null);
    setTab(t);
  };

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = TABS[(TABS.indexOf(tab) + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length]!;
    chooseTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  const adaptPortfolio = (path: PathId) => {
    setAdapt({ path, n: (adapt?.n ?? 0) + 1 });
    setTab("next");
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
        <nav className={s.modeSwitch} aria-label="Demo or Live">
          <a href="/api/mode?to=demo" aria-current={example ? "page" : undefined}>
            Demo
          </a>
          <a href="/api/mode?to=live" aria-current={example ? undefined : "page"}>
            Live
          </a>
        </nav>
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

        {!example && (
          <section className={s.livePanel} aria-label="Live setup">
            {state.readiness && (
              <details className={s.ready} open={!built}>
                <summary>What works live today</summary>
                <ul>
                  {state.readiness.map((r) => (
                    <li key={r.feature} data-status={r.status}>
                      <span className={s.readyName}>{r.feature}</span>
                      <span className={s.readyStatus}>{READY_WORD[r.status]}</span>
                      <span className={s.readyDetail}>{r.detail}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <label className={s.liveField}>
              The role you are aiming for
              <input value={goalText ?? state.snapshot.goal?.text ?? ""} onChange={(e) => setGoalText(e.target.value)} placeholder="For example: founding engineer at an early-stage startup" />
            </label>
            <label className={s.liveField}>
              Your CV, pasted (optional)
              <textarea
                rows={5}
                value={cvText ?? model?.cv ?? ""}
                onChange={(e) => setCvText(e.target.value)}
                onBlur={() => {
                  if (cvText !== null) void edit({ cv: cvText });
                }}
                placeholder="Paste the text of your CV. It is the before, never evidence."
              />
            </label>
          </section>
        )}

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
          <button type="button" className={s.build} disabled={!!ws.busy || needsModel} onClick={build}>
            {building ? (reading && reading.length ? `Read ${reading.length} files…` : "Reading the sources…") : built ? "Rebuild from sources" : "Build portfolio"}
          </button>
          {built && (
            <button
              type="button"
              className={s.textBtn}
              onClick={() => {
                setTab("portfolio");
                setSwarm(true);
              }}
              disabled={swarm}
            >
              Replay the reveal
            </button>
          )}
          <p className={s.buildNote}>
            {example ? "Uses the prepared EXAMPLE sources and the recorded statements, no AI model. " : "Live: claims come from the configured model; a failure is shown, never replaced. "}
            Building confirms {first}’s statements on {first}’s behalf; review or correct them anytime.
          </p>
          {needsModel && state.model && !state.model.ready && (
            <p className={s.error} role="status">
              Statements need a model. {state.model.reason} Add it to .env.local and restart the server.
            </p>
          )}
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
              {model.provenance && (
                <p className={s.hint}>
                  {model.provenance.mode === "demo" ? "Demo" : "Live"} · {model.provenance.engine} · built {new Date(model.provenance.at).toLocaleString()}
                </p>
              )}
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
          <>
            <div className={s.tabs}>
              <div role="tablist" aria-label="Canvas" className={s.tablist} onKeyDown={onTabKey}>
                {TABS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    id={`tab-${t}`}
                    aria-selected={tab === t}
                    aria-controls="canvas-panel"
                    tabIndex={tab === t ? 0 : -1}
                    className={s.tab}
                    onClick={() => chooseTab(t)}
                  >
                    {t === "portfolio" ? "Portfolio" : t === "discover" ? "Discover" : `${first}'s next steps`}
                  </button>
                ))}
              </div>
              <a className={s.kitLink} href="/packet">
                Next: consultation kit <span aria-hidden="true">→</span>
              </a>
              <LangSwitch label="Language" lang={lang} onLang={setLang} className={s.langSwitch} />
            </div>
            <div role="tabpanel" id="canvas-panel" aria-labelledby={`tab-${tab}`}>
              {tab === "portfolio" ? (
                <Portfolio model={model} lang={lang} mode="preview" onEdit={(patch) => void edit(patch)} />
              ) : tab === "discover" ? (
                <Discover model={model} lang={lang} onAdapt={adaptPortfolio} />
              ) : (
                <NextSteps key={adapt?.n ?? 0} model={model} lang={lang} onLang={setLang} initialPath={adapt?.path} />
              )}
            </div>
          </>
        ) : (
          <div className={s.before}>
            <p className={s.beforeLabel}>Before</p>
            <h2 className={s.beforeTitle}>{example || beforeCv ? "This is all a reader gets today." : "Start with your own projects."}</h2>
            {example || beforeCv ? (
              <pre className={s.cv}>{beforeCv.replace(/^#+ /gm, "").trim()}</pre>
            ) : (
              <p className={s.beforeNote}>Add your projects and the role you are aiming for in the rail. Paste your CV there too if you want to compare it with what your files show. Nothing is filled in for you.</p>
            )}
            <p className={s.beforeNote}>
              Every line is a claim, and none of them shows who did what. Build the portfolio to see what {first}’s files actually show.
            </p>
            <button type="button" className={s.build} disabled={!!ws.busy || needsModel} onClick={build}>
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
