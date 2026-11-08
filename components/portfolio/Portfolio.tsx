"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import type { PortfolioModel, PortfolioProject, ProofItem } from "@/lib/portfolio";
import type { Support } from "@/lib/domain/types";
import { content, lowerFirst, period, UI, type Lang, type Shown, type UiWords } from "@/lib/i18n";
import { LangSwitch } from "../Choice";
import { ProjectArt } from "./art";
import { SourceDialog, type SourceRequest } from "../SourceDialog";
import p from "./portfolio.module.css";

export function Level({ support, lang = "en" }: { support: Support; lang?: Lang }) {
  return (
    <span className={p.level} data-level={support}>
      {UI[lang].level[support]}
    </span>
  );
}

/** A content string as shown: a prepared translation is marked, so it never passes for the original. */
export function Tr({ shown }: { shown: Shown }) {
  return shown.translated ? (
    <span lang="es" data-translated="" title="Traducido del inglés">
      {shown.text}
    </span>
  ) : (
    <>{shown.text}</>
  );
}

export type PortfolioFocus = { order: string[]; badges: Record<string, string>; intro: Shown; label: string };

type Proof = { title: ReactNode; items: ProofItem[] };
type Translate = (text: string) => Shown;

function transition(fn: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (doc.startViewTransition && !reduced) doc.startViewTransition(() => flushSync(fn));
  else fn();
}

const rank = (order: string[], slug: string) => {
  const i = order.indexOf(slug);
  return i < 0 ? order.length : i;
};

