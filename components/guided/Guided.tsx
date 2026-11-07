"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResolvedCapability, SnapshotClaim } from "@/lib/views/project";
import type { Support } from "@/lib/domain/types";
import { AttorneyDoc, PortfolioDoc, SUPPORT_WORD } from "../docs";
import { SourceDialog, type SourceRequest } from "../SourceDialog";
import { CorrectionDialog } from "../CorrectionDialog";
import { post, useWorkspace, type WorkspaceState } from "./useWorkspace";
import g from "./guided.module.css";

const STEPS = [
  { key: "before", label: "The CV" },
  { key: "built", label: "What Rin built" },
  { key: "can-do", label: "What Rin can do" },
  { key: "opportunities", label: "Where it could lead" },
  { key: "attorney", label: "For an attorney" },
  { key: "next", label: "What Rin builds next" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

export type Proof = {
  title: string;
  subtitle?: string;
  items: { id: string; sourceId: string; quote: string; where: string; context?: boolean }[];
  claims?: SnapshotClaim[];
};

const ROLE_WORD: Record<string, string> = {
  author: "Rin did it",
  co_author: "Shared with others",
  contributor: "Rin contributed",
  reviewer: "Rin reviewed",
  unknown: "Unclear who did it",
};
const BACKED_WORD: Record<string, string> = {
  fetched: "Rin's files show it",
  corroborated: "Two independent sources",
  user_attested: "Rin's word only",
  unverified: "Not backed",
};

export function Mark({ support }: { support: Support }) {
  return (
    <span className={`${g.mark} ${g[`mark_${support}`]}`} data-support-word={support}>
      {SUPPORT_WORD[support]}
    </span>
  );
}

function ProofButton({ count, onClick, label }: { count: number; onClick: () => void; label?: string }) {
  if (!count) return null;
  return (
    <button type="button" className={g.proofBtn} onClick={onClick}>
      {label ?? "Proof"} <span className={g.proofCount}>{count}</span>
    </button>
  );
}

const capProof = (c: ResolvedCapability, title = c.name): Proof => ({
  title,
  subtitle: c.limits[0],
  items: c.evidence.map((e) => ({ id: e.id, sourceId: e.sourceId, quote: e.quote, where: `${e.projectTitle} · ${e.locator}` })),
});

function firstName(name: string) {
  return name.replace(/\s*\(EXAMPLE\)\s*/, "").split(" ")[0] ?? name;
}

export function Guided() {
  const ws = useWorkspace();
  const [step, setStep] = useState<StepKey>("before");
  const [proof, setProof] = useState<Proof | null>(null);
  const [source, setSource] = useState<SourceRequest | null>(null);
  const [correcting, setCorrecting] = useState<SnapshotClaim | null>(null);
  const [compare, setCompare] = useState(false);
  const [menu, setMenu] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("step");
    if (STEPS.some((s) => s.key === fromUrl)) setStep(fromUrl as StepKey);
    const onPop = () => {
      const k = new URLSearchParams(window.location.search).get("step");
      setStep(STEPS.some((s) => s.key === k) ? (k as StepKey) : "before");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = useCallback((k: StepKey) => {
    setStep(k);
    setMenu(false);
    window.history.pushState(null, "", `/demo?step=${k}`);
    sheetRef.current?.scrollTo({ top: 0 });
    sheetRef.current?.focus({ preventScroll: true });
  }, []);

  const index = STEPS.findIndex((s) => s.key === step);
  const prev = STEPS[index - 1];
  const next = STEPS[index + 1];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, dialog[open]") || document.querySelector("dialog[open]")) return;
      if (e.key === "ArrowRight" && next) go(next.key);
      if (e.key === "ArrowLeft" && prev) go(prev.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, next, prev]);

  if (!ws.state) {
    return <main className={g.loading}>{ws.error ? `Could not open the example: ${ws.error}` : "Opening Rin's example"}</main>;
  }
  const state = ws.state;
  const person = state.snapshot.workspace.personName;
  const name = firstName(person);
  const openSource = (sourceId: string, quote: string) => setSource({ sourceId, quote });

  const shared = { state, ws, name, go, setProof, openSource, setCorrecting, setCompare };

  return (
    <div className={g.frame}>
      <aside className={`${g.side} ${menu ? g.sideOpen : ""}`} aria-label="Demo steps">
        <a href="/" className={g.brand}>
          <span className={g.logo} aria-hidden="true">
            P
          </span>
          Proof of Work
        </a>
        <p className={g.scope}>
          <span className={g.exampleChip}>EXAMPLE</span> {person.replace(" (EXAMPLE)", "")}, a fictional builder
        </p>
        <nav>
          <ol className={g.steps}>
            {STEPS.map((s, i) => (
              <li key={s.key}>
                <button type="button" className={g.stepLink} aria-current={s.key === step ? "step" : undefined} data-done={i < index} onClick={() => go(s.key)}>
                  <span className={g.stepNum}>{i + 1}</span>
                  {s.label.replace("Rin", name)}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className={g.sideFoot}>
          <a href="/workbench">Open the workbench</a>
          <a href="/api/example/start?to=/demo">Start over</a>
        </div>
      </aside>

      <header className={g.bar}>
        <button type="button" className={g.menuBtn} onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
          Steps
        </button>
        <p className={g.where}>
          <span className={g.whereCount}>
            {index + 1} of {STEPS.length}
          </span>{" "}
          {STEPS[index]!.label.replace("Rin", name)}
        </p>
        <div className={g.barActions}>
          <button type="button" className={g.btnGhost} disabled={!prev} onClick={() => prev && go(prev.key)}>
            Back
          </button>
          {next ? (
            <button type="button" className={g.btnPrimary} onClick={() => go(next.key)}>
              Next: {next.label.replace("Rin", name)}
            </button>
          ) : (
            <a className={g.btnPrimary} href="/workbench">
              Explore the workbench
            </a>
          )}
        </div>
      </header>

      <main className={g.sheet} ref={sheetRef} tabIndex={-1}>
        {ws.error && (
          <p className={g.error} role="alert">
            {ws.error}
          </p>
        )}
        {step === "before" && <StepBefore {...shared} />}
        {step === "built" && <StepBuilt {...shared} />}
        {step === "can-do" && <StepCanDo {...shared} />}
        {step === "opportunities" && <StepOpportunities {...shared} />}
        {step === "attorney" && <StepAttorney {...shared} />}
        {step === "next" && <StepNext {...shared} />}
      </main>

      {proof && <ProofDrawer proof={proof} onClose={() => setProof(null)} onOpen={openSource} onCorrect={(c) => setCorrecting(c)} ws={ws} />}
      {source && <SourceDialog req={source} onClose={() => setSource(null)} />}
      {compare && <CompareDialog state={state} onClose={() => setCompare(false)} onOpen={openSource} />}
      {correcting && (
        <CorrectionDialog
          claim={correcting}
          suggestion={state.example && correcting.text === state.example.correction.claim ? state.example.correction : null}
          onClose={() => setCorrecting(null)}
          onSave={(body) =>
            ws.run("correct", async () => {
              await post(`/api/claims/${correcting.id}`, { action: "correct", ...body });
              setCorrecting(null);
              setProof(null);
            })
          }
        />
      )}
    </div>
  );
}

type Shared = {
  state: WorkspaceState;
  ws: ReturnType<typeof useWorkspace>;
  name: string;
  go: (k: StepKey) => void;
  setProof: (p: Proof | null) => void;
  openSource: (sourceId: string, quote: string) => void;
  setCorrecting: (c: SnapshotClaim | null) => void;
  setCompare: (b: boolean) => void;
};

function Title({ title, sub, action }: { title: string; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={g.titleRow}>
      <div className={g.titleText}>
        <h1 className={g.h1}>{title}</h1>
        {sub && <p className={g.sub}>{sub}</p>}
      </div>
      {action && <div className={g.titleAction}>{action}</div>}
    </div>
  );
}

function StepBefore({ state, name, go, ws }: Shared) {
  const cv = (state.example?.cv ?? "").split("\n").filter((l) => l.trim());
  const imported = state.snapshot.projects.length > 0;
  return (
    <>
      <Title
        title="A CV lists claims. It can’t show the work."
        sub={`${name} Okafor is a fictional builder outside the US who wants to work in San Francisco. Here is ${name}’s CV, and what the work behind it actually shows.`}
      />
      <div className={g.beforeGrid}>
        <figure className={g.cvCard} aria-label={`${name}'s CV, EXAMPLE`}>
          {cv.map((l, i) =>
            l.startsWith("# ") ? (
              <p key={i} className={g.cvName}>
                {l.slice(2)}
              </p>
            ) : l.startsWith("## ") ? (
              <p key={i} className={g.cvHead}>
                {l.slice(3)}
              </p>
            ) : (
              <p key={i} className={g.cvLine}>
                {l.replace(/^- /, "")}
              </p>
            ),
          )}
          <figcaption className={g.cvCaption}>Every line is a claim. None of them shows who did what, or how we would know.</figcaption>
        </figure>
        <div className={g.howCard}>
          <h2 className={g.h2}>What Proof of Work does instead</h2>
          <ol className={g.how}>
            <li>
              <strong>Reads {name}’s three projects,</strong> file by file: the README, design notes, a pull request, the commit history.
            </li>
            <li>
              <strong>Keeps only what the files say,</strong> word for word, and who did it. Work by someone else stays theirs.
            </li>
            <li>
              <strong>Turns it into tasks a client could hand {name},</strong> each with its proof one click away, and what it does not show.
            </li>
          </ol>
          <button
            type="button"
            className={g.btnPrimaryLarge}
            disabled={ws.busy === "import"}
            onClick={() => {
              if (!imported && state.example) void ws.readProjects(state.example.projects);
              go("built");
            }}
          >
            {imported ? `See what ${name} built` : `Read ${name}’s 3 projects`}
          </button>
          <p className={g.note}>Everything here is an EXAMPLE: synthetic files, no network, no AI model.</p>
        </div>
      </div>
    </>
  );
}

function othersFromContributors(text: string, handle: string) {
  return text
    .split("\n")
    .map((l) => l.match(/^([^:]+):\s*(\d+)/))
    .filter((m): m is RegExpMatchArray => !!m && m[1]!.toLowerCase() !== handle.toLowerCase())
    .map((m) => ({ who: m[1]!, commits: Number(m[2]) }));
}

function StepBuilt({ state, name, ws, setProof }: Shared) {
  const projects = state.snapshot.projects;
  const exampleProjects = state.example?.projects ?? [];
  const claims = projects.flatMap((p) => p.claims);
  const proposed = claims.filter((c) => c.reviewStatus === "proposed" && c.state !== "unverified");
  const confirmed = claims.filter((c) => c.reviewStatus === "approved").length;
  const filesRead = projects.flatMap((p) => p.sources).filter((s) => s.status === "ok").length;
  const reading = ws.busy === "import";

  if (!projects.length || reading) {
    const live = ws.reading;
    return (
      <>
        <Title
          title={`What ${name} built`}
          sub={reading ? `Reading ${name}’s project files now. Each file appears as it is read.` : `${name} has three projects. Read them to see what the files show.`}
          action={
            !reading && (
              <button type="button" className={g.btnPrimary} onClick={() => state.example && ws.readProjects(state.example.projects)}>
                Read the 3 projects
              </button>
            )
          }
        />
        <div className={g.cards3}>
          {exampleProjects.map((p) => {
            const pid = live && Object.entries(live.titles).find(([, t]) => t === p.title)?.[0];
            const files = live?.sources.filter((s) => s.projectId === pid) ?? [];
            return (
              <article key={p.title} className={g.card}>
                <h2 className={g.cardTitle}>{p.title}</h2>
                <p className={g.cardSummary}>{p.summary}</p>
                <ul className={g.fileList} aria-live="polite">
                  {files.map((f) => (
                    <li key={f.url + f.locator}>
                      <span className={g.fileOk}>{f.status === "ok" ? "Read" : f.status}</span> {f.locator}
                    </li>
                  ))}
                  {!files.length && <li className={g.muted}>{reading ? "Waiting" : "Not read yet"}</li>}
                </ul>
              </article>
            );
          })}
        </div>
      </>
    );
  }

  const handle = state.snapshot.workspace.githubHandle;
  return (
    <>
      <Title
        title={`What ${name} built`}
        sub={`${projects.length} projects · ${filesRead} files read · ${claims.filter((c) => c.state !== "unverified").length} statements found, each quoted from a file. ${confirmed ? `${confirmed} confirmed by ${name}.` : `${name} confirms them before anything is shown to a client.`}`}
        action={
          proposed.length > 0 ? (
            <button
              type="button"
              className={g.btnPrimary}
              disabled={!!ws.busy}
              onClick={() =>
                ws.run("confirm", async () => {
                  for (const c of proposed) await post(`/api/claims/${c.id}`, { action: "approve" });
                })
              }
            >
              {ws.busy === "confirm" ? "Confirming" : `${name} confirms all ${proposed.length}`}
            </button>
          ) : (
            <span className={g.doneNote}>All statements confirmed by {name}</span>
          )
        }
      />
      <div className={g.cards3}>
        {projects.map((p) => {
          const meta = exampleProjects.find((e) => e.title === p.title);
          const mine = p.claims.filter((c) => c.reviewStatus !== "rejected" && c.state !== "unverified");
          const others = othersFromContributors(p.sources.find((s) => s.locator === "contributors")?.contributors ?? "", handle);
          const outcome = mine.find((c) => c.kind === "impact");
          const proofItems = mine.flatMap((c) =>
            c.evidence.map((e) => ({ id: e.id, sourceId: e.sourceId, quote: e.quote, where: `${p.title} · ${e.locator}`, context: e.supportScore === "context" })),
          );
          return (
            <article key={p.id} className={g.card}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={g.art} src={`/api/example/${p.title.toLowerCase()}/illustration.svg`} alt={`EXAMPLE illustration of ${p.title}`} width={480} height={300} />
              <div className={g.cardHead}>
                <h2 className={g.cardTitle}>{p.title}</h2>
                <span className={g.roleChip}>{p.role}</span>
              </div>
              {meta?.summary && <p className={g.cardSummary}>{meta.summary}</p>}
              <div className={g.part}>
                <p className={g.partLabel}>{name}’s part</p>
                <ul className={g.partList}>
                  {mine
                    .filter((c) => c.kind !== "impact")
                    .map((c) => (
                      <li key={c.id} data-confirmed={c.reviewStatus === "approved"}>
                        <span>{c.text}</span>
                        <span className={g.partMeta}>
                          {ROLE_WORD[c.attribution]}
                          {c.reviewStatus === "approved" ? " · confirmed" : ""}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
              <div className={g.part}>
                <p className={g.partLabel}>Others’ part</p>
                <p className={g.partText}>
                  {others.length ? others.map((o) => `${o.who} (${o.commits} commit${o.commits === 1 ? "" : "s"})`).join(", ") : "No one else appears in the history."}
                </p>
              </div>
              <div className={g.part}>
                <p className={g.partLabel}>Outcome</p>
                <p className={g.partText}>{outcome ? outcome.text : p.questions[0] ? `Not shown yet. ${p.questions[0]}` : "No outcome in the files."}</p>
              </div>
              <div className={g.cardFoot}>
                <ProofButton
                  count={proofItems.length}
                  label="See the proof"
                  onClick={() => setProof({ title: p.title, subtitle: `${p.sources.length} files read. Each quote is word for word from its file.`, items: proofItems, claims: p.claims })}
                />
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function whyLine(c: ResolvedCapability, name: string) {
  if (c.support === "unknown") return `Nothing in ${name}’s files shows this yet.`;
  const projects = [...new Set(c.claims.map((x) => x.projectTitle))];
  const own = c.claims.filter((x) => x.attribution === "author").length;
  return `${c.claims.length} confirmed statement${c.claims.length === 1 ? "" : "s"} from ${projects.join(" and ")}${own ? `, ${own} of them ${name}’s own work` : ", all of it shared with others"}.`;
}

function StepCanDo({ state, name, ws, setProof, go }: Shared) {
  const { entrust } = state;
  const [editing, setEditing] = useState(false);
  const [goal, setGoal] = useState(entrust.goal ?? state.example?.goal ?? "");
  const approved = state.snapshot.projects.flatMap((p) => p.claims).filter((c) => c.reviewStatus === "approved").length;
  const proposed = state.snapshot.projects.flatMap((p) => p.claims).filter((c) => c.reviewStatus === "proposed" && c.state !== "unverified");
  const answered = entrust.status === "current" || entrust.status === "ledger-changed";

  const goalLine = (
    <>
      For a client hiring: <strong>{entrust.goal ?? goal}</strong>{" "}
      <button type="button" className={g.inlineLink} onClick={() => setEditing((e) => !e)}>
        {editing ? "Close" : "Change the need"}
      </button>
    </>
  );

  return (
    <>
      <Title title={`What a client can hand ${name}`} sub={goalLine} />
      {editing && (
        <form
          className={g.goalForm}
          onSubmit={(e) => {
            e.preventDefault();
            setEditing(false);
            void ws.run("ask", () => post("/api/goal", { text: goal }));
          }}
        >
          <label className={g.label}>
            What the client needs
            <input value={goal} onChange={(e) => setGoal(e.target.value)} />
          </label>
          <button className={g.btnPrimary} disabled={!goal.trim()}>
            Answer this need
          </button>
        </form>
      )}

      {!answered ? (
        <div className={g.firstRun}>
          {approved === 0 ? (
            <>
              <p className={g.firstRunText}>{name} has not confirmed any statements yet. Nothing is shown to a client before that.</p>
              <div className={g.row}>
                {proposed.length > 0 && (
                  <button
                    type="button"
                    className={g.btnPrimary}
                    disabled={!!ws.busy}
                    onClick={() => ws.run("confirm", async () => {
                      for (const c of proposed) await post(`/api/claims/${c.id}`, { action: "approve" });
                      await post("/api/goal", { text: goal });
                    })}
                  >
                    {name} confirms {proposed.length} statements and asks
                  </button>
                )}
                <button type="button" className={g.btnGhost} onClick={() => go("built")}>
                  Review them first
                </button>
              </div>
            </>
          ) : (
            <>
              <p className={g.firstRunText}>Answer from {name}’s {approved} confirmed statements.</p>
              <button type="button" className={g.btnPrimary} disabled={!!ws.busy} onClick={() => ws.run("ask", () => post("/api/goal", { text: goal }))}>
                {ws.busy === "ask" ? "Answering" : "Answer for this client"}
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          {entrust.withdrawn.length > 0 && (
            <div className={g.banner} role="status">
              <p>
                {name} corrected a statement, so <strong>{entrust.withdrawn.map((w) => w.name.charAt(0).toLowerCase() + w.name.slice(1)).join(" and ")}</strong> was taken out of the client view and the dossier until it is checked again.
              </p>
              <button type="button" className={g.btnPrimary} disabled={!!ws.busy} onClick={() => ws.run("ask", () => post("/api/goal", {}))}>
                Check again
              </button>
            </div>
          )}
          <ul className={g.tasks}>
            {entrust.capabilities.map((c) => (
              <li key={`${c.key}-${c.support}-${c.name}`} className={g.task} data-support={c.support}>
                <div className={g.taskMark}>
                  <Mark support={c.support} />
                </div>
                <div className={g.taskBody}>
                  <h2 className={g.taskName}>{c.name}</h2>
                  <p className={g.taskWhy}>{whyLine(c, name)}</p>
                  {c.limits[0] && <p className={g.taskLimit}>Keep in mind: {c.limits[0]}</p>}
                </div>
                <div className={g.taskProof}>
                  <ProofButton count={c.evidence.length} label="See the proof" onClick={() => setProof({ ...capProof(c), claims: c.claims.map((x) => state.snapshot.projects.flatMap((p) => p.claims).find((y) => y.id === x.id)!).filter(Boolean) })} />
                </div>
              </li>
            ))}
          </ul>
          {entrust.question && (
            <p className={g.question}>
              <strong>One question would settle the open item.</strong> {entrust.question}
            </p>
          )}
          <p className={g.footnote}>
            Answered by example rules from {name}’s confirmed statements. No AI model is used in this example. A level is never higher than its proof allows.
          </p>
        </>
      )}
    </>
  );
}

const SIGNAL_TONE: Record<string, string> = {
  current_posting_states_sponsorship: "strong",
  historical_filings: "weak",
  unknown: "none",
};

function StepOpportunities({ state, name, setProof }: Shared) {
  return (
    <>
      <Title
        title={`Where ${name}’s work could lead in San Francisco`}
        sub={`${name} is outside the US. Three EXAMPLE roles, each with what its own source says about visa sponsorship, and why ${name}’s work fits.`}
      />
      <p className={g.caveats}>
        <span>Not legal advice</span>
        <span>Historical filings ≠ current policy</span>
        <span>One role’s sponsorship ≠ all visa types</span>
        <span>Fictional employers</span>
      </p>
      {state.opportunities.length === 0 ? (
        <p className={g.firstRunText}>Answer the client’s need first: roles are matched to what {name} can be trusted with.</p>
      ) : (
        <div className={g.cards3}>
          {state.opportunities.map((o) => (
            <article key={o.id} className={g.card} data-signal={o.signalType}>
              <div>
                <h2 className={g.cardTitle}>{o.company}</h2>
                <p className={g.cardSummary}>
                  {o.role} · {o.location ?? "location unknown"}
                </p>
              </div>
              <div className={`${g.signal} ${g[`signal_${SIGNAL_TONE[o.signalType]}`]}`}>
                <p className={g.signalLabel}>{o.signal.label}</p>
                {o.snippet ? <p className={g.signalQuote}>“{o.snippet}”</p> : <p className={g.signalQuote}>Snippet: unknown</p>}
                <p className={g.signalMeta}>
                  Read {o.retrieved ?? "on an unknown date"} · {o.status ?? "status unknown"}
                </p>
                <p className={g.signalMeta}>{o.signal.caveat}</p>
              </div>
              <div className={g.part}>
                <p className={g.partLabel}>Why {name} fits (a proposal)</p>
                {o.fit.length ? (
                  <ul className={g.fitList}>
                    {o.fit.map((f) => (
                      <li key={f.name}>
                        <Mark support={f.support} />
                        <span className={g.fitName}>{f.name}</span>
                        <ProofButton
                          count={f.evidence.length}
                          onClick={() =>
                            setProof({ title: f.name, subtitle: `Why it fits ${o.company}`, items: f.evidence.map((e) => ({ id: e.id, sourceId: e.sourceId, quote: e.quote, where: `${e.projectTitle} · ${e.locator}` })) })
                          }
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={g.partText}>None of {name}’s evidenced work matches this role.</p>
                )}
              </div>
              <p className={g.sourceId}>Source: {o.id}</p>
              <p className={g.sourceId}>Entity: {o.entityName ?? "unknown"}</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function StepAttorney({ state, name, ws, setProof, setCompare, setCorrecting }: Shared) {
  const approved = state.attorney.projects.flatMap((p) => p.claims.map((c) => ({ ...c, projectTitle: p.title })));
  const all = state.snapshot.projects.flatMap((p) => p.claims);
  const kerf = state.example ? all.find((c) => c.text === state.example!.correction.claim) : undefined;
  const [link, setLink] = useState<string | null>(null);
  return (
    <>
      <Title
        title="What an attorney sees first"
        sub={`A private dossier for a first consult: who did what, what independent sources show, what rests on ${name}’s word, and what to ask.`}
        action={
          <button
            type="button"
            className={g.btnPrimary}
            onClick={() =>
              ws.run("link", async () => {
                const r = await post("/api/presentations", { audience: "attorney" });
                setLink(r.path);
                window.open(r.path, "_blank", "noopener");
              })
            }
          >
            Open the private dossier
          </button>
        }
      />
      <p className={g.caveats}>
        <span>Attorney review needed</span>
        <span>No eligibility assessment</span>
        <span>Not legal advice</span>
        {link && (
          <a href={link} target="_blank" rel="noreferrer">
            Private link created
          </a>
        )}
      </p>
      {approved.length === 0 ? (
        <p className={g.firstRunText}>Nothing confirmed yet. The dossier lists only statements {name} has confirmed.</p>
      ) : (
        <div className={g.attorneyGrid}>
          <section className={g.panel} aria-labelledby="contrib">
            <h2 id="contrib" className={g.h2}>
              {name}’s contributions
            </h2>
            <table className={g.table}>
              <thead>
                <tr>
                  <th>Contribution</th>
                  <th>{name}’s part</th>
                  <th className={g.num}>Proof</th>
                </tr>
              </thead>
              <tbody>
                {approved.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.text}
                      <span className={g.cellSub}>
                        {c.projectTitle}
                        {c.revision > 1 ? ` · corrected by ${name}` : ""}
                      </span>
                    </td>
                    <td>
                      {ROLE_WORD[c.attribution]}
                      {c.state !== "fetched" && <span className={g.cellSub}>{BACKED_WORD[c.state]}</span>}
                    </td>
                    <td className={g.num}>
                      <ProofButton
                        count={c.evidence.length}
                        onClick={() => setProof({ title: c.text, items: c.evidence.map((e) => ({ id: e.id, sourceId: e.sourceId, quote: e.quote, where: `${c.projectTitle} · ${e.locator}` })) })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className={g.panel} aria-labelledby="ask">
            <h2 id="ask" className={g.h2}>
              Questions for the first consult
            </h2>
            <ol className={g.questions}>
              {state.attorney.questions.slice(0, 5).map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
            <div className={g.trust}>
              <p className={g.partLabel}>Same facts, two views</p>
              <p className={g.partText}>The client portfolio and this dossier are built from the same confirmed statements. A correction reaches both.</p>
              <div className={g.row}>
                <button type="button" className={g.btnGhost} onClick={() => setCompare(true)}>
                  Compare both views
                </button>
                {kerf && (
                  <button type="button" className={g.btnGhost} onClick={() => setCorrecting(kerf)}>
                    Try {name}’s Kerf correction
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function StepNext({ state, name, setProof }: Shared) {
  const next = state.entrust.nextBuild;
  return (
    <>
      <Title title={`What ${name} could build next`} sub={`A proposal assembled only from what ${name}’s work shows. Not a promise of timeline, ability, a job or a visa.`} />
      {!next ? (
        <p className={g.firstRunText}>Answer the client’s need first: the proposal is built from the same confirmed work.</p>
      ) : (
        <div className={g.nextGrid}>
          <section className={g.mvp} aria-labelledby="mvp">
            <h2 id="mvp" className={g.mvpTitle}>
              {next.title}
            </h2>
            <p className={g.mvpSummary}>{next.summary}</p>
            <ul className={g.mvpParts}>
              {next.parts.map((p) => (
                <li key={p.key}>
                  <Mark support={p.support} />
                  <span className={g.mvpPartName}>{p.name}</span>
                  <span className={g.mvpFrom}>from {[...new Set(p.claims.map((c) => c.projectTitle))].join(" and ")}</span>
                  <ProofButton count={p.evidence.length} onClick={() => setProof(capProof(p))} />
                </li>
              ))}
            </ul>
            <p className={g.partLabel}>What it still needs</p>
            <ul className={g.gaps}>
              {next.gaps.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
          <section className={g.nextSteps} aria-labelledby="steps">
            <h2 id="steps" className={g.h2}>
              A useful next step toward San Francisco
            </h2>
            <ol className={g.stepList}>
              {state.nextSteps.map((s) => (
                <li key={s.key}>
                  <p className={g.stepTitle}>{s.title}</p>
                  <p className={g.stepDetail}>{s.detail}</p>
                  {s.caveat && <p className={g.stepCaveat}>{s.caveat}</p>}
                  {s.evidence.length > 0 && (
                    <ProofButton
                      count={s.evidence.length}
                      label="Backed by"
                      onClick={() => setProof({ title: s.title, items: s.evidence.map((e) => ({ id: e.id, sourceId: e.sourceId, quote: e.quote, where: `${e.projectTitle} · ${e.locator}` })) })}
                    />
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </>
  );
}

function ProofDrawer({
  proof,
  onClose,
  onOpen,
  onCorrect,
  ws,
}: {
  proof: Proof;
  onClose: () => void;
  onOpen: (sourceId: string, quote: string) => void;
  onCorrect: (c: SnapshotClaim) => void;
  ws: ReturnType<typeof useWorkspace>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const claims = useMemo(() => proof.claims ?? [], [proof]);
  return (
    <dialog ref={ref} className={g.drawer} onClose={onClose} aria-labelledby="proof-title">
      <div className={g.drawerHead}>
        <h2 id="proof-title" className={g.h2}>
          {proof.title}
        </h2>
        <button type="button" className={g.btnGhost} onClick={() => ref.current?.close()} autoFocus>
          Close
        </button>
      </div>
      {proof.subtitle && <p className={g.drawerSub}>{proof.subtitle}</p>}
      <p className={g.partLabel}>Word for word from the files</p>
      <ul className={g.quotes}>
        {proof.items.map((q) => (
          <li key={q.id}>
            <button type="button" className={g.quote} data-context={q.context} onClick={() => onOpen(q.sourceId, q.quote)}>
              <span className={g.quoteText}>“{q.quote}”</span>
              <span className={g.quoteWhere}>
                {q.where}
                {q.context ? " · context only, does not show who did it" : ""} · open the file
              </span>
            </button>
          </li>
        ))}
      </ul>
      {claims.length > 0 && (
        <>
          <p className={g.partLabel}>Statements behind this</p>
          <ul className={g.drawerClaims}>
            {claims.map((c) => (
              <li key={`${c.id}-${c.revision}`}>
                <p className={g.drawerClaim}>{c.text}</p>
                <p className={g.partMeta}>
                  {ROLE_WORD[c.attribution]} · {BACKED_WORD[c.state]} · {c.reviewStatus === "approved" ? "confirmed" : c.reviewStatus === "rejected" ? "rejected" : "not confirmed yet"}
                </p>
                <div className={g.row}>
                  {c.reviewStatus !== "approved" && c.state !== "unverified" && (
                    <button type="button" className={g.btnSmall} disabled={!!ws.busy} onClick={() => ws.run("claim", () => post(`/api/claims/${c.id}`, { action: "approve" }))}>
                      Confirm
                    </button>
                  )}
                  <button type="button" className={g.btnSmallGhost} onClick={() => onCorrect(c)}>
                    Something wrong? Correct it
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </dialog>
  );
}

function CompareDialog({ state, onClose, onOpen }: { state: WorkspaceState; onClose: () => void; onOpen: (s: string, q: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className={g.compare} onClose={onClose} aria-labelledby="compare-title">
      <div className={g.drawerHead}>
        <h2 id="compare-title" className={g.h2}>
          Same facts, two views
        </h2>
        <button type="button" className={g.btnGhost} onClick={() => ref.current?.close()} autoFocus>
          Close
        </button>
      </div>
      <div className={g.compareGrid}>
        <div>
          <p className={g.partLabel}>Client portfolio</p>
          <PortfolioDoc view={state.portfolio} onOpen={onOpen} compact />
        </div>
        <div>
          <p className={g.partLabel}>Private attorney dossier</p>
          <AttorneyDoc view={state.attorney} onOpen={onOpen} compact />
        </div>
      </div>
    </dialog>
  );
}
