import type { ChecklistItem, Citation, Classification, Exhibit, ExcerptLine, Packet, PageMap, Statement } from "@/lib/packet/model";
import { CLASSIFICATION_MEANING } from "@/lib/packet/model";

/**
 * The kit as one HTML string, used both for the typeset pages on screen and for the PDF.
 * Plain strings rather than React: the PDF route renders it without react-dom/server, and the preview injects the same markup.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const TITLE = "First Consultation Kit";
export const RUNNING_HEAD = "First Consultation Kit · Draft for attorney review";
export const NOTICE = "Synthetic EXAMPLE material. Not legal advice. No eligibility assessment.";
export const QUESTIONS_NOTE = "Suggestions to bring to the meeting. They are not advice and not an eligibility decision.";
export const PROJECTS_ALONE = "Projects alone do not decide any visa question.";

export const subtitle = (p: Packet) => `Prepared by ${p.person.name} for a first meeting with an immigration attorney`;

export type Section = { anchor: string; number: string; title: string; children?: Section[] };

export const PARTS: Section[] = [
  { anchor: "part-summary", number: "Part 1", title: "One-page summary" },
  {
    anchor: "part-dossier",
    number: "Part 2",
    title: "Dossier",
    children: [
      { anchor: "sec-contributions", number: "2.1", title: "Contributions per project" },
      { anchor: "sec-impact", number: "2.2", title: "Impact and limits" },
      { anchor: "sec-chronology", number: "2.3", title: "Chronology" },
      { anchor: "sec-index", number: "2.4", title: "Evidence index" },
    ],
  },
  { anchor: "part-missing", number: "Part 3", title: "What is missing" },
  { anchor: "part-questions", number: "Part 4", title: "Questions and notes for the consult" },
];

const SUB = Object.fromEntries(PARTS.flatMap((p) => p.children ?? []).map((s) => [s.anchor, s])) as Record<string, Section>;

/** Text each anchor's heading prints, in document order, so the PDF pass can find the page it landed on. */
export function headingMarks(p: Packet): { anchor: string; text: string }[] {
  return [
    ...PARTS.flatMap((s) => [s, ...(s.children ?? [])]).map((s) => ({ anchor: s.anchor, text: `${s.number}${s.title}` })),
    ...p.exhibits.map((e) => ({ anchor: e.anchor, text: `Annex${e.id}` })),
  ];
}

const pn = (pages: PageMap | null, anchor: string) => `<span class="pn">${pages?.[anchor] ?? "00"}</span>`;

const clsTag = (c: Classification) => `<span class="cls cls-${c.toLowerCase().replace(/[^a-z]+/g, "-")}">${esc(c)}</span>`;

const exLink = (id: string) => `<a class="exl" href="#ex-${id}">${id}</a>`;

function ref(c: Citation, pages: PageMap | null) {
  return `<a class="ref" href="#ex-${c.exhibitId}">Ex.&nbsp;<span class="refid">${c.exhibitId}</span></a><span class="refloc">, line ${c.line}, p.&nbsp;${pn(pages, `ex-${c.exhibitId}`)}</span>`;
}

function head(s: Section, lead?: string) {
  return `<header class="sh"><h1 id="${s.anchor}"><span class="sn">${s.number}</span>${esc(s.title)}</h1>${lead ? `<p class="lead">${lead}</p>` : ""}</header>`;
}

const MARKS = (Object.keys(CLASSIFICATION_MEANING) as (keyof typeof CLASSIFICATION_MEANING)[]).map(
  (k) => `<tr><td>${clsTag(k)}</td><td>${esc(CLASSIFICATION_MEANING[k])}</td></tr>`,
);
const LEGEND = `<table class="legend"><tbody>${MARKS.join("")}<tr><td><span class="cls cls-synthetic">Synthetic EXAMPLE</span></td><td>Everything in this kit. Rin Okafor is a fictional builder and every file is synthetic, written for a demo.</td></tr></tbody></table>`;

const PART_BLURB: Record<string, string> = {
  "part-summary": "Profile, objective, main contributions, and what the record does and does not show.",
  "part-dossier": "Contributions per project with attribution, impact and limits, chronology, evidence index.",
  "part-missing": "A prioritized checklist of what still needs gathering, inside and outside the projects.",
  "part-questions": "Suggested questions, with room for notes during the meeting.",
};

