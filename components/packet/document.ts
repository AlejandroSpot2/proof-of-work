import type { Citation, Classification, Exhibit, ExcerptLine, Packet, PageMap, Statement } from "@/lib/packet/model";
import { CLASSIFICATION_MEANING } from "@/lib/packet/model";

/**
 * The packet as one HTML string, used both for the on-screen preview and for the PDF.
 * Plain strings rather than React: the PDF route renders it without react-dom/server, and the preview injects the same markup.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const TITLE = "Evidence packet for a first consult";
export const CAVEAT = "SYNTHETIC EXAMPLE MATERIAL. Not legal advice. No eligibility assessment.";

export type Section = { anchor: string; number: string; title: string };

export const SECTIONS: Section[] = [
  { anchor: "sec-profile", number: "1", title: "Profile and objective" },
  { anchor: "sec-summary", number: "2", title: "Review summary" },
  { anchor: "sec-contributions", number: "3", title: "Project contributions" },
  { anchor: "sec-impact", number: "4", title: "Impact and evidence limitations" },
  { anchor: "sec-chronology", number: "5", title: "Chronological record" },
  { anchor: "sec-index", number: "6", title: "Evidence index" },
  { anchor: "sec-gaps", number: "7", title: "Missing corroboration" },
  { anchor: "sec-questions", number: "8", title: "Questions for the attorney" },
];

/** Text each anchor's heading prints, in document order, so the PDF pass can find the page it landed on. */
export function headingMarks(p: Packet): { anchor: string; text: string }[] {
  return [
    ...SECTIONS.map((s) => ({ anchor: s.anchor, text: `${s.number}${s.title}` })),
    ...p.exhibits.map((e) => ({ anchor: e.anchor, text: `Annex${e.id}` })),
  ];
}

const pn = (pages: PageMap | null, anchor: string) => `<span class="pn">${pages?.[anchor] ?? "00"}</span>`;

const clsTag = (c: Classification) => `<span class="cls cls-${c.toLowerCase().replace(/[^a-z]+/g, "-")}">${esc(c)}</span>`;

function ref(c: Citation, pages: PageMap | null) {
  return `<a class="ref" href="#ex-${c.exhibitId}">Ex.&nbsp;<span class="refid">${c.exhibitId}</span></a><span class="refloc">, line ${c.line}, p.&nbsp;${pn(pages, `ex-${c.exhibitId}`)}</span>`;
}

function sectionHead(s: Section, lead?: string) {
  return `<header class="sh"><h1 id="${s.anchor}"><span class="sn">${s.number}</span>${esc(s.title)}</h1>${lead ? `<p class="lead">${lead}</p>` : ""}</header>`;
}

function cover(p: Packet) {
  const meta: [string, string][] = [
    ["Person", p.person.name],
    ["Generated", p.generated],
    ["Ledger revision", String(p.ledgerRevision)],
    ["Statements", String(p.summary.statements)],
    ["Exhibits", `${p.summary.exhibits}, E-01 to ${p.exhibits.at(-1)?.id ?? "E-00"}`],
    ["Projects", p.projects.map((x) => x.title).join(", ")],
  ];
  const legend = (Object.keys(CLASSIFICATION_MEANING) as (keyof typeof CLASSIFICATION_MEANING)[])
    .map((k) => `<tr><td>${clsTag(k)}</td><td>${esc(CLASSIFICATION_MEANING[k])}</td></tr>`)
    .join("");
  return `<section class="sheet cover">
  <div class="cover-top"><span class="wordmark">Proof of Work</span><span class="mono small">Draft · for attorney review</span></div>
  <div class="cover-main">
    <p class="kicker mono">Evidence packet</p>
    <h1 class="cover-title">${TITLE}</h1>
    <p class="cover-name">${esc(p.person.name)}</p>
    <p class="cover-sub">Draft prepared by the builder for attorney review</p>
    <dl class="cover-meta">${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
  </div>
  <div class="cover-foot">
    <p class="legend-title">How each statement and exhibit is marked</p>
    <table class="legend"><tbody>${legend}<tr><td><span class="cls cls-synthetic">Synthetic EXAMPLE</span></td><td>Everything in this packet. Rin Okafor is a fictional builder and every file is synthetic, written for a demo.</td></tr></tbody></table>
    <p class="caveat">${CAVEAT}</p>
  </div>
</section>`;
}

