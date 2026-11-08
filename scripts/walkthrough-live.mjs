// Demo/Live phase 1, in a real browser (Edge). Run it against a server whose model is unconfigured, so no paid call can happen:
//   AI_MODEL="none:unset" npx next start -p 3100   then   node scripts/walkthrough-live.mjs [outDir]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = path.resolve(process.argv[2] ?? "live-check");
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, label) => {
  results.push({ ok, label });
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
};
const errors = [];
const browser = await chromium.launch({ channel: "msedge" });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`pageerror ${e.message.slice(0, 200)}`));
page.on("console", (m) => m.type() === "error" && !/favicon/.test(m.text()) && errors.push(m.text().slice(0, 200)));
const shot = async (name, p = page) => {
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(OUT, `${name}.png`) });
};
const modeNav = () => page.getByRole("navigation", { name: "Demo or Live" });

await page.goto(`${BASE}/api/example/start?to=/studio`);
await page.getByRole("button", { name: "Build portfolio" }).first().waitFor({ timeout: 30000 });
check((await modeNav().getByRole("link", { name: "Demo" }).getAttribute("aria-current")) === "page", "Demo is the current mode in the EXAMPLE workspace");
await shot("01-demo-studio");

await modeNav().getByRole("link", { name: "Live" }).click();
await page.waitForURL("**/live");
check(true, "Live with no live workspace yet goes to the /live entry");
await page.getByLabel("Your name").fill("Ada Test");
await page.getByLabel("GitHub handle").fill("ada-test");
await page.getByRole("button", { name: "Start a private live workspace" }).click();
await page.waitForURL("**/studio");
await page.getByText("What works live today").waitFor({ timeout: 30000 });
check((await modeNav().getByRole("link", { name: "Live" }).getAttribute("aria-current")) === "page", "Live is the current mode after starting a live workspace");

const rail = page.getByRole("complementary", { name: "Sources" });
const railText = await rail.innerText();
check(/Statements with quotes\s*Needs setup/.test(railText), "readiness marks statements as needing setup");
check(/Discover\s*Planned/.test(railText) && /Spanish translation\s*Demo only/.test(railText), "readiness keeps Discover planned and translation demo-only, never all live");
check(/AI_MODEL is not set/.test(await page.locator("body").innerText()), "the missing model is named, with what to do");
check(await page.getByRole("button", { name: "Build portfolio" }).first().isDisabled(), "Build waits for a model instead of falling back");
const visible = (await page.locator("aside, main").allInnerTexts()).join("\n");
check(!/EXAMPLE|Rin\b|Okafor/.test(visible), "the live Studio shows no EXAMPLE label, no Rin and no example file");
check(/Start with your own projects\./.test(visible), "the canvas shows an empty state that says what to do");
await shot("02-live-empty");

await page.getByLabel("Project 1 name").fill("Gizmo");
await page.getByLabel("Project 1 link").fill("https://github.com/ada-test/gizmo");
await page.getByLabel("The role you are aiming for").fill("Founding engineer");
await page.getByLabel("Your CV, pasted (optional)").fill("Ada Test\nEngineer. Built Gizmo, an offline notes tool.");
await page.getByLabel("The role you are aiming for").click();
await page.waitForTimeout(800);
check(/This is all a reader gets today\./.test(await page.locator("main").innerText()) && /Built Gizmo, an offline notes tool\./.test(await page.locator("main").innerText()), "the pasted CV becomes the before");
await shot("03-live-filled");

await modeNav().getByRole("link", { name: "Demo" }).click();
await page.getByRole("button", { name: "Build portfolio" }).first().waitFor({ timeout: 30000 });
check(/EXAMPLE/.test(await page.locator("header").innerText()), "Demo returns to the EXAMPLE workspace");
await modeNav().getByRole("link", { name: "Live" }).click();
await page.waitForURL("**/studio");
await page.getByText("What works live today").waitFor({ timeout: 30000 });
await page.waitForTimeout(600);
check((await page.getByLabel("Project 1 name").inputValue()) === "Gizmo", "returning to Live keeps the project draft");
check((await page.getByLabel("The role you are aiming for").inputValue()) === "Founding engineer", "returning to Live keeps the goal");
check(/Built Gizmo/.test(await page.getByLabel("Your CV, pasted (optional)").inputValue()), "returning to Live keeps the pasted CV");

const state = await page.evaluate(async () => (await fetch("/api/state", { cache: "no-store" })).json());
check(state.snapshot.workspace.mode === "live" && state.example === null, "the live workspace holds no EXAMPLE data");
check(!JSON.stringify(state).match(/sk-|api[_-]?key"\s*:/i), "the state response carries no key");

await page.goto(`${BASE}/packet`);
await page.waitForLoadState("networkidle");
const kit = await page.locator("body").innerText();
check(!/EXAMPLE|Rin Okafor|Synthetic/.test(kit), "the live consultation kit page shows no EXAMPLE marks");
await shot("04-live-kit");

const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await context.storageState() });
const pp = await phone.newPage();
await pp.goto(`${BASE}/studio`);
await pp.getByText("What works live today").waitFor({ timeout: 30000 });
await shot("05-phone-live", pp);
const overflow = await pp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
check(overflow <= 1, `phone: no sideways scroll on the live Studio (${overflow}px)`);
await phone.close();

await browser.close();
check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots in ${OUT}`);
process.exit(failed.length ? 1 : 0);
