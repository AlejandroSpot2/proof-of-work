// The final 3-minute demo, driven end to end in a real browser (Edge). Usage: node scripts/walkthrough-v4.mjs [outDir]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve(process.argv[2] ?? "walkthrough-v4");
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, label) => {
  results.push({ ok, label });
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
};
const errors = [];

const browser = await chromium.launch({ channel: "msedge" });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
const watch = (p) => {
  p.on("pageerror", (e) => errors.push(`pageerror ${e.message.slice(0, 200)}`));
  p.on("console", (m) => m.type() === "error" && !/favicon/.test(m.text()) && errors.push(m.text().slice(0, 200)));
};
watch(page);
const shot = async (name, p = page) => {
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(OUT, `${name}.png`) });
};

await page.goto(BASE + "/");
await shot("01-landing");
check(await page.getByRole("heading", { level: 1, name: "Portfolios for builders, built from their files" }).isVisible(), "landing states what it is");

await page.locator("main").getByRole("link", { name: "Open the Studio" }).first().click();
await page.waitForURL("**/studio");
await page.getByRole("button", { name: "Build portfolio" }).first().waitFor();
await shot("02-studio-before");
check(await page.getByText("This is all a reader gets today.").isVisible(), "the CV is the short before");

await page.getByRole("button", { name: "Build portfolio" }).first().click();
await page.locator("[class*='swarmCaption']").waitFor({ timeout: 30000 });
await page.waitForTimeout(1100);
await shot("03-swarm");
check(await page.getByText(/Illustration: placing the portfolio/).isVisible(), "the reveal is labeled an illustration and is skippable");
await page.locator("[class*='swarmCaption']").waitFor({ state: "detached", timeout: 15000 });
await shot("04-studio-built");
const chips = await page.locator("[data-swarm-origin]").count();
check(chips === 15, `15 source files read (${chips})`);

const canvas = page.locator("main[aria-label='Portfolio preview']");
await canvas.getByRole("button", { name: /Tidepool/ }).first().click();
await page.getByRole("dialog").getByRole("heading", { name: "Tidepool" }).waitFor();
await page.waitForTimeout(900);
await shot("05-project-tidepool");
await page.getByRole("dialog").getByLabel("Scrub the timeline").fill("90");
await page.waitForTimeout(300);
await shot("06-scrubbed-merge");
check(await page.getByText("Both edits survive, field by field.").first().isVisible(), "scrubbing to the end shows the per-field merge");

await page.getByRole("dialog").getByRole("button", { name: /^Proof/ }).first().click();
await page.locator("dialog[open]").waitFor();
await shot("07-proof-drawer");
await page.locator("dialog[open] li button").first().click();
await page.locator("dialog[open] mark").waitFor();
await shot("08-quote-in-file");
check(await page.locator("dialog[open] mark").isVisible(), "a proof quote opens highlighted in its file");
await page.keyboard.press("Escape");
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "← All work" }).click();
await page.waitForTimeout(600);

await canvas.evaluate((el) => {
  const t = el.querySelector("#next");
  if (t) el.scrollTo({ top: t.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 24 });
});
await shot("09-what-next");
check(await canvas.getByText("Offline field-notes app with AI tagging").isVisible(), "a future build assembled from evidenced parts");
await canvas.evaluate((el) => {
  const t = el.querySelector("#sf");
  if (t) el.scrollTo({ top: t.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 24 });
});
await shot("10-sf-roles");
check(await canvas.getByText("Past filings only").isVisible(), "SF roles keep their signal labels");

await page.getByRole("button", { name: "Share portfolio" }).click();
const link = await page.getByLabel("Portfolio link").inputValue();
check(/\/p\//.test(link), "share creates a read-only link");
const pub = await context.newPage();
watch(pub);
await pub.goto(link);
await pub.getByRole("heading", { level: 1 }).waitFor();
await shot("11-shared-portfolio", pub);
check(!(await pub.content()).includes("Consultation"), "the shared portfolio shows no attorney material");
await pub.close();
await page.getByRole("button", { name: "Close" }).click();

await page.getByRole("link", { name: "Consultation kit", exact: true }).click();
await page.waitForURL("**/packet");
await page.waitForLoadState("networkidle");
await shot("12-kit-preview");
const [download] = await Promise.all([page.waitForEvent("download", { timeout: 90000 }), page.getByRole("link", { name: /Download PDF/ }).first().click()]);
const pdfPath = path.join(OUT, download.suggestedFilename());
await download.saveAs(pdfPath);
const head = fs.readFileSync(pdfPath).subarray(0, 5).toString();
check(head === "%PDF-", `the kit downloads as a PDF (${download.suggestedFilename()}, ${(fs.statSync(pdfPath).size / 1024).toFixed(0)} KB)`);

for (const [w, h] of [
  [1280, 720],
  [390, 844],
]) {
  const p = await context.newPage();
  await p.setViewportSize({ width: w, height: h });
  for (const [name, url] of [
    ["landing", "/"],
    ["studio", "/studio"],
    ["portfolio", "/portfolio"],
    ["kit", "/packet"],
  ]) {
    await p.goto(BASE + url);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(OUT, `${w}-${name}.png`) });
  }
  await p.close();
}

await browser.close();
check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots in ${OUT}`);
process.exit(failed.length ? 1 : 0);
