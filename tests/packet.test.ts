import { describe, expect, test } from "vitest";
import { exampleWorkspace, approveAllAndEvaluate, snap, claimByText } from "./helpers";
import { buildPacket, CLASSIFICATION_OF } from "@/lib/packet/model";
import { renderPacketBody } from "@/components/packet/document";
import { renderPacket, locateHeadings } from "@/lib/packet/pdf";
import { reviewClaim } from "@/lib/workspace";

async function answered() {
  const w = await exampleWorkspace();
  await approveAllAndEvaluate(w.db, w.token, w.workspaceId, w.profile.goal);
  return { ...w, packet: buildPacket(w.db, w.workspaceId)! };
}

const visibleText = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, " ");

describe("attorney evidence packet", () => {
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
    expect(packet.gaps[0]).toMatchObject({ priority: "High" });

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

  test("the document makes no legal judgment and names no visa category", async () => {
    const { packet } = await answered();
    const text = visibleText(renderPacketBody(packet, null));
    expect(text).toContain("SYNTHETIC EXAMPLE MATERIAL. Not legal advice. No eligibility assessment.");
    const rest = text.replaceAll("No eligibility assessment", "");
    for (const banned of [/eligib/i, /\bO-1/, /H-1B/i, /\bEB-\d/, /\bL-1\b/, /petition/i, /probabilit/i, /approved/i, /\bawards?\b/i, /\bpress\b/i, /signature/i, /letters? of/i, /guarantee/i, /\bvisa\b/i])
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
    expect(r.pages["sec-profile"]).toBe(3);
    for (const e of packet.exhibits) expect(r.pages[e.anchor], e.id).toBeGreaterThan(r.pages["sec-questions"]!);
  }, 120_000);
});
