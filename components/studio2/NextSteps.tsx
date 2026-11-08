"use client";

import { useMemo, useState, type ComponentType } from "react";
import type { PortfolioModel, ProofItem } from "@/lib/portfolio";
import { content, localized, UI, type Lang, type PathId, type Shown } from "@/lib/i18n";
import {
  adaptedIntro,
  applyPlan,
  cofounderPlan,
  strengthenPlan,
  EXAMPLE_COFOUNDER,
  EXAMPLE_OFFER,
  EXAMPLE_STRENGTHEN,
  type GapReason,
  type RequirementResult,
} from "@/lib/next-paths";
import { Level, Portfolio, Tr } from "../portfolio/Portfolio";
import { LangSwitch, Radios } from "../Choice";
import { SourceDialog, type SourceRequest } from "../SourceDialog";
import n from "./nextsteps.module.css";

type PanelProps = { model: PortfolioModel; lang: Lang; onLang: (lang: Lang) => void; onOpen: (sourceId: string, quote: string) => void };

const PATHS: PathId[] = ["apply", "strengthen", "cofounder"];

export function NextSteps({ model, lang, onLang, initialPath }: { model: PortfolioModel; lang: Lang; onLang: (lang: Lang) => void; initialPath?: PathId }) {
  const w = UI[lang].next;
  const [path, setPath] = useState<PathId | null>(initialPath ?? null);
  const [source, setSource] = useState<SourceRequest | null>(null);

  if (!model.example) {
    return (
      <div className={n.root} lang={lang}>
        <p className={n.note}>{w.live}</p>
      </div>
    );
  }

  const Panel = path ? PANEL[path] : null;
  return (
    <div className={n.root} lang={lang}>
      <header className={n.head}>
        <h2 className={n.heading}>{w.heading}</h2>
        <p className={n.note}>{w.example}</p>
      </header>
      <Radios
        label={w.paths}
        value={path}
        onChange={setPath}
        className={n.paths}
        options={PATHS.map((id) => ({
          value: id,
          content: (
            <>
              <span className={n.pathTitle}>{w.path[id].title}</span>
              <span className={n.pathLine}>{w.path[id].line}</span>
            </>
          ),
        }))}
      />
      {path && Panel ? (
        <section key={path} className={n.panel} aria-label={w.path[path].title}>
          <Panel model={model} lang={lang} onLang={onLang} onOpen={(sourceId, quote) => setSource({ sourceId, quote })} />
        </section>
      ) : (
        <p className={n.choose}>{w.choose}</p>
      )}
      {source && <SourceDialog req={source} onClose={() => setSource(null)} />}
    </div>
  );
}

const fileKey = (q: ProofItem) => `${q.projectTitle}|${q.locator}`;

export function FileChip({ project, locator, onClick }: { project: string; locator: string; onClick?: () => void }) {
  const label = (
    <>
      {project} · <span className={n.mono}>{locator}</span>
    </>
  );
  return onClick ? (
    <button type="button" className={n.chip} onClick={onClick}>
      {label}
    </button>
  ) : (
    <span className={n.chip} data-static="">
      {label}
    </span>
  );
}

function ApplyPanel({ model, lang, onLang, onOpen }: PanelProps) {
  const w = UI[lang].next;
  const plan = useMemo(() => applyPlan(model, EXAMPLE_OFFER), [model]);
  const intro: Shown = { text: adaptedIntro(plan, model, lang), translated: lang === "es" };
  const o = plan.offer;
  const badges = Object.fromEntries(plan.projects.filter((x) => x.backs.length > 0).map((x) => [x.slug, w.backs(x.backs.length, plan.total)]));
  return (
    <>
      <div className={n.applyTop}>
        <Radios
          label={w.posting}
          value={o.id}
          onChange={() => {}}
          className={n.offers}
          options={[
            {
              value: o.id,
              content: (
                <>
                  <span className={n.offerCompany}>{o.company}</span>
                  <span className={n.offerRole}>
                    {o.role} · {o.location}
                  </span>
                  <span className={n.offerMeta}>{w.postingRead(o.retrieved)}</span>
                </>
              ),
            },
          ]}
        />
        <div className={n.langRow}>
          <span className={n.label}>{w.outputLanguage}</span>
          <LangSwitch label={w.outputLanguage} lang={lang} onLang={onLang} className={n.lang} />
        </div>
      </div>

      <p className={n.score}>{w.score(plan.backed, plan.total)}</p>
      <ol className={n.reqs}>
        {plan.requirements.map((r) => (
          <Requirement key={r.id} r={r} lang={lang} example={model.example} onOpen={onOpen} />
        ))}
      </ol>

      <section className={n.block} aria-labelledby="ns-intro">
        <h3 id="ns-intro" className={n.h3}>
          {w.intro}
        </h3>
        <p className={n.introText}>
          <Tr shown={intro} />
        </p>
      </section>

      <section className={n.block} aria-labelledby="ns-portfolio">
        <h3 id="ns-portfolio" className={n.h3}>
          {w.forRole}
        </h3>
        <div className={n.frame}>
          <Portfolio model={model} lang={lang} mode="preview" focus={{ order: plan.projects.map((x) => x.slug), badges, intro, label: w.adaptedFor(o.company) }} />
        </div>
      </section>
    </>
  );
}

