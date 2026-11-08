"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { PortfolioModel } from "@/lib/portfolio";
import { content, UI, type Lang } from "@/lib/i18n";
import { discover, NO_FILTERS, usd, VIEWS, type CallProvenance, type Relevance, type RelevanceLabel, type StoredRun, type Verdict, type View } from "@/lib/discover";
import type { DiscoverEvent, DiscoverStatus } from "@/lib/discover-live";
import { Level, Tr } from "../portfolio/Portfolio";
import { Radios } from "../Choice";
import { SourceDialog, type SourceRequest } from "../SourceDialog";
import { FileChip } from "./NextSteps";
import { Names, Sentence, type Translate } from "./Discover";
import d from "./discover.module.css";
import n from "./nextsteps.module.css";

type Result = { run: StoredRun; cached: boolean; relevance: Relevance | null };
type Phase = { kind: "idle" } | { kind: "running"; view: View; step: "search" | "relevance"; startedAt: number } | { kind: "done" } | { kind: "cancelled" } | { kind: "failed"; message: string };
type Store = { view: View; text: Record<View, string>; results: Record<View, Result | null>; phase: Phase; status: DiscoverStatus | null; loadError: string | null };

/** Module state, so a search keeps running and its results stay when the user switches tabs and comes back. */
let store: Store = { view: "cofounders", text: { cofounders: "", clients: "" }, results: { cofounders: null, clients: null }, phase: { kind: "idle" }, status: null, loadError: null };
let controller: AbortController | null = null;
const listeners = new Set<() => void>();
const set = (patch: (s: Store) => Partial<Store>) => {
  store = { ...store, ...patch(store) };
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const setResult = (view: View, f: (r: Result | null) => Result | null) => set((s) => ({ results: { ...s.results, [view]: f(s.results[view]) } }));

async function loadStatus() {
  try {
    const r = await fetch("/api/discover", { cache: "no-store" });
    const data = (await r.json()) as { status?: DiscoverStatus; runs?: Record<View, StoredRun | null>; error?: string };
    if (!r.ok || !data.status) throw new Error(data.error ?? `HTTP ${r.status}`);
    set((s) => ({
      status: data.status!,
      loadError: null,
      results: Object.fromEntries(VIEWS.map((v) => [v, s.results[v] ?? (data.runs?.[v] ? { run: data.runs[v]!, cached: true, relevance: data.runs[v]!.relevance } : null)])) as Store["results"],
      text: Object.fromEntries(VIEWS.map((v) => [v, s.text[v] || data.runs?.[v]?.query || ""])) as Store["text"],
    }));
  } catch (e) {
    set(() => ({ loadError: (e as Error).message }));
  }
}

/** One press: one POST, read as NDJSON. The search shows as soon as it arrives; relevance follows or fails on its own. */
async function search(view: View, query: string) {
  controller = new AbortController();
  set(() => ({ phase: { kind: "running", view, step: "search", startedAt: Date.now() } }));
  let failure: string | null = null;
  try {
    const res = await fetch("/api/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ view, query }), signal: controller.signal });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const e = JSON.parse(line) as DiscoverEvent;
        if (e.type === "search") {
          setResult(view, () => ({ run: e.run, cached: e.cached, relevance: e.run.relevance }));
          set(() => ({ phase: { kind: "running", view, step: "relevance", startedAt: store.phase.kind === "running" ? store.phase.startedAt : Date.now() } }));
        }
        if (e.type === "relevance") setResult(view, (r) => r && { ...r, relevance: e.relevance });
        if (e.type === "done" && e.spend) set((s) => ({ status: s.status?.mode === "live" && s.status.ready ? { ...s.status, spend: e.spend! } : s.status }));
        if (e.type === "error") failure = e.message;
      }
    }
    set(() => ({ phase: failure ? { kind: "failed", message: failure } : { kind: "done" } }));
  } catch (e) {
    const aborted = controller?.signal.aborted;
    set(() => ({ phase: aborted ? { kind: "cancelled" } : { kind: "failed", message: (e as Error).message } }));
  } finally {
    controller = null;
  }
}

