// Review harness for docs/SWARM-AUDIT.md: records the swarm in a real browser (Edge) and logs what it does.
// Usage: node docs/swarm-review/record.mjs ours|frames|reduced|scrolled|reel5
//   ours      video of a fresh Build portfolio run + probe log (no screenshots, so nothing slows the motion)
//   frames    key frames every 300 ms of the same run + probe log (no video)
//   reduced   the same run under prefers-reduced-motion: reduce
//   scrolled  an already built Studio, canvas scrolled to the projects, then "Replay the reveal"
//   reel5     Reel 5 (PromoColossu, read-only): key frames seeked on its timeline, then 13.5 s of video
// The dev server must be on :3000 for the first four. It reads the app; it changes nothing in it.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const which = process.argv[2] ?? "ours";
const OUT = path.resolve("docs/swarm-review");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const REEL5 = process.env.REEL5 ?? "C:/Users/alejo/Documents/Repos/PromoColossu/variants/neviza-2026/projects/r5-vision-swarm-9x16/index.html";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "msedge" });

// a probe in the page: timestamps (ms since navigation) of what the swarm does, frame by frame
const PROBE = () => {
  const log = (window.__swarmLog = { events: [], frames: [] });
  const t = () => Math.round(performance.now());
  let overlay = null;
  const snap = (what) => {
    const clipped = [...document.querySelectorAll("[data-swarm]")].filter((e) => /inset/.test(e.style.clipPath));
    const canvas = document.querySelector("main[aria-label='Portfolio preview']");
    return {
      at: t(),
      what,
      clipped: clipped.map((e) => ({ swarm: e.dataset.swarm, rect: e.getBoundingClientRect().toJSON() })),
      cursors: overlay ? [...overlay.children].filter((c) => c.querySelector("svg")).map((c) => c.querySelector("span")?.textContent ?? "") : [],
      selections: overlay ? [...overlay.children].filter((c) => !c.querySelector("svg") && !c.getAttribute("role")).length : 0,
      canvasScroll: canvas?.scrollTop ?? null,
      canvasRect: canvas?.getBoundingClientRect().toJSON(),
      viewport: [innerWidth, innerHeight],
      overlayStyle: overlay ? (({ position, zIndex, pointerEvents }) => ({ position, zIndex, pointerEvents }))(getComputedStyle(overlay)) : null,
      allSwarm: [...document.querySelectorAll("[data-swarm]")].map((e) => e.dataset.swarm),
    };
  };
  new MutationObserver(() => {
    const cap = document.querySelector("[class*='swarmCaption']");
    if (cap && !overlay) {
      overlay = cap.parentElement;
      log.events.push(snap("overlay mounted"));
      setTimeout(() => log.events.push(snap("overlay +120 ms")), 120);
    }
    if (overlay && !overlay.isConnected) {
      log.events.push({ at: t(), what: "overlay removed" });
      overlay = null;
    }
  }).observe(document, { childList: true, subtree: true });
  // every frame: the name block's clip, and whether the overlay is up (a change is logged once)
  const tick = () => {
    const n = document.querySelector("[data-swarm='name']");
    if (n) {
      const clip = n.style.clipPath || getComputedStyle(n).clipPath;
      const last = log.frames[log.frames.length - 1];
      const state = `${clip}|${!!overlay}`;
      if (!last || last.state !== state) log.frames.push({ at: t(), state });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const workspace = async (stage) => {
  // the workspace cookie comes from a context that records nothing, so a video starts on the Studio
  const pre = await browser.newContext();
  const p = await pre.newPage();
  await p.goto(`${BASE}/api/example/start?${stage ? `stage=${stage}&` : ""}to=/studio`);
  await p.waitForLoadState("networkidle");
  const state = await pre.storageState();
  await pre.close();
  return state;
};

const save = (name, data) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2));

if (["ours", "frames", "reduced"].includes(which)) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: await workspace(null),
    reducedMotion: which === "reduced" ? "reduce" : "no-preference",
    ...(which === "ours" ? { recordVideo: { dir: OUT, size: { width: 1440, height: 900 } } } : {}),
  });
  await ctx.addInitScript(PROBE);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/studio`);
  const build = page.getByRole("button", { name: "Build portfolio" }).first();
  await build.waitFor();
  await page.waitForTimeout(which === "ours" ? 1800 : 700); // the video opens on the CV "before" a moment
  const clickAt = await page.evaluate(() => Math.round(performance.now()));
  await build.click();
  const frames = [];
  if (which === "reduced") {
    await page.getByRole("button", { name: "Replay the reveal" }).waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, "reduced-final.jpg"), type: "jpeg", quality: 55 });
  } else {
    await page.locator("[class*='swarmCaption']").waitFor({ timeout: 30000 });
    for (let k = 0; which === "frames" && k < 14; k++) {
      const f = `ours-frame-${String(k).padStart(2, "0")}.jpg`;
      await page.screenshot({ path: path.join(OUT, f), type: "jpeg", quality: 55 });
      frames.push(f);
      await page.waitForTimeout(250);
      if (!(await page.locator("[class*='swarmCaption']").count())) break;
    }
    await page.locator("[class*='swarmCaption']").waitFor({ state: "detached", timeout: 15000 });
    await page.waitForTimeout(which === "ours" ? 3000 : 1500); // and holds on the settled portfolio
  }
  const log = await page.evaluate(() => window.__swarmLog);
  const video = page.video();
  await ctx.close();
  const out = { which, clickAt, frames, ...log };
  if (video) {
    fs.renameSync(await video.path(), path.join(OUT, "ours-swarm.webm"));
    out.video = "ours-swarm.webm";
  }
  save(`${which}-log.json`, out);
  console.log(JSON.stringify(out, null, 1).slice(0, 6000));
}

if (which === "scrolled") {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: await workspace("answered") });
  await ctx.addInitScript(PROBE);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/studio`);
  await page.getByRole("button", { name: "Replay the reveal" }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const c = document.querySelector("main[aria-label='Portfolio preview']");
    const w = c.querySelector("#work");
    c.scrollTo({ top: w.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop });
  });
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Replay the reveal" }).click();
  await page.locator("[class*='swarmCaption']").waitFor();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, "scrolled-mid.jpg"), type: "jpeg", quality: 55 });
  await page.locator("[class*='swarmCaption']").waitFor({ state: "detached", timeout: 15000 });
  const log = await page.evaluate(() => window.__swarmLog);
  await ctx.close();
  save("scrolled-log.json", { which, ...log });
  console.log(JSON.stringify(log, null, 1).slice(0, 4000));
}

