import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { ownerWorkspace } from "@/lib/workspace";
import { buildPortfolio } from "@/lib/portfolio";
import { OWNER_COOKIE } from "@/lib/auth";
import { Portfolio } from "@/components/portfolio/Portfolio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Portfolio preview | Proof of Work" };

/** The owner's view of the portfolio exactly as a visitor with the link would see it. */
export default async function PortfolioPreview() {
  const db = getDb();
  const ws = ownerWorkspace(db, (await cookies()).get(OWNER_COOKIE)?.value ?? null);
  if (!ws) redirect("/api/example/start?stage=answered&to=/portfolio");
  const model = buildPortfolio(db, ws.id, { audience: "public" });
  if (!model || !model.projects.length) redirect("/studio");
  return <Portfolio model={model} mode="public" />;
}
