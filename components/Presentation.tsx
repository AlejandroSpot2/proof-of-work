"use client";

import { useState } from "react";
import type { AttorneyView, PortfolioView } from "@/lib/views/project";
import { AttorneyDoc, PortfolioDoc } from "./docs";
import { SourceDialog, type SourceRequest } from "./SourceDialog";

export function Presentation({ token, view }: { token: string; view: PortfolioView | AttorneyView }) {
  const [req, setReq] = useState<SourceRequest | null>(null);
  const open = (sourceId: string, quote: string) => setReq({ sourceId, quote, token });
  return (
    <>
      {view.audience === "portfolio" ? <PortfolioDoc view={view} onOpen={open} /> : <AttorneyDoc view={view as AttorneyView} onOpen={open} />}
      {req && <SourceDialog req={req} onClose={() => setReq(null)} />}
    </>
  );
}