function Requirement({ r, lang, example, onOpen }: { r: RequirementResult; lang: Lang; example: boolean; onOpen: PanelProps["onOpen"] }) {
  const w = UI[lang].next;
  const files = r.status.kind === "backed" ? r.status.backing.flatMap((b) => b.proof).filter((q, i, all) => all.findIndex((x) => fileKey(x) === fileKey(q)) === i) : [];
  return (
    <li className={n.req} data-status={r.status.kind}>
      <span className={n.pill} data-status={r.status.kind}>
        {r.status.kind === "backed" ? w.backed : w.gap}
      </span>
      <div className={n.reqBody}>
        <p className={n.line} lang="en">
          “{r.line}”
        </p>
        {lang === "es" && (
          <p className={n.lineEs}>
            <Tr shown={{ text: r.lineEs, translated: true }} />
          </p>
        )}
        {r.status.kind === "backed" ? (
          <div className={n.chips}>
            {files.slice(0, 3).map((q) => (
              <FileChip key={q.id} project={q.projectTitle} locator={q.locator} onClick={() => onOpen(q.sourceId, q.quote)} />
            ))}
          </div>
        ) : (
          <Reason reason={r.status.reason} lang={lang} example={example} />
        )}
      </div>
    </li>
  );
}

function Reason({ reason, lang, example }: { reason: GapReason; lang: Lang; example: boolean }) {
  const w = UI[lang].next;
  switch (reason.kind) {
    case "not-shown":
      return <p className={n.reason}>{reason.limit ? <Tr shown={content(reason.limit, lang, example)} /> : w.notShown}</p>;
    case "others": {
      const [first, ...rest] = reason.commits;
      return (
        <p className={n.reason}>
          {w.othersWrote(reason.who)}{" "}
          <q className={n.commit} lang="en">
            {first.message}
          </q>
          {rest.length > 0 && <span className={n.more}> {w.more(rest.length)}</span>}
        </p>
      );
    }
    case "nothing":
      return <p className={n.reason}>{w.nothing}</p>;
  }
}

