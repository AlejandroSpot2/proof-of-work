"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Entrust, PortfolioView, AttorneyView, Snapshot, SnapshotClaim, ResolvedCapability } from "@/lib/views/project";
import type { Opportunity } from "@/lib/opportunities";
import type { ModelStatus } from "@/lib/ai/model";
import { AttorneyDoc, PortfolioDoc, SupportMark, attributionWord, stateWord } from "./docs";
import { SourceDialog, type SourceRequest } from "./SourceDialog";
import { Opportunities } from "./Opportunities";
import s from "./studio.module.css";

type ExampleInfo = {
  disclaimer: string;
  goal: string;
  role: string;
  bio: string;
  projects: { title: string; role: string; url: string }[];
  correction: { claim: string; text: string; attribution: string; attributionNote: string; why: string };
};

type State = {
  snapshot: Snapshot;
  entrust: Entrust;
  portfolio: PortfolioView;
  attorney: AttorneyView;
  opportunities: Opportunity[];
  example: ExampleInfo | null;
  model: ModelStatus | null;
};

type Draft = { title: string; role: string; urls: { url: string; ownPage: boolean }[] };
type LiveSource = { url: string; locator: string; status: string; statusDetail: string };

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

export function Studio() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [source, setSource] = useState<SourceRequest | null>(null);
  const [correcting, setCorrecting] = useState<SnapshotClaim | null>(null);
  const [links, setLinks] = useState<{ id: string; audience: string; path: string }[]>([]);
  const [liveSources, setLiveSources] = useState<Record<string, LiveSource[]>>({});
  const [importLog, setImportLog] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [goal, setGoal] = useState("");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.status === 401) {
      window.location.href = "/";
      return;
    }
    const data = (await res.json()) as State;
    setState(data);
    setDrafts((d) => d ?? initialDrafts(data));
    setGoal((g) => g || data.snapshot.goal?.text || data.example?.goal || "");
  }, []);

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, [refresh]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const doImport = () =>
    run("import", async () => {
      setLiveSources({});
      setImportLog([]);
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects: (drafts ?? []).map((d) => ({ ...d, urls: d.urls.filter((u) => u.url.trim()) })) }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? "Import failed");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      const titles: Record<string, string> = {};
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line);
          if (e.type === "project") titles[e.projectId] = e.title;
          if (e.type === "source") setLiveSources((prev) => ({ ...prev, [e.projectId]: [...(prev[e.projectId] ?? []), e] }));
          if (e.type === "claims")
            setImportLog((l) => [
              ...l,
              `${titles[e.projectId]}: ${e.kept} claim${e.kept === 1 ? "" : "s"} kept${e.report.llmCalled ? " (1 model call)" : ""}${e.report.discarded.length ? `, ${e.report.discarded.length} discarded for a quote not in the source` : ""}${e.report.heldBack.length ? `, ${e.report.heldBack.length} held back by attribution rules` : ""}.`,
            ]);
          if (e.type === "error") setImportLog((l) => [...l, e.message]);
        }
      }
    });

  if (!state || !drafts) {
    return <main className={s.loading}>{error ? `Could not load: ${error}` : "Opening the ledger"}</main>;
  }

  const { snapshot, entrust, example } = state;
  const person = snapshot.workspace.personName;
  const allClaims = snapshot.projects.flatMap((p) => p.claims);
  const proposed = allClaims.filter((c) => c.reviewStatus === "proposed" && c.state !== "unverified");
  const approvedCount = allClaims.filter((c) => c.reviewStatus === "approved").length;
  const openSource = (sourceId: string, quote: string) => setSource({ sourceId, quote });
  const claimById = new Map(allClaims.map((c) => [c.id, c]));

  return (
    <div className={s.page}>
      <header className={s.bar}>
        <a href="/" className={s.wordmark}>
          Proof of Work
        </a>
        <p className={s.scope}>
          {example ? (
            <>
              <span className="example-flag">EXAMPLE</span> {person}, a fictional builder. Synthetic data, no keys, no network.
            </>
          ) : (
            <>
              {person} (@{snapshot.workspace.githubHandle}). Live mode{state.model?.ready ? `, model ${state.model.label}` : ""}.
            </>
          )}
        </p>
        <nav className={s.barLinks}>
          {example && (
            <a href="/cv" target="_blank" rel="noreferrer">
              The flat CV
            </a>
          )}
          <a href="#views">Two views</a>
        </nav>
      </header>

      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}

      <section className={s.chapter} id="projects">
        <div className={s.side}>
          <h2 className={s.h2}>Three projects in</h2>
          <p className={s.note}>
            {example
              ? "Each project is a folder of EXAMPLE files: README, design notes, a pull request, commits. Fixture mode reads only these."
              : "GitHub repositories are read through the public API. Other pages must be https and are fetched through an allowlist, 200 KB at most."}
          </p>
          {state.model && !state.model.ready && <p className={s.warn}>Live claims need a model: {state.model.reason}</p>}
        </div>
        <div className={s.main}>
          <div className={s.drafts}>
            {drafts.map((d, i) => (
              <div key={i} className={s.draft}>
                <label>
                  Project
                  <input value={d.title} onChange={(e) => setDrafts(updateDraft(drafts, i, { title: e.target.value }))} />
                </label>
                <label>
                  Role
                  <input value={d.role} onChange={(e) => setDrafts(updateDraft(drafts, i, { role: e.target.value }))} />
                </label>
                {d.urls.map((u, j) => (
                  <label key={j} className={s.urlField}>
                    {j === 0 ? "URL" : "Second URL (optional)"}
                    <input
                      value={u.url}
                      placeholder={example ? "" : j === 0 ? "https://github.com/owner/repo" : "https://your-site.dev/write-up"}
                      onChange={(e) => setDrafts(updateDraft(drafts, i, { urls: d.urls.map((x, k) => (k === j ? { ...x, url: e.target.value } : x)) }))}
                    />
                  </label>
                ))}
              </div>
            ))}
          </div>
          <div className={s.row}>
            <button className="btn" onClick={doImport} disabled={!!busy}>
              {busy === "import" ? "Importing" : snapshot.projects.length ? "Import again" : "Import 3 projects"}
            </button>
            {snapshot.projects.length > 0 && <span className="small muted">Re-importing unchanged sources makes no new model call and keeps your reviews.</span>}
          </div>

          {snapshot.projects.length > 0 && (
            <div className={s.sourceGrid}>
              {snapshot.projects.map((p) => {
                const live = Object.values(liveSources).length ? liveSources[p.id] : undefined;
                const rows = live ?? p.sources;
                return (
                  <div key={p.id} className={s.sourceCol}>
                    <p className={s.colTitle}>{p.title}</p>
                    <ul className={s.sources}>
                      {rows.map((src, k) => {
                        const stored = p.sources.find((x) => x.url === src.url && x.locator === src.locator);
                        return (
                          <li key={src.url + src.locator} className="rise" style={{ animationDelay: `${k * 70}ms` }}>
                            <span className={`${s.status} ${s[src.status]}`}>{src.status === "ok" ? "Read" : src.status === "blocked" ? "Blocked" : "Unavailable"}</span>
                            {stored && src.status === "ok" ? (
                              <button className="link-button" onClick={() => setSource({ sourceId: stored.id, quote: "" })}>
                                {src.locator}
                              </button>
                            ) : (
                              <span>{src.locator}</span>
                            )}
                            {src.status !== "ok" && <span className="small muted"> {src.statusDetail}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
          {importLog.length > 0 && (
            <ul className={s.log}>
              {importLog.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {snapshot.projects.length > 0 && (
        <section className={s.chapter} id="claims">
          <div className={s.side}>
            <h2 className={s.h2}>Every claim carries its quote</h2>
            <p className={s.note}>
              A claim is kept only if its quote appears word for word in the source. Owning a repository, or being named in a README, is not authorship. Click any quote to see it in its source.
            </p>
            <p className={s.note}>
              {approvedCount} approved. {proposed.length} waiting for you.
            </p>
            {proposed.length > 0 && (
              <button className="btn" disabled={!!busy} onClick={() => run("approve-all", async () => { for (const c of proposed) await post(`/api/claims/${c.id}`, { action: "approve" }); })}>
                {busy === "approve-all" ? "Approving" : `Approve all ${proposed.length} quoted claims`}
              </button>
            )}
          </div>
          <div className={s.main}>
            {snapshot.projects.map((p) => (
              <div key={p.id} className={s.projectBlock}>
                <div className={s.projectHead}>
                  <h3 className={s.h3}>{p.title}</h3>
                  <span className="muted">{p.role}</span>
                  {p.report && <span className="small muted">Claims by {p.report.engine}</span>}
                </div>
                {example && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={s.illustration} src={`/api/example/${p.title.toLowerCase()}/illustration.svg`} alt={`EXAMPLE illustration of ${p.title}`} width={480} height={300} />
                )}
                <div className={s.claims}>
                  {p.claims.map((c) => (
                    <ClaimCard key={`${c.id}-${c.revision}`} c={c} busy={!!busy} onOpen={openSource} onCorrect={() => setCorrecting(c)} run={run} />
                  ))}
                </div>
                {p.report && (p.report.heldBack.length > 0 || p.report.discarded.length > 0) && (
                  <ul className={s.heldBack}>
                    {p.report.heldBack.map((h) => (
                      <li key={h.text}>
                        Held back: “{h.text}”. {h.reason}
                      </li>
                    ))}
                    {p.report.discarded.map((h) => (
                      <li key={h.text}>
                        Discarded: “{h.text}”. {h.reason}
                      </li>
                    ))}
                  </ul>
                )}
                {p.questions.length > 0 && <FollowUp projectId={p.id} questions={p.questions} run={run} busy={!!busy} />}
              </div>
            ))}
          </div>
        </section>
      )}

      {approvedCount > 0 && (
        <section className={`${s.chapter} ${s.questionChapter}`} id="entrust">
          <div className={s.side}>
            <h2 className={s.h2}>One goal</h2>
            <form
              className={s.goalForm}
              onSubmit={(e) => {
                e.preventDefault();
                run("goal", () => post("/api/goal", { text: goal }));
              }}
            >
              <label>
                What the client needs
                <textarea rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} />
              </label>
              <button className="btn" disabled={!!busy || !goal.trim()}>
                {busy === "goal" ? "Reading the ledger" : "Ask"}
              </button>
            </form>
            <p className={s.note}>
              {example ? "Answered by deterministic fixture rules over the approved claims. No model." : "One model call per goal per ledger revision."} Support levels are capped by the ledger, never chosen by a model.
            </p>
          </div>
          <div className={s.main}>
            {entrust.status === "no-goal" || entrust.status === "not-evaluated" ? (
              <p className={s.placeholder}>Ask one goal to see what the approved evidence supports.</p>
            ) : (
              <div className={s.answer}>
                <h2 className={s.question}>What can you entrust to {person.replace(" (EXAMPLE)", "")}, and why?</h2>
                <p className={s.goalEcho}>For: {entrust.goal}</p>
                {entrust.status === "ledger-changed" && (
                  <div className={`${s.stale} rise`}>
                    <p>The ledger changed since this answer. Anything that cited a changed claim has been withdrawn from every view.</p>
                    <button className="btn btn-small" disabled={!!busy} onClick={() => run("goal", () => post("/api/goal", {}))}>
                      {busy === "goal" ? "Re-reading" : "Re-evaluate"}
                    </button>
                  </div>
                )}
                <div className={s.capList}>
                  {entrust.capabilities.map((c) => (
                    <CapabilityRow key={`${c.key}-${c.support}-${c.name}`} c={c} onOpen={openSource} claimById={claimById} onCorrect={setCorrecting} run={run} busy={!!busy} />
                  ))}
                  {entrust.capabilities.length === 0 && <p className={s.placeholder}>No capability is supported. Nothing is invented to fill the space.</p>}
                </div>
                {entrust.withdrawn.length > 0 && (
                  <div className={`${s.withdrawn} rise`}>
                    {entrust.withdrawn.map((w) => (
                      <p key={w.name}>
                        <s>{w.name}</s> withdrawn. {w.reason}
                      </p>
                    ))}
                  </div>
                )}
                {entrust.question && (
                  <p className={s.oneQuestion}>
                    <strong>One question would close the biggest gap.</strong> {entrust.question}
                  </p>
                )}
                {entrust.discarded.length > 0 && (
                  <p className="small muted">Discarded for citing unapproved evidence: {entrust.discarded.map((d) => d.name).join(", ")}.</p>
                )}
                <p className="small muted">Answered by {entrust.engine}.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {entrust.status === "current" || entrust.status === "ledger-changed" ? (
        <section className={`${s.field} on-field`} id="views">
          <div className={s.fieldHead}>
            <h2 className={s.h2}>Two views, one ledger</h2>
            <p className={s.fieldNote}>
              Both are projections of the same approved facts, rebuilt on every change. A correction lands in both at once.
            </p>
          </div>
          {entrust.withdrawn.length > 0 ? (
            <div className={`${s.ribbon} rise`} role="status">
              {entrust.withdrawn.map((w) => (
                <p key={w.name}>
                  Withdrawn from both views: <strong>{w.name}</strong>. {w.reason}
                </p>
              ))}
              {entrust.status === "ledger-changed" && (
                <div>
                  <button className="btn btn-small" disabled={!!busy} onClick={() => run("goal", () => post("/api/goal", {}))}>
                    {busy === "goal" ? "Re-reading the ledger" : "Re-evaluate from the corrected ledger"}
                  </button>
                </div>
              )}
            </div>
          ) : snapshot.reviews.some((r) => r.action === "correct") ? (
            <div className={`${s.ribbon} rise`} role="status">
              <p>
                Both views rebuilt from ledger revision {snapshot.workspace.ledgerRevision}, after {snapshot.reviews.filter((r) => r.action === "correct").length === 1 ? "one human correction" : `${snapshot.reviews.filter((r) => r.action === "correct").length} human corrections`}.
              </p>
            </div>
          ) : null}
          <div className={s.views}>
            <div className={s.viewCol}>
              <ViewLinks audience="portfolio" label="Client portfolio" links={links} setLinks={setLinks} run={run} />
              <PortfolioDoc view={state.portfolio} onOpen={openSource} compact />
            </div>
            <div className={s.viewCol}>
              <ViewLinks audience="attorney" label="Private attorney dossier" links={links} setLinks={setLinks} run={run} />
              <AttorneyDoc view={state.attorney} onOpen={openSource} compact />
            </div>
          </div>
        </section>
      ) : null}

      {entrust.nextBuild && (
        <section className={s.chapter} id="next">
          <div className={s.side}>
            <h2 className={s.h2}>What could {person.replace(" (EXAMPLE)", "").split(" ")[0]} build next?</h2>
            <p className={s.note}>A proposal assembled only from approved evidence. Not a promise of timeline or ability.</p>
          </div>
          <div className={s.main}>
            <div className={s.next}>
              <h3 className={s.nextTitle}>{entrust.nextBuild.title}</h3>
              <p className={s.lead}>{entrust.nextBuild.summary}</p>
              <ol className={s.parts}>
                {entrust.nextBuild.parts.map((part) => (
                  <li key={part.key} className={`${s.part} rise`}>
                    <div className={s.partHead}>
                      <SupportMark support={part.support} />
                      <span className={s.partName}>{part.name}</span>
                    </div>
                    <p className="small muted">From {[...new Set(part.claims.map((c) => c.projectTitle))].join(" and ")}.</p>
                    {part.evidence.slice(0, 1).map((e) => (
                      <button key={e.id} className={s.partQuote} onClick={() => openSource(e.sourceId, e.quote)}>
                        “{e.quote}”
                      </button>
                    ))}
                  </li>
                ))}
              </ol>
              {entrust.nextBuild.gaps.length > 0 && (
                <ul className={s.gaps}>
                  {entrust.nextBuild.gaps.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              )}
            </div>
            {state.opportunities.length > 0 && <Opportunities items={state.opportunities} />}
          </div>
        </section>
      )}

      <footer className={s.footer}>
        <p className={s.footName}>Proof of Work</p>
        <p className="small">
          {example ? example.disclaimer : "Private by default. Nothing is published unless you create a link, and links can be revoked."} Support levels are qualitative readings of the sources, not verification, scores, or legal criteria.
        </p>
      </footer>

      {source && <SourceDialog req={source} onClose={() => setSource(null)} />}
      {correcting && (
        <CorrectionDialog
          claim={correcting}
          suggestion={example && correcting.text === example.correction.claim ? example.correction : null}
          onClose={() => setCorrecting(null)}
          onSave={(body) =>
            run("correct", async () => {
              await post(`/api/claims/${correcting.id}`, { action: "correct", ...body });
              setCorrecting(null);
              setTimeout(() => document.getElementById("views")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
            })
          }
        />
      )}
    </div>
  );
}

function initialDrafts(state: State): Draft[] {
  const fromProjects = state.snapshot.projects.map((p) => ({ title: p.title, role: p.role ?? "", urls: padUrls(p.urls) }));
  if (fromProjects.length) return fromProjects;
  if (state.example) return state.example.projects.map((p) => ({ title: p.title, role: p.role, urls: [{ url: p.url, ownPage: false }] }));
  return [0, 1, 2].map(() => ({ title: "", role: "", urls: padUrls([]) }));
}

function padUrls(urls: string[]) {
  const list = urls.map((url) => ({ url, ownPage: false }));
  while (list.length < 2 && !urls.some((u) => u.startsWith("example://"))) list.push({ url: "", ownPage: false });
  return list.length ? list : [{ url: "", ownPage: false }];
}

function updateDraft(drafts: Draft[], i: number, patch: Partial<Draft>) {
  return drafts.map((d, k) => (k === i ? { ...d, ...patch } : d));
}

type Run = (label: string, fn: () => Promise<unknown>) => Promise<void>;

function ClaimCard({ c, busy, onOpen, onCorrect, run }: { c: SnapshotClaim; busy: boolean; onOpen: (id: string, q: string) => void; onCorrect: () => void; run: Run }) {
  return (
    <article className={`${s.claim} rise`} data-review={c.reviewStatus}>
      <div className={s.claimTop}>
        <p className={s.claimText}>{c.text}</p>
        <p className={s.claimMeta}>
          {attributionWord(c.attribution)}. {stateWord(c.state)}.{c.revision > 1 ? ` Revision ${c.revision}.` : ""} {c.reviewStatus === "approved" ? "Approved." : c.reviewStatus === "rejected" ? "Rejected." : ""}
          {c.attributionNote ? ` ${c.attributionNote}` : ""}
        </p>
      </div>
      <div className={s.claimQuotes}>
        {c.evidence.map((e) => (
          <button key={e.id} className={s.claimQuote} data-support={e.supportScore} onClick={() => onOpen(e.sourceId, e.quote)} title={e.supportScore === "context" ? "Context only: does not back authorship" : "Open in source"}>
            <span>“{e.quote}”</span>
            <span className={s.quoteLoc}>
              {e.locator}
              {e.supportScore === "context" ? ", context only" : ""}
            </span>
          </button>
        ))}
      </div>
      <div className={s.claimActions}>
        {c.reviewStatus !== "approved" && c.state !== "unverified" && (
          <button className="btn btn-small" disabled={busy} onClick={() => run("claim", () => post(`/api/claims/${c.id}`, { action: "approve" }))}>
            Approve
          </button>
        )}
        <button className="btn btn-small btn-quiet" disabled={busy} onClick={onCorrect}>
          Correct
        </button>
        {c.reviewStatus !== "rejected" && (
          <button className="btn btn-small btn-quiet" disabled={busy} onClick={() => run("claim", () => post(`/api/claims/${c.id}`, { action: "reject" }))}>
            Reject
          </button>
        )}
        <label className={s.publishToggle}>
          <input type="checkbox" checked={c.publishable} disabled={busy} onChange={(e) => run("claim", () => post(`/api/claims/${c.id}`, { action: "publishable", publishable: e.target.checked }))} />
          Show in portfolio
        </label>
      </div>
    </article>
  );
}

function CapabilityRow({
  c,
  onOpen,
  claimById,
  onCorrect,
  run,
  busy,
}: {
  c: ResolvedCapability;
  onOpen: (id: string, q: string) => void;
  claimById: Map<string, SnapshotClaim>;
  onCorrect: (c: SnapshotClaim) => void;
  run: Run;
  busy: boolean;
}) {
  return (
    <article className={`${s.capRow} changed`} data-support={c.support}>
      <div className={s.capSupport}>
        <SupportMark support={c.support} />
      </div>
      <div className={s.capBody}>
        <h3 className={s.capName}>{c.name}</h3>
        {c.evidence.length > 0 && (
          <div className={s.capQuotes}>
            {c.evidence.slice(0, 4).map((e) => (
              <button key={e.id} className={s.capQuote} onClick={() => onOpen(e.sourceId, e.quote)}>
                <span>“{e.quote}”</span>
                <span className={s.quoteLoc}>
                  {e.projectTitle}, {e.locator}
                </span>
              </button>
            ))}
          </div>
        )}
        {c.limits.length > 0 && (
          <ul className={s.capLimits}>
            {c.limits.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        <div className={s.capActions}>
          {c.claims.map((cl) => {
            const full = claimById.get(cl.id);
            return full ? (
              <button key={cl.id} className="link-button small" onClick={() => onCorrect(full)}>
                Correct “{cl.text.length > 48 ? cl.text.slice(0, 46) + "…" : cl.text}”
              </button>
            ) : null;
          })}
          {c.support !== "unknown" && (
            <button
              className="link-button small"
              disabled={busy}
              onClick={() => {
                const note = window.prompt("Why is this reading wrong? It is recorded in the review log.");
                if (note !== null) void run("reading", () => post("/api/readings", { key: c.key, action: "reject_reading", note }));
              }}
            >
              Reject this reading
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function FollowUp({ projectId, questions, run, busy }: { projectId: string; questions: string[]; run: Run; busy: boolean }) {
  const [answer, setAnswer] = useState("");
  return (
    <form
      className={s.followUp}
      onSubmit={(e) => {
        e.preventDefault();
        void run("attest", async () => {
          await post("/api/claims/attest", { projectId, text: answer });
          setAnswer("");
        });
      }}
    >
      <p className="small">
        <strong>Follow-up.</strong> {questions.join(" ")}
      </p>
      <div className={s.row}>
        <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Answer in your own words. It is recorded as attested by you, not as a source." aria-label="Your answer" />
        <button className="btn btn-small btn-quiet" disabled={busy || answer.trim().length < 8}>
          Attest
        </button>
      </div>
    </form>
  );
}

function ViewLinks({ audience, label, links, setLinks, run }: { audience: string; label: string; links: { id: string; audience: string; path: string }[]; setLinks: (l: { id: string; audience: string; path: string }[]) => void; run: Run }) {
  const mine = links.filter((l) => l.audience === audience);
  return (
    <div className={s.viewLinks}>
      <p className={s.viewLabel}>{label}</p>
      <div className={s.row}>
        {mine.map((l) => (
          <span key={l.id} className={s.linkPair}>
            <a href={l.path} target="_blank" rel="noreferrer">
              Open link
            </a>
            <button
              className="link-button"
              onClick={() =>
                run("revoke", async () => {
                  await fetch(`/api/presentations/${l.id}`, { method: "DELETE" });
                  setLinks(links.filter((x) => x.id !== l.id));
                })
              }
            >
              Revoke
            </button>
          </span>
        ))}
        {mine.length === 0 && (
          <button
            className="btn btn-small"
            onClick={() =>
              run("link", async () => {
                const r = await post("/api/presentations", { audience });
                setLinks([...links, { id: r.id, audience, path: r.path }]);
              })
            }
          >
            Create private link
          </button>
        )}
      </div>
    </div>
  );
}

function CorrectionDialog({
  claim,
  suggestion,
  onClose,
  onSave,
}: {
  claim: SnapshotClaim;
  suggestion: ExampleInfo["correction"] | null;
  onClose: () => void;
  onSave: (b: { text: string; attribution: string; attributionNote: string; note: string }) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState(claim.text);
  const [attribution, setAttribution] = useState<string>(claim.attribution);
  const [attributionNote, setNote] = useState(claim.attributionNote ?? "");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className={s.dialog} onClose={onClose} aria-labelledby="correct-title">
      <form
        className={s.dialogBody}
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ text, attribution, attributionNote, note: "Correction by the builder" });
        }}
      >
        <h2 id="correct-title" className={s.h3}>
          Correct this claim
        </h2>
        <p className="small muted">The correction becomes revision {claim.revision + 1}. Anything that cited revision {claim.revision} is withdrawn from both views until you re-evaluate. If you change the wording, the claim rests on your word.</p>
        {suggestion && (
          <div className={s.suggestion}>
            <p className="small">{suggestion.why}</p>
            <button
              type="button"
              className="btn btn-small btn-quiet"
              onClick={() => {
                setText(suggestion.text);
                setAttribution(suggestion.attribution);
                setNote(suggestion.attributionNote);
              }}
            >
              Use Rin&apos;s correction (EXAMPLE)
            </button>
          </div>
        )}
        <label>
          Claim
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <label>
          Your role in this work
          <select value={attribution} onChange={(e) => setAttribution(e.target.value)}>
            <option value="author">Author</option>
            <option value="co_author">Co-author</option>
            <option value="contributor">Contributor</option>
            <option value="reviewer">Reviewer</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label>
          Who else, and what they did
          <input value={attributionNote} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className={s.row}>
          <button className="btn">Save correction</button>
          <button type="button" className="btn btn-quiet" onClick={() => ref.current?.close()}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