function cover(p: Packet, pages: PageMap | null) {
  const meta: [string, string][] = [
    ["Prepared by", esc(p.person.name)],
    ["Date", `<span class="mono">${p.generated}</span>`],
    ["Projects", esc(p.projects.map((x) => x.title).join(", "))],
    ["Exhibits", `${p.summary.exhibits}, <span class="mono">E-01</span> to <span class="mono">${p.exhibits.at(-1)?.id ?? "E-00"}</span>`],
    ["Statements confirmed", `${p.summary.statements}`],
    ["Record revision", `<span class="mono">${p.ledgerRevision}</span>`],
  ];
  return `<section class="sheet cover">
  <div class="cover-top"><span>A draft for an attorney to review. Not ready to file.</span><span class="mono">${p.generated}</span></div>
  <div class="cover-main">
    <h1 class="cover-title">${TITLE}</h1>
    <p class="cover-sub">${esc(subtitle(p))}</p>
    <dl class="cover-meta">${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
  </div>
  <ol class="cover-parts">${PARTS.map(
    (s) => `<li><a href="#${s.anchor}"><span class="cp-n">${s.number}</span><span class="cp-t"><strong>${esc(s.title)}</strong><span>${PART_BLURB[s.anchor]}</span></span>${pn(pages, s.anchor)}</a></li>`,
  ).join("")}<li><a href="#${p.exhibits[0]?.anchor ?? ""}"><span class="cp-n">Annexes</span><span class="cp-t"><strong>Source excerpts</strong><span>The literal text of each exhibit, with the quoted passages highlighted.</span></span>${pn(pages, p.exhibits[0]?.anchor ?? "")}</a></li></ol>
  <div class="cover-foot">
    <p class="legend-title">How each statement and exhibit is marked</p>
    ${LEGEND}
    <p class="notice">${NOTICE}</p>
  </div>
</section>`;
}

function contents(p: Packet, pages: PageMap | null) {
  const row = (anchor: string, num: string, title: string, cls = "") =>
    `<li class="${cls}"><a href="#${anchor}"><span class="tn">${num}</span><span class="tt">${esc(title)}</span><span class="dots"></span>${pn(pages, anchor)}</a></li>`;
  return `<section class="sheet toc">
  <header class="sh"><h1 id="sec-contents">Contents</h1></header>
  <ol class="toc-list">${PARTS.map((s) => row(s.anchor, s.number, s.title, "toc-part") + (s.children ?? []).map((c) => row(c.anchor, c.number, c.title, "toc-sub")).join("")).join("")}</ol>
  <p class="toc-group">Annexes. Literal source excerpts, one per exhibit</p>
  <ol class="toc-list toc-annex">${p.exhibits.map((e) => row(e.anchor, e.id, e.title)).join("")}</ol>
</section>`;
}

function onePage(p: Packet, pages: PageMap | null) {
  const byProject = p.projects.map((x) => ({ x, items: p.contributions.filter((c) => c.project === x.title) }));
  return `<section class="sheet one">
  ${head(PARTS[0]!, "The kit on one page, for a first look before the meeting.")}
  <dl class="facts">
    <div><dt>Name</dt><dd>${esc(p.person.name)}</dd></div>
    ${p.person.role ? `<div><dt>Role</dt><dd>${esc(p.person.role)}</dd></div>` : ""}
    <div><dt>Handle in the records</dt><dd class="mono">${esc(p.person.handle)}</dd></div>
  </dl>
  ${p.person.bio ? `<p class="prose bio">${esc(p.person.bio)}</p>` : ""}
  <h2>Objective</h2>
  <p class="prose">${esc(p.objective)}</p>
  <h2>Main contributions</h2>
  <div class="contribs">${byProject
    .map(
      ({ x, items }) => `<div class="cg"><p class="cg-name">${esc(x.title)}<span>${esc(x.role ?? "Role unknown")}</span></p><ul>${items
        .map((c) => `<li><span class="ct">${esc(c.text)}</span><span class="cr">${c.exhibitIds.map(exLink).join(", ")}</span></li>`)
        .join("")}</ul></div>`,
    )
    .join("")}</div>
  <h2>What the record does and does not show</h2>
  <ul class="record">${p.recordLines.map((l) => `<li class="${l.shows ? "yes" : "no"}"><span class="rk">${l.shows ? "Shows" : "Does not show"}</span><span>${esc(l.text)}</span></li>`).join("")}</ul>
  <p class="note">Details and sources in Part 2 from page ${pn(pages, "part-dossier")}. What still needs gathering in Part 3 on page ${pn(pages, "part-missing")}.</p>
</section>`;
}