function contents(p: Packet, pages: PageMap | null) {
  const row = (anchor: string, num: string, title: string, cls = "") =>
    `<li class="${cls}"><a href="#${anchor}"><span class="tn">${num}</span><span class="tt">${esc(title)}</span><span class="dots"></span>${pn(pages, anchor)}</a></li>`;
  return `<section class="sheet toc">
  <header class="sh"><h1 id="sec-contents">Contents</h1></header>
  <ol class="toc-list">${SECTIONS.map((s) => row(s.anchor, s.number, s.title)).join("")}</ol>
  <p class="toc-group">Annexes · literal source excerpts, one per exhibit</p>
  <ol class="toc-list toc-annex">${p.exhibits.map((e) => row(e.anchor, e.id, e.title, "mono-num")).join("")}</ol>
</section>`;
}

function profile(p: Packet, pages: PageMap | null) {
  const rows = p.projects
    .map(
      (x) =>
        `<tr><td class="strong">${esc(x.title)}</td><td>${esc(x.role ?? "unknown")}</td><td>${esc(x.summary ?? "")}</td><td class="mono nowrap">${x.exhibitIds[0]}–${x.exhibitIds.at(-1)}</td></tr>`,
    )
    .join("");
  return `<section class="sheet">
  ${sectionHead(SECTIONS[0]!)}
  <dl class="facts">
    <div><dt>Name</dt><dd>${esc(p.person.name)}</dd></div>
    ${p.person.role ? `<div><dt>Role</dt><dd>${esc(p.person.role)}</dd></div>` : ""}
    ${p.person.location ? `<div><dt>Location</dt><dd>${esc(p.person.location)}</dd></div>` : ""}
    <div><dt>Handle in the records</dt><dd class="mono">${esc(p.person.handle)}</dd></div>
  </dl>
  ${p.person.bio ? `<h2>Background</h2><p class="prose">${esc(p.person.bio)}</p>` : ""}
  <h2>Objective</h2>
  <p class="prose">${esc(p.person.goal ?? "No objective recorded.")}</p>
  <p class="note">The objective is the kind of role Rin is looking for, in her own words. This packet does not assess it.</p>
  <h2>Projects in this packet</h2>
  <table class="grid"><thead><tr><th>Project</th><th>Role recorded</th><th>What it is</th><th>Exhibits</th></tr></thead><tbody>${rows}</tbody></table>
  <p class="note">Detailed contributions start on page ${pn(pages, "sec-contributions")}.</p>
</section>`;
}

function summary(p: Packet) {
  const s = p.summary;
  const counts = (Object.keys(CLASSIFICATION_MEANING) as (keyof typeof CLASSIFICATION_MEANING)[])
    .map((k) => `<div><dt>${clsTag(k)}</dt><dd><span class="big">${s.byClass[k]}</span> of ${s.statements} statements</dd></div>`)
    .join("");
  return `<section class="sheet">
  ${sectionHead(SECTIONS[1]!, "What the record shows, what it does not, and how each piece is marked.")}
  <dl class="tally">${counts}</dl>
  <div class="two">
    <div><h2>What the record shows</h2><ul class="bul">${s.shows.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <div><h2>What it does not show</h2><ul class="bul">${s.doesNotShow.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
  </div>
  <h2>How evidence is classified</h2>
  <p class="prose">Each statement below was confirmed by Rin and is tied to a literal passage in a file. A statement is <em>Independent</em> only when two separate origins back it. Files from Rin's own project repositories, including her commits, pull requests and notes, are <em>Repository records</em>: they show what the repository says, written or kept by people working on the project. Anything that rests on Rin's word alone is <em>Self-attested</em>. Work by other people is listed separately under each project and is never counted as Rin's.</p>
  <p class="prose">Every file, name, number and date here is synthetic EXAMPLE material.</p>
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
    <h2 class="proj-title"><span class="sn">3.${i + 1}</span>${esc(x.title)}<span class="proj-role">Role recorded: ${esc(x.role ?? "unknown")}</span></h2>
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
  ${sectionHead(SECTIONS[2]!, "Per project: what Rin did, what others did, and the passage that backs each line.")}
  ${projects}
</section>`;
}

