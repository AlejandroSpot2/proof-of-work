// Next steps, driven in a real browser (Edge): the three paths in EN and ES, a false-claim scan, desktop and phone shots.
// Usage: node scripts/walkthrough-next.mjs [outDir]   (dev server on :3000)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve(process.argv[2] ?? "walkthrough-next");
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, label) => {
  results.push({ ok, label });
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
};
const errors = [];

// words that would be false or out of bounds anywhere in next steps or the portfolio
const FORBIDDEN = [
  /guarantee|garantiza/i,
  /visa (is )?(approved|granted)|visa aprobada/i,
  /match score|% match|compatibilidad del \d/i,
  /\bendorse|\bavala\b|recommended by/i,
  /has accepted|accepted your|aceptó|ha aceptado/i,
  /\bwas sent\b|message sent|mensaje enviado|se envió/i,
  /\byou are hired\b|\bcontratad[oa]\b/i,
];

const browser = await chromium.launch({ channel: "msedge" });

async function studio(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror ${e.message.slice(0, 200)}`));
  page.on("console", (m) => m.type() === "error" && !/favicon/.test(m.text()) && errors.push(m.text().slice(0, 200)));
  await page.goto(`${BASE}/api/example/start?stage=answered&to=/studio`);
  await page.getByRole("tablist").waitFor({ timeout: 30000 });
  return { context, page };
}

const shot = async (page, name) => {
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
};
const panelText = (page) => page.locator("main[aria-label='Portfolio preview']").innerText();
const setLang = async (page, lang) => {
  await page.getByRole("group", { name: /Language|Idioma/ }).first().getByRole("button", { name: lang.toUpperCase(), exact: true }).click();
  await page.waitForTimeout(300);
};
const openNext = (page) => page.getByRole("tab", { name: /next steps|próximos pasos/i }).click();
const path_ = (page, i) => page.getByRole("radiogroup").first().getByRole("radio").nth(i).click();
const scan = (text, where) => {
  const hit = FORBIDDEN.find((re) => re.test(text));
  check(!hit, `no false or out-of-bounds claim in ${where}${hit ? ` (matched ${hit})` : ""}`);
};

{
  const { context, page } = await studio({ width: 1440, height: 900 });
  check((await page.getByRole("tab").count()) === 2, "the Studio canvas has two tabs: the portfolio and the next steps");
  check(await page.getByRole("link", { name: "Consultation kit", exact: true }).isVisible(), "the header still links to the consultation kit by its exact name");

  for (const lang of ["en", "es"]) {
    await openNext(page);
    await setLang(page, lang);

    // 1 · apply
    await path_(page, 0);
    await page.waitForTimeout(500);
    const t1 = await panelText(page);
    const backed = (t1.match(lang === "en" ? /Backed by evidence/g : /Respaldado por evidencia/g) ?? []).length;
    const gaps = (t1.match(lang === "en" ? /\bGap\b/g : /Sin evidencia/g) ?? []).length;
    check(backed === 4 && gaps >= 2, `[${lang}] apply: 4 requirements backed, 2 gaps (${backed}/${gaps})`);
    check(t1.includes("Contributor C"), `[${lang}] apply: the deploy gap names Contributor C as the author`);
    check(t1.includes("You can merge conflicting edits from devices that reconnect."), `[${lang}] apply: posting lines stay as written`);
    check(/4 (of|de) (the )?6|4 de los 6/.test(t1), `[${lang}] apply: the score and the intro say 4 of 6`);
    const order = await page.locator("[data-swarm='index'] [data-swarm^='index-']").evaluateAll((els) => els.map((e) => e.getAttribute("data-swarm")));
    check(order[0] === "index-tidepool", `[${lang}] apply: the tailored portfolio leads with Tidepool (${order.join(", ")})`);
    if (lang === "es") check((await page.locator("[data-translated]").count()) > 5, "[es] apply: translated text is marked");
    scan(t1, `[${lang}] apply`);
    await shot(page, `next-${lang}-1-apply`);
    await page.locator("main[aria-label='Portfolio preview'] [data-swarm='index']").scrollIntoViewIfNeeded();
    await shot(page, `next-${lang}-1-apply-portfolio`);

    // a backed requirement opens its file at the quote
    const chip = page.locator("main[aria-label='Portfolio preview'] button", { hasText: /PR-12\.md/ }).first();
    if (await chip.count()) {
      await chip.scrollIntoViewIfNeeded();
      await chip.click();
      await page.locator("dialog[open] mark").first().waitFor({ timeout: 8000 }).catch(() => {});
      check(await page.locator("dialog[open] mark").first().isVisible().catch(() => false), `[${lang}] apply: a proof chip opens the file with the quote highlighted`);
      await page.keyboard.press("Escape");
    } else check(false, `[${lang}] apply: a proof chip for PR-12.md exists`);

    // 2 · strengthen
    await page.locator("main[aria-label='Portfolio preview']").evaluate((el) => el.scrollTo({ top: 0 }));
    await path_(page, 1);
    await page.waitForTimeout(500);
    const t2 = await panelText(page);
    const cards = await page.locator("main[aria-label='Portfolio preview'] ol li, main[aria-label='Portfolio preview'] [data-improvement]").count();
    check(/Publish a demo of Tidepool's offline merge|Publicar una demo de la fusión offline de Tidepool/.test(t2), `[${lang}] strengthen: the first improvement is the Tidepool demo`);
    check(/not true yet|todavía no es cierto|aún no es cierto|no es cierto todavía/i.test(t2), `[${lang}] strengthen: the "if done" state is labeled as not true yet`);
    check(cards > 0, `[${lang}] strengthen: improvement cards render (${cards})`);
    scan(t2, `[${lang}] strengthen`);
    await shot(page, `next-${lang}-2-strengthen`);
    const goals = page.getByRole("radiogroup").nth(1).getByRole("radio");
    if ((await goals.count()) > 1) {
      await goals.nth(1).click();
      await page.waitForTimeout(400);
      const t2b = await panelText(page);
      check(/Set up the deploys for Tidepool's demo yourself|Montar por tu cuenta los despliegues/.test(t2b), `[${lang}] strengthen: the Fieldmark goal brings the own-deploys improvement`);
      await shot(page, `next-${lang}-2-strengthen-fieldmark`);
    } else check(false, `[${lang}] strengthen: two goals to pick from`);

    // 3 · cofounder
    await path_(page, 2);
    await page.waitForTimeout(500);
    const t3 = await panelText(page);
    check(/Synthetic EXAMPLE profile|Perfil sintético/i.test(t3), `[${lang}] cofounder: the profile is labeled synthetic`);
    check(/Sol Arrieta/.test(t3), `[${lang}] cofounder: one possible cofounder is shown`);
    check(/Nothing is sent|No se envía nada/i.test(t3), `[${lang}] cofounder: the draft says nothing is sent`);
    check((await page.getByRole("button", { name: /^(send|enviar)/i }).count()) === 0, `[${lang}] cofounder: there is no send button`);
    check(await page.getByRole("button", { name: /Copy draft|Copiar borrador/i }).isVisible(), `[${lang}] cofounder: the draft can be copied`);
    scan(t3, `[${lang}] cofounder`);
    await shot(page, `next-${lang}-3-cofounder`);
    await page.getByRole("button", { name: /Copy draft|Copiar borrador/i }).scrollIntoViewIfNeeded();
    await shot(page, `next-${lang}-3-cofounder-draft`);

    // the portfolio itself in this language
    await page.getByRole("tab", { name: /^Portfolio$|^Portafolio$/ }).click();
    await page.waitForTimeout(500);
    const tp = await panelText(page);
    if (lang === "es") {
      check(/Construye sincronización offline/.test(tp), "[es] portfolio: the headline is translated");
      check((await page.locator("[data-translated]").count()) > 10, "[es] portfolio: translated text is marked");
    } else {
      check(/Builds offline-first sync/.test(tp), "[en] portfolio: the headline is the original");
      check((await page.locator("[data-translated]").count()) === 0, "[en] portfolio: nothing is marked translated");
    }
    scan(tp, `[${lang}] portfolio`);
    await shot(page, `portfolio-${lang}`);
    // proof quotes stay in the original language
    await page.locator("main[aria-label='Portfolio preview']").getByRole("button", { name: /^Proof|^Prueba/ }).first().click();
    await page.locator("dialog[open]").waitFor();
    const quote = await page.locator("dialog[open] li button span").first().innerText();
    check(/^“[A-Za-z0-9]/.test(quote) && !/[áéíóúñ¿¡]/.test(quote), `[${lang}] portfolio: proof quotes stay word for word in English (${quote.slice(0, 50)})`);
    await page.keyboard.press("Escape");
  }
  await context.close();
}

// the visitor's portfolio has its own switch
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/api/example/start?stage=published`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  const sw = page.getByRole("group", { name: /Language|Idioma/ });
  check((await sw.count()) > 0, "visitor portfolio: a language switch is shown");
  if (await sw.count()) {
    await sw.first().getByRole("button", { name: "ES", exact: true }).click();
    await page.waitForTimeout(400);
    check(/Construye sincronización offline/.test(await page.locator("body").innerText()), "visitor portfolio: ES changes the visible words");
    const body = await page.locator("body").innerText();
    check(!/Sol Arrieta|Backed by evidence|Respaldado por evidencia|next steps|próximos pasos/i.test(body), "visitor portfolio: Rin's next steps never reach the shared page");
    await shot(page, "visitor-portfolio-es");
  }
  await context.close();
}

// phone
{
  const { context, page } = await studio({ width: 390, height: 844 });
  await openNext(page);
  for (const [i, name] of [[0, "apply"], [1, "strengthen"], [2, "cofounder"]]) {
    await path_(page, i);
    await shot(page, `phone-next-en-${i + 1}-${name}`);
  }
  await setLang(page, "es");
  await path_(page, 0);
  await shot(page, "phone-next-es-1-apply");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(overflow <= 1, `phone: no sideways scroll (${overflow}px)`);
  await context.close();
}

await browser.close();
check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots in ${OUT}`);
process.exit(failed.length ? 1 : 0);
