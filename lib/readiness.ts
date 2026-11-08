import { modelStatus } from "@/lib/ai/model";
import { ENDPOINTS, tregSetup } from "@/lib/treg";
import { usd } from "@/lib/discover";

/** One row per feature: what works in Live today, what needs setup, and what is still Demo only. Never the whole app as "live". */
export type FeatureStatus = "ready" | "needs-setup" | "demo-only";
export type Readiness = { feature: string; status: FeatureStatus; detail: string }[];

export function liveReadiness(env: Record<string, string | undefined> = process.env): Readiness {
  const model = modelStatus(env);
  const modelRow = model.ready
    ? { status: "ready" as const, detail: `Uses ${model.label}. Every statement must quote its file word for word.` }
    : { status: "needs-setup" as const, detail: `${model.reason} Add it to .env.local and restart the server. Nothing is filled in without it.` };
  return [
    {
      feature: "Sources from public GitHub",
      status: "ready",
      detail: env.GITHUB_TOKEN ? "Read-only, with your GitHub token." : "Read-only and unauthenticated: GitHub allows about 60 requests an hour. GITHUB_TOKEN in .env.local raises it.",
    },
    { feature: "Statements with quotes", ...modelRow },
    { feature: "Capabilities for your goal", ...modelRow },
    { feature: "Review and correct", status: "ready", detail: "Nothing reaches the portfolio until it is confirmed." },
    { feature: "Portfolio and share link", status: "ready", detail: "Read-only and revocable." },
    { feature: "Consultation kit (PDF)", status: "ready", detail: "Built from your confirmed statements and files only." },
    model.ready
      ? { feature: "Spanish translation", status: "ready", detail: `On request, with ${model.label}: one call per portfolio version, then cached. Quotes, files and names are never translated.` }
      : { feature: "Spanish translation", status: "needs-setup", detail: `${model.reason} Until then only the interface words switch.` },
    model.ready
      ? { feature: "Apply for a role", status: "ready", detail: `Paste a posting; ${model.label} reads its requirements, and your confirmed statements decide what is backed.` }
      : { feature: "Apply for a role", status: "needs-setup", detail: `${model.reason} Reading a posting needs it.` },
    { feature: "Strengthen and cofounder", status: "demo-only", detail: "These use the prepared demo data for now." },
    discoverRow(env),
  ];
}

function discoverRow(env: Record<string, string | undefined>): Readiness[number] {
  const treg = tregSetup(env);
  if (!treg.ready) {
    return {
      feature: "Discover",
      status: "needs-setup",
      detail: `${treg.reason} Add TREG_TOKEN and TREG_MAX_SPEND_MICRO (your spend cap in micro-USD; 1000000 is $1) to .env.local and restart the server. A token alone never spends.`,
    };
  }
  const most = (search: keyof typeof ENDPOINTS) => usd(ENDPOINTS[search].maxCostMicro + ENDPOINTS["openrouter.ai-judge.decide"].maxCostMicro);
  return {
    feature: "Discover",
    status: "ready",
    detail: `Public profiles and posts through Treg, with Jev only for relevance. Spending stops at your cap of ${usd(treg.config.capMicro)}. One search costs at most ${most("treg.people.search")} for cofounders and ${most("treg.x.search.posts")} for clients.`,
  };
}
