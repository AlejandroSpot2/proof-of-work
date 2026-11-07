import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve(process.argv[2] ?? "walkthrough-v2");
const SHOTS = path.resolve("public", "shots");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (ok, label) => {
  results.push({ ok, label });
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
};

async function launch() {
  for (const channel of [undefined, "msedge", "chrome"]) {
    try {
      return await chromium.launch({ channel });
    } catch {}
  }
  throw new Error("No browser available");
}

const browser = await launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const shot = async (name, p = page) => {
  await p.waitForTimeout(350);
  await p.screenshot({ path: path.join(OUT, `${name}.png`) });
};
const supports = () => page.locator("main [data-support-word]").evaluateAll((els) => els.map((e) => e.getAttribute("data-support-word")));
const fits = async (label) => {
  const m = await page.locator("main").evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
  check(m.scroll <= m.client + 2, `${label} fits on one 1440x900 screen (content ${m.scroll}px, sheet ${m.client}px)`);
};
const next = () => page.getByRole("button", { name: /^Next:/ }).click();
const heading = (name) => page.getByRole("heading", { level: 1, name }).waitFor();

await page.goto(BASE + "/");
await shot("01-landing");
check(await page.getByRole("heading", { level: 1, name: "Turn your projects into proof" }).isVisible(), "landing says what it is in its h1");
check((await page.getByRole("link", { name: "See the 3-minute example" }).count()) === 1, "landing has one primary action");

await page.getByRole("link", { name: "See the 3-minute example" }).click();
await page.waitForURL("**/demo");
await heading(/A CV lists claims/);
await shot("02-before");
await fits("The CV step");

await page.getByRole("button", { name: /Read Rin’s 3 projects/ }).click();
await page.getByRole("button", { name: /Rin confirms all 8/ }).waitFor({ timeout: 20000 });
await shot("03-built");
await fits("What Rin built");
const builtText = await page.locator("main").innerText();
check(builtText.includes("contributor-b") && builtText.includes("contributor-c"), "others' part names the other contributors");

await page.getByRole("button", { name: /See the proof/ }).first().click();
await page.locator("dialog[open]").first().waitFor();
await shot("04-proof-drawer");
await page.locator("dialog[open] button[data-context]").first().click();
await page.locator("dialog[open] mark").waitFor();
await shot("05-quote-in-file");
check(await page.locator("dialog[open] mark").isVisible(), "a quote opens in its file, highlighted");
await page.keyboard.press("Escape");
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

await page.getByRole("button", { name: /Rin confirms all 8/ }).click();
await page.getByText("All statements confirmed by Rin").waitFor();

await next();
await heading("What a client can hand Rin");
await page.getByRole("button", { name: "Answer for this client" }).click();
await page.locator("main li[data-support]").first().waitFor();
await shot("06-can-do");
await fits("What Rin can do");
check(JSON.stringify(await supports()) === JSON.stringify(["demonstrated", "demonstrated", "unknown"]), `tasks before correction: ${(await supports()).join(", ")}`);
await crop("can-do");

await next();
await heading(/Where Rin’s work could lead/);
await shot("07-opportunities");
await fits("Where it could lead");
const opp = await page.locator("main").innerText();
check(opp.includes("Historical filings ≠ current policy") && opp.includes("Not legal advice") && opp.includes("Past filings only"), "opportunities carry the three caveats and the past-filings label");

await next();
await heading("What an attorney sees first");
await shot("08-attorney");
await fits("For an attorney");
const att = await page.locator("main").innerText();
check(att.includes("No eligibility assessment") && att.includes("Questions for the first consult"), "attorney step: no eligibility assessment, questions for the first consult");

await next();
await heading("What Rin could build next");
await shot("09-finale");
await fits("What Rin could build next");
const fin = await page.locator("main").innerText();
check(fin.includes("Offline field-notes app with AI tagging") && fin.includes("Show it to Fieldmark (EXAMPLE)"), "finale shows the MVP and a sourced next step");
await crop("next");

await page.keyboard.press("ArrowLeft");
await heading("What an attorney sees first");
check(true, "arrow keys move between steps");

await page.getByRole("button", { name: "Compare both views" }).click();
await page.locator("dialog[open]").waitFor();
await shot("10-compare-views");
await page.keyboard.press("Escape");
await page.getByRole("button", { name: /Kerf correction/ }).click();
await page.getByRole("button", { name: "Use Rin's correction (EXAMPLE)" }).click();
await page.getByRole("button", { name: "Save correction" }).click();
await page.locator("dialog[open]").waitFor({ state: "detached" }).catch(() => {});
await page.goto(BASE + "/demo?step=can-do");
await heading("What a client can hand Rin");
await page.getByText(/was taken out of the client view and the dossier/).waitFor();
await shot("11-correction-withdrawn");
await page.getByRole("button", { name: "Check again" }).click();
await page.getByText(/was taken out of the client view/).waitFor({ state: "detached" });
await shot("12-can-do-after-correction");
check(JSON.stringify(await supports()) === JSON.stringify(["demonstrated", "inferred", "unknown"]), `tasks after correction: ${(await supports()).join(", ")}`);

await page.goto(BASE + "/demo?step=built");
await heading("What Rin built");
await crop("built");

for (const [w, h] of [[768, 1024], [390, 844]]) {
  await page.setViewportSize({ width: w, height: h });
  for (const step of ["before", "can-do", "next"]) {
    await page.goto(`${BASE}/demo?step=${step}`);
    await page.locator("main h1").waitFor();
    await shot(`${w}-${step}`);
  }
  await page.goto(BASE + "/");
  await shot(`${w}-landing`);
}

await browser.close();

async function crop(name) {
  await page.locator("main").screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots in ${OUT}`);
process.exit(failed.length ? 1 : 0);
