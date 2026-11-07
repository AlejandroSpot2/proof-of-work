// Usage: node scripts/shot.mjs <path-or-url> <out.png> [width] [height] [full] [clickSelector] [waitMs]
import { chromium } from "playwright";

const [, , target, out, w = "1440", h = "900", full = "", click = "", wait = "1200"] = process.argv;
const url = target.startsWith("http") ? target : `http://localhost:3000${target}`;
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
await page.goto(url, { waitUntil: "networkidle" });
if (click) {
  await page.locator(click).first().click();
}
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out, fullPage: full === "full" });
await browser.close();
console.log("saved", out);