if (which === "reel5") {
  const url = "file:///" + REEL5.split(path.sep).join("/");
  // key frames at the reel's own times, seeked on its paused timeline (no video in this context)
  const still = await browser.newContext({ viewport: { width: 1080, height: 1920 } });
  const sp = await still.newPage();
  await sp.goto(url);
  await sp.waitForFunction(() => !!window.__timelines?.main);
  for (const s of [1.0, 1.9, 3.6, 4.8, 6.6, 8.6, 9.8, 11.2, 12.8]) {
    await sp.evaluate((s) => { window.__timelines.main.pause().seek(s, false); }, s);
    await sp.waitForTimeout(80);
    await sp.screenshot({ path: path.join(OUT, `reel5-t${String(s).replace(".", "_")}.jpg`), type: "jpeg", quality: 55 });
  }
  await still.close();
  // the reel in real time from the top, 13.5 s, in its own recorded context
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, recordVideo: { dir: OUT, size: { width: 540, height: 960 } } });
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForFunction(() => !!window.__timelines?.main);
  await page.evaluate(() => { window.__timelines.main.play(0); });
  await page.waitForTimeout(13500);
  const video = page.video();
  await ctx.close();
  fs.renameSync(await video.path(), path.join(OUT, "reel5-swarm.webm"));
  console.log("reel5 recorded");
}

await browser.close();
