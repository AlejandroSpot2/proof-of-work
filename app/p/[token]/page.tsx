import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { resolvePresentation } from "@/lib/workspace";
import { attorneyView, loadSnapshot, portfolioView } from "@/lib/views/project";
import { Presentation } from "@/components/Presentation";
import s from "@/components/present.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Presentation | Proof of Work", robots: { index: false, follow: false } };

export default async function PresentationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();
  const pres = resolvePresentation(db, token);
  if (!pres) notFound();
  const snap = loadSnapshot(db, pres.workspaceId);
  if (!snap) notFound();
  const view = pres.audience === "portfolio" ? portfolioView(snap) : attorneyView(snap);
  return (
    <main className={s.page}>
      <header className={`${s.bar} no-print`}>
        <span className={s.wordmark}>Proof of Work</span>
        <span className="small">
          {pres.audience === "portfolio" ? "Read-only portfolio link." : "Private dossier link. Print to save a PDF."} Revocable by the owner.
        </span>
      </header>
      <div className={s.sheet}>
        <Presentation token={token} view={view} />
      </div>
    </main>
  );
}
