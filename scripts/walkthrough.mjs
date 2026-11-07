import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve(process.argv[2] ?? "walkthrough");
fs.mkdirSync(OUT, { recursive: true });

const started = Date.now();
const results = [];
function check(ok, label) {
  results.push({ ok, label });
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
}

async function launch() {
  for (const channel of [undefined, "msedge", "chrome"]) {
    try {
      return await chromium.launch({ channel });
    } catch {}
  }
  throw new Error("No Chromium, Edge or Chrome available");
}

const browser = await launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on("dialog", (d) => d.accept("Not my work"));
const shot = async (name, opts = {}) => {
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), ...opts });
};

await page.goto(BASE + "/");
await shot("01-hook-flat-cv");
check(await page.getByRole("heading", { level: 1, name: "A resume says what you claim." }).isVisible(), "hook headline visible on first screen");

await page.getByRole("button", { name: "Open the EXAMPLE workspace" }).first().click();
await page.waitForURL("**/studio");
await page.getByRole("button", { name: "Import 3 projects" }).click();
await page.getByText("Approve all").waitFor();
await page.locator("#projects").scrollIntoViewIfNeeded();
await shot("02-sources-with-status");
const read = await page.locator("#projects").getByText("Read", { exact: true }).count();
check(read === 15, `15 sources read across 3 projects (got ${read})`);

await page.locator("#claims").scrollIntoViewIfNeeded();
await page.locator("#claims button[title='Open in source']").first().click();
await page.locator("dialog[open] mark").waitFor();
await shot("03-quote-in-source");
check(await page.locator("dialog[open] mark").isVisible(), "clicked quote is highlighted inside its source");
await page.locator("dialog[open]").getByRole("button", { name: "Close" }).click();

await page.getByRole("button", { name: /Approve all \d+ quoted claims/ }).click();
await page.getByRole("button", { name: "Ask" }).waitFor();
await page.locator("#claims").scrollIntoViewIfNeeded();
await shot("04-claims-approved");

await page.getByRole("button", { name: "Ask" }).click();
await page.getByRole("heading", { name: /What can you entrust to Rin Okafor, and why\?/ }).waitFor();
await page.locator("#entrust").scrollIntoViewIfNeeded();
await shot("05-entrust-answer", { fullPage: false });
const supports = await page.locator("#entrust article [class*='support']").allInnerTexts();
check(JSON.stringify(supports) === JSON.stringify(["Demonstrated", "Demonstrated", "Unknown"]), `capabilities before correction: ${supports.join(", ")}`);

await page.locator("#views").scrollIntoViewIfNeeded();
await shot("06-two-views-before");
const viewsBefore = await page.locator("#views").innerText();
check(viewsBefore.includes("Own releases and preview deploys"), "both views show the deploy capability before correction");

await page.locator("#entrust").getByRole("button", { name: /Correct “Co-maintains Kerf/ }).click();
await page.getByRole("button", { name: "Use Rin's correction (EXAMPLE)" }).click();
await shot("07-correction-dialog");
await page.getByRole("button", { name: "Save correction" }).click();
await page.getByText("The ledger changed since this answer.").waitFor();
await page.locator("#views").scrollIntoViewIfNeeded();
await shot("08-views-capability-withdrawn");
const portfolioText = await page.locator("[data-doc=portfolio]").innerText();
const dossierText = await page.locator("[data-doc=attorney]").innerText();
check(!portfolioText.includes("Own releases and preview deploys"), "portfolio dropped the obsolete capability");
check(dossierText.includes("Withdrawn after human review") && dossierText.includes("Own releases and preview deploys"), "dossier records the withdrawal");

await page.getByRole("button", { name: "Re-evaluate" }).click();
await page.getByText("The ledger changed since this answer.").waitFor({ state: "detached" });
await page.locator("#entrust").scrollIntoViewIfNeeded();
await shot("09-entrust-after-correction");
const after = await page.locator("#entrust article [class*='support']").allInnerTexts();
check(JSON.stringify(after) === JSON.stringify(["Demonstrated", "Inferred", "Unknown"]), `capabilities after correction: ${after.join(", ")}`);
await page.locator("#views").scrollIntoViewIfNeeded();
await shot("10-two-views-after");
const pAfter = await page.locator("[data-doc=portfolio] [data-support]").evaluateAll((els) => els.map((e) => e.getAttribute("data-support")));
const dAfter = await page.locator("[data-doc=attorney] [data-support]").evaluateAll((els) => els.map((e) => e.getAttribute("data-support")));
check(JSON.stringify(pAfter) === JSON.stringify(dAfter), `both views agree after correction: ${pAfter.join(", ")}`);

await page.locator("#next").scrollIntoViewIfNeeded();
await shot("11-what-next-and-opportunities");
await page.screenshot({ path: path.join(OUT, "15-studio-full.png"), fullPage: true });
const nextText = await page.locator("#next").innerText();
check(nextText.includes("Offline field-notes app with AI tagging"), "what-next proposal shown");
check(nextText.includes("Past filings only") && nextText.includes("Historical filings are not current policy"), "historical filings labeled as not current");

const [portfolioTab] = await Promise.all([
  context.waitForEvent("page"),
  (async () => {
    await page.locator("#views").getByRole("button", { name: "Create private link" }).first().click();
    await page.locator("#views").getByRole("link", { name: "Open link" }).first().click();
  })(),
]);
await portfolioTab.waitForLoadState();
await portfolioTab.screenshot({ path: path.join(OUT, "12-portfolio-link.png"), fullPage: true });
const portfolioUrl = portfolioTab.url();
check(!(await portfolioTab.content()).includes("Questions for your attorney"), "portfolio link never shows dossier content");

await page.locator("#views").getByRole("button", { name: "Create private link" }).first().click();
const [dossierTab] = await Promise.all([context.waitForEvent("page"), page.locator("#views").getByRole("link", { name: "Open link" }).nth(1).click()]);
await dossierTab.waitForLoadState();
await dossierTab.screenshot({ path: path.join(OUT, "13-attorney-dossier-link.png"), fullPage: true });
check((await dossierTab.content()).includes("No eligibility assessment"), "dossier states no eligibility assessment");

await Promise.all([
  page.waitForResponse((r) => r.url().includes("/api/presentations/") && r.request().method() === "DELETE"),
  page.locator("#views").getByRole("button", { name: "Revoke" }).first().click(),
]);
const anon = await browser.newContext();
const res = await (await anon.newPage()).goto(portfolioUrl);
check(res.status() === 404, `revoked portfolio link returns 404 (got ${res.status()})`);
const noSession = await anon.request.post(BASE + "/api/goal", { data: { text: "x" } });
check(noSession.status() === 401 || noSession.status() === 403, `no session cannot edit (got ${noSession.status()})`);

await page.goto(BASE + "/");
await page.setViewportSize({ width: 390, height: 844 });
await shot("14-hook-phone");

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed in ${((Date.now() - started) / 1000).toFixed(1)}s. Screenshots in ${OUT}`);
process.exit(failed.length ? 1 : 0);
