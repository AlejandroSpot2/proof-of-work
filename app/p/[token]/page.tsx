import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { resolvePresentation } from "@/lib/workspace";
import { buildPortfolio } from "@/lib/portfolio";
import { Portfolio } from "@/components/portfolio/Portfolio";
import { PacketScreen } from "@/components/packet/PacketScreen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proof of Work", robots: { index: false, follow: false } };

/** A token opens exactly one presentation: the portfolio, or the consultation kit for an attorney. */
export default async function PresentationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();
  const pres = resolvePresentation(db, token);
  if (!pres) notFound();
  if (pres.audience === "portfolio") {
    const model = buildPortfolio(db, pres.workspaceId, { audience: "public" });
    if (!model) notFound();
    return <Portfolio model={model} sourceToken={token} mode="public" />;
  }
  return <PacketScreen workspaceId={pres.workspaceId} downloadHref={`/api/p/${token}/packet`} />;
}
