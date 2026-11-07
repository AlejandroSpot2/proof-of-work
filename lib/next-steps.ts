import type { Entrust, ResolvedCapability } from "@/lib/views/project";
import type { Opportunity } from "@/lib/opportunities";

export type StepEvidence = { id: string; sourceId: string; quote: string; locator: string; projectTitle: string };

export type NextStep = {
  key: "build" | "gap" | "role" | "consult";
  title: string;
  detail: string;
  evidence: StepEvidence[];
  caveat: string | null;
};

const firstEvidence = (parts: ResolvedCapability[]) =>
  parts.flatMap((p) => p.evidence.slice(0, 1)).map((e) => ({ id: e.id, sourceId: e.sourceId, quote: e.quote, locator: e.locator, projectTitle: e.projectTitle }));

/**
 * Concrete next steps for an international builder, assembled only from what is already on screen:
 * the evidenced MVP, the biggest gap, a role whose current posting states sponsorship, and the dossier.
 */
export function nextStepsFor(entrust: Entrust, opportunities: Opportunity[], attorneyQuestionCount: number, firstName: string): NextStep[] {
  const steps: NextStep[] = [];
  const next = entrust.nextBuild;

  if (next) {
    const shown = next.parts.filter((p) => p.support === "demonstrated").length;
    const likely = next.parts.filter((p) => p.support === "inferred").length;
    steps.push({
      key: "build",
      title: `Build the ${next.title.charAt(0).toLowerCase()}${next.title.slice(1)} as a public demo`,
      detail: `${shown} of its ${next.parts.length} parts are already shown in ${firstName}'s work${likely ? `; ${likely} ${likely === 1 ? "is" : "are"} likely but not proven` : ""}. A working demo is evidence a client or employer can open.`,
      evidence: firstEvidence(next.parts).slice(0, 4),
      caveat: null,
    });
  }

  if (entrust.question) {
    steps.push({ key: "gap", title: "Close the biggest gap", detail: entrust.question, evidence: [], caveat: null });
  }

  const role = opportunities
    .filter((o) => o.signalType === "current_posting_states_sponsorship" && o.fit.length > 0)
    .sort((a, b) => b.fit.length - a.fit.length)[0];
  if (role) {
    steps.push({
      key: "role",
      title: `Show it to ${role.company} for the ${role.role.toLowerCase()} role`,
      detail: `Its posting${role.retrieved ? `, read on ${role.retrieved},` : ""} says: “${role.snippet}” ${firstName}'s matching work: ${role.fit.map((f) => f.name.charAt(0).toLowerCase() + f.name.slice(1)).join("; ")}.`,
      evidence: role.fit.flatMap((f) => f.evidence.slice(0, 1)).slice(0, 3),
      caveat: `${role.signal.caveat} Not a job offer or a visa outcome.`,
    });
  }

  steps.push({
    key: "consult",
    title: "Take the dossier to a first attorney consult",
    detail: `It separates what independent sources show from what rests on ${firstName}'s word, and lists ${attorneyQuestionCount} question${attorneyQuestionCount === 1 ? "" : "s"} to ask. It makes no eligibility assessment.`,
    evidence: [],
    caveat: null,
  });

  return steps;
}
