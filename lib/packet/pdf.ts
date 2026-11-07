import fs from "node:fs";
import path from "node:path";
import type { Browser } from "playwright";
import type { Db } from "@/lib/db/client";
import { buildPacket, type Packet, type PageMap } from "@/lib/packet/model";
import { TITLE, headingMarks, renderPacketBody } from "@/components/packet/document";
import { PACKET_CSS } from "@/components/packet/styles";

const FONT_DIR = path.join(process.cwd(), "node_modules", "geist", "dist", "fonts");
const FONTS: [family: string, weight: number, file: string][] = [
  ["Geist", 400, "geist-sans/Geist-Regular.woff2"],
  ["Geist", 500, "geist-sans/Geist-Medium.woff2"],
  ["Geist", 600, "geist-sans/Geist-SemiBold.woff2"],
  ["Geist Mono", 400, "geist-mono/GeistMono-Regular.woff2"],
  ["Geist Mono", 500, "geist-mono/GeistMono-Medium.woff2"],
];

let fontCss: string | null = null;
function fontFaces() {
  fontCss ??= FONTS.map(
    ([family, weight, file]) =>
      `@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${fs.readFileSync(path.join(FONT_DIR, file)).toString("base64")}) format("woff2");}`,
  ).join("\n");
  return fontCss;
}

export function packetHtml(packet: Packet, pages: PageMap | null): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${TITLE} · ${packet.person.name}</title>
<style>${fontFaces()}
:root{--font-sans:"Geist";--font-mono:"Geist Mono";}
html,body{margin:0;background:#fff;}
${PACKET_CSS}</style></head><body>${renderPacketBody(packet, pages)}</body></html>`;
}

const chrome = (inner: string) =>
  `<div style="width:100%;padding:0 0.85in;font-family:Geist,Arial,sans-serif;font-size:7pt;color:#565c68;display:flex;justify-content:space-between;-webkit-print-color-adjust:exact;">${inner}</div>`;

const HEADER = (name: string) => chrome(`<span>${name} · ${TITLE} · Draft</span><span></span>`);
const FOOTER = chrome(`<span>Synthetic EXAMPLE material · Not legal advice</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>`);

const g = globalThis as unknown as { __pow_pdf_browser?: Promise<Browser>; __pow_pdf_cache?: Map<string, Promise<RenderedPacket>> };

/** Playwright's bundled Chromium is not installed everywhere; an installed Edge or Chrome renders the same PDF. */
async function launch(): Promise<Browser> {
  const { chromium } = await import("playwright");
  let last: unknown;
  for (const channel of ["msedge", "chrome", undefined]) {
    try {
      return await chromium.launch(channel ? { channel } : {});
    } catch (err) {
      last = err;
    }
  }
  throw last;
}

async function browser(): Promise<Browser> {
  const existing = g.__pow_pdf_browser && (await g.__pow_pdf_browser.catch(() => null));
  if (existing?.isConnected()) return existing;
  g.__pow_pdf_browser = launch();
  return g.__pow_pdf_browser;
}

async function printPdf(packet: Packet, pages: PageMap | null): Promise<Buffer> {
  const page = await (await browser()).newPage();
  try {
    await page.setContent(packetHtml(packet, pages), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    return await page.pdf({
      format: "Letter",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: HEADER(packet.person.name.replace(/</g, "&lt;")),
      footerTemplate: FOOTER,
      margin: { top: "0.85in", bottom: "0.8in", left: "0.85in", right: "0.85in" },
      outline: true,
      tagged: true,
    });
  } finally {
    await page.close();
  }
}

/** Per-page text with whitespace removed, so a heading split across text runs still matches. */
export async function pageTexts(pdf: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(pdf) });
  const doc = await task.promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    out.push(content.items.map((it) => ("str" in it ? it.str : "")).join("").replace(/\s+/g, "").toLowerCase());
  }
  await task.destroy();
  return out;
}

/** Cover is page 1 and Contents page 2, so headings are looked for from page 3 on, in document order. */
export function locateHeadings(texts: string[], marks: { anchor: string; text: string }[]): PageMap {
  const pages: PageMap = {};
  let from = 2;
  for (const m of marks) {
    const needle = m.text.replace(/\s+/g, "").toLowerCase();
    const i = texts.findIndex((t, idx) => idx >= from && t.includes(needle));
    if (i < 0) continue;
    pages[m.anchor] = i + 1;
    from = i;
  }
  return pages;
}

export type RenderedPacket = { packet: Packet; pages: PageMap; pdf: Buffer; pageCount: number };

/**
 * Two passes: the first prints fixed-width "00" page numbers, the headings are found in its text,
 * and the second prints the real numbers. Number slots have a fixed width, so nothing reflows between passes.
 */
export async function renderPacket(packet: Packet): Promise<RenderedPacket> {
  const draft = await printPdf(packet, null);
  const texts = await pageTexts(draft);
  const pages = locateHeadings(texts, headingMarks(packet));
  const pdf = await printPdf(packet, pages);
  return { packet, pages, pdf, pageCount: texts.length };
}

export function packetFor(db: Db, workspaceId: string): Promise<RenderedPacket> | null {
  const packet = buildPacket(db, workspaceId);
  if (!packet) return null;
  const cache = (g.__pow_pdf_cache ??= new Map());
  const key = `${workspaceId}:${packet.ledgerRevision}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = renderPacket(packet);
    hit.catch(() => cache.delete(key));
    cache.set(key, hit);
    if (cache.size > 24) cache.delete(cache.keys().next().value!);
  }
  return hit;
}

export const PDF_FILENAME = "rin-okafor-evidence-packet-EXAMPLE.pdf";

export function pdfResponse(r: RenderedPacket): Response {
  return new Response(new Uint8Array(r.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${PDF_FILENAME}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