function dossierOpener(p: Packet) {
  const rows = p.projects
    .map(
      (x) =>
        `<tr><td class="strong">${esc(x.title)}</td><td>${esc(x.role ?? "unknown")}</td><td>${esc(x.summary ?? "")}</td><td class="nowrap">${exLink(x.exhibitIds[0]!)} to ${exLink(x.exhibitIds.at(-1)!)}</td></tr>`,
    )
    .join("");
  return `<section class="sheet">
  ${head(PARTS[1]!, "The record behind Part 1: what Rin did, what others did, and the passage that backs each line.")}
  <h2>Projects in this dossier</h2>
  <table class="grid"><thead><tr><th>Project</th><th>Role recorded</th><th>What it is</th><th>Exhibits</th></tr></thead><tbody>${rows}</tbody></table>
  <h2>How evidence is marked</h2>
  ${LEGEND}
  <p class="prose spaced">Each statement was confirmed by Rin and is tied to a literal passage in a file. A statement is <em>Independent</em> only when two separate origins back it. Files from Rin's own project repositories, including her commits, pull requests and notes, are <em>Repository records</em>. Anything that rests on Rin's word alone is <em>Self-attested</em>. Work by other people is listed under each project and is never counted as Rin's.</p>
</section>`;
}

function statement(st: Statement, pages: PageMap | null) {
  return `<li class="stmt">
    <div class="stmt-head"><p class="stmt-text">${esc(st.text)}</p><div class="stmt-tags">${clsTag(st.classification)}${st.shared ? `<span class="cls cls-shared">Shared work</span>` : ""}</div></div>
    ${st.attributionNote ? `<p class="note">${esc(st.attributionNote)}</p>` : ""}
    <ul class="cites">${st.citations.map((c) => `<li><q>${esc(c.quote)}</q><span class="cite">${ref(c, pages)}</span></li>`).join("")}</ul>
  </li>`;
}

