"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import type { PortfolioModel } from "@/lib/portfolio";
import { content, localized, localized as localizedText, UI, type Lang, type Localized, type PathId, type Shown } from "@/lib/i18n";
import { discover, filterOptions, EXAMPLE_SIGNALS, NO_FILTERS, VIEWS, type Check, type Filters, type Reason, type Verdict, type View } from "@/lib/discover";
import { Level, Tr } from "../portfolio/Portfolio";
import { Radios } from "../Choice";
import { SourceDialog, type SourceRequest } from "../SourceDialog";
import { FileChip } from "./NextSteps";
import { LiveDiscover } from "./LiveDiscover";
import d from "./discover.module.css";
import n from "./nextsteps.module.css";

const STEP_MS = 180;
const SETTLE_MS = 320;
const ADAPT: Record<View, PathId> = { cofounders: "cofounder", clients: "strengthen" };

type Query = { view: View; intent: string; filters: Filters };
/** A run shows every card in list order, resolves them one by one, then sorts them into the two groups. */
type Stage = { kind: "checking"; resolved: number } | { kind: "sorted" };
type PillState = "pending" | "pass" | "fail";
export type Translate = (text: string) => Shown;

const firstQuery = (view: View, lang: Lang): Query => ({ view, intent: EXAMPLE_SIGNALS[view].presets[0][lang], filters: NO_FILTERS });
const animates = () => "startViewTransition" in document && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const anyFilter = (f: Filters) => f.skills.length > 0 || f.needs.length > 0 || f.location !== null;

export function Discover({ model, lang, onAdapt }: { model: PortfolioModel; lang: Lang; onAdapt: (path: PathId) => void }) {
  return model.example ? <ExampleDiscover model={model} lang={lang} onAdapt={onAdapt} /> : <LiveDiscover model={model} lang={lang} />;
}

