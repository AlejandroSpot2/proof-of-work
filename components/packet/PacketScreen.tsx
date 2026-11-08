import type { ReactNode } from "react";
import { getDb } from "@/lib/db/client";
import { buildPacket, type Classification, type Packet, type PageMap } from "@/lib/packet/model";
import { packetFor, pdfFilename } from "@/lib/packet/pdf";
import { noticeFor, PARTS, PROJECTS_ALONE, QUESTIONS_NOTE, TITLE, checklistCounts, renderPacketBody, subtitle } from "@/components/packet/document";
import { PACKET_CSS } from "@/components/packet/styles";
import s from "./screen.module.css";

const Ids = ({ ids }: { ids: string[] }) => <span className={s.ids}>{ids.join(", ")}</span>;

const Tag = ({ c }: { c: Classification | "Shared work" }) => <span className={`${s.tag} ${c === "Shared work" ? s.tagMuted : ""}`}>{c}</span>;

function Part({ index, summary, pages, open, children }: { index: number; summary: string; pages: PageMap | null; open?: boolean; children: ReactNode }) {
  const part = PARTS[index]!;
  const page = pages?.[part.anchor];
  return (
    <details className={s.part} open={open}>
      <summary className={s.summary}>
        <span className={s.partNo}>{part.number}</span>
        <span className={s.partText}>
          <span className={s.partTitle}>{part.title}</span>
          <span className={s.partLine}>{summary}</span>
        </span>
        {page ? <span className={s.page}>Page {page}</span> : null}
        <span className={s.chev} aria-hidden="true" />
      </summary>
      <div className={s.body}>{children}</div>
    </details>
  );
}

