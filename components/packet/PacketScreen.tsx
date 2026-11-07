import type { ReactNode } from "react";
import { getDb } from "@/lib/db/client";
import { buildPacket } from "@/lib/packet/model";
import { packetFor } from "@/lib/packet/pdf";
import { renderPacketBody } from "@/components/packet/document";
import { PACKET_CSS } from "@/components/packet/styles";
import s from "./screen.module.css";

/** The packet on screen as paper pages, with the same markup and page numbers as the PDF it downloads. */
export async function PacketScreen({ workspaceId, downloadHref, leading }: { workspaceId: string; downloadHref: string; leading?: ReactNode }) {
  const db = getDb();
  const rendered = await packetFor(db, workspaceId)?.catch((err: unknown) => {
    console.error("packet render failed", err);
    return null;
  });
  const packet = rendered?.packet ?? buildPacket(db, workspaceId);
  if (!packet) return null;
  return (
    <main className={s.screen}>
      <header className={s.bar}>
        {leading}
        <div className={s.title}>
          <strong>Evidence packet for a first consult</strong>
          <span>
            {packet.person.name} · {packet.summary.exhibits} exhibits{rendered ? ` · ${rendered.pageCount} pages` : ""} · ledger rev {packet.ledgerRevision}
          </span>
        </div>
        <span className={s.spacer} />
        <a className={s.download} href={downloadHref} download="rin-okafor-evidence-packet-EXAMPLE.pdf">
          Download PDF
        </a>
      </header>
      {!rendered && <p className={s.notice}>Page numbers are not available because the PDF renderer could not start. The download may fail too.</p>}
      <style dangerouslySetInnerHTML={{ __html: PACKET_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: renderPacketBody(packet, rendered?.pages ?? null) }} />
    </main>
  );
}
