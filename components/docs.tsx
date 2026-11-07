import type { AttorneyView, PortfolioView, ResolvedCapability } from "@/lib/views/project";
import styles from "./docs.module.css";

export type OpenSource = (sourceId: string, quote: string) => void;

export const SUPPORT_WORD = { demonstrated: "Shown in the work", inferred: "Likely, not proven", unknown: "Not shown yet" } as const;
const STATE_WORD: Record<string, string> = {
  fetched: "A source says it",
  corroborated: "Two independent sources",
  user_attested: "Only the builder says it",
  unverified: "No support",
};
const ATTRIBUTION_WORD: Record<string, string> = {
  author: "Author",
  co_author: "Co-author",
  contributor: "Contributor",
  reviewer: "Reviewer",
  unknown: "Attribution unknown",
};

export function SupportMark({ support }: { support: keyof typeof SUPPORT_WORD }) {
  return (
    <span className={`${styles.support} ${styles[support]}`} data-support-word={support}>
      {SUPPORT_WORD[support]}
    </span>
  );
}

export function stateWord(s: string) {
  return STATE_WORD[s] ?? s;
}
export function attributionWord(a: string) {
  return ATTRIBUTION_WORD[a] ?? a;
}

function Quote({ e, onOpen }: { e: { sourceId: string; quote: string; locator: string; sourceUrl: string }; onOpen?: OpenSource }) {
  const body = (
    <>
      <span className={styles.quoteText}>{e.quote}</span>
      <span className={styles.quoteSource}>{e.sourceUrl.replace(/^example:\/\/rin\//, "")}</span>
    </>
  );
  return onOpen ? (
    <button type="button" className={styles.quote} onClick={() => onOpen(e.sourceId, e.quote)} aria-label={`Open source ${e.locator}: ${e.quote}`}>
      {body}
    </button>
  ) : (
    <span className={styles.quote}>{body}</span>
  );
}

function CapabilityBlock({ c, onOpen, compact }: { c: ResolvedCapability; onOpen?: OpenSource; compact?: boolean }) {
  return (
    <article className={`${styles.cap} rise`} data-support={c.support} key={`${c.key}-${c.support}-${c.name}`}>
      <div className={styles.capHead}>
        <SupportMark support={c.support} />
        <h4 className={styles.capName}>{c.name}</h4>
      </div>
      {c.evidence.length > 0 && (
        <div className={styles.quotes}>
          {c.evidence.slice(0, compact ? 2 : 6).map((e) => (
            <Quote key={e.id} e={e} onOpen={onOpen} />
          ))}
        </div>
      )}
      {c.limits.length > 0 && (
        <ul className={styles.limits}>
          {c.limits.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function PortfolioDoc({ view, onOpen, compact }: { view: PortfolioView; onOpen?: OpenSource; compact?: boolean }) {
  return (
    <div className={styles.doc} data-doc="portfolio">
      <header className={styles.docHead}>
        {view.example && <span className="example-flag">EXAMPLE</span>}
        <h3 className={styles.docTitle}>{view.person.name}</h3>
        <p className="muted small">Client portfolio. Built from ledger revision {view.ledgerRevision}.</p>
      </header>
      {view.goal ? (
        <section className={styles.block}>
          <p className={styles.goal}>
            For <strong>{view.goal}</strong>, you can entrust:
          </p>
          {view.capabilities.length ? (
            view.capabilities.map((c) => <CapabilityBlock key={`${c.key}-${c.support}-${c.name}`} c={c} onOpen={onOpen} compact={compact} />)
          ) : (
            <p className="muted">Nothing yet. No capability is shown without evidence.</p>
          )}
          {view.question && <p className={styles.question}>Open question: {view.question}</p>}
        </section>
      ) : (
        <p className="muted">No goal asked yet.</p>
      )}
      {!compact && (
        <section className={styles.block}>
          <h4 className={styles.blockTitle}>Work, as the sources show it</h4>
          {view.projects.map((p) => (
            <div key={p.title} className={styles.project}>
              <p className={styles.projectTitle}>
                {p.title} <span className="muted">{p.role}</span>
              </p>
              <ul className={styles.claimList}>
                {p.claims.map((c) => (
                  <li key={c.id}>
                    {c.text} <span className="muted small">({attributionWord(c.attribution)}. {stateWord(c.state)})</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export function AttorneyDoc({ view, onOpen, compact }: { view: AttorneyView; onOpen?: OpenSource; compact?: boolean }) {
  return (
    <div className={`${styles.doc} ${styles.dossier}`} data-doc="attorney">
      <header className={styles.docHead}>
        {view.example && <span className="example-flag">EXAMPLE</span>}
        <h3 className={styles.docTitle}>{view.person.name}</h3>
        <p className="muted small">Private attorney-review dossier. Ledger revision {view.ledgerRevision}.</p>
        <p className={styles.disclaimer}>Attorney review needed. {view.disclaimer}</p>
      </header>

      <section className={styles.block}>
        <h4 className={styles.blockTitle}>Capabilities for the stated goal</h4>
        {view.goal && <p className="small muted">Goal: {view.goal}</p>}
        {view.capabilities.map((c) => (
          <CapabilityBlock key={`${c.key}-${c.support}-${c.name}`} c={c} onOpen={onOpen} compact={compact} />
        ))}
        {view.withdrawn.length > 0 && (
          <div className={`${styles.withdrawn} rise`}>
            <p className={styles.withdrawnTitle}>Withdrawn after human review</p>
            <ul>
              {view.withdrawn.map((w) => (
                <li key={w.name}>
                  <s>{w.name}</s>. {w.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {view.gaps.length > 0 && (
        <section className={styles.block}>
          <h4 className={styles.blockTitle}>Gaps in the evidence</h4>
          <ul className={styles.questions}>
            {view.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.block}>
        <h4 className={styles.blockTitle}>Questions for your attorney</h4>
        <ol className={styles.questions}>
          {view.questions.slice(0, compact ? 3 : undefined).map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </section>

      {!compact && (
        <>
          <section className={styles.block}>
            <h4 className={styles.blockTitle}>Contributions and their sources</h4>
            {view.projects.map((p) => (
              <div key={p.title} className={styles.project}>
                <p className={styles.projectTitle}>
                  {p.title} <span className="muted">{p.role}</span>
                </p>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Claim</th>
                      <th>Attribution</th>
                      <th>State</th>
                      <th>Rev</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.claims.map((c) => (
                      <tr key={c.id}>
                        <td>
                          {c.text}
                          {c.attributionNote && <span className="muted small"> {c.attributionNote}</span>}
                          <div className={styles.quotesInline}>
                            {c.evidence.map((e) => (
                              <Quote key={e.id} e={e} onOpen={onOpen} />
                            ))}
                          </div>
                        </td>
                        <td>{attributionWord(c.attribution)}</td>
                        <td>{stateWord(c.state)}</td>
                        <td className={styles.num}>{c.revision}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(p.report?.heldBack.length || p.report?.discarded.length) ? (
                  <p className="small muted">
                    Held back by the rules:{" "}
                    {[...(p.report?.heldBack ?? []), ...(p.report?.discarded ?? [])].map((h) => `"${h.text}" (${h.reason})`).join(" ")}
                  </p>
                ) : null}
                <p className="small muted">
                  Sources: {p.sources.map((s) => `${s.locator} (${s.status}, fetched ${new Date(s.fetchedAt).toISOString().slice(0, 10)}, hash ${s.contentHash.slice(0, 8)})`).join("; ")}
                </p>
              </div>
            ))}
          </section>

          {view.attorneyAttention.length > 0 && (
            <section className={styles.block}>
              <h4 className={styles.blockTitle}>Flagged for attorney attention (suggestions only)</h4>
              <ul>
                {view.attorneyAttention.map((a) => (
                  <li key={a.claimId}>
                    {a.text}. {a.suggestion}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={styles.block}>
            <h4 className={styles.blockTitle}>Review log</h4>
            {view.reviewLog.length ? (
              <ul className={styles.log}>
                {view.reviewLog.map((r) => (
                  <li key={r.id}>
                    Rev {r.ledgerRevision}. {r.action.replace("_", " ")}
                    {r.before && "text" in r.before && r.after && "text" in r.after && r.before.text !== r.after.text
                      ? `: "${String(r.before.text)}" became "${String(r.after.text)}"`
                      : r.after && "text" in r.after
                        ? `: "${String(r.after.text)}"`
                        : ""}
                    {r.note ? `. Note: ${r.note}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No reviews yet.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