function OnePage({ p }: { p: Packet }) {
  return (
    <>
      <dl className={s.facts}>
        <div>
          <dt>Name</dt>
          <dd>{p.person.name}</dd>
        </div>
        {p.person.role && (
          <div>
            <dt>Role</dt>
            <dd>{p.person.role}</dd>
          </div>
        )}
        <div>
          <dt>Handle in the records</dt>
          <dd className={s.mono}>{p.person.handle}</dd>
        </div>
      </dl>
      <h3 className={s.h3}>Objective</h3>
      <p className={s.prose}>{p.objective}</p>
      <h3 className={s.h3}>Main contributions</h3>
      <div className={s.groups}>
        {p.projects.map((x) => (
          <div key={x.anchor} className={s.group}>
            <p className={s.groupName}>
              {x.title}
              <span>{x.role ?? "Role unknown"}</span>
            </p>
            <ul className={s.lines}>
              {p.contributions
                .filter((c) => c.project === x.title)
                .map((c) => (
                  <li key={c.text}>
                    <span>{c.text}</span>
                    <Ids ids={c.exhibitIds} />
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <h3 className={s.h3}>What the record does and does not show</h3>
      <ul className={s.record}>
        {p.recordLines.map((l) => (
          <li key={l.text} className={l.shows ? "" : s.recordNo}>
            <span className={s.recordKey}>{l.shows ? "Shows" : "Does not show"}</span>
            <span>{l.text}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Dossier({ p }: { p: Packet }) {
  return (
    <>
      {p.projects.map((x) => (
        <section key={x.anchor} className={s.project}>
          <header className={s.projectHead}>
            <h3>{x.title}</h3>
            <span>Role recorded: {x.role ?? "unknown"}</span>
          </header>
          <p className={s.scope}>{x.rinScope}</p>
          <ul className={s.stmts}>
            {x.statements.map((st) => (
              <li key={st.id}>
                <span className={s.stmtText}>{st.text}</span>
                <span className={s.stmtMeta}>
                  <Tag c={st.classification} />
                  {st.shared && <Tag c="Shared work" />}
                  <Ids ids={[...new Set(st.citations.map((c) => c.exhibitId))]} />
                </span>
              </li>
            ))}
          </ul>
          {x.others.length > 0 && (
            <p className={s.others}>
              Others&apos; part: {x.others.length} {x.others.length === 1 ? "entry" : "entries"} by {[...new Set(x.others.map((o) => o.who))].join(", ")}, listed in the PDF and not counted as Rin&apos;s.
            </p>
          )}
        </section>
      ))}
      <h3 className={s.h3}>Limits</h3>
      <ul className={s.bullets}>
        {p.limits.map((l) => (
          <li key={l}>{l}</li>
        ))}
        <li>Nothing in the record shows the projects in production, with real users or with real data.</li>
      </ul>
      <h3 className={s.h3}>Evidence index</h3>
      <ol className={s.index}>
        {p.exhibits.map((e) => (
          <li key={e.id}>
            <span className={s.mono}>{e.id}</span>
            <span>{e.title}</span>
            <span className={s.muted}>{e.classification}</span>
          </li>
        ))}
      </ol>
      <p className={`${s.muted} ${s.after}`}>
        {p.chronology.length} dated events from {p.chronology[0]?.date ?? "unknown"} to {p.chronology.at(-1)?.date ?? "unknown"} are listed in the chronology of the PDF.
      </p>
    </>
  );
}

function Missing({ p }: { p: Packet }) {
  const groups = [
    { title: "From the record", items: p.checklist.filter((c) => c.scope === "record") },
    { title: "Outside the projects", items: p.checklist.filter((c) => c.scope === "outside") },
  ];
  return (
    <>
      <p className={s.alone}>
        {PROJECTS_ALONE}
        <span>Bring each item if relevant. Nothing here is a form to fill in, and nothing outside the projects is stored in this tool.</span>
      </p>
      {groups.map((g) => (
        <div key={g.title}>
          <h3 className={s.h3}>{g.title}</h3>
          <ul className={s.checklist}>
            {g.items.map((c) => (
              <li key={c.item}>
                <span className={s.box} aria-hidden="true" />
                <span className={`${s.prio} ${c.priority === "High" ? s.prioHigh : c.priority === "Low" ? s.prioLow : ""}`}>{c.priority}</span>
                <span className={s.item}>
                  <strong>{c.item}</strong>
                  <span>{c.why}</span>
                </span>
                <span className={s.status}>
                  <strong>{c.status}</strong>
                  <span>Who: {c.who}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

function Questions({ p }: { p: Packet }) {
  return (
    <>
      <p className={s.muted}>{QUESTIONS_NOTE} The PDF leaves ruled lines under each one, and a notes page, for the meeting.</p>
      <ol className={s.questions}>
        {p.questions.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ol>
    </>
  );
}

/** The kit on screen: the four parts as expandable sections built from the same model as the PDF, then the typeset pages themselves. */
export async function PacketScreen({ workspaceId, downloadHref, leading }: { workspaceId: string; downloadHref: string; leading?: ReactNode }) {
  const db = getDb();
  const rendered = await packetFor(db, workspaceId)?.catch((err: unknown) => {
    console.error("kit render failed", err);
    return null;
  });
  const packet = rendered?.packet ?? buildPacket(db, workspaceId);
  if (!packet) return null;
  const pages = rendered?.pages ?? null;
  const { total, high } = checklistCounts(packet);
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  return (
    <main className={s.screen}>
      <header className={s.bar}>
        {leading}
        <span className={s.barTitle}>{TITLE}</span>
        <span className={s.spacer} />
        <a className={s.download} href={downloadHref} download={pdfFilename(packet)}>
          Download PDF
        </a>
      </header>
      <div className={s.wrap}>
        <section className={s.hero}>
          <h1>{TITLE}</h1>
          <p className={s.sub}>{subtitle(packet)}</p>
          <p className={s.meta}>
            <span className={s.mono}>{packet.generated}</span>
            <span>{rendered ? `${rendered.pageCount} pages, Letter` : "Page count unavailable"}</span>
            <span>Draft for attorney review. Not ready to file.</span>
          </p>
          <p className={s.notice}>{noticeFor(packet)}</p>
          {!rendered && <p className={s.notice}>Page numbers are not available because the PDF renderer could not start. The download may fail too.</p>}
        </section>
        <div className={s.parts}>
          <Part index={0} pages={pages} open summary="Profile, objective, main contributions, and what the record does and does not show.">
            <OnePage p={packet} />
          </Part>
          <Part index={1} pages={pages} summary={`${n(packet.summary.statements, "contribution", "contributions")}, ${n(packet.summary.exhibits, "exhibit", "exhibits")}`}>
            <Dossier p={packet} />
          </Part>
          <Part index={2} pages={pages} summary={`${n(total, "item", "items")} to gather, ${high} high priority`}>
            <Missing p={packet} />
          </Part>
          <Part index={3} pages={pages} summary={n(packet.questions.length, "question", "questions")}>
            <Questions p={packet} />
          </Part>
          <details className={s.part}>
            <summary className={s.summary}>
              <span className={s.partNo}>PDF</span>
              <span className={s.partText}>
                <span className={s.partTitle}>Full document pages</span>
                <span className={s.partLine}>
                  {rendered ? `${rendered.pageCount} typeset pages` : "The typeset pages"}, including the annexes with each source file and its highlighted passages
                </span>
              </span>
              <span className={s.chev} aria-hidden="true" />
            </summary>
            <div className={s.pages}>
              <style dangerouslySetInnerHTML={{ __html: PACKET_CSS }} />
              <div dangerouslySetInnerHTML={{ __html: renderPacketBody(packet, pages) }} />
            </div>
          </details>
        </div>
      </div>
    </main>
  );
}
