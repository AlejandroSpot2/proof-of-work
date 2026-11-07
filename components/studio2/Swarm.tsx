"use client";

import { useEffect, useRef } from "react";
import s from "./studio2.module.css";

const ARROW = "M1 1 L1 27 L8 20.5 L12.6 31 L17 29.2 L12.4 18.8 L22 18.8 Z";
const COLORS = ["#2747e8", "#0e1116", "#2747e8", "#4a5160", "#2747e8", "#0e1116"];
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

type Rect = { x: number; y: number; w: number; h: number };
const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

/**
 * A composition illustration, not agents at work: the portfolio is already built when this runs.
 * Cursors labeled with the files that were read fly from the sources rail and place each visible
 * block of the portfolio. Skippable; reduced motion shows the final state at once.
 */
export function Swarm({ canvas, rail, onDone, fileCount }: { canvas: HTMLElement; rail: HTMLElement; onDone: () => void; fileCount: number }) {
  const overlay = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = overlay.current;
    let over = false;
    const stop = (targets: HTMLElement[], anims: Animation[], timers: number[]) => {
      timers.forEach((t) => clearTimeout(t));
      anims.forEach((a) => a.cancel());
      targets.forEach((t) => {
        t.style.clipPath = "";
        t.style.opacity = "";
      });
      layer?.querySelectorAll(`.${s.cursor}, .${s.selection}`).forEach((n) => n.remove());
    };
    const finish = (targets: HTMLElement[], anims: Animation[], timers: number[]) => {
      if (over) return;
      over = true;
      stop(targets, anims, timers);
      onDone();
    };

    const view = rectOf(canvas);
    const targets = [...canvas.querySelectorAll<HTMLElement>("[data-swarm]")]
      .filter((el) => {
        const r = rectOf(el);
        return r.h > 0 && r.y < view.y + view.h - 40 && r.y + r.h > view.y + 20;
      })
      .filter((el, _, all) => !all.some((o) => o !== el && o.contains(el) && o.dataset.swarm !== "hero"))
      .filter((el) => el.dataset.swarm !== "hero")
      .slice(0, 9);
    const origins = [...rail.querySelectorAll<HTMLElement>("[data-swarm-origin]")];

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !layer || !targets.length) {
      finish(targets, [], []);
      return;
    }

    targets.forEach((t) => {
      t.style.clipPath = "inset(0 0 100% 0)";
    });

    const anims: Animation[] = [];
    const timers: number[] = [];
    const N = Math.min(12, Math.max(6, targets.length + 3));
    const cursors = Array.from({ length: N }, (_, i) => {
      const origin = origins[i % Math.max(1, origins.length)];
      const label = origin?.dataset.swarmOrigin ?? "";
      const el = document.createElement("div");
      el.className = s.cursor ?? "";
      const color = COLORS[i % COLORS.length]!;
      el.innerHTML = `<svg width="24" height="34" viewBox="0 0 24 34" aria-hidden="true"><path d="${ARROW}" fill="${color}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>${label ? `<span style="background:${color}">${label}</span>` : ""}`;
      layer.appendChild(el);
      const start = origin ? rectOf(origin) : { x: view.x - 40, y: view.y + view.h / 2, w: 0, h: 0 };
      const pos = { x: start.x + start.w / 2, y: start.y + start.h / 2 };
      el.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
      anims.push(el.animate([{ opacity: 0, transform: `translate(${pos.x}px, ${pos.y}px) scale(0.6)` }, { opacity: 1, transform: `translate(${pos.x}px, ${pos.y}px) scale(1)` }], { duration: 220, delay: i * 40, easing: EASE, fill: "both" }));
      return { el, pos };
    });

    const move = (c: (typeof cursors)[number], x: number, y: number, duration: number, delay: number) => {
      const from = `translate(${c.pos.x}px, ${c.pos.y}px)`;
      const to = `translate(${x}px, ${y}px)`;
      anims.push(c.el.animate([{ transform: from }, { transform: to }], { duration, delay, easing: EASE, fill: "forwards" }));
      c.pos = { x, y };
    };

    const STEP = 260;
    targets.forEach((t, k) => {
      const c = cursors[k % N]!;
      const r = rectOf(t);
      const t0 = 260 + k * STEP;
      move(c, r.x, r.y, 460, t0);
      const sel = document.createElement("div");
      sel.className = s.selection ?? "";
      sel.style.left = `${r.x}px`;
      sel.style.top = `${r.y}px`;
      layer.appendChild(sel);
      const draw = t0 + 460;
      anims.push(sel.animate([{ width: "0px", height: "0px", opacity: 1 }, { width: `${r.w}px`, height: `${r.h}px`, opacity: 1 }], { duration: 380, delay: draw, easing: EASE, fill: "forwards" }));
      move(c, r.x + Math.min(r.w, 900), r.y + r.h, 380, draw);
      anims.push(t.animate([{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)" }], { duration: 460, delay: draw + 220, easing: EASE, fill: "forwards" }));
      anims.push(sel.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: draw + 640, fill: "forwards" }));
    });

    // the cursors with no block of their own drift over the canvas instead of idling in the rail
    cursors.slice(targets.length).forEach((c, i) => {
      move(c, view.x + view.w * (0.25 + 0.15 * i), view.y + view.h * (0.3 + 0.12 * (i % 3)), 900, 300 + i * 120);
    });

    const end = 260 + targets.length * STEP + 1100;
    cursors.forEach((c, i) => {
      anims.push(c.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: end - 200 + i * 20, fill: "forwards" }));
    });
    timers.push(window.setTimeout(() => finish(targets, anims, timers), end + 300));

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(targets, anims, timers);
    };
    window.addEventListener("keydown", onKey);
    layer.dataset.ready = "true";
    const skip = layer.querySelector("button");
    skip?.addEventListener("click", () => finish(targets, anims, timers));
    return () => {
      window.removeEventListener("keydown", onKey);
      if (!over) stop(targets, anims, timers);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={overlay} className={s.swarm} aria-hidden="false">
      <div className={s.swarmCaption} role="status">
        <span>Illustration: placing the portfolio built from the {fileCount} files just read</span>
        <button type="button">Skip</button>
      </div>
    </div>
  );
}