export function Portfolio({
  model,
  sourceToken,
  mode = "public",
  onEdit,
  lang: controlledLang,
  focus,
  translations,
}: {
  model: PortfolioModel;
  sourceToken?: string | null;
  mode?: "preview" | "public";
  onEdit?: (patch: { headline?: string; intro?: string }) => void;
  lang?: Lang;
  focus?: PortfolioFocus;
  /** Live only: the model's cached Spanish for this portfolio's own words. */
  translations?: { entries: Record<string, string>; engine: string } | null;
}) {
  const [ownLang, setOwnLang] = useState<Lang>("en");
  const lang = controlledLang ?? ownLang;
  const w = UI[lang];
  const tr: Translate = (text) => content(text, lang, model.example, translations?.entries);
  const [open, setOpen] = useState<string | null>(null);
  const [proof, setProof] = useState<Proof | null>(null);
  const [source, setSource] = useState<SourceRequest | null>(null);
  const project = model.projects.find((x) => x.slug === open) ?? null;
  const shown = model.projects.filter((x) => mode === "public" || !model.hidden.includes(x.slug));
  const visible = focus ? [...shown].sort((a, b) => rank(focus.order, a.slug) - rank(focus.order, b.slug)) : shown;
  const first = model.person.firstName;

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

  /** A Spanish translation or an adapted intro saved on blur would overwrite the English text. */
  const editable = !!onEdit && lang === "en" && !focus;
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

  const badge = (slug: string) => (focus?.badges[slug] ? <span className={p.badge}>{focus.badges[slug]}</span> : null);

  return (
    <div className={p.root} lang={lang} data-mode={mode} data-motion={motion ? "on" : undefined} ref={rootRef}>
      <header className={p.top}>
        <span className={p.topName}>{model.person.name.replace(" (EXAMPLE)", "")}</span>
        {model.example && <span className={p.example}>{w.examplePortfolio}</span>}
        <nav className={p.topNav} aria-label={w.sections}>
          <a href="#work">{w.nav.work}</a>
          <a href="#trust">{w.nav.trust}</a>
          <a href="#next">{w.nav.next}</a>
          <a href="#sf">{w.nav.sf}</a>
        </nav>
        {controlledLang === undefined && <LangSwitch label={w.language} lang={lang} onLang={setOwnLang} className={p.lang} />}
      </header>
      {model.example && w.translatedNote && <p className={p.esNote}>{w.translatedNote}</p>}
      {!model.example && lang === "es" && (
        <p className={p.esNote}>
          {translations
            ? `Versión en español, traducida con ${translations.engine}. El texto con subrayado punteado está traducido; las citas, los archivos y los nombres se muestran tal como están.`
            : "Solo las palabras de la interfaz están en español. El contenido sigue en su idioma original hasta que pidas la traducción."}
        </p>
      )}

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
            onBlur={(e) => editable && onEdit?.({ headline: e.currentTarget.textContent ?? "" })}
            data-editable={editable}
          >
            <Tr shown={tr(model.person.headline)} />
          </p>
          {focus ? (
            <div className={p.focusIntro}>
              <span className={p.focusLabel}>{focus.label}</span>
              <p className={p.intro}>
                <Tr shown={focus.intro} />
              </p>
            </div>
          ) : (
            <p
              className={p.intro}
              contentEditable={editable}
              suppressContentEditableWarning
              onBlur={(e) => editable && onEdit?.({ intro: e.currentTarget.textContent ?? "" })}
              data-editable={editable}
            >
              <Tr shown={tr(model.person.intro)} />
            </p>
          )}
          <dl className={p.facts} data-swarm="facts">
            <div>
              <dt>{w.factRole}</dt>
              <dd>{model.person.role ? <Tr shown={tr(model.person.role)} /> : w.builder}</dd>
            </div>
            {model.person.location && (
              <div>
                <dt>{w.factLocation}</dt>
                <dd>
                  <Tr shown={tr(model.person.location)} />
                </dd>
              </div>
            )}
            <div>
              <dt>{w.factRecord}</dt>
              <dd>{w.record(model.stats.projects, model.stats.files)}</dd>
            </div>
          </dl>
        </div>
        <nav className={p.index} aria-label={w.projects} data-swarm="index">
          <p className={p.indexLabel}>{w.workCount(visible.length)}</p>
          <ol>
            {visible.map((x) => (
              <li key={x.slug}>
                <button type="button" onClick={() => openProject(x.slug)} data-swarm={`index-${x.slug}`}>
                  <span className={p.indexTitle}>{x.title}</span>
                  <span className={p.indexLine}>
                    <Tr shown={tr(x.summary)} />
                  </span>
                  <span className={p.indexMeta}>
                    {period(x.period, lang) ?? ""} · {x.role && <Tr shown={tr(x.role)} />}
                    {badge(x.slug)}
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
          {w.work}
        </h2>
        {visible.map((x, i) => (
          <article key={x.slug} className={p.project} data-flip={i % 2 === 1} data-swarm={`project-${x.slug}`} data-reveal>
            <div className={p.projectText}>
              <p className={p.period}>
                {period(x.period, lang) ?? ""}
                {badge(x.slug)}
              </p>
              <h3 className={p.projectTitle} style={{ viewTransitionName: open === x.slug ? undefined : `title-${x.slug}` }}>
                {x.title}
              </h3>
              <p className={p.projectSummary}>
                <Tr shown={tr(x.summary)} />
              </p>
              <ul className={p.parts}>
                {x.rinPart.slice(0, 3).map((r) => (
                  <li key={r.text}>
                    <Tr shown={tr(r.text)} />
                    {r.shared && <span className={p.shared}>{w.shared}</span>}
                  </li>
                ))}
              </ul>
              <div className={p.projectActions}>
                <button type="button" className={p.primary} onClick={() => openProject(x.slug)}>
                  {w.openProject}
                </button>
                <button type="button" className={p.proofLink} onClick={() => setProof({ title: x.title, items: x.proof })}>
                  {w.proof} <span>{x.proof.length}</span>
                </button>
              </div>
            </div>
            <div
              className={p.cover}
              style={{ viewTransitionName: open === x.slug ? undefined : `art-${x.slug}` }}
              role="button"
              tabIndex={0}
              aria-label={w.openNamed(x.title)}
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
              {w.handTitle(first)}
            </h2>
            {model.person.goal && (
              <p className={p.goal}>
                {w.forGoal} <Tr shown={tr(model.person.goal)} />
              </p>
            )}
          </div>
          <ol className={p.tasks}>
            {model.capabilities.map((c) => (
              <li key={c.key} data-level={c.support}>
                <Level support={c.support} lang={lang} />
                <div className={p.taskBody}>
                  <p className={p.taskName}>
                    <Tr shown={tr(c.name)} />
                  </p>
                  <p className={p.taskFrom}>
                    {c.support === "unknown" ? (
                      model.question ? (
                        <Tr shown={tr(model.question)} />
                      ) : (
                        w.nothingYet
                      )
                    ) : (
                      <>
                        {w.fromProjects(c.projects)}
                        {c.limit && (
                          <>
                            . <Tr shown={tr(c.limit)} />
                          </>
                        )}
                      </>
                    )}
                  </p>
                </div>
                {c.proof.length > 0 && (
                  <button type="button" className={p.proofLink} onClick={() => setProof({ title: <Tr shown={tr(c.name)} />, items: c.proof })}>
                    {w.proof} <span>{c.proof.length}</span>
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
            {w.nextTitle(first)}
          </h2>
          <div className={p.assembly}>
            <div className={p.assemblyCol}>
              {model.nextBuild.parts
                .filter((x) => x.projects.includes("Tidepool"))
                .map((x) => (
                  <PartChip key={x.key} name={tr(x.name)} support={x.support} lang={lang} onProof={() => setProof({ title: <Tr shown={tr(x.name)} />, items: x.proof })} />
                ))}
              <p className={p.assemblyFrom}>{w.fromProject("Tidepool")}</p>
            </div>
            <div className={p.mvp}>
              <p className={p.mvpLabel}>{w.proposal}</p>
              <p className={p.mvpTitle}>
                <Tr shown={tr(model.nextBuild.title)} />
              </p>
              <p className={p.mvpSummary}>
                <Tr shown={tr(model.nextBuild.summary)} />
              </p>
              {model.nextBuild.gaps[0] && (
                <p className={p.mvpGap}>
                  {w.stillNeeds}{" "}
                  {model.nextBuild.gaps.slice(0, 2).map((g, i) => (
                    <Fragment key={g}>
                      {i > 0 && " "}
                      <Tr shown={tr(g)} />
                    </Fragment>
                  ))}
                </p>
              )}
            </div>
            <div className={p.assemblyCol}>
              {model.nextBuild.parts
                .filter((x) => !x.projects.includes("Tidepool"))
                .map((x) => (
                  <PartChip key={x.key} name={tr(x.name)} support={x.support} lang={lang} onProof={() => setProof({ title: <Tr shown={tr(x.name)} />, items: x.proof })} />
                ))}
              <p className={p.assemblyFrom}>{w.fromProject("Quietroom")}</p>
            </div>
          </div>
        </section>
      )}

      {model.roles.length > 0 && (
        <section className={p.sf} id="sf" aria-labelledby="sf-title" data-swarm="sf" data-reveal>
          <div className={p.sfHead}>
            <h2 id="sf-title" className={p.sectionTitle}>
              {w.sfTitle}
            </h2>
            <p className={p.sfNote}>{w.sfNote(first)}</p>
          </div>
          <ul className={p.roles}>
            {model.roles.map((r) => (
              <li key={r.id} data-signal={r.signalType}>
                <div className={p.roleHead}>
                  <p className={p.roleCompany}>{r.company}</p>
                  <p className={p.roleName}>
                    {r.role} · {r.location ?? w.locationUnknown}
                  </p>
                </div>
                <p className={p.signal} data-signal={r.signalType}>
                  {w.signal[r.signalType] ?? r.signal.label}
                </p>
                <p className={p.roleQuote}>{r.snippet ? `“${r.snippet}”` : w.snippetUnknown}</p>
                <p className={p.roleMeta}>
                  {w.read(r.retrieved)} · {r.id}
                </p>
                <p className={p.roleFit}>
                  {r.fit.length ? (
                    <>
                      {w.fits}{" "}
                      {r.fit.map((f, i) => {
                        const name = tr(f.name);
                        return (
                          <Fragment key={f.name}>
                            {i > 0 && "; "}
                            <Tr shown={{ ...name, text: name.text.split(":")[0]! }} />
                          </Fragment>
                        );
                      })}{" "}
                      <button type="button" className={p.inlineProof} onClick={() => setProof({ title: w.whyFits(first, r.company), items: r.fit.flatMap((f) => f.evidence.map((e) => ({ ...e }))) })}>
                        {w.proofLower}
                      </button>
                    </>
                  ) : (
                    w.noFit
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
          {model.example ? w.footExample : ""}
          {w.footNote}
        </p>
      </footer>

      {project && <ProjectView project={project} firstName={first} lang={lang} tr={tr} translate={model.example} onClose={close} onProof={setProof} onSource={openSource} />}
      {proof && <ProofDrawer proof={proof} w={w} onClose={() => setProof(null)} onOpen={openSource} />}
      {source && <SourceDialog req={source} onClose={() => setSource(null)} />}
    </div>
  );
}

function PartChip({ name, support, lang, onProof }: { name: Shown; support: Support; lang: Lang; onProof: () => void }) {
  return (
    <button type="button" className={p.partChip} data-level={support} onClick={onProof}>
      <span className={p.partName}>
        <Tr shown={name} />
      </span>
      <Level support={support} lang={lang} />
    </button>
  );
}

const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

/** The Spanish "part" paragraph: Rin's translated statements, then others' commits word for word. */
function contributionEs(first: string, parts: string[], others: PortfolioProject["others"]) {
  const mine = parts.map((t) => `${first} ${lowerFirst(sentence(t))}`);
  const theirs = others.map(
    (o) => `${o.who} escribió ${o.commits.length === 1 ? "un cambio" : `${o.commits.length} cambios`} aquí: ${o.commits.map((c) => `«${c.message}»`).join("; ")}.`,
  );
  return [...mine, ...theirs].join(" ");
}

function ProjectView({
  project: x,
  firstName,
  lang,
  tr,
  translate,
  onClose,
  onProof,
  onSource,
}: {
  project: PortfolioProject;
  firstName: string;
  lang: Lang;
  tr: Translate;
  translate: boolean;
  onClose: () => void;
  onProof: (p: Proof) => void;
  onSource: (sourceId: string, quote: string) => void;
}) {
  const w = UI[lang];
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  const parts = x.rinPart.map((r) => tr(r.text));
  const contribution: Shown =
    lang === "es" && translate && parts.every((s) => s.translated)
      ? { text: contributionEs(firstName, parts.map((s) => s.text), x.others), translated: true }
      : { text: x.contribution, translated: false };
  return (
    <div className={p.view} role="dialog" aria-modal="true" aria-labelledby={`pv-${x.slug}`} ref={ref} tabIndex={-1}>
      <div className={p.viewBar}>
        <button type="button" className={p.back} onClick={onClose}>
          {w.allWork}
        </button>
        <span className={p.viewMeta}>
          {x.role && <Tr shown={tr(x.role)} />} · {period(x.period, lang)}
        </span>
        <button type="button" className={p.proofLink} onClick={() => onProof({ title: x.title, items: x.proof })}>
          {w.proof} <span>{x.proof.length}</span>
        </button>
      </div>
      <div className={p.viewInner}>
        <h2 id={`pv-${x.slug}`} className={p.viewTitle} style={{ viewTransitionName: `title-${x.slug}` }}>
          {x.title}
        </h2>
        <p className={p.viewSummary}>
          <Tr shown={tr(x.summary)} />
        </p>
        <div className={p.viewArt} style={{ viewTransitionName: `art-${x.slug}` }}>
          <ProjectArt slug={x.slug} size="detail" />
        </div>

        <div className={p.viewGrid}>
          <section aria-labelledby={`c-${x.slug}`}>
            <h3 id={`c-${x.slug}`} className={p.viewH}>
              {w.partOf(firstName)}
            </h3>
            <p className={p.contribution}>
              <Tr shown={contribution} />
            </p>
            {x.outcome && (
              <p className={p.outcome}>
                <strong>{w.outcome}</strong> <Tr shown={tr(x.outcome.text)} />
              </p>
            )}
            {x.openQuestion && (
              <p className={p.open}>
                <strong>{w.notShown}</strong> <Tr shown={tr(x.openQuestion)} />
              </p>
            )}
          </section>
          <section aria-labelledby={`h-${x.slug}`}>
            <h3 id={`h-${x.slug}`} className={p.viewH}>
              {w.history}
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
              {w.ownFiles}
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
            {w.proofWords}
          </h3>
          <ul className={p.quoteList}>
            {x.proof.slice(0, 6).map((q) => (
              <li key={q.id}>
                <button type="button" onClick={() => onSource(q.sourceId, q.quote)}>
                  <span>“{q.quote}”</span>
                  <span className={p.quoteWhere}>
                    {q.locator} · {w.openFile}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function ProofDrawer({ proof, w, onClose, onOpen }: { proof: Proof; w: UiWords; onClose: () => void; onOpen: (sourceId: string, quote: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className={p.drawer} onClose={onClose} aria-labelledby="proof-h">
      <div className={p.drawerHead}>
        <div>
          <p className={p.drawerKicker}>{w.drawerKicker}</p>
          <h2 id="proof-h" className={p.drawerTitle}>
            {proof.title}
          </h2>
        </div>
        <button type="button" className={p.back} onClick={() => ref.current?.close()} autoFocus>
          {w.close}
        </button>
      </div>
      <ul className={p.quoteList}>
        {proof.items.map((q) => (
          <li key={q.id}>
            <button type="button" onClick={() => onOpen(q.sourceId, q.quote)}>
              <span>“{q.quote}”</span>
              <span className={p.quoteWhere}>
                {q.projectTitle} · {q.locator} · {w.openFile}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </dialog>
  );
}
