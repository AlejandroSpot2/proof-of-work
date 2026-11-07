import fs from "node:fs";
import path from "node:path";
import type { Entrust } from "@/lib/views/project";
import type { Support } from "@/lib/domain/types";
import { SIGNAL_COPY, type EmployerRecord } from "@/lib/signals";

export type Opportunity = Omit<EmployerRecord, "matches"> & {
  signal: { label: string; caveat: string };
  fit: {
    name: string;
    support: Support;
    evidenceIds: string[];
    evidence: { id: string; sourceId: string; quote: string; locator: string; projectTitle: string }[];
  }[];
};

export function loadEmployerRecords(): EmployerRecord[] {
  const file = path.join(process.cwd(), "fixtures", "example-rin", "employers", "employers.json");
  return (JSON.parse(fs.readFileSync(file, "utf8")) as { records: EmployerRecord[] }).records.slice(0, 3);
}

/** A proposal of how evidenced capabilities map onto a role. Only live, cited capabilities are used. */
export function opportunitiesFor(entrust: Entrust, records = loadEmployerRecords()): Opportunity[] {
  const pool = [...entrust.capabilities, ...(entrust.nextBuild?.parts ?? [])].filter((c) => c.support !== "unknown");
  return records.map(({ matches, ...r }) => {
    const fit = pool
      .filter((c) => matches.some((m) => new RegExp(`\\b${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(c.name)))
      .map((c) => ({
        name: c.name,
        support: c.support,
        evidenceIds: c.evidence.map((e) => e.id),
        evidence: c.evidence.map((e) => ({ id: e.id, sourceId: e.sourceId, quote: e.quote, locator: e.locator, projectTitle: e.projectTitle })),
      }));
    const unique = fit.filter((f, i) => fit.findIndex((g) => [...g.evidenceIds].sort().join(",") === [...f.evidenceIds].sort().join(",")) === i);
    return { ...r, signal: SIGNAL_COPY[r.signalType] ?? SIGNAL_COPY.unknown, fit: unique };
  });
}
