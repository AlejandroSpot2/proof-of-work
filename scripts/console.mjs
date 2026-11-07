// Usage: node scripts/console.mjs <path> — prints browser console errors and warnings for a page.
import { chromium } from "playwright";

const url = `http://localhost:3000${process.argv[2] ?? "/"}`;
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") console.log(`[${m.type()}] ${m.text().slice(0, 400)}`);
});
page.on("pageerror", (e) => console.log(`[pageerror] ${e.message.slice(0, 400)}`));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await browser.close();
