/** Packet stylesheet, shared by the screen preview and the PDF. Everything is scoped under .pk. */
export const PACKET_CSS = `
.pk {
  --pk-ink: #0e1116;
  --pk-muted: #565c68;
  --pk-line: #e1e1dc;
  --pk-accent: #2747e8;
  --pk-mark: #e6ebff;
  --pk-sans: var(--font-sans, "Geist"), Arial, sans-serif;
  --pk-mono: var(--font-mono, "Geist Mono"), ui-monospace, monospace;
  color: var(--pk-ink);
  font-family: var(--pk-sans);
  font-size: 9.5pt;
  line-height: 1.5;
  font-feature-settings: "tnum" 0;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.pk *, .pk *::before, .pk *::after { box-sizing: border-box; }
.pk p, .pk h1, .pk h2, .pk h3, .pk ol, .pk ul, .pk dl, .pk dd, .pk figure { margin: 0; padding: 0; }
.pk ol, .pk ul { list-style: none; }
.pk a { color: inherit; text-decoration: none; }
.pk .mono, .pk .exid, .pk .hash, .pk .tn { font-family: var(--pk-mono); }
.pk .small { font-size: 7.5pt; }
.pk .strong { font-weight: 500; }
.pk .nowrap { white-space: nowrap; }
.pk em { font-style: normal; font-weight: 500; }
.pk q { quotes: "\\201C" "\\201D"; }

.pk .pn { display: inline-block; min-width: 2.4ch; text-align: right; font-variant-numeric: tabular-nums; }

/* Section heads */
.pk .sh { margin-bottom: 22pt; padding-bottom: 12pt; border-bottom: 1px solid var(--pk-ink); }
.pk .sh h1 { font-size: 19pt; line-height: 1.15; font-weight: 600; letter-spacing: -0.01em; display: flex; align-items: baseline; gap: 12pt; }
.pk .sh h1 .sn { font-family: var(--pk-sans); font-size: 10pt; font-weight: 500; color: var(--pk-accent); min-width: 16pt; }
.pk .sh .lead { margin-top: 6pt; color: var(--pk-muted); font-size: 10pt; max-width: 34em; }
.pk h2 { font-size: 11pt; font-weight: 600; margin: 20pt 0 8pt; break-after: avoid; }
.pk h3 { font-size: 8.5pt; font-weight: 600; color: var(--pk-muted); margin: 16pt 0 6pt; break-after: avoid; }
.pk .prose { max-width: 40em; margin-bottom: 8pt; }
.pk .note { color: var(--pk-muted); font-size: 8.5pt; margin-top: 6pt; }
.pk .bul li { position: relative; padding-left: 12pt; margin-bottom: 5pt; }
.pk .bul li::before { content: ""; position: absolute; left: 0; top: 0.68em; width: 5pt; height: 1px; background: var(--pk-ink); }

/* Classification tags */
.pk .cls { display: inline-block; font-size: 7pt; font-weight: 500; line-height: 1; padding: 3pt 5pt 3pt; border: 1px solid var(--pk-ink); border-radius: 3pt; white-space: nowrap; }
.pk .cls + .cls { margin-left: 4pt; }
.pk .cls-repository-record { border-color: var(--pk-ink); }
.pk .cls-independent { border-color: var(--pk-accent); color: var(--pk-accent); }
.pk .cls-self-attested { border-style: dashed; }
.pk .cls-unverified, .pk .cls-synthetic, .pk .cls-shared { border-color: var(--pk-line); color: var(--pk-muted); }

/* Citations */
.pk .ref { color: var(--pk-accent); font-size: 8pt; }
.pk .refid { font-family: var(--pk-mono); font-size: 7.8pt; }
.pk .refloc { font-size: 8pt; color: var(--pk-muted); }
.pk .refloc .pn { min-width: 0; text-align: left; font-family: var(--pk-sans); }
.pk .note .pn { text-align: left; font-family: var(--pk-sans); min-width: 0; }

/* Tables */
.pk table { width: 100%; border-collapse: collapse; }
.pk .grid th { text-align: left; font-weight: 500; font-size: 7.5pt; color: var(--pk-muted); padding: 0 8pt 6pt 0; border-bottom: 1px solid var(--pk-ink); vertical-align: bottom; }
.pk .grid td { padding: 6pt 8pt 6pt 0; border-bottom: 1px solid var(--pk-line); vertical-align: top; }
.pk .grid tr { break-inside: avoid; }
.pk .grid td:last-child, .pk .grid th:last-child { padding-right: 0; }
.pk .grid .num { text-align: right; }
.pk .sub { display: block; font-size: 7pt; color: var(--pk-muted); margin-top: 2pt; }
.pk .sub.mono { font-size: 6.8pt; }
.pk .index td { font-size: 8.5pt; padding-top: 4.5pt; padding-bottom: 4.5pt; }
.pk .index td.mono { font-size: 7.6pt; }
.pk .index .exid a { font-family: var(--pk-mono); color: var(--pk-accent); font-weight: 500; }
.pk .index .hash { font-size: 7pt; color: var(--pk-muted); }
.pk .chrono td { font-size: 8.5pt; padding-top: 4.5pt; padding-bottom: 4.5pt; }
.pk .chrono tr.other td { color: var(--pk-muted); }
.pk .chrono .who-rin { font-weight: 600; }
.pk .others td { font-size: 8.5pt; }

/* Cover */
.pk .cover { display: flex; flex-direction: column; }
.pk .cover-top { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 9pt; border-bottom: 1px solid var(--pk-ink); font-size: 8pt; color: var(--pk-muted); }
.pk .cover-main { padding-top: 40pt; }
.pk .cover-title { font-size: 40pt; line-height: 1.02; font-weight: 600; letter-spacing: -0.03em; }
.pk .cover-sub { font-size: 13pt; line-height: 1.35; margin-top: 14pt; max-width: 26em; color: var(--pk-ink); }
.pk .cover-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10pt 18pt; margin-top: 26pt; padding-top: 12pt; border-top: 1px solid var(--pk-line); }
.pk .cover-meta dt, .pk .facts dt, .pk .annex-meta dt { font-size: 7.5pt; color: var(--pk-muted); margin-bottom: 1.5pt; }
.pk .cover-meta dd { font-size: 10pt; }
.pk .cover-meta dd .mono { font-size: 9pt; }
.pk .cover-parts { margin-top: 24pt; border-top: 1px solid var(--pk-ink); }
.pk .cover-parts a { display: flex; align-items: baseline; gap: 14pt; padding: 6pt 0; border-bottom: 1px solid var(--pk-line); }
.pk .cover-parts .cp-n { flex: none; width: 52pt; font-size: 8.5pt; color: var(--pk-accent); font-weight: 500; }
.pk .cover-parts .cp-t { flex: 1; display: flex; flex-direction: column; gap: 1pt; }
.pk .cover-parts .cp-t strong { font-weight: 600; font-size: 10.5pt; }
.pk .cover-parts .cp-t span { color: var(--pk-muted); font-size: 8.5pt; }
.pk .cover-parts .pn { font-size: 8.5pt; color: var(--pk-muted); }
.pk .cover-foot { margin-top: auto; }
.pk .legend-title { font-size: 8pt; font-weight: 600; margin-bottom: 5pt; }
.pk .legend td { padding: 4pt 10pt 4pt 0; border-top: 1px solid var(--pk-line); vertical-align: top; font-size: 8.5pt; }
.pk .legend td:first-child { width: 1%; white-space: nowrap; }
.pk .notice { margin-top: 12pt; padding-top: 8pt; border-top: 1px solid var(--pk-line); color: var(--pk-muted); font-size: 8pt; }

/* Contents */
.pk .toc-list li a { display: flex; align-items: baseline; gap: 8pt; padding: 6pt 0; border-bottom: 1px solid var(--pk-line); }
.pk .toc-list .tn { min-width: 22pt; color: var(--pk-muted); font-size: 8.5pt; }
.pk .toc-list .tt { font-weight: 500; }
.pk .toc-list .dots { flex: 1; }
.pk .toc-list .pn { font-size: 8.5pt; }
.pk .toc-group { margin: 20pt 0 4pt; font-size: 8.5pt; font-weight: 600; }
.pk .toc-list .toc-part a { padding-top: 9pt; }
.pk .toc-list .toc-part .tn { color: var(--pk-accent); font-family: var(--pk-sans); font-weight: 500; min-width: 44pt; }
.pk .toc-list .toc-part .tt { font-weight: 600; }
.pk .toc-list .toc-sub a { padding: 4pt 0 4pt 44pt; font-size: 9pt; }
.pk .toc-list .toc-sub .tt { font-weight: 400; }
.pk .toc-list .toc-sub .tn { font-family: var(--pk-sans); }
.pk .cgroup { break-inside: avoid; }
.pk .toc-annex li a { padding: 3.4pt 0; font-size: 8.5pt; }
.pk .toc-annex .tn { color: var(--pk-accent); min-width: 44pt; }
.pk .toc-annex .tt { font-weight: 400; }

/* One-page summary */
.pk .one .sh { margin-bottom: 16pt; }
.pk .one h2 { margin: 15pt 0 6pt; }
.pk .bio { font-size: 9pt; color: var(--pk-muted); margin-top: 8pt; }
.pk .exl { font-family: var(--pk-mono); color: var(--pk-accent); font-size: 7.8pt; }
.pk .contribs { border-top: 1px solid var(--pk-ink); }
.pk .cg { display: grid; grid-template-columns: 92pt 1fr; gap: 12pt; padding: 7pt 0; border-bottom: 1px solid var(--pk-line); break-inside: avoid; }
.pk .cg-name { font-weight: 600; display: flex; flex-direction: column; }
.pk .cg-name span { font-weight: 400; color: var(--pk-muted); font-size: 8pt; }
.pk .cg li { display: flex; justify-content: space-between; gap: 14pt; padding: 1.5pt 0; }
.pk .cg .cr { flex: none; white-space: nowrap; }
.pk .record li { display: grid; grid-template-columns: 76pt 1fr; gap: 12pt; padding: 5pt 0; border-bottom: 1px solid var(--pk-line); }
.pk .record li:first-child { border-top: 1px solid var(--pk-ink); }
.pk .record .rk { font-weight: 600; font-size: 8.5pt; }
.pk .record .no .rk { color: var(--pk-muted); }
.pk .one .note { margin-top: 10pt; }

/* Profile and summary */
.pk .facts { display: grid; grid-template-columns: 1fr 1.7fr 0.8fr; gap: 10pt 20pt; margin-bottom: 4pt; }
.pk .spaced { margin-top: 10pt; }
.pk .facts dd { font-size: 10pt; }
.pk .tally { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--pk-line); border-bottom: 1px solid var(--pk-line); }
.pk .tally div { padding: 12pt 12pt 12pt 0; }
.pk .tally div + div { padding-left: 12pt; border-left: 1px solid var(--pk-line); }
.pk .tally dd { margin-top: 8pt; color: var(--pk-muted); font-size: 8.5pt; }
.pk .tally .big { font-size: 20pt; font-weight: 600; color: var(--pk-ink); margin-right: 3pt; letter-spacing: -0.02em; }
.pk .two { display: grid; grid-template-columns: 1fr 1fr; gap: 24pt; }

/* Contributions */
.pk .proj { margin-bottom: 26pt; }
.pk .proj + .proj { break-before: page; }
.pk .proj-title { font-size: 14pt; margin: 0 0 6pt; display: flex; align-items: baseline; gap: 10pt; }
.pk .proj-title .sn { font-size: 9pt; font-weight: 400; color: var(--pk-muted); }
.pk .proj-role { margin-left: auto; font-size: 8pt; font-weight: 400; color: var(--pk-muted); }
.pk .scope { font-size: 8.5pt; padding: 6pt 0 6pt 10pt; border-left: 2px solid var(--pk-ink); margin: 6pt 0 2pt; }
.pk .stmts { counter-reset: st; }
.pk .stmt { break-inside: avoid; padding: 8pt 0 9pt; border-top: 1px solid var(--pk-line); }
.pk .stmt:last-child { border-bottom: 1px solid var(--pk-line); }
.pk .stmt-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12pt; }
.pk .stmt-text { font-weight: 500; font-size: 10pt; }
.pk .stmt-tags { flex: none; }
.pk .cites { margin-top: 5pt; }
.pk .cites li { display: flex; justify-content: space-between; gap: 14pt; font-size: 8.5pt; color: var(--pk-muted); padding: 1.5pt 0; }
.pk .cites .cite { flex: none; white-space: nowrap; }
.pk .files-say { margin-top: 8pt; font-size: 8.5pt; color: var(--pk-muted); }

/* Questions and notes */
.pk .qs { counter-reset: q; }
.pk .qs li { counter-increment: q; position: relative; padding: 10pt 0 6pt 28pt; break-inside: avoid; }
.pk .qs li p { font-size: 10pt; max-width: 40em; }
.pk .qs li::before { content: counter(q, decimal-leading-zero); position: absolute; left: 0; top: 11.5pt; font-family: var(--pk-mono); font-size: 8pt; color: var(--pk-accent); }
.pk .ruled span { display: block; height: 19pt; border-bottom: 0.75pt solid #cfd0cb; }
.pk .qs .ruled { margin-top: 2pt; }
.pk .notes { margin-top: 18pt; padding-top: 4pt; border-top: 1px solid var(--pk-ink); break-inside: avoid; }
.pk .notes h2 { margin-top: 10pt; }
.pk .notes .ruled span { height: 22pt; }

/* What is missing */
.pk .alone { margin-bottom: 2pt; padding: 8pt 12pt; border-left: 2px solid var(--pk-accent); background: #f4f6ff; font-weight: 600; font-size: 10.5pt; }
.pk .alone span { display: block; margin-top: 3pt; font-weight: 400; font-size: 8.5pt; color: var(--pk-muted); }
.pk .group-lead { margin: -2pt 0 6pt; }
.pk .check td { font-size: 8.3pt; line-height: 1.4; padding-top: 5pt; padding-bottom: 5pt; }
.pk .check .box-cell { width: 16pt; }
.pk .box { display: inline-block; width: 9pt; height: 9pt; border: 1pt solid var(--pk-ink); border-radius: 1.5pt; margin-top: 1pt; }
.pk .check td:nth-child(2) { width: 46pt; }
.pk .check td:nth-child(3) { width: 44%; }
.pk .check .why { display: block; color: var(--pk-muted); margin-top: 2pt; }
.pk .check .who { color: var(--pk-muted); }
.pk .status { font-weight: 500; }
.pk .status-outside { color: var(--pk-muted); }
.pk .prio { font-size: 8pt; font-weight: 500; }
.pk .prio-high { color: var(--pk-ink); font-weight: 600; }
.pk .prio-medium { color: var(--pk-ink); }
.pk .prio-low { color: var(--pk-muted); }

/* Annexes */
.pk .annex-head { padding-bottom: 12pt; border-bottom: 1px solid var(--pk-ink); margin-bottom: 14pt; }
.pk .annex-head h1 { display: flex; align-items: baseline; gap: 8pt; font-size: 19pt; font-weight: 600; }
.pk .annex-label { font-size: 10pt; font-weight: 400; color: var(--pk-muted); }
.pk .annex-id { font-family: var(--pk-mono); color: var(--pk-accent); font-weight: 500; }
.pk .annex-title { font-size: 12pt; font-weight: 500; margin-top: 4pt; }
.pk .annex-tags { margin-top: 8pt; }
.pk .annex-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8pt 24pt; margin-bottom: 14pt; }
.pk .annex-meta dd { font-size: 8.5pt; }
.pk .annex-meta dd.mono { font-size: 8pt; word-break: break-all; }
.pk .excerpt-label { font-size: 8pt; color: var(--pk-muted); margin-bottom: 6pt; }
.pk .excerpt { border-top: 1px solid var(--pk-ink); border-bottom: 1px solid var(--pk-line); padding: 6pt 0; font-family: var(--pk-mono); font-size: 7.8pt; line-height: 1.5; }
.pk .ln { display: flex; break-inside: avoid; border-left: 2px solid transparent; }
.pk .ln.hl { border-left-color: var(--pk-accent); }
.pk .lno { flex: none; width: 30pt; padding-right: 10pt; text-align: right; color: #9aa0aa; user-select: none; }
.pk .ltx { flex: 1; white-space: pre-wrap; word-break: break-word; }
.pk mark { background: var(--pk-mark); color: var(--pk-ink); padding: 0.5pt 0; }
.pk mark.m-context { background: #efefeb; }
.pk .ln.hl-context { border-left-color: #b9bcc2; }
.pk .illo { margin-top: 14pt; break-inside: avoid; display: flex; gap: 14pt; align-items: flex-end; }
.pk .illo svg { display: block; flex: none; width: 2.8in; max-width: 100%; border: 1px solid var(--pk-line); }
.pk .illo figcaption { font-size: 7.5pt; color: var(--pk-muted); max-width: 2.6in; }

@media screen {
  .pk { display: flex; flex-direction: column; align-items: center; gap: 28px; padding: 32px 16px 64px; }
  .pk .sheet { width: 8.5in; max-width: 100%; min-height: 11in; padding: 0.85in; background: #ffffff; box-shadow: 0 1px 2px rgba(14, 17, 22, 0.06), 0 8px 28px rgba(14, 17, 22, 0.06); }
  .pk .cover { height: 11in; }
  .pk .ref:hover { text-decoration: underline; }
  .pk [id] { scroll-margin-top: 80px; }
}
@media screen and (max-width: 860px) {
  .pk .illo { flex-direction: column; align-items: flex-start; }
  .pk .sheet { min-height: 0; padding: 28px 20px; }
  .pk .cover { height: auto; min-height: 0; }
  .pk .two, .pk .facts, .pk .annex-meta, .pk .cover-meta, .pk .tally, .pk .cg, .pk .record li { grid-template-columns: 1fr; }
  .pk .grid { display: block; overflow-x: auto; }
}
@media print {
  .pk .sheet { break-before: page; }
  .pk .sheet:first-child { break-before: auto; }
  .pk .cover { height: 9.2in; }
}
`;
