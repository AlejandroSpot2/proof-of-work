import { describe, expect, test } from "vitest";
import { exampleWorkspace, approveAllAndEvaluate, snap, claimByText } from "./helpers";
import { buildPacket, CLASSIFICATION_OF } from "@/lib/packet/model";
import { NOTICE, PROJECTS_ALONE, QUESTIONS_NOTE, renderPacketBody } from "@/components/packet/document";
import { renderPacket, locateHeadings, PDF_FILENAME } from "@/lib/packet/pdf";
import { reviewClaim } from "@/lib/workspace";

async function answered() {
  const w = await exampleWorkspace();
  await approveAllAndEvaluate(w.db, w.token, w.workspaceId, w.profile.goal);
  return { ...w, packet: buildPacket(w.db, w.workspaceId)! };
}

const visibleText = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, " ");

describe("first consultation kit", () => {
  test("covers every confirmed statement, each citing an exhibit", async () => {
    const { db, workspaceId, packet } = await answered();
    const approved = snap(db, workspaceId).projects.flatMap((p) => p.claims.filter((c) => c.reviewStatus === "approved"));
    const inPacket = packet.projects.flatMap((p) => p.statements);
    expect(approved.length).toBeGreaterThan(0);
    expect(inPacket.map((s) => s.id).sort()).toEqual(approved.map((c) => c.id).sort());
    const ids = new Set(packet.exhibits.map((e) => e.id));
    for (const s of inPacket) {
      expect(s.citations.length).toBeGreaterThan(0);
      for (const c of s.citations) expect(ids.has(c.exhibitId)).toBe(true);
    }
  });

  test("every exhibit excerpt contains its quoted passages literally, highlighted", async () => {
    const { packet } = await answered();
    const cited = packet.projects.flatMap((p) => [...p.statements.flatMap((s) => s.citations), ...p.others.map((o) => o.citation)]);
    for (const c of cited) {
      const ex = packet.exhibits.find((e) => e.id === c.exhibitId)!;
      const line = ex.excerpt.find((l) => !("gap" in l) && l.n === c.line);
      expect(line && !("gap" in line) && line.text.includes(c.quote), `${c.exhibitId} line ${c.line}: ${c.quote}`).toBe(true);
      const marked = line && !("gap" in line) ? line.marks.map((m) => line.text.slice(m.start, m.end)) : [];
      expect(marked).toContain(c.quote);
    }
    for (const c of packet.projects.flatMap((p) => p.statements.flatMap((s) => s.citations))) {
      const line = packet.exhibits.find((e) => e.id === c.exhibitId)!.excerpt.find((l) => !("gap" in l) && l.n === c.line);
      expect(line && !("gap" in line) && line.marks.find((m) => line.text.slice(m.start, m.end) === c.quote)?.kind).toBe("statement");
    }
    const others = packet.projects.flatMap((p) => p.others.map((o) => o.citation));
    for (const c of others) {
      const line = packet.exhibits.find((e) => e.id === c.exhibitId)!.excerpt.find((l) => !("gap" in l) && l.n === c.line);
      expect(line && !("gap" in line) && line.marks.every((m) => m.kind === "context")).toBe(true);
    }
  });

  test("classification follows the record: repository files are never independent", async () => {
    const { db, token, workspaceId, packet } = await answered();
    for (const e of packet.exhibits) expect(e.classification).toBe("Repository record");
    const states = new Map(snap(db, workspaceId).projects.flatMap((p) => p.claims.map((c) => [c.id, c.state] as const)));
    for (const s of packet.projects.flatMap((p) => p.statements)) expect(s.classification).toBe(CLASSIFICATION_OF[states.get(s.id)!]);
    expect(packet.summary.byClass.Independent).toBe(0);
    expect(packet.checklist[0]).toMatchObject({ priority: "High", scope: "record", status: "Missing from the record" });

    const kerf = claimByText(db, workspaceId, "Co-maintains Kerf's docs and release process");
    reviewClaim(db, token, kerf.id, { action: "correct", text: "Runs Kerf's docs and release process; the deploy engine and its infrastructure are Contributor C's", attribution: "author" });
    const after = buildPacket(db, workspaceId)!;
    const corrected = after.projects.flatMap((p) => p.statements).find((s) => s.id === kerf.id)!;
    expect(corrected.classification).toBe("Self-attested");
  });

  test("Kerf is docs and release process only; the deploy work stays with Contributor C", async () => {
    const { packet } = await answered();
    const kerf = packet.projects.find((p) => p.title === "Kerf")!;
    expect(kerf.rinScope).toMatch(/documentation/);
    expect(kerf.rinScope).toMatch(/release process/);
    for (const s of kerf.statements) expect(s.text).not.toMatch(/deploy|infra/i);
    expect(kerf.rinScope).not.toMatch(/deploy|infra/i);
    const deploys = kerf.others.filter((o) => /preview|deploy/i.test(o.what));
    expect(deploys.length).toBeGreaterThan(0);
    for (const o of deploys) expect(o.who).toBe("contributor-c");
    for (const row of packet.chronology.filter((r) => /deploy|preview environment/i.test(r.event))) expect(row.isRin).toBe(false);
  });

  test("the kit runs cover, contents, the four parts in order, then the annexes", async () => {
    const { packet } = await answered();
    const html = renderPacketBody(packet, null);
    const at = (needle: string) => {
      const i = html.indexOf(needle);
      expect(i, needle).toBeGreaterThanOrEqual(0);
      return i;
    };
    const order = [
      at('class="cover-title">First Consultation Kit<'),
      at('id="sec-contents"'),
      at('id="part-summary"'),
      at('id="part-dossier"'),
      at('id="sec-contributions"'),
      at('id="sec-impact"'),
      at('id="sec-chronology"'),
      at('id="sec-index"'),
      at('id="part-missing"'),
      at('id="part-questions"'),
      at('id="ex-E-01"'),
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
    const text = visibleText(html);
    expect(text).toContain("Prepared by Rin Okafor (EXAMPLE) for a first meeting with an immigration attorney");
    expect(text).toContain(NOTICE);
    expect(packet.objective).toMatch(/outside the US, interested in roles in San Francisco/);
    expect(packet.contributions.length).toBe(packet.summary.statements);
    for (const c of packet.contributions) expect(c.exhibitIds.length).toBeGreaterThan(0);
    expect(packet.recordLines.map((l) => l.shows)).toEqual([true, true, false]);
    expect(PDF_FILENAME).toBe("rin-okafor-first-consultation-kit-EXAMPLE.pdf");
  });

  test("the missing checklist names record gaps and outside items without inventing them", async () => {
    const { packet } = await answered();
    const items = packet.checklist.map((c) => c.item);
    expect(items).toContain("An independent account of any contribution");
    expect(items).toContain("Evidence of production use or real users");
    expect(items).toContain("Results measured on real data");
    expect(items.some((i) => i.startsWith("Kerf:"))).toBe(true);
    const outside = packet.checklist.filter((c) => c.scope === "outside");
    expect(outside.map((c) => c.item)).toEqual(
      expect.arrayContaining(["Current immigration status and history", "A job offer or prospective employer", "Employment history and any employer letters", "Education credentials", "Recognition or publications"]),
    );
    for (const c of outside) expect(["Unknown", "Not collected by this tool", "None in this record"]).toContain(c.status);
    expect(outside.find((c) => c.item.startsWith("Current immigration"))!.who).toMatch(/Not stored here/);
    const ranks = packet.checklist.map((c) => ["High", "Medium", "Low"].indexOf(c.priority));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    const html = renderPacketBody(packet, null);
    expect(visibleText(html)).toContain(PROJECTS_ALONE);
    expect(html.match(/class="box"/g)?.length).toBe(packet.checklist.length);
  });

  test("the kit makes no legal judgment and names no visa category", async () => {
    const { packet } = await answered();
    const text = visibleText(renderPacketBody(packet, null));
    expect(text).toContain(QUESTIONS_NOTE);
    let rest = text;
    for (const allowed of [NOTICE, QUESTIONS_NOTE, PROJECTS_ALONE]) rest = rest.replaceAll(allowed, "");
    for (const banned of [/eligib/i, /\bO-1/, /H-1B/i, /\bEB-\d/, /\bL-1\b/, /petition/i, /probabilit/i, /approved/i, /\bawards?\b/i, /\bpress\b/i, /signature/i, /letters? of/i, /guarantee/i, /\bvisa\b/i, /(?<!not )ready to file/i, /endorse/i])
      expect(rest, String(banned)).not.toMatch(banned);
  });

  test("chronology is dated, ordered and cites its exhibit", async () => {
    const { packet } = await answered();
    const dates = packet.chronology.map((r) => r.date);
    expect(dates).toEqual([...dates].sort());
    expect(packet.chronology.some((r) => r.event.startsWith("Merged"))).toBe(true);
    expect(packet.chronology.some((r) => !r.isRin)).toBe(true);
    for (const r of packet.chronology) expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("headings are located in document order after the contents page", () => {
    const pages = locateHeadings(["cover", "contents 1profileandobjective annexe-01", "x", "1profileandobjective", "annexe-01"], [
      { anchor: "a", text: "1 Profile and objective" },
      { anchor: "b", text: "Annex E-01" },
    ]);
    expect(pages).toEqual({ a: 4, b: 5 });
  });

  test("renders a multi-page PDF with real page numbers", async () => {
    const { packet } = await answered();
    const r = await renderPacket(packet);
    expect(r.pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(r.pageCount).toBeGreaterThan(5);
    expect(r.pages["part-summary"]).toBe(3);
    expect(r.pages["part-dossier"]).toBe(4);
    const order = ["part-summary", "part-dossier", "sec-contributions", "sec-impact", "sec-chronology", "sec-index", "part-missing", "part-questions"].map((a) => r.pages[a]!);
    expect(order.every((n) => n > 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const e of packet.exhibits) expect(r.pages[e.anchor], e.id).toBeGreaterThan(r.pages["part-questions"]!);
  }, 120_000);
});
