import type { Opportunity } from "@/lib/opportunities";
import { SupportMark } from "./docs";
import s from "./studio.module.css";

/** Fictional EXAMPLE employers only. Real employer records, if ever added, belong in a visually separate panel and never in the claims ledger. */
export function Opportunities({ items, onOpen }: { items: Opportunity[]; onOpen?: (sourceId: string, quote: string) => void }) {
  return (
    <div className={s.opps}>
      <p className={s.oppNotice}>
        Not legal advice. Historical filings ≠ current policy. One role&apos;s sponsorship ≠ all visa types. Fictional EXAMPLE employers. No job or visa outcome is implied.
      </p>
      {items.map((o) => (
        <article key={o.id} className={s.opp} data-signal={o.signalType}>
          <h3 className={s.oppCompany}>
            {o.company} <span className="muted">{o.role}</span>
          </h3>
          <dl className={s.oppFacts}>
            <dt>Entity</dt>
            <dd>{o.entityName ?? "unknown"}</dd>
            <dt>Location</dt>
            <dd>{o.location ?? "unknown"}</dd>
            <dt>Signal</dt>
            <dd data-testid="signal" data-signal-type={o.signalType}>
              {o.signal.label}
            </dd>
            <dt>Status</dt>
            <dd>{o.status ?? "unknown"}</dd>
            <dt>Retrieved</dt>
            <dd>{o.retrieved ?? "unknown"}</dd>
            <dt>Source</dt>
            <dd>{o.id}</dd>
          </dl>
          {o.snippet ? <p className={s.oppSnippet}>“{o.snippet}”</p> : <p className="muted">Snippet: unknown</p>}
          <p className="small muted">{o.signal.caveat}</p>
          <div className={s.oppFit}>
            <p className={s.oppFitTitle}>What Rin could contribute here (a proposal)</p>
            {o.fit.length > 0 ? (
              <ul>
                {o.fit.map((f) => (
                  <li key={f.name}>
                    <SupportMark support={f.support} /> {f.name}
                    <span className={s.evidenceIds}>
                      Evidence{" "}
                      {f.evidence.map((e) =>
                        onOpen ? (
                          <button key={e.id} type="button" className="link-button small" onClick={() => onOpen(e.sourceId, e.quote)} title={`${e.projectTitle}, ${e.locator}: ${e.quote}`}>
                            {e.id}
                          </button>
                        ) : (
                          <span key={e.id} className="small">
                            {e.id}
                          </span>
                        ),
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">None of the evidenced capabilities match this role.</p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
