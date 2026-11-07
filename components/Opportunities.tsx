import type { Opportunity } from "@/lib/opportunities";
import { OPPORTUNITY_NOTICE } from "@/lib/signals";
import s from "./studio.module.css";

export function Opportunities({ items }: { items: Opportunity[] }) {
  return (
    <aside className={s.opps} aria-labelledby="opps-title">
      <h3 id="opps-title" className={s.h3}>
        Where this work could go
      </h3>
      <p className="small">{OPPORTUNITY_NOTICE} Historical filings ≠ current policy. One role&apos;s sponsorship ≠ all visa types.</p>
      {items.map((o) => (
        <div key={o.id} className={s.opp} data-signal={o.signalType}>
          <p className={s.oppCompany}>
            {o.company} <span className="muted">{o.role}</span>
          </p>
          <dl className={s.oppFacts}>
            <dt>Entity</dt>
            <dd>{o.entityName ?? "unknown"}</dd>
            <dt>Location</dt>
            <dd>{o.location ?? "unknown"}</dd>
            <dt>Signal</dt>
            <dd data-testid="signal">{o.signal.label}</dd>
            <dt>Status</dt>
            <dd>{o.status ?? "unknown"}</dd>
            <dt>Retrieved</dt>
            <dd>{o.retrieved ?? "unknown"}</dd>
            <dt>Source</dt>
            <dd className="small">{o.id}</dd>
          </dl>
          {o.snippet && <p className={s.oppSnippet}>“{o.snippet}”</p>}
          <p className="small muted">{o.signal.caveat}</p>
          {o.fit.length > 0 ? (
            <p className="small">
              Proposed fit: {o.fit.map((f) => `${f.name} (${f.support}, ${f.evidenceIds.length} evidence)`).join("; ")}.
            </p>
          ) : (
            <p className="small muted">Proposed fit: none of the evidenced capabilities match this role.</p>
          )}
        </div>
      ))}
    </aside>
  );
}