function ExampleDiscover({ model, lang, onAdapt }: { model: PortfolioModel; lang: Lang; onAdapt: (path: PathId) => void }) {
  const w = UI[lang].discover;
  const first = model.person.firstName;
  const tr: Translate = (text) => content(text, lang, model.example);
  const [query, setQuery] = useState<Query>(() => firstQuery("cofounders", lang));
  const [text, setText] = useState(query.intent);
  const [stage, setStage] = useState<Stage>({ kind: "sorted" });
  const [selected, setSelected] = useState<string | null>(null);
  const [source, setSource] = useState<SourceRequest | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const runRef = useRef(0);
  const detailRef = useRef<HTMLElement>(null);
  const result = useMemo(() => discover(model, query.view, query.intent, query.filters), [model, query]);
  const order = EXAMPLE_SIGNALS[query.view].signals.map((s) => s.id);
  const inOrder = [...result.kept, ...result.dropped].sort((a, b) => order.indexOf(a.signal.id) - order.indexOf(b.signal.id));
  const current = inOrder.find((v) => v.signal.id === selected) ?? result.kept[0] ?? null;
  const options = filterOptions(query.view);
  const presets = EXAMPLE_SIGNALS[query.view].presets;

  /** A preset follows the language switch; an intent typed by hand stays as typed. */
  const [langShown, setLangShown] = useState(lang);
  if (langShown !== lang) {
    setLangShown(lang);
    const preset = presets.find((p) => p.en === query.intent || p.es === query.intent);
    if (preset && preset[lang] !== query.intent) {
      setQuery({ ...query, intent: preset[lang] });
      if (text === query.intent) setText(preset[lang]);
    }
  }

  useEffect(() => {
    if (stage.kind !== "checking") return;
    const run = runRef.current;
    const done = stage.resolved >= order.length;
    const timer = window.setTimeout(
      () => {
        if (!done) return setStage({ kind: "checking", resolved: stage.resolved + 1 });
        const sort = () => {
          if (runRef.current === run) setStage({ kind: "sorted" });
        };
        const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
        if (doc.startViewTransition) doc.startViewTransition(() => flushSync(sort));
        else sort();
      },
      done ? SETTLE_MS : STEP_MS,
    );
    return () => window.clearTimeout(timer);
  }, [stage, order.length]);

  const run = (next: Query) => {
    runRef.current += 1;
    setQuery(next);
    setText(next.intent);
    setSelected(null);
    setStage(animates() ? { kind: "checking", resolved: 0 } : { kind: "sorted" });
  };
  const skip = () => {
    runRef.current += 1;
    setStage({ kind: "sorted" });
  };
  const setFilters = (filters: Filters) => run({ ...query, intent: text, filters });
  const toggle = (id: string) => {
    const field = options.field;
    const on = query.filters[field];
    setFilters({ ...query.filters, [field]: on.includes(id) ? on.filter((x) => x !== id) : [...on, id] });
  };
  const select = (id: string) => {
    setSelected(id);
    const el = detailRef.current;
    if (el && el.getBoundingClientRect().top > window.innerHeight * 0.5) el.scrollIntoView({ block: "start", behavior: animates() ? "smooth" : "auto" });
  };
  const onIntentKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    run({ ...query, intent: text });
  };

  const card = (v: Verdict, pending: boolean) => (
    <Card key={v.signal.id} v={v} lang={lang} tr={tr} first={first} pending={pending} selected={current?.signal.id === v.signal.id} onSelect={() => select(v.signal.id)} />
  );

  return (
    <div className={d.root} lang={lang}>
      <div className={d.top}>
        <header className={d.head}>
          <div className={d.titleRow}>
            <h2 className={n.heading}>{w.heading}</h2>
            <span className={d.label}>{w.label}</span>
          </div>
          <p className={n.note}>{w.planned}</p>
          <details className={d.how}>
            <summary>{w.how}</summary>
            <Rules lang={lang} first={first} />
          </details>
        </header>
        <Radios
          label={w.views}
          value={query.view}
          onChange={(view) => view !== query.view && run(firstQuery(view, lang))}
          className={d.views}
          options={VIEWS.map((v) => ({ value: v, content: w.view[v] }))}
        />
      </div>

      <form
        className={d.query}
        onSubmit={(e) => {
          e.preventDefault();
          run({ ...query, intent: text });
        }}
      >
        <label htmlFor="dv-intent" className={d.intentLabel}>
          {w.intent}
        </label>
        <div className={d.intentRow}>
          <textarea id="dv-intent" className={d.intent} rows={2} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onIntentKey} />
          <button type="submit" className={d.run}>
            {w.run}
          </button>
        </div>
        <div role="group" aria-label={w.presets} className={d.presets}>
          {presets.map((p) => (
            <button key={p.en} type="button" aria-pressed={query.intent === p[lang]} onClick={() => run({ ...query, intent: p[lang] })}>
              <Tr shown={localized(p, lang)} />
            </button>
          ))}
        </div>
        <div className={d.filters}>
          <div role="group" aria-label={w.field[options.field]} className={d.chips}>
            <span className={n.label}>{w.field[options.field]}</span>
            {options.options.map((o) => (
              <button key={o.id} type="button" aria-pressed={query.filters[options.field].includes(o.id)} onClick={() => toggle(o.id)}>
                <Tr shown={localized(o.label, lang)} />
              </button>
            ))}
          </div>
          <label className={d.location}>
            <span className={n.label}>{w.location}</span>
            <select value={query.filters.location ?? ""} onChange={(e) => setFilters({ ...query.filters, location: e.target.value || null })}>
              <option value="">{w.anyLocation}</option>
              {options.locations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
      </form>

      <p className={d.sr} aria-live="polite">
        {stage.kind === "checking" ? w.checking(order.length, first) : `${w.shortlist(result.kept.length)}. ${w.dropped(result.dropped.length)}.`}
      </p>

      <div className={d.results}>
        <div className={d.list}>
          {stage.kind === "checking" ? (
            <section className={d.group} aria-labelledby="dv-checking">
              <div className={d.groupHead}>
                <h3 id="dv-checking" className={d.groupTitle}>
                  {w.checking(order.length, first)}
                </h3>
                <button type="button" className={d.skip} onClick={skip}>
                  {w.skip}
                </button>
              </div>
              <ol className={d.cards}>{inOrder.map((v, i) => card(v, i >= stage.resolved))}</ol>
            </section>
          ) : (
            <>
              <section className={d.group} aria-labelledby="dv-kept">
                <h3 id="dv-kept" className={d.groupTitle}>
                  {w.shortlist(result.kept.length)}
                </h3>
                {result.kept.length ? <ol className={d.cards}>{result.kept.map((v) => card(v, false))}</ol> : <p className={d.empty}>{w.empty}</p>}
              </section>
              {result.dropped.length > 0 && (
                <section className={d.group} aria-labelledby="dv-dropped">
                  <h3 id="dv-dropped" className={d.groupTitle}>
                    {w.dropped(result.dropped.length)}
                  </h3>
                  <p className={n.note}>{w.droppedNote}</p>
                  <ol className={d.cards}>{result.dropped.map((v) => card(v, false))}</ol>
                </section>
              )}
            </>
          )}
        </div>

        <aside className={d.detail} ref={detailRef} aria-label={current?.signal.name ?? w.heading}>
          {stage.kind === "checking" ? (
            <div className={d.waiting}>
              <p className={n.label}>{w.how}</p>
              <Rules lang={lang} first={first} />
            </div>
          ) : current ? (
            <Detail
              v={current}
              model={model}
              lang={lang}
              tr={tr}
              filtered={anyFilter(query.filters)}
              copied={copied === `${current.signal.id}:${lang}`}
              onCopied={() => setCopied(`${current.signal.id}:${lang}`)}
              onOpen={(sourceId, quote) => setSource({ sourceId, quote })}
              onAdapt={() => onAdapt(ADAPT[current.signal.view])}
            />
          ) : (
            <p className={n.note}>{w.select}</p>
          )}
        </aside>
      </div>
      {source && <SourceDialog req={source} onClose={() => setSource(null)} />}
    </div>
  );
}

