import { beforeAll, describe, expect, it } from "vitest";
import * as t from "@/lib/db/schema";
import { buildPortfolio, type PortfolioModel } from "@/lib/portfolio";
import { buildPacket } from "@/lib/packet/model";
import { quoteIsLiteral } from "@/lib/domain/rules";
import { cofounderPlan, EXAMPLE_COFOUNDER } from "@/lib/next-paths";
import { discover, filterOptions, EXAMPLE_SIGNALS, NO_FILTERS, VIEWS, type Verdict, type View } from "@/lib/discover";
import signalsJson from "@/fixtures/example-rin/discover/signals.json";
import { approveAllAndEvaluate, exampleWorkspace } from "./helpers";

async function built() {
  const ctx = await exampleWorkspace();
  await approveAllAndEvaluate(ctx.db, ctx.token, ctx.workspaceId, ctx.profile.goal);
  return { ...ctx, model: buildPortfolio(ctx.db, ctx.workspaceId, { audience: "owner" })! };
}

let ctx: Awaited<ReturnType<typeof built>>;
beforeAll(async () => {
  ctx = await built();
});

const ids = (vs: Verdict[]) => vs.map((v) => v.signal.id);
const byId = (vs: Verdict[], id: string) => vs.find((v) => v.signal.id === id)!;
const firstPreset = (view: View) => EXAMPLE_SIGNALS[view].presets[0].en;
const run = (view: View, intent = firstPreset(view), filters = NO_FILTERS, model: PortfolioModel = ctx.model) => discover(model, view, intent, filters);
const everyRun = () =>
  VIEWS.flatMap((view) => EXAMPLE_SIGNALS[view].presets.flatMap((p) => [run(view, p.en), run(view, p.es)]).flatMap((r) => [...r.kept, ...r.dropped]));

describe("discover cofounders", () => {
  it("keeps Sol then Jun for the first intent, and drops the rest at the first check they fail", () => {
    const { kept, dropped } = run("cofounders");
    expect(ids(kept)).toEqual(["sol", "jun"]);
    expect(ids(dropped)).toEqual(["tomas", "ari", "noor"]);

    const tomas = byId(dropped, "tomas");
    expect(tomas.failed?.id).toBe("complement");
    expect(tomas.failed?.reason.kind).toBe("complement-overlap");
    if (tomas.failed?.reason.kind === "complement-overlap") expect(tomas.failed.reason.already).toContain("Build offline sync that merges conflicting edits");
    expect(byId(dropped, "ari").failed?.id).toBe("evidence");
    expect(byId(dropped, "noor").failed?.id).toBe("intent");

    const noor = byId(dropped, "noor");
    expect(noor.checks.map((c) => c.id)).toEqual(["intent", "evidence", "complement", "filters"]);
    expect(noor.checks.filter((c) => !c.pass).map((c) => c.id)[0]).toBe("intent");
  });

  it("keeps nobody when no proof backs what they ask for", () => {
    const stripped: PortfolioModel = structuredClone(ctx.model);
    for (const c of [...stripped.capabilities, ...stripped.nextBuild!.parts]) c.proof = [];
    const { kept, dropped } = run("cofounders", firstPreset("cofounders"), NO_FILTERS, stripped);
    expect(kept).toEqual([]);
    expect(byId(dropped, "sol").failed?.id).toBe("evidence");
    expect(byId(dropped, "jun").failed?.id).toBe("evidence");
  });
});

describe("discover clients", () => {
  it("keeps Harrow, Bramble and Corvid, and drops Pinecrest because the files do not show production", () => {
    const { kept, dropped } = run("clients");
    expect(new Set(ids(kept))).toEqual(new Set(["harrow", "bramble", "corvid"]));
    expect(ids(dropped)).toEqual(["pinecrest"]);
    const pinecrest = byId(dropped, "pinecrest");
    expect(pinecrest.failed?.id).toBe("evidence");
    expect(pinecrest.failed?.reason.kind).toBe("evidence-miss");
    if (pinecrest.failed?.reason.kind === "evidence-miss") expect(pinecrest.failed.reason.notShown).toContain("Run it in production for real users");
    expect(pinecrest.checks.map((c) => c.id)).toEqual(["intent", "evidence", "filters"]);
  });
});

describe("the intent rule", () => {
  it("gives the same verdicts for every preset in English and in Spanish", () => {
    for (const view of VIEWS) {
      for (const p of EXAMPLE_SIGNALS[view].presets) {
        const en = run(view, p.en);
        const es = run(view, p.es);
        expect({ kept: ids(es.kept), dropped: ids(es.dropped) }, `${view}: ${p.en}`).toEqual({ kept: ids(en.kept), dropped: ids(en.dropped) });
      }
    }
  });
});

