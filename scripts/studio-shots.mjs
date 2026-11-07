// Captures the Studio before a build, during the reveal, and after. Usage: node scripts/studio-shots.mjs <outDir> [width] [height]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const out = path.resolve(process.argv[2] ?? "walkthrough-v3");
const w = Number(process.argv[3] ?? 1440);
const h = Number(process.argv[4] ?? 900);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: w, height: h } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto("http://localhost:3000/api/example/start?to=/studio", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Build portfolio" }).first().waitFor();
await page.screenshot({ path: path.join(out, `${w}-studio-before.png`) });
await page.getByRole("button", { name: "Build portfolio" }).first().click();
await page.waitForTimeout(250);
await page.screenshot({ path: path.join(out, `${w}-studio-reading.png`) });
await page.locator("[class*='swarmCaption']").waitFor({ timeout: 20000 });
for (const t of [600, 1300, 2200]) {
  await page.waitForTimeout(t === 600 ? 600 : 700);
  await page.screenshot({ path: path.join(out, `${w}-swarm-${t}.png`) });
}
await page.locator("[class*='swarmCaption']").waitFor({ state: "detached", timeout: 15000 });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(out, `${w}-studio-built.png`) });
console.log(errors.length ? `errors:\n${errors.join("\n").slice(0, 1500)}` : "no console errors");
await browser.close();