function StrengthenPanel({ model, lang, onOpen }: PanelProps) {
  const w = UI[lang].next;
  const [goalId, setGoalId] = useState(EXAMPLE_STRENGTHEN.goals[0]!.id);
  const plan = useMemo(() => strengthenPlan(model, EXAMPLE_STRENGTHEN, goalId), [model, goalId]);
  return (
    <>
      <Radios
        label={w.goal}
        value={goalId}
        onChange={setGoalId}
        className={n.goals}
        options={EXAMPLE_STRENGTHEN.goals.map((g) => ({ value: g.id, content: <Tr shown={localized(g.label, lang)} /> }))}
      />
      <ol className={n.cards}>
        {plan.improvements.map((imp) => (
          <li key={imp.id} className={n.card} data-improvement={imp.id}>
            <div className={n.cardHead}>
              <span className={n.num}>{imp.priority}</span>
              <span className={n.kind}>{w.kind[imp.kind]}</span>
            </div>
            <h4 className={n.cardTitle}>
              <Tr shown={localized(imp.title, lang)} />
            </h4>
            <p className={n.why}>
              <Tr shown={localized(imp.why, lang)} />
            </p>
            <p className={n.proves}>
              <span className={n.label}>{w.proves}</span> <Tr shown={localized(imp.proves, lang)} />
            </p>
            <div className={n.chips}>
              <span className={n.label}>{w.buildsOn}</span>
              {imp.buildsOn.map((b) => (
                <FileChip key={`${b.project}|${b.locator}`} project={b.project} locator={b.locator} onClick={b.sourceId ? () => onOpen(b.sourceId!, "") : undefined} />
              ))}
            </div>
            <dl className={n.states}>
              <div className={n.state}>
                <dt className={n.label}>{w.today}</dt>
                <dd>
                  {imp.today ? (
                    <>
                      <Level support={imp.today.support} lang={lang} /> <Tr shown={content(imp.today.name, lang, model.example)} />
                    </>
                  ) : (
                    <span className={n.none}>{w.notInFiles}</span>
                  )}
                </dd>
              </div>
              <div className={n.state} data-future="">
                <dt className={n.label}>
                  {w.ifDone} <span className={n.notYet}>{w.notTrueYet}</span>
                </dt>
                <dd>
                  <Tr shown={localized(imp.ifDone, lang)} />
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
    </>
  );
}

function CofounderPanel({ model, lang, onOpen }: PanelProps) {
  const w = UI[lang].next;
  const plan = useMemo(() => cofounderPlan(model, EXAMPLE_COFOUNDER), [model]);
  const [copied, setCopied] = useState<Lang | null>(null);
  if (!plan) return <p className={n.choose}>{w.noProject}</p>;
  const first = model.person.firstName;
  const tr = (text: string) => content(text, lang, model.example);
  const draft = localized(plan.draft, lang);
  const copy = () =>
    navigator.clipboard
      ?.writeText(draft.text)
      .then(() => setCopied(lang))
      .catch(() => {});
  return (
    <>
      <div className={n.project}>
        <p className={n.label}>{w.fromNext(first)}</p>
        <h3 className={n.projectTitle}>
          <Tr shown={tr(plan.project.title)} />
        </h3>
        <p className={n.projectSummary}>
          <Tr shown={tr(plan.project.summary)} />
        </p>
      </div>

      <div className={n.cols}>
        <section className={n.col} aria-labelledby="cf-brings">
          <h4 id="cf-brings" className={n.colTitle}>
            {w.brings(first)}
          </h4>
          <ul className={n.items}>
            {plan.brings.map((part) => {
              const q = part.proof[0];
              return (
                <li key={part.key}>
                  <p className={n.itemName}>
                    <Tr shown={tr(part.name)} />
                  </p>
                  <div className={n.itemMeta}>
                    <Level support={part.support} lang={lang} />
                    {q && <FileChip project={q.projectTitle} locator={q.locator} onClick={() => onOpen(q.sourceId, q.quote)} />}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        <section className={n.col} aria-labelledby="cf-needs">
          <h4 id="cf-needs" className={n.colTitle}>
            {w.complement(first)}
          </h4>
          <ul className={n.items}>
            {plan.needs.map((need) => (
              <li key={need.because}>
                <p className={n.itemName}>
                  <Tr shown={localized(need.text, lang)} />
                </p>
                <p className={n.because}>
                  <Tr shown={tr(need.because)} />
                </p>
              </li>
            ))}
          </ul>
        </section>
        <section className={n.col} data-person="" aria-labelledby="cf-person">
          <h4 id="cf-person" className={n.colTitle}>
            {w.possible}
          </h4>
          {plan.person.synthetic && <p className={n.synthetic}>{w.synthetic}</p>}
          <p className={n.personName}>{plan.person.name}</p>
          <p className={n.personHeadline}>
            <Tr shown={localized(plan.person.headline, lang)} />
          </p>
          <p className={n.label}>{w.selfDescribed}</p>
          <ul className={n.plain}>
            {plan.person.brings.map((b) => (
              <li key={b.en}>
                <Tr shown={localized(b, lang)} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={n.block} aria-labelledby="cf-together">
        <h3 id="cf-together" className={n.h3}>
          {w.together}
        </h3>
        <div className={n.pair}>
          <div>
            <p className={n.who}>{first}</p>
            <ul className={n.plain}>
              {plan.brings.map((part) => (
                <li key={part.key}>
                  <Tr shown={tr(part.name)} />
                  {part.support === "inferred" && <span className={n.because}> · {UI[lang].level.inferred}</span>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className={n.who}>{plan.person.first}</p>
            <ul className={n.plain}>
              {plan.together.map((t) => (
                <li key={t.en}>
                  <Tr shown={localized(t, lang)} />
                </li>
              ))}
            </ul>
          </div>
        </div>
        <h4 className={n.colTitle}>{w.questions}</h4>
        <ul className={n.plain}>
          {plan.questions.map((q) => (
            <li key={q.en}>
              <Tr shown={localized(q, lang)} />
            </li>
          ))}
        </ul>
      </section>

      <section className={n.block} aria-labelledby="cf-draft">
        <div className={n.draftHead}>
          <h3 id="cf-draft" className={n.h3}>
            {w.draft}
          </h3>
          <button type="button" className={n.copy} onClick={copy}>
            {copied === lang ? w.copied : w.copy}
          </button>
        </div>
        <p className={n.draft}>
          <Tr shown={draft} />
        </p>
        <p className={n.label}>{w.draftNote(plan.person.first)}</p>
      </section>
    </>
  );
}

const PANEL: Record<PathId, ComponentType<PanelProps>> = { apply: ApplyPanel, strengthen: StrengthenPanel, cofounder: CofounderPanel };
