"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { LANGS, type Lang } from "@/lib/i18n";

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** Arrow keys move the choice, as in a native radio group. */
export function Radios<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T | null;
  options: { value: T; content: ReactNode }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const current = Math.max(0, options.findIndex((o) => o.value === value));
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = STEP[e.key];
    if (!step) return;
    e.preventDefault();
    const i = (current + step + options.length) % options.length;
    onChange(options[i]!.value);
    e.currentTarget.querySelectorAll<HTMLElement>("[role='radio']")[i]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={className} onKeyDown={onKey}>
      {options.map((o, i) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} tabIndex={i === current ? 0 : -1} onClick={() => onChange(o.value)}>
          {o.content}
        </button>
      ))}
    </div>
  );
}

export function LangSwitch({ label, lang, onLang, className }: { label: string; lang: Lang; onLang: (lang: Lang) => void; className?: string }) {
  return (
    <div role="group" aria-label={label} className={className}>
      {LANGS.map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={l === lang} onClick={() => onLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
