import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Opportunities } from "@/components/Opportunities";
import { opportunitiesFor, loadEmployerRecords } from "@/lib/opportunities";
import { deriveEntrust } from "@/lib/views/project";
import { approveAllAndEvaluate, exampleWorkspace, snap } from "./helpers";

async function rendered() {
  const { db, token, workspaceId, profile } = await exampleWorkspace();
  await approveAllAndEvaluate(db, token, workspaceId, profile.goal);
  const items = opportunitiesFor(deriveEntrust(snap(db, workspaceId)));
  return { items, html: renderToStaticMarkup(createElement(Opportunities, { items })) };
}

describe("opportunities panel", () => {
  it("holds at most 3 fictional EXAMPLE employer records", () => {
    const records = loadEmployerRecords();
    expect(records.length).toBeLessThanOrEqual(3);
    for (const r of records) {
      expect(r.company).toContain("(EXAMPLE)");
      expect(r.id.startsWith("example://employers/")).toBe(true);
    }
  });

  it("renders signal type, status and retrieved date for every record", async () => {
    const { items, html } = await rendered();
    for (const o of items) {
      expect(html).toContain(o.signal.label);
      expect(html).toContain(o.retrieved ?? "unknown");
      expect(html).toContain(o.status ?? "unknown");
    }
    expect(html).toContain("Not legal advice");
    expect(html).toContain("Historical filings ≠ current policy");
    expect(html).toContain("One role&#x27;s sponsorship ≠ all visa types");
  });

  it("never renders historical filings as current sponsorship", async () => {
    const { items, html } = await rendered();
    const historical = items.find((o) => o.signalType === "historical_filings")!;
    expect(historical.signal.label).not.toMatch(/current|sponsors/i);
    const block = html.slice(html.indexOf(historical.company), html.indexOf(historical.company) + 1500);
    expect(block).not.toContain("The current posting says it sponsors visas");
    expect(block).toContain("Historical filings are not current policy");
  });

  it("keeps missing fields as unknown, never guessed", async () => {
    const { items, html } = await rendered();
    const unknown = items.find((o) => o.signalType === "unknown")!;
    expect(unknown.entityName).toBeNull();
    expect(unknown.location).toBeNull();
    const block = html.slice(html.indexOf(unknown.company));
    expect(block.match(/>unknown</g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("maps a role only to live, evidenced capabilities", async () => {
    const { items } = await rendered();
    for (const o of items) for (const f of o.fit) {
      expect(f.support).not.toBe("unknown");
      expect(f.evidenceIds.length).toBeGreaterThan(0);
    }
  });
});
