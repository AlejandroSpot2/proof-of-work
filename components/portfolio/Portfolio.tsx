"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { PortfolioModel, PortfolioProject, ProofItem } from "@/lib/portfolio";
import type { Support } from "@/lib/domain/types";
import { ProjectArt } from "./art";
import { SourceDialog, type SourceRequest } from "../SourceDialog";
import p from "./portfolio.module.css";

const LEVEL: Record<Support, string> = { demonstrated: "Shown in the work", inferred: "Likely, not proven", unknown: "Not shown yet" };
const SIGNAL_SHORT: Record<string, string> = {
  current_posting_states_sponsorship: "Posting says it sponsors",
  historical_filings: "Past filings only",
  unknown: "Sponsorship unknown",
};

export function Level({ support }: { support: Support }) {
  return (
    <span className={p.level} data-level={support}>
      {LEVEL[support]}
    </span>
  );
}

type Proof = { title: string; items: ProofItem[] };

function transition(fn: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (doc.startViewTransition && !reduced) doc.startViewTransition(() => flushSync(fn));
  else fn();
}

export function Portfolio({
  model,
  sourceToken,
  mode = "public",
  onEdit,
}: {
  model: PortfolioModel;
  sourceToken?: string | null;
  mode?: "preview" | "public";
  onEdit?: (patch: { headline?: string; intro?: string }) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [proof, setProof] = useState<Proof | null>(null);
  const [source, setSource] = useState<SourceRequest | null>(null);
  const project = model.projects.find((x) => x.slug === open) ?? null;
  const visible = model.projects.filter((x) => mode === "public" || !model.hidden.includes(x.slug));

  const openProject = useCallback((slug: string) => transition(() => setOpen(slug)), []);
  const close = useCallback(() => transition(() => setOpen(null)), []);
  const openSource = (sourceId: string, quote: string) => setSource({ sourceId, quote, token: sourceToken ?? undefined });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const editable = !!onEdit;
  const rootRef = useRef<HTMLDivElement>(null);
  const [motion, setMotion] = useState(false);

  /** Scroll reveals: enabled by script, so nothing stays hidden without it, and never under reduced motion. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setMotion(true);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.in = "true";
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.18 },
    );
    root.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [model.projects.length]);

  return (
    <div className={p.root} data-mode={mode} data-motion={motion ? "on" : undefined} ref={rootRef}>
      <header className={p.top}>
        <span className={p.topName}>{model.person.name.replace(" (EXAMPLE)", "")}</span>
        {model.example && <span className={p.example}>EXAMPLE portfolio</span>}
        <nav className={p.topNav} aria-label="Portfolio sections">
          <a href="#work">Work</a>
          <a href="#trust">What to hand over</a>
          <a href="#next">Next</a>
          <a href="#sf">San Francisco</a>
        </nav>
      </header>

      <section className={p.hero} data-swarm="hero">
        <div className={p.heroText}>
          <h1 className={p.name} data-swarm="name">
            {model.person.name.replace(" (EXAMPLE)", "")}
          </h1>
          <p
            className={p.headline}
            data-swarm="headline"
            contentEditable={editable}
            suppressContentEditableWarning
            onBlur={(e) => onEdit?.({ headline: e.currentTarget.textContent ?? "" })}
            data-editable={editable}
          >
            {model.person.headline}
          </p>
          <p
            className={p.intro}
            contentEditable={editable}
            suppressContentEditableWarning
            onBlur={(e) => onEdit?.({ intro: e.currentTarget.textContent ?? "" })}
            data-editable={editable}
          >
            {model.person.intro}
          </p>
          <dl className={p.facts} data-swarm="facts">
            <div>
              <dt>Role</dt>
              <dd>{model.person.role || "Builder"}</dd>
            </div>
            {model.person.location && (
              <div>
                <dt>Location</dt>
                <dd>{model.person.location}</dd>
              </div>
            )}
            <div>
              <dt>Record</dt>
              <dd>
                {model.stats.projects} projects · {model.stats.files} source files · every sentence linked to its file
              </dd>
            </div>
          </dl>
        </div>
        <nav className={p.index} aria-label="Projects" data-swarm="index">
          <p className={p.indexLabel}>Selected work, {visible.length} projects</p>
          <ol>
            {visible.map((x) => (
              <li key={x.slug}>
                <button type="button" onClick={() => openProject(x.slug)} data-swarm={`index-${x.slug}`}>
                  <span className={p.indexTitle}>{x.title}</span>
                  <span className={p.indexLine}>{x.summary}</span>
                  <span className={p.indexMeta}>
                    {x.period ?? ""} · {x.role}
                  </span>
                  <span className={p.indexArrow} aria-hidden="true">
                    →
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </section>

      <section className={p.work} id="work" aria-labelledby="work-title">
        <h2 id="work-title" className={p.sectionTitle}>
          Selected work
        </h2>
        {visible.map((x, i) => (
          <article key={x.slug} className={p.project} data-flip={i % 2 === 1} data-swarm={`project-${x.slug}`} data-reveal>
            <div className={p.projectText}>
              <p className={p.period}>{x.period ?? ""}</p>
              <h3 className={p.projectTitle} style={{ viewTransitionName: open === x.slug ? undefined : `title-${x.slug}` }}>
                {x.title}
              </h3>
              <p className={p.projectSummary}>{x.summary}</p>
              <ul className={p.parts}>
                {x.rinPart.slice(0, 3).map((r) => (
                  <li key={r.text}>
                    {r.text}
                    {r.shared && <span className={p.shared}>shared</span>}
                  </li>
                ))}
              </ul>
              <div className={p.projectActions}>
                <button type="button" className={p.primary} onClick={() => openProject(x.slug)}>
                  Open the project
                </button>
                <button type="button" className={p.proofLink} onClick={() => setProof({ title: x.title, items: x.proof })}>
                  Proof <span>{x.proof.length}</span>
                </button>
              </div>
            </div>
            <div
              className={p.cover}
              style={{ viewTransitionName: open === x.slug ? undefined : `art-${x.slug}` }}
              role="button"
              tabIndex={0}
              aria-label={`Open ${x.title}`}
              onClick={() => openProject(x.slug)}
              onKeyDown={(e) => {
                if (e.key === "Enter") openProject(x.slug);
              }}
            >
              <ProjectArt slug={x.slug} />
            </div>
          </article>
        ))}
      </section>

      {model.capabilities.length > 0 && (
        <section className={p.trust} id="trust" aria-labelledby="trust-title" data-swarm="trust" data-reveal>
          <div className={p.trustHead}>
            <h2 id="trust-title" className={p.sectionTitle}>
              What you can hand {model.person.firstName}
            </h2>
            {model.person.goal && <p className={p.goal}>For: {model.person.goal}</p>}
          </div>
          <ol className={p.tasks}>
            {model.capabilities.map((c) => (
              <li key={c.key} data-level={c.support}>
                <Level support={c.support} />
                <div className={p.taskBody}>
                  <p className={p.taskName}>{c.name}</p>
                  <p className={p.taskFrom}>{c.support === "unknown" ? (model.question ?? "Nothing in the files shows this yet.") : `From ${c.projects.join(" and ")}${c.limit ? `. ${c.limit}` : ""}`}</p>
                </div>
                {c.proof.length > 0 && (
                  <button type="button" className={p.proofLink} onClick={() => setProof({ title: c.name, items: c.proof })}>
                    Proof <span>{c.proof.length}</span>
                  </button>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {model.nextBuild && (
        <section className={p.next} id="next" aria-labelledby="next-title" data-swarm="next" data-reveal>
          <h2 id="next-title" className={p.sectionTitle}>
            What {model.person.firstName} could build next
          </h2>
          <div className={p.assembly}>
            <div className={p.assemblyCol}>
              {model.nextBuild.parts
                .filter((x) => x.projects.includes("Tidepool"))
                .map((x) => (
                  <PartChip key={x.key} part={x} onProof={() => setProof({ title: x.name, items: x.proof })} />
                ))}
              <p className={p.assemblyFrom}>from Tidepool</p>
            </div>
            <div className={p.mvp}>
              <p className={p.mvpLabel}>A proposal, not a promise</p>
              <p className={p.mvpTitle}>{model.nextBuild.title}</p>
              <p className={p.mvpSummary}>{model.nextBuild.summary}</p>
              {model.nextBuild.gaps[0] && <p className={p.mvpGap}>Still needs: {model.nextBuild.gaps.slice(0, 2).join(" ")}</p>}
            </div>
            <div className={p.assemblyCol}>
              {model.nextBuild.parts
                .filter((x) => !x.projects.includes("Tidepool"))
                .map((x) => (
                  <PartChip key={x.key} part={x} onProof={() => setProof({ title: x.name, items: x.proof })} />
                ))}
              <p className={p.assemblyFrom}>from Quietroom</p>
            </div>
          </div>
        </section>
      )}

      {model.roles.length > 0 && (
        <section className={p.sf} id="sf" aria-labelledby="sf-title" data-swarm="sf" data-reveal>
          <div className={p.sfHead}>
            <h2 id="sf-title" className={p.sectionTitle}>
              Heading to San Francisco
            </h2>
            <p className={p.sfNote}>
              {model.person.firstName} is outside the US. Three EXAMPLE roles, each with what its own source says about sponsorship. Not legal advice. Historical filings ≠ current policy. One role’s sponsorship ≠ all visa types.
            </p>
          </div>
          <ul className={p.roles}>
            {model.roles.map((r) => (
              <li key={r.id} data-signal={r.signalType}>
                <div className={p.roleHead}>
                  <p className={p.roleCompany}>{r.company}</p>
                  <p className={p.roleName}>
                    {r.role} · {r.location ?? "location unknown"}
                  </p>
                </div>
                <p className={p.signal} data-signal={r.signalType}>
                  {SIGNAL_SHORT[r.signalType] ?? r.signal.label}
                </p>
                <p className={p.roleQuote}>{r.snippet ? `“${r.snippet}”` : "Snippet unknown"}</p>
                <p className={p.roleMeta}>
                  Read {r.retrieved ?? "on an unknown date"} · {r.id}
                </p>
                <p className={p.roleFit}>
                  {r.fit.length ? (
                    <>
                      Fits: {r.fit.map((f) => f.name.split(":")[0]).join("; ")}{" "}
                      <button type="button" className={p.inlineProof} onClick={() => setProof({ title: `Why ${model.person.firstName} fits ${r.company}`, items: r.fit.flatMap((f) => f.evidence.map((e) => ({ ...e }))) })}>
                        proof
                      </button>
                    </>
                  ) : (
                    "No evidenced work matches this role."
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className={p.footer}>
        <p className={p.footName}>{model.person.name.replace(" (EXAMPLE)", "")}</p>
        <p className={p.footNote}>
          {model.example ? "EXAMPLE portfolio of a fictional builder, made from synthetic files. " : ""}
          Every sentence on this page opens the file it came from. Built with Proof of Work.
        </p>
      </footer>

      {project && <ProjectView project={project} firstName={model.person.firstName} onClose={close} onProof={setProof} onSource={openSource} />}
      {proof && <ProofDrawer proof={proof} onClose={() => setProof(null)} onOpen={openSource} />}
      {source && <SourceDialog req={source} onClose={() => setSource(null)} />}
    </div>
  );
}

function PartChip({ part, onProof }: { part: { name: string; support: Support; proof: ProofItem[] }; onProof: () => void }) {
  return (
    <button type="button" className={p.partChip} data-level={part.support} onClick={onProof}>
      <span className={p.partName}>{part.name}</span>
      <Level support={part.support} />
    </button>
  );
}

function ProjectView({
  project: x,
  firstName,
  onClose,
  onProof,
  onSource,
}: {
  project: PortfolioProject;
  firstName: string;
  onClose: () => void;
  onProof: (p: Proof) => void;
  onSource: (sourceId: string, quote: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className={p.view} role="dialog" aria-modal="true" aria-labelledby={`pv-${x.slug}`} ref={ref} tabIndex={-1}>
      <div className={p.viewBar}>
        <button type="button" className={p.back} onClick={onClose}>
          ← All work
        </button>
        <span className={p.viewMeta}>
          {x.role} · {x.period}
        </span>
        <button type="button" className={p.proofLink} onClick={() => onProof({ title: x.title, items: x.proof })}>
          Proof <span>{x.proof.length}</span>
        </button>
      </div>
      <div className={p.viewInner}>
        <h2 id={`pv-${x.slug}`} className={p.viewTitle} style={{ viewTransitionName: `title-${x.slug}` }}>
          {x.title}
        </h2>
        <p className={p.viewSummary}>{x.summary}</p>
        <div className={p.viewArt} style={{ viewTransitionName: `art-${x.slug}` }}>
          <ProjectArt slug={x.slug} size="detail" />
        </div>

        <div className={p.viewGrid}>
          <section aria-labelledby={`c-${x.slug}`}>
            <h3 id={`c-${x.slug}`} className={p.viewH}>
              {firstName}’s part
            </h3>
            <p className={p.contribution}>{x.contribution}</p>
            {x.outcome && (
              <p className={p.outcome}>
                <strong>Outcome.</strong> {x.outcome.text}
              </p>
            )}
            {x.openQuestion && (
              <p className={p.open}>
                <strong>Not shown yet.</strong> {x.openQuestion}
              </p>
            )}
          </section>
          <section aria-labelledby={`h-${x.slug}`}>
            <h3 id={`h-${x.slug}`} className={p.viewH}>
              Who did what, by date
            </h3>
            <ol className={p.history}>
              {[...x.rinCommits, ...x.others.flatMap((o) => o.commits)]
                .sort((m, n) => (m.date ?? "").localeCompare(n.date ?? ""))
                .map((c) => (
                  <li key={c.sha} data-mine={c.mine}>
                    <span className={p.histDate}>{c.date ?? "—"}</span>
                    <span className={p.histWho}>{c.mine ? firstName : c.author}</span>
                    <span className={p.histMsg}>{c.message}</span>
                  </li>
                ))}
            </ol>
          </section>
        </div>

        {x.documents.length > 0 && (
          <section className={p.gallery} aria-labelledby={`g-${x.slug}`}>
            <h3 id={`g-${x.slug}`} className={p.viewH}>
              From the project’s own files
            </h3>
            <div className={p.docs}>
              {x.documents.map((d) => (
                <figure key={d.locator} className={p.docCard}>
                  <figcaption>
                    <span className={p.docFile}>{d.locator}</span>
                    <span className={p.docTitle}>{d.title}</span>
                  </figcaption>
                  <pre className={p.docBody}>{d.body}</pre>
                </figure>
              ))}
            </div>
          </section>
        )}

        <section className={p.viewProof} aria-labelledby={`q-${x.slug}`}>
          <h3 id={`q-${x.slug}`} className={p.viewH}>
            Proof, word for word
          </h3>
          <ul className={p.quoteList}>
            {x.proof.slice(0, 6).map((q) => (
              <li key={q.id}>
                <button type="button" onClick={() => onSource(q.sourceId, q.quote)}>
                  <span>“{q.quote}”</span>
                  <span className={p.quoteWhere}>{q.locator} · open the file</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function ProofDrawer({ proof, onClose, onOpen }: { proof: Proof; onClose: () => void; onOpen: (sourceId: string, quote: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className={p.drawer} onClose={onClose} aria-labelledby="proof-h">
      <div className={p.drawerHead}>
        <div>
          <p className={p.drawerKicker}>Proof, word for word from the files</p>
          <h2 id="proof-h" className={p.drawerTitle}>
            {proof.title}
          </h2>
        </div>
        <button type="button" className={p.back} onClick={() => ref.current?.close()} autoFocus>
          Close
        </button>
      </div>
      <ul className={p.quoteList}>
        {proof.items.map((q) => (
          <li key={q.id}>
            <button type="button" onClick={() => onOpen(q.sourceId, q.quote)}>
              <span>“{q.quote}”</span>
              <span className={p.quoteWhere}>
                {q.projectTitle} · {q.locator} · open the file
              </span>
            </button>
          </li>
        ))}
      </ul>
    </dialog>
  );
}
