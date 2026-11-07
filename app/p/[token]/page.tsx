import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { resolvePresentation } from "@/lib/workspace";
import { attorneyView, loadSnapshot } from "@/lib/views/project";
import { buildPortfolio } from "@/lib/portfolio";
import { Portfolio } from "@/components/portfolio/Portfolio";
import { Presentation } from "@/components/Presentation";
import s from "@/components/present.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proof of Work", robots: { index: false, follow: false } };

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
  const snap = loadSnapshot(db, pres.workspaceId);
  if (!snap) notFound();
  return (
    <main className={s.page}>
      <div className={s.sheet}>
        <Presentation token={token} view={attorneyView(snap)} />
      </div>
    </main>
  );
}