function contributions(p: Packet, pages: PageMap | null) {
  const projects = p.projects
    .map(
      (x, i) => `<article class="proj" id="${x.anchor}">
    <h2 class="proj-title"><span class="sn">2.1.${i + 1}</span>${esc(x.title)}<span class="proj-role">Role recorded: ${esc(x.role ?? "unknown")}</span></h2>
    ${x.summary ? `<p class="prose">${esc(x.summary)}</p>` : ""}
    <p class="scope">${esc(x.rinScope)}</p>
    <h3>Rin's part</h3>
    <ol class="stmts">${x.statements.map((s) => statement(s, pages)).join("")}</ol>
    <h3>Others' part</h3>
    ${
      x.others.length
        ? `<table class="grid others"><thead><tr><th>Date</th><th>Who</th><th>What the record shows</th><th>Source</th></tr></thead><tbody>${x.others
            .map(
              (o) =>
                `<tr><td class="mono nowrap">${o.date ?? "unknown"}</td><td class="mono nowrap">${esc(o.who)}</td><td>${esc(o.what)}</td><td class="nowrap">${ref(o.citation, pages)}</td></tr>`,
            )
            .join("")}</tbody></table>`
        : `<p class="note">The record names no one else's work on ${esc(x.title)}.</p>`
    }
    ${
      x.fileStatements.length
        ? `<p class="files-say">Project files also state: ${x.fileStatements.map((c) => `<q>${esc(c.quote)}</q> (${ref(c, pages)})`).join("; ")}</p>`
        : ""
    }
  </article>`,
    )
    .join("");
  return `<section class="sheet">
  ${head(SUB["sec-contributions"]!, "Per project: what Rin did, what others did, and the passage that backs each line.")}
  ${projects}
</section>`;
}

function impact(p: Packet, pages: PageMap | null) {
  const rows = p.outcomes
    .map((o) => `<tr><td class="strong nowrap">${esc(o.project)}</td><td><q>${esc(o.text)}</q></td><td class="nowrap">${ref(o.citation, pages)}</td></tr>`)
    .join("");
  const impactStatements = p.projects.flatMap((x) => x.statements.filter((s) => s.kind === "impact"));
  return `<section class="sheet">
  ${head(SUB["sec-impact"]!, "Results the files state, each with the limit the same file puts on it.")}
  <table class="grid"><thead><tr><th>Project</th><th>Passage</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table>
  ${impactStatements.length ? `<h2>Confirmed impact statements</h2><ol class="stmts">${impactStatements.map((s) => statement(s, pages)).join("")}</ol>` : ""}
  <h2>Limits</h2>
  <ul class="bul">
    ${p.limits.map((l) => `<li>${esc(l)}</li>`).join("")}
    <li>Nothing in the record shows the projects in production, with real users or with real data.</li>
    <li>No result has been reproduced by anyone other than Rin.</li>
  </ul>
</section>`;
}

function chronology(p: Packet, pages: PageMap | null) {
  const rows = p.chronology
    .map(
      (r) =>
        `<tr class="${r.isRin ? "rin" : "other"}"><td class="mono nowrap">${r.date}</td><td class="nowrap">${esc(r.project)}</td><td class="nowrap">${r.isRin ? `<span class="who-rin">Rin</span>` : `<span class="mono">${esc(r.who)}</span>`}</td><td>${esc(r.event)}</td><td class="nowrap">${ref(r.citation, pages)}</td></tr>`,
    )
    .join("");
  return `<section class="sheet">
  ${head(SUB["sec-chronology"]!, "Every dated commit and merged pull request in the exhibits, oldest first. Rows by other people are kept and marked.")}
  <table class="grid chrono"><thead><tr><th>Date</th><th>Project</th><th>By</th><th>Event</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table>
</section>`;
}

function index(p: Packet, pages: PageMap | null) {
  const rows = p.exhibits
    .map(
      (e) => `<tr>
      <td class="exid nowrap"><a href="#${e.anchor}">${e.id}</a></td>
      <td><span class="strong">${esc(e.title)}</span><span class="sub mono">${esc(e.url)}</span></td>
      <td class="nowrap">${esc(e.project)}</td>
      <td>${clsTag(e.classification)}</td>
      <td class="mono nowrap">${e.retrieved}</td>
      <td class="mono hash">${e.contentHash}</td>
      <td class="num">${pn(pages, e.anchor)}</td>
    </tr>`,
    )
    .join("");
  return `<section class="sheet">
  ${head(SUB["sec-index"]!, "One exhibit per source file, all Synthetic EXAMPLE. Hashes are the first 16 hex characters of the file's SHA-256 at retrieval.")}
  <table class="grid index"><thead><tr><th>ID</th><th>Exhibit and locator</th><th>Project</th><th>Marked</th><th>Retrieved</th><th>Content hash</th><th class="num nowrap">Annex p.</th></tr></thead><tbody>${rows}</tbody></table>
</section>`;
}

export const checklistCounts = (p: Packet) => ({ total: p.checklist.length, high: p.checklist.filter((c) => c.priority === "High").length });

function checkRows(items: ChecklistItem[]) {
  return items
    .map(
      (c) => `<tr>
      <td class="box-cell"><span class="box" aria-hidden="true"></span></td>
      <td><span class="prio prio-${c.priority.toLowerCase()}">${c.priority}</span></td>
      <td><span class="strong">${esc(c.item)}</span><span class="why">${esc(c.why).replace(/E-\d{2}/g, (m) => `<span class="nowrap">${m}</span>`)}</span></td>
      <td><span class="status status-${c.scope}">${esc(c.status)}</span></td>
      <td class="who">${esc(c.who)}</td>
    </tr>`,
    )
    .join("");
}

function missing(p: Packet) {
  const { total, high } = checklistCounts(p);
  const group = (title: string, lead: string, items: ChecklistItem[]) =>
    items.length
      ? `<div class="cgroup"><h2>${title}</h2><p class="note group-lead">${lead}</p><table class="grid check"><thead><tr><th></th><th>Priority</th><th>Item and why it matters</th><th>Status</th><th>Who would provide it</th></tr></thead><tbody>${checkRows(items)}</tbody></table></div>`
      : "";
  return `<section class="sheet">
  ${head(PARTS[2]!, `${total} items to gather, ${high} high priority. Bring each one if relevant. Nothing here is a form to fill in.`)}
  <p class="alone">${PROJECTS_ALONE} <span>The projects are one part of what an attorney may want to see. The rest is listed here as unknown, because this tool does not know it and does not store it.</span></p>
  ${group("From the record", "Gaps in the exhibits themselves, derived from the files in Part 2.", p.checklist.filter((c) => c.scope === "record"))}
  ${group("Outside the projects", "Things an attorney may ask about. None of it is stored in this tool.", p.checklist.filter((c) => c.scope === "outside"))}
</section>`;
}

const RULED = (n: number) => `<div class="ruled" aria-hidden="true">${"<span></span>".repeat(n)}</div>`;

function questions(p: Packet) {
  return `<section class="sheet">
  ${head(PARTS[3]!, QUESTIONS_NOTE)}
  <ol class="qs">${p.questions.map((q) => `<li><p>${esc(q)}</p>${RULED(3)}</li>`).join("")}</ol>
  <div class="notes"><h2>Notes</h2><p class="note">For anything the attorney asks to bring next time.</p>${RULED(16)}</div>
</section>`;
}

function excerptLine(l: ExcerptLine) {
  if ("gap" in l) return `<div class="ln gap"><span class="lno">…</span><span class="ltx"></span></div>`;
  let html = "";
  let at = 0;
  for (const m of l.marks) {
    html += esc(l.text.slice(at, m.start)) + `<mark class="m-${m.kind}">${esc(l.text.slice(m.start, m.end))}</mark>`;
    at = m.end;
  }
  html += esc(l.text.slice(at));
  const hl = l.marks.some((m) => m.kind === "statement") ? " hl" : l.marks.length ? " hl-context" : "";
  return `<div class="ln${hl}"><span class="lno">${l.n}</span><span class="ltx">${html || "&nbsp;"}</span></div>`;
}

function annex(e: Exhibit) {
  const meta: [string, string, boolean][] = [
    ["Project", e.project, false],
    ["File", e.locator, true],
    ["Fixture URL", e.url, true],
    ["Content hash", e.contentHash, true],
    ["Retrieved", e.retrieved, true],
    ["Authorship", e.authorship, false],
  ];
  return `<section class="sheet annex">
  <header class="annex-head">
    <h1 id="${e.anchor}"><span class="annex-label">Annex</span><span class="annex-id">${e.id}</span></h1>
    <p class="annex-title">${esc(e.title)}</p>
    <div class="annex-tags">${clsTag(e.classification)}<span class="cls cls-synthetic">Synthetic EXAMPLE</span></div>
  </header>
  <dl class="annex-meta">${meta.map(([k, v, mono]) => `<div><dt>${k}</dt><dd${mono ? ' class="mono"' : ""}>${esc(v)}</dd></div>`).join("")}${
    e.citedBy.length ? `<div><dt>Backs</dt><dd>${e.citedBy.map(esc).join("<br>")}</dd></div>` : ""
  }</dl>
  <p class="excerpt-label">${e.fullText ? "Full text of the file" : "Excerpt, lines around each quoted passage"}${e.quotes.length ? ". Blue: passages that back Rin's statements. Grey: passages cited for others' work, dates or stated limits." : "."}</p>
  <div class="excerpt">${e.excerpt.map(excerptLine).join("")}</div>
  ${e.illustration ? `<figure class="illo">${e.illustration.svg}<figcaption>${esc(e.illustration.caption)}</figcaption></figure>` : ""}
</section>`;
}

export function renderPacketBody(p: Packet, pages: PageMap | null): string {
  return `<div class="pk">${[
    cover(p, pages),
    contents(p, pages),
    onePage(p, pages),
    dossierOpener(p),
    contributions(p, pages),
    impact(p, pages),
    chronology(p, pages),
    index(p, pages),
    missing(p),
    questions(p),
    ...p.exhibits.map(annex),
  ].join("\n")}</div>`;
}
