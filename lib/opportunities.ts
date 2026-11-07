import fs from "node:fs";
import path from "node:path";
import type { Entrust } from "@/lib/views/project";
import type { Support } from "@/lib/domain/types";

export type SignalType = "current_posting_states_sponsorship" | "historical_filings" | "unknown";

type EmployerRecord = {
  id: string;
  company: string;
  entityName: string | null;
  location: string | null;
  role: string;
  snippet: string | null;
  retrieved: string | null;
  signalType: SignalType;
  status: string | null;
  matches: string[];
};

export const SIGNAL_COPY: Record<SignalType, { label: string; caveat: string }> = {
  current_posting_states_sponsorship: {
    label: "The current posting says it sponsors visas",
    caveat: "One role's sponsorship is not every visa type, and a posting can change.",
  },
  historical_filings: {
    label: "Past filings only",
    caveat: "Historical filings are not current policy. Nothing here says this role sponsors today.",
  },
  unknown: { label: "Unknown", caveat: "No source states a sponsorship position. Not guessed." },
};

export const OPPORTUNITY_NOTICE = "Not legal advice. Fictional EXAMPLE employers. No job or visa outcome is implied.";

export type Opportunity = Omit<EmployerRecord, "matches"> & {
  signal: { label: string; caveat: string };
  fit: { name: string; support: Support; evidenceIds: string[] }[];
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
      .filter((c) => matches.some((m) => c.name.toLowerCase().includes(m.toLowerCase())))
      .map((c) => ({ name: c.name, support: c.support, evidenceIds: c.evidence.map((e) => e.id) }));
    const unique = [...new Map(fit.map((f) => [f.name, f])).values()];
    return { ...r, signal: SIGNAL_COPY[r.signalType] ?? SIGNAL_COPY.unknown, fit: unique };
  });
}