export function LiveDiscover({ model, lang }: { model: PortfolioModel; lang: Lang }) {
  const s = useSyncExternalStore(subscribe, () => store, () => store);
  const w = UI[lang].discover;
  const L = UI[lang].discoverLive;
  const first = model.person.firstName;
  const tr: Translate = (text) => content(text, lang, false);
  const [selected, setSelected] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [source, setSource] = useState<SourceRequest | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const running = s.phase.kind === "running" ? s.phase : null;

  useEffect(() => {
    void loadStatus();
  }, []);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const view = s.view;
  const text = s.text[view];
  const status = s.status?.mode === "live" ? s.status : null;
  const ready = !!status?.ready;
  const result = s.results[view];
  const locations = [...new Set((result?.run.signals ?? []).flatMap((x) => (x.location ? [x.location] : [])))].sort();
  const filters = { ...NO_FILTERS, location: location && locations.includes(location) ? location : null };
  const verdicts = result ? discover(model, view, result.run.query, filters, result.run.signals) : null;
  const all = verdicts ? [...verdicts.kept, ...verdicts.dropped] : [];
  const current = all.find((v) => v.signal.id === selected) ?? verdicts?.kept[0] ?? null;
  const labels = result?.relevance?.status === "labeled" ? result.relevance.labels : null;
  const canRun = ready && !running && text.trim().length >= 3;
  const time = (at: number) => new Date(at).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" });

  const provenance = (p: CallProvenance, cached: boolean) =>
    [L.live, p.source, p.provider && L.servedBy(p.provider), p.callId && L.call(p.callId), p.costMicro === null ? L.costUnknown : L.cost(usd(p.costMicro)), L.fetched(time(p.at)), cached && L.cached].filter(Boolean).join(" · ");

  const card = (v: Verdict) => {
    const o = v.signal.origin;
    const label = labels?.[v.signal.id];
    return (
      <li key={v.signal.id} className={d.item}>
        <button type="button" className={d.card} aria-pressed={current?.signal.id === v.signal.id} data-kept={String(v.kept)} onClick={() => setSelected(v.signal.id)}>
          <span className={d.name}>{v.signal.name}</span>
          {v.signal.quote && <span className={d.quote}>{v.signal.quote}</span>}
          <span className={d.meta}>
            {o && <span className={d.source}>{o.provider}</span>}
            <span className={d.recency}>{o?.date ?? L.noDate}</span>
            {v.signal.location && <span className={d.recency}>{v.signal.location}</span>}
          </span>
          <span className={d.pills} aria-label={w.checks}>
            {v.checks.map((c) => (
              <span key={c.id} className={d.pill} data-state={c.pass ? "pass" : "fail"}>
                {w.check[c.id]}
                <span className={d.sr}> {w.state[c.pass ? "pass" : "fail"]}</span>
              </span>
            ))}
            {label && (
              <span className={d.pill} data-state="jev">
                Jev · {L.labels[label]}
              </span>
            )}
          </span>
          {v.failed && (
            <span className={d.reason}>
              <span className={d.reasonCheck}>{w.check[v.failed.id]}.</span> <Sentence reason={v.failed.reason} wants={v.signal.wants} lang={lang} tr={tr} first={first} asWritten />
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <div className={d.root} lang={lang}>
      <div className={d.top}>
        <header className={d.head}>
          <div className={d.titleRow}>
            <h2 className={n.heading}>{w.heading}</h2>
            <span className={d.label}>{L.label}</span>
          </div>
          {status?.ready && <p className={n.note}>{L.cap(usd(status.spend.capMicro), usd(status.spend.spentMicro))}</p>}
          <details className={d.how}>
            <summary>{L.how}</summary>
            <ol className={d.rules}>
              {L.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          </details>
        </header>
        <Radios label={w.views} value={view} onChange={(v) => set(() => ({ view: v }))} className={d.views} options={VIEWS.map((v) => ({ value: v, content: w.view[v] }))} />
      </div>

      {status && !status.ready && (
        <section className={d.setup} role="status" aria-labelledby="dv-setup">
          <h3 id="dv-setup" className={d.setupTitle}>
            {L.setupTitle}
          </h3>
          <p className={d.text}>{status.reason}</p>
          <p className={d.text}>{L.setup}</p>
          <p className={n.label}>{L.consent}</p>
        </section>
      )}
      {s.loadError && (
        <p className={d.empty} role="alert">
          {s.loadError}
        </p>
      )}

      <form
        className={d.query}
        onSubmit={(e) => {
          e.preventDefault();
          if (canRun) void search(view, text);
        }}
      >
        <label htmlFor="dv-live-intent" className={d.intentLabel}>
          {w.intent}
        </label>
        <div className={d.intentRow}>
          <textarea
            id="dv-live-intent"
            className={d.intent}
            rows={2}
            maxLength={200}
            value={text}
            placeholder={L.placeholder[view]}
            onChange={(e) => set((st) => ({ text: { ...st.text, [view]: e.target.value } }))}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey) return;
              e.preventDefault();
              if (canRun) void search(view, text);
            }}
          />
          <button type="submit" className={d.run} disabled={!canRun}>
            {L.run}
          </button>
        </div>
        {status?.ready && <p className={n.label}>{L.costNote(usd(status.maxCostMicro[view]))}</p>}
        {locations.length > 0 && (
          <div className={d.filters}>
            <label className={d.location}>
              <span className={n.label}>{w.location}</span>
              <select value={filters.location ?? ""} onChange={(e) => setLocation(e.target.value || null)}>
                <option value="">{w.anyLocation}</option>
                {locations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </form>

      {running && (
        <div className={d.progress} role="status">
          <span>
            {running.view !== view ? L.busyOther : running.step === "search" ? L.searching[running.view] : L.judging} · <span className={d.elapsed}>{Math.max(0, Math.round((now - running.startedAt) / 1000))} s</span>
          </span>
          <button type="button" className={d.skip} onClick={() => controller?.abort()}>
            {L.cancel}
          </button>
          <span className={d.bar} aria-hidden="true" />
          <span className={n.label}>{L.slow}</span>
        </div>
      )}
      {s.phase.kind === "cancelled" && <p className={n.note}>{L.cancelled}</p>}
      {s.phase.kind === "failed" && (
        <p className={d.empty} role="alert">
          {s.phase.message}
        </p>
      )}

      {!result ? (
        ready && !running && <p className={d.empty}>{L.noneYet}</p>
      ) : (
        <>
          <p className={d.provenance}>{provenance(result.run.search, result.cached)}</p>
          <p className={d.provenance}>
            {result.relevance === null
              ? L.relevancePending
              : result.relevance.status === "labeled"
                ? `${L.relevance} · ${provenance(result.relevance.provenance, false)}`
                : result.relevance.status === "failed"
                  ? L.relevanceFailed(result.relevance.message)
                  : result.relevance.reason === "cancelled"
                    ? L.relevanceCancelled
                    : ""}
          </p>
          {verdicts && all.length === 0 ? (
            <p className={d.empty}>{L.miss(result.run.query)}</p>
          ) : (
            verdicts && (
              <div className={d.results}>
                <div className={d.list}>
                  <section className={d.group} aria-labelledby="dv-live-kept">
                    <h3 id="dv-live-kept" className={d.groupTitle}>
                      {w.shortlist(verdicts.kept.length)}
                    </h3>
                    {verdicts.kept.length ? <ol className={d.cards}>{verdicts.kept.map(card)}</ol> : <p className={d.empty}>{w.empty}</p>}
                  </section>
                  {verdicts.dropped.length > 0 && (
                    <section className={d.group} aria-labelledby="dv-live-dropped">
                      <h3 id="dv-live-dropped" className={d.groupTitle}>
                        {w.dropped(verdicts.dropped.length)}
                      </h3>
                      <p className={n.note}>{w.droppedNote}</p>
                      <ol className={d.cards}>{verdicts.dropped.map(card)}</ol>
                    </section>
                  )}
                </div>
                <aside className={d.detail} aria-label={current?.signal.name ?? w.heading}>
                  {current ? (
                    <LiveDetail
                      v={current}
                      model={model}
                      lang={lang}
                      tr={tr}
                      label={labels?.[current.signal.id] ?? null}
                      origin={provenance(result.run.search, result.cached)}
                      copied={copied === `${current.signal.id}:${lang}`}
                      onCopied={() => setCopied(`${current.signal.id}:${lang}`)}
                      onOpen={(sourceId, quote) => setSource({ sourceId, quote })}
                    />
                  ) : (
                    <p className={n.note}>{w.select}</p>
                  )}
                </aside>
              </div>
            )
          )}
        </>
      )}
      {source && <SourceDialog req={source} onClose={() => setSource(null)} />}
    </div>
  );
}

function LiveDetail({
  v,
  model,
  lang,
  tr,
  label,
  origin,
  copied,
  onCopied,
  onOpen,
}: {
  v: Verdict;
  model: PortfolioModel;
  lang: Lang;
  tr: Translate;
  label: RelevanceLabel | null;
  origin: string;
  copied: boolean;
  onCopied: () => void;
  onOpen: (sourceId: string, quote: string) => void;
}) {
  const w = UI[lang].discover;
  const L = UI[lang].discoverLive;
  const first = model.person.firstName;
  const s = v.signal;
  const proof = v.backing.flatMap((b) => b.proof);
  const why = v.checks.filter((c) => c.pass && c.id !== "filters");
  const draft = s.draft?.[lang] ?? null;
  const copy = () =>
    draft &&
    navigator.clipboard
      ?.writeText(draft)
      .then(onCopied)
      .catch(() => {});

  return (
    <div className={d.detailBody}>
      <header className={d.detailHead}>
        <p className={d.detailName}>{s.name}</p>
        {s.quote && <p className={d.detailLine}>{s.quote}</p>}
        {s.origin && (
          <a className={d.open} href={s.origin.url} target="_blank" rel="noreferrer noopener">
            {L.open[s.origin.kind]}
          </a>
        )}
        {v.failed && (
          <p className={d.reason}>
            <span className={d.reasonCheck}>{w.check[v.failed.id]}.</span> <Sentence reason={v.failed.reason} wants={s.wants} lang={lang} tr={tr} first={first} asWritten />
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

      <section className={d.section} aria-labelledby="dv-live-bring">
        <h4 id="dv-live-bring" className={d.sectionTitle}>
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
        <section className={d.section} aria-labelledby="dv-live-why">
          <h4 id="dv-live-why" className={d.sectionTitle}>
            {w.why}
          </h4>
          <ul className={n.plain}>
            {why.map((c) => (
              <li key={c.id}>
                <Sentence reason={c.reason} wants={s.wants} lang={lang} tr={tr} first={first} asWritten />
                {c.reason.kind === "complement" && (
                  <ul className={d.covers}>
                    <li>
                      <Names names={c.reason.covers} tr={tr} />
                    </li>
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={d.section} aria-labelledby="dv-live-jev">
        <h4 id="dv-live-jev" className={d.sectionTitle}>
          {L.relevance}
        </h4>
        <p className={d.text}>{label ? `${L.labels[label]}. ${L.reasons[label]}` : L.relevancePending}</p>
        <p className={n.label}>{L.jevNote}</p>
      </section>

      <section className={d.section} aria-labelledby="dv-live-unknown">
        <h4 id="dv-live-unknown" className={d.sectionTitle}>
          {w.unknown}
        </h4>
        <ul className={n.plain}>
          {s.unknowns.map((u) => (
            <li key={u.en}>{u[lang]}</li>
          ))}
        </ul>
      </section>

      {v.kept && draft && (
        <section className={d.section} aria-labelledby="dv-live-draft">
          <div className={n.draftHead}>
            <h4 id="dv-live-draft" className={d.sectionTitle}>
              {w.draft}
            </h4>
            <button type="button" className={n.copy} onClick={copy}>
              {copied ? UI[lang].next.copied : UI[lang].next.copy}
            </button>
          </div>
          <p className={d.draft}>{draft}</p>
          <p className={n.label}>{w.draftNote}</p>
        </section>
      )}

      <section className={d.section} aria-labelledby="dv-live-origin">
        <h4 id="dv-live-origin" className={d.sectionTitle}>
          {L.origin}
        </h4>
        <p className={d.provenance}>{origin}</p>
        <p className={d.provenance}>{s.origin?.date ?? L.noDate}</p>
      </section>
    </div>
  );
}
