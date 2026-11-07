"use client";

import { useEffect, useRef, useState } from "react";
import type { SnapshotClaim } from "@/lib/views/project";
import s from "./studio.module.css";

export type ExampleCorrection = { claim: string; text: string; attribution: string; attributionNote: string; why: string };

export function CorrectionDialog({
  claim,
  suggestion,
  onClose,
  onSave,
}: {
  claim: SnapshotClaim;
  suggestion: ExampleCorrection | null;
  onClose: () => void;
  onSave: (b: { text: string; attribution: string; attributionNote: string; note: string }) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState(claim.text);
  const [attribution, setAttribution] = useState<string>(claim.attribution);
  const [attributionNote, setNote] = useState(claim.attributionNote ?? "");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className={s.dialog} onClose={onClose} aria-labelledby="correct-title">
      <form
        className={s.dialogBody}
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ text, attribution, attributionNote, note: "Correction by the builder" });
        }}
      >
        <h2 id="correct-title" className={s.h3}>
          Correct this claim
        </h2>
        <p className="small muted">The correction becomes revision {claim.revision + 1}. Anything that cited revision {claim.revision} is withdrawn from both views until you re-evaluate. If you change the wording, the claim rests on your word.</p>
        {suggestion && (
          <div className={s.suggestion}>
            <p className="small">{suggestion.why}</p>
            <button
              type="button"
              className="btn btn-small btn-quiet"
              onClick={() => {
                setText(suggestion.text);
                setAttribution(suggestion.attribution);
                setNote(suggestion.attributionNote);
              }}
            >
              Use Rin&apos;s correction (EXAMPLE)
            </button>
          </div>
        )}
        <label>
          Claim
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <label>
          Your role in this work
          <select value={attribution} onChange={(e) => setAttribution(e.target.value)}>
            <option value="author">Author</option>
            <option value="co_author">Co-author</option>
            <option value="contributor">Contributor</option>
            <option value="reviewer">Reviewer</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label>
          Who else, and what they did
          <input value={attributionNote} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className={s.row}>
          <button className="btn">Save correction</button>
          <button type="button" className="btn btn-quiet" onClick={() => ref.current?.close()}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