function impact(p: Packet, pages: PageMap | null) {
  const rows = p.outcomes
    .map((o) => `<tr><td class="strong nowrap">${esc(o.project)}</td><td><q>${esc(o.text)}</q></td><td class="nowrap">${ref(o.citation, pages)}</td></tr>`)
    .join("");
  const impactStatements = p.projects.flatMap((x) => x.statements.filter((s) => s.kind === "impact").map((s) => ({ s, project: x.title })));
  return `<section class="sheet">
  ${sectionHead(SECTIONS[3]!, "Results the files state, each with the limit the same file puts on it.")}
  <h2>What the files say about results</h2>
  <table class="grid"><thead><tr><th>Project</th><th>Passage</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table>
  ${
    impactStatements.length
      ? `<h2>Confirmed impact statements</h2><ol class="stmts">${impactStatements.map(({ s }) => statement(s, pages)).join("")}</ol>`
      : ""
  }
  <h2>Limitations</h2>
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
  ${sectionHead(SECTIONS[4]!, "Every dated commit and merged pull request in the exhibits, oldest first. Rows by other people are kept and marked.")}
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
      <td>${clsTag(e.classification)}<span class="sub">Synthetic EXAMPLE</span></td>
      <td class="mono nowrap">${e.retrieved}</td>
      <td class="mono hash">${e.contentHash}</td>
      <td class="num">${pn(pages, e.anchor)}</td>
    </tr>`,
    )
    .join("");
  return `<section class="sheet">
  ${sectionHead(SECTIONS[5]!, "One exhibit per source file. Hashes are the first 16 hex characters of the file's SHA-256 at retrieval.")}
  <table class="grid index"><thead><tr><th>ID</th><th>Exhibit and locator</th><th>Project</th><th>Classification</th><th>Retrieved</th><th>Content hash</th><th class="num nowrap">Annex p.</th></tr></thead><tbody>${rows}</tbody></table>
</section>`;
}

function gaps(p: Packet) {
  return `<section class="sheet">
  ${sectionHead(SECTIONS[6]!, "What would make the record stronger, most important first.")}
  <table class="grid gaps"><thead><tr><th>Priority</th><th>Gap</th><th>Why</th></tr></thead><tbody>${p.gaps
    .map((g) => `<tr><td><span class="prio prio-${g.priority.toLowerCase()}">${g.priority}</span></td><td class="strong">${esc(g.title)}</td><td>${esc(g.reason)}</td></tr>`)
    .join("")}</tbody></table>
</section>`;
}

function questions(p: Packet) {
  return `<section class="sheet">
  ${sectionHead(SECTIONS[7]!, "Open questions for a first consult. They ask for the attorney's judgment; this packet makes none.")}
  <ol class="qs">${p.questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ol>
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
    cover(p),
    contents(p, pages),
    profile(p, pages),
    summary(p),
    contributions(p, pages),
    impact(p, pages),
    chronology(p, pages),
    index(p, pages),
    gaps(p),
    questions(p),
    ...p.exhibits.map(annex),
  ].join("\n")}</div>`;
}