function Rules({ lang, first }: { lang: Lang; first: string }) {
  const w = UI[lang].discover;
  return (
    <>
      <ol className={d.rules}>
        {w.rules(first).map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
      <p className={n.label}>{w.allPass}</p>
      <p className={n.label}>{w.simulated}</p>
    </>
  );
}

function Card({ v, lang, tr, first, pending, selected, onSelect }: { v: Verdict; lang: Lang; tr: Translate; first: string; pending: boolean; selected: boolean; onSelect: () => void }) {
  const w = UI[lang].discover;
  const s = v.signal;
  const line = s.headline ?? s.need;
  const state = (c: Check): PillState => (pending ? "pending" : c.pass ? "pass" : "fail");
  return (
    <li className={d.item} style={{ viewTransitionName: `signal-${s.id}` }}>
      <button type="button" className={d.card} aria-pressed={selected} data-kept={pending ? undefined : String(v.kept)} onClick={onSelect}>
        <span className={d.name}>{s.name}</span>
        {line && (
          <span className={d.line}>
            <Tr shown={localized(line, lang)} />
          </span>
        )}
        <span className={d.meta}>
          <span className={d.source}>
            <Tr shown={localized(s.source, lang)} /> · EXAMPLE
          </span>
          <span className={d.recency}>{w.fictional(s.recency[lang])}</span>
        </span>
        <q className={d.quote} lang="en">
          {s.quote}
        </q>
        {lang === "es" && (
          <span className={d.quoteEs}>
            <Tr shown={{ text: s.quoteEs, translated: true }} />
          </span>
        )}
        <span className={d.pills} aria-label={w.checks}>
          {v.checks.map((c) => (
            <span key={c.id} className={d.pill} data-state={state(c)}>
              {w.check[c.id]}
              <span className={d.sr}> {w.state[state(c)]}</span>
            </span>
          ))}
        </span>
        {!pending && v.failed && (
          <span className={d.reason}>
            <span className={d.reasonCheck}>{w.check[v.failed.id]}.</span> <Sentence reason={v.failed.reason} wants={s.wants} lang={lang} tr={tr} first={first} />
          </span>
        )}
      </button>
    </li>
  );
}

export function Names({ names, tr }: { names: string[]; tr: Translate }) {
  return (
    <>
      {names.map((x, i) => (
        <Fragment key={x}>
          {i > 0 && "; "}
          <Tr shown={tr(x)} />
        </Fragment>
      ))}
    </>
  );
}

/** One sentence per reason, passed or failed; model names go through the content dictionary. Live text is shown as written. */
export function Sentence({ reason, wants, lang, tr, first, asWritten = false }: { reason: Reason; wants: Localized; lang: Lang; tr: Translate; first: string; asWritten?: boolean }) {
  const w = UI[lang].discover;
  const localized = (l: Localized, at: Lang): Shown => (asWritten ? { text: l[at], translated: false } : localizedText(l, at));
  switch (reason.kind) {
    case "intent":
      return (
        <>
          {w.intentHit} {reason.words.join(", ")}.
        </>
      );
    case "intent-miss":
      return <>{w.intentMiss}</>;
    case "evidence":
      return (
        <>
          {w.evidenceHit(first)} <Tr shown={localized(wants, lang)} />.
        </>
      );
    case "evidence-miss":
      return (
        <>
          {w.evidenceMiss(first)} <Tr shown={localized(reason.wants, lang)} />.
          {reason.notShown.length > 0 && (
            <>
              {" "}
              {w.notShownYet} <Names names={reason.notShown} tr={tr} />.
            </>
          )}
        </>
      );
    case "complement":
      return <>{w.complementHit(first)}</>;
    case "complement-overlap":
      return (
        <>
          {w.overlap(first)} <Names names={reason.already} tr={tr} />.
        </>
      );
    case "complement-miss":
      return <>{w.complementMiss(first)}</>;
    case "filters":
      return <>{w.filtersHit}</>;
    case "filter-skill":
      return <>{w.filterSkill}</>;
    case "filter-need":
      return <>{w.filterNeed}</>;
    case "filter-location":
      return <>{reason.location === null ? `${w.locationNotStated}.` : w.locationOther(reason.location)}</>;
  }
}

function Detail({
  v,
  model,
  lang,
  tr,
  filtered,
  copied,
  onCopied,
  onOpen,
  onAdapt,
}: {
  v: Verdict;
  model: PortfolioModel;
  lang: Lang;
  tr: Translate;
  filtered: boolean;
  copied: boolean;
  onCopied: () => void;
  onOpen: (sourceId: string, quote: string) => void;
  onAdapt: () => void;
}) {
  const w = UI[lang].discover;
  const first = model.person.firstName;
  const s = v.signal;
  const proof = v.backing.flatMap((b) => b.proof);
  const why = v.checks.filter((c) => c.pass && (c.id !== "filters" || filtered));
  const draft = s.draft ? localized(s.draft, lang) : null;
  const copy = () =>
    draft &&
    navigator.clipboard
      ?.writeText(draft.text)
      .then(onCopied)
      .catch(() => {});

  return (
    <div className={d.detailBody}>
      <header className={d.detailHead}>
        <p className={d.detailName}>{s.name}</p>
        {s.headline && (
          <p className={d.detailLine}>
            <Tr shown={localized(s.headline, lang)} />
          </p>
        )}
        {s.brings.length > 0 && (
          <div className={d.brings}>
            <span className={n.label}>{UI[lang].next.selfDescribed}</span>
            <ul className={n.plain}>
              {s.brings.map((b) => (
                <li key={b.en}>
                  <Tr shown={localized(b, lang)} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {v.failed && (
          <p className={d.reason}>
            <span className={d.reasonCheck}>{w.check[v.failed.id]}.</span> <Sentence reason={v.failed.reason} wants={s.wants} lang={lang} tr={tr} first={first} />
          </p>
        )}
      </header>

      <div className={d.projects}>
        <span className={n.label}>{w.reliesOn(first)}</span>
        <div className={d.projectChips}>
          {model.projects.map((p) => {
            const q = v.projects.includes(p.title) ? proof.find((x) => x.projectTitle === p.title) : undefined;
            return q ? (
              <button key={p.slug} type="button" className={d.project} data-lit="" onClick={() => onOpen(q.sourceId, q.quote)}>
                {p.title}
              </button>
            ) : (
              <span key={p.slug} className={d.project}>
                {p.title}
              </span>
            );
          })}
        </div>
      </div>

      <section className={d.section} aria-labelledby="dv-need">
        <h4 id="dv-need" className={d.sectionTitle}>
          {w.need}
        </h4>
        {s.need && (
          <p className={d.needText}>
            <Tr shown={localized(s.need, lang)} />
          </p>
        )}
        <p className={d.text}>
          {s.view === "cofounders" ? w.lookingFor : w.asksFor} <Tr shown={localized(s.wants, lang)} />
        </p>
      </section>

      <section className={d.section} aria-labelledby="dv-bring">
        <h4 id="dv-bring" className={d.sectionTitle}>
          {w.bring}
        </h4>
        {v.backing.length ? (
          <ul className={n.items}>
            {v.backing.map((b) => {
              const q = b.proof[0];
              return (
                <li key={b.name}>
                  <p className={n.itemName}>
                    <Tr shown={tr(b.name)} />
                  </p>
                  <div className={n.itemMeta}>
                    <Level support={b.support} lang={lang} />
                    {q && <FileChip project={q.projectTitle} locator={q.locator} onClick={() => onOpen(q.sourceId, q.quote)} />}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={d.text}>{UI[lang].nothingYet}</p>
        )}
      </section>

      {why.length > 0 && (
        <section className={d.section} aria-labelledby="dv-why">
          <h4 id="dv-why" className={d.sectionTitle}>
            {w.why}
          </h4>
          <ul className={n.plain}>
            {why.map((c) => (
              <li key={c.id}>
                <Sentence reason={c.reason} wants={s.wants} lang={lang} tr={tr} first={first} />
                {c.reason.kind === "complement" && (
                  <ul className={d.covers}>
                    {c.reason.covers.map((x) => (
                      <li key={x}>
                        <Tr shown={tr(x)} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={d.section} aria-labelledby="dv-unknown">
        <h4 id="dv-unknown" className={d.sectionTitle}>
          {w.unknown}
        </h4>
        <ul className={n.plain}>
          {s.unknowns.map((u) => (
            <li key={u.en}>
              <Tr shown={localized(u, lang)} />
            </li>
          ))}
        </ul>
      </section>

      {v.kept && draft && (
        <section className={d.section} aria-labelledby="dv-draft">
          <div className={n.draftHead}>
            <h4 id="dv-draft" className={d.sectionTitle}>
              {w.draft}
            </h4>
            <button type="button" className={n.copy} onClick={copy}>
              {copied ? UI[lang].next.copied : UI[lang].next.copy}
            </button>
          </div>
          <p className={d.draft}>
            <Tr shown={draft} />
          </p>
          <p className={n.label}>{w.draftNote}</p>
        </section>
      )}

      {v.kept && (
        <div className={d.adapt}>
          <button type="button" className={d.adaptBtn} onClick={onAdapt}>
            {w.adapt}
          </button>
          <p className={n.label}>{w.adaptLine(UI[lang].next.path[ADAPT[s.view]].title)}</p>
        </div>
      )}
    </div>
  );
}
