import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { ownerWorkspace } from "@/lib/workspace";
import { OWNER_COOKIE } from "@/lib/auth";
import { PacketScreen } from "@/components/packet/PacketScreen";
import s from "@/components/packet/screen.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Evidence packet | Proof of Work", robots: { index: false, follow: false } };

export default async function PacketPage() {
  const token = (await cookies()).get(OWNER_COOKIE)?.value ?? null;
  const ws = ownerWorkspace(getDb(), token);
  if (!ws) redirect("/");
  return (
    <PacketScreen
      workspaceId={ws.id}
      downloadHref="/api/packet/pdf"
      leading={
        <Link className={s.back} href="/studio">
          ← Back to the Studio
        </Link>
      }
    />
  );
}
