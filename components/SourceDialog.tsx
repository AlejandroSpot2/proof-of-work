"use client";

import { useEffect, useRef, useState } from "react";
import s from "./studio.module.css";

export type SourceRequest = { sourceId: string; quote: string; token?: string };
type Source = { id: string; url: string; locator: string; status: string; fetchedAt: number; contentHash: string; text: string };

function escapeRe(x: string) {
  return x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Finds the quote in the source, allowing only the whitespace and typographic differences the quote check allows. */
function locate(text: string, quote: string): [number, number] | null {
  if (!quote) return null;
  const exact = text.indexOf(quote);
  if (exact >= 0) return [exact, exact + quote.length];
  const pattern = quote
    .trim()
    .split(/\s+/)
    .map((w) => escapeRe(w).replace(/['‘’]/g, "['‘’]").replace(/["“”]/g, '["“”]'))
    .join("\\s+");
  const m = new RegExp(pattern).exec(text);
  return m ? [m.index, m.index + m[0].length] : null;
}

export function SourceDialog({ req, onClose }: { req: SourceRequest; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const markRef = useRef<HTMLElement>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ref.current?.showModal();
    const url = req.token ? `/api/p/${req.token}/source/${req.sourceId}` : `/api/source/${req.sourceId}`;
    fetch(url)
      .then(async (r) => (r.ok ? setSource(await r.json()) : setError("This source is not available to this view.")))
      .catch(() => setError("Could not load the source."));
  }, [req]);

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center" });
  }, [source]);

  const range = source ? locate(source.text, req.quote) : null;
  return (
    <dialog ref={ref} className={s.dialog} onClose={onClose} aria-labelledby="src-title">
      <div className={s.dialogBody}>
        <div className={s.dialogHead}>
          <h2 id="src-title" className={s.h3}>
            {source ? source.locator : "Source"}
          </h2>
          <button className="btn btn-small btn-quiet" onClick={() => ref.current?.close()} autoFocus>
            Close
          </button>
        </div>
        {error && <p>{error}</p>}
        {source && (
          <>
            <p className="small muted">
              {source.url}. Read {new Date(source.fetchedAt).toISOString().slice(0, 16).replace("T", " ")} UTC. Content hash {source.contentHash}.
              {req.quote ? (range ? " The quote is highlighted where it appears." : " The quote was not found in this copy.") : ""}
            </p>
            <pre className={s.sourceText}>
              {range ? (
                <>
                  {source.text.slice(0, range[0])}
                  <mark ref={markRef}>{source.text.slice(range[0], range[1])}</mark>
                  {source.text.slice(range[1])}
                </>
              ) : (
                source.text
              )}
            </pre>
          </>
        )}
      </div>
    </dialog>
  );
}