describe("filters", () => {
  it("drop by location, skill and need, and a signal with no location fails a location filter as not stated", () => {
    const sf = run("cofounders", firstPreset("cofounders"), { ...NO_FILTERS, location: "San Francisco" });
    expect(ids(sf.kept)).toEqual(["jun"]);
    expect(byId(sf.dropped, "sol").failed).toEqual({ id: "filters", pass: false, reason: { kind: "filter-location", location: null } });

    expect(ids(run("cofounders", firstPreset("cofounders"), { ...NO_FILTERS, skills: ["design"] }).kept)).toEqual(["jun"]);
    expect(ids(run("clients", firstPreset("clients"), { ...NO_FILTERS, needs: ["releases"] }).kept)).toEqual(["corvid"]);
  });

  it("offer the data's own options and locations", () => {
    expect(filterOptions("cofounders")).toMatchObject({ field: "skills", locations: ["Berlin", "San Francisco"] });
    expect(filterOptions("clients").field).toBe("needs");
    expect(filterOptions("clients").options.map((o) => o.id)).toEqual(signalsJson.clients.needs.map((n) => n.id));
  });
});

describe("what a kept signal relies on", () => {
  it("is Rin's own proof, quoted word for word, and only the projects that proof comes from", () => {
    const sources = ctx.db.select().from(t.sources).all();
    const kept = everyRun().filter((v) => v.kept);
    expect(kept.length).toBeGreaterThan(0);
    for (const v of kept) {
      const proof = v.backing.flatMap((b) => b.proof);
      expect(proof.length, v.signal.id).toBeGreaterThan(0);
      for (const q of proof) expect(quoteIsLiteral(q.quote, sources.find((s) => s.id === q.sourceId)!.snippetStore)).toBe(true);
      const inProof = ctx.model.projects.map((p) => p.title).filter((title) => proof.some((q) => q.projectTitle === title));
      expect(v.projects, v.signal.id).toEqual(inProof);
    }
  });

  it("offers a draft only for a kept signal, addressed from Rin", () => {
    for (const v of everyRun()) {
      if (!v.kept) expect(v.signal.draft, v.signal.id).toBeNull();
      else if (v.signal.draft) for (const text of [v.signal.draft.en, v.signal.draft.es]) expect(text).toMatch(/\bRin\s*$/);
    }
  });
});

describe("one identity across Discover and next steps", () => {
  it("shows Sol with the same name, headline, background and draft as the cofounder plan", () => {
    const plan = cofounderPlan(ctx.model, EXAMPLE_COFOUNDER)!;
    const sol = byId(run("cofounders").kept, "sol").signal;
    expect([sol.name, sol.first, sol.headline, sol.brings]).toEqual([plan.person.name, plan.person.first, plan.person.headline, plan.person.brings]);
    expect(sol.draft).toEqual(plan.draft);
  });
});

describe("what we don't know", () => {
  it("always starts with availability for cofounders, and budget and interest for clients", () => {
    for (const v of everyRun()) {
      const unknowns = v.signal.unknowns.map((u) => u.en);
      if (v.signal.view === "cofounders") expect(unknowns[0]).toBe("Availability: unknown");
      else expect(unknowns.slice(0, 2)).toEqual(["Budget: unknown", "Interest in outside help: unknown"]);
    }
  });
});

const strings = (x: unknown): string[] =>
  typeof x === "string" ? [x] : Array.isArray(x) ? x.flatMap(strings) : x && typeof x === "object" ? Object.values(x).flatMap(strings) : [];

describe("the prepared list", () => {
  it("has no link, handle or post id, names only EXAMPLE people, and gives every signal a source and a recency", () => {
    for (const s of strings(signalsJson)) expect(s).not.toMatch(/http|www\.|\.com|@|#\d/i);
    const raw = [...signalsJson.cofounders.signals, ...signalsJson.clients.signals];
    for (const s of raw) {
      if ("name" in s && s.name !== undefined) expect(s.name).toMatch(/\(EXAMPLE\)$/);
      for (const l of [s.source, s.recency]) expect([l.en.trim(), l.es.trim()].every(Boolean), s.id).toBe(true);
    }
    for (const v of everyRun()) expect(v.signal.name).toMatch(/\(EXAMPLE\)$/);
  });
});

describe("the consultation kit", () => {
  it("contains no Discover name or quote", () => {
    const packet = JSON.stringify(buildPacket(ctx.db, ctx.workspaceId));
    expect(packet).toContain("Tidepool");
    const signals = [...run("cofounders").kept, ...run("cofounders").dropped, ...run("clients").kept, ...run("clients").dropped].map((v) => v.signal);
    expect(signals).toHaveLength(EXAMPLE_SIGNALS.cofounders.signals.length + EXAMPLE_SIGNALS.clients.signals.length);
    for (const s of signals) {
      expect(packet).not.toContain(s.name.replace(" (EXAMPLE)", ""));
      expect(packet).not.toContain(s.quote);
      expect(packet).not.toContain(s.quoteEs);
    }
  });
});
