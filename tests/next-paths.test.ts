import { beforeAll, describe, expect, it } from "vitest";
import * as t from "@/lib/db/schema";
import { buildPortfolio, type PortfolioModel } from "@/lib/portfolio";
import { buildPacket } from "@/lib/packet/model";
import { quoteIsLiteral } from "@/lib/domain/rules";
import { reviewClaim, evaluateGoal } from "@/lib/workspace";
import { fixtureDeps } from "@/lib/deps";
import { content, type Lang } from "@/lib/i18n";
import es from "@/fixtures/example-rin/i18n/es.json";
import { adaptedIntro, applyPlan, cofounderPlan, strengthenPlan, EXAMPLE_COFOUNDER, EXAMPLE_OFFER, EXAMPLE_STRENGTHEN, type ApplyPlan } from "@/lib/next-paths";
import { approveAllAndEvaluate, claimByText, exampleWorkspace } from "./helpers";

const LANGS: Lang[] = ["en", "es"];

async function built() {
  const ctx = await exampleWorkspace();
  await approveAllAndEvaluate(ctx.db, ctx.token, ctx.workspaceId, ctx.profile.goal);
  return { ...ctx, model: buildPortfolio(ctx.db, ctx.workspaceId, { audience: "owner" })! };
}

let ctx: Awaited<ReturnType<typeof built>>;
beforeAll(async () => {
  ctx = await built();
});

const statusOf = (plan: ApplyPlan, id: string) => plan.requirements.find((r) => r.id === id)!.status;
const backedIds = (plan: ApplyPlan) => plan.requirements.filter((r) => r.status.kind === "backed").map((r) => r.id);

describe("apply for a role", () => {
  it("backs a requirement only with the files' proof, and keeps others' work theirs", () => {
    const { db, model } = ctx;
    const plan = applyPlan(model, EXAMPLE_OFFER);
    expect(backedIds(plan)).toEqual(["offline-sync", "conflicts", "ai", "releases"]);
    expect(statusOf(plan, "production")).toMatchObject({ kind: "gap", reason: { kind: "not-shown", capability: "Run it in production for real users" } });
    const deploys = statusOf(plan, "deploys");
    expect(deploys).toMatchObject({ kind: "gap", reason: { kind: "others", who: "Contributor C", project: "Kerf" } });
    if (deploys.kind === "gap" && deploys.reason.kind === "others") expect(deploys.reason.commits.every((c) => c.author === "Contributor C" && !c.mine)).toBe(true);

    const sources = db.select().from(t.sources).all();
    const proof = plan.requirements.flatMap((r) => (r.status.kind === "backed" ? r.status.backing.flatMap((b) => b.proof) : []));
    expect(proof.length).toBeGreaterThan(0);
    for (const q of proof) expect(quoteIsLiteral(q.quote, sources.find((s) => s.id === q.sourceId)!.snippetStore)).toBe(true);
    expect([plan.backed, plan.total]).toEqual([4, 6]);
    expect(plan.projects[0]!.title).toBe("Tidepool");
  });

  it("no proof, no backing: emptying the offline and merge proof turns those requirements into gaps", () => {
    const stripped: PortfolioModel = structuredClone(ctx.model);
    for (const c of [...stripped.capabilities, ...stripped.nextBuild!.parts]) if (/offline|merg/i.test(c.name)) c.proof = [];
    const plan = applyPlan(stripped, EXAMPLE_OFFER);
    expect(statusOf(plan, "offline-sync").kind).toBe("gap");
    expect(statusOf(plan, "conflicts").kind).toBe("gap");
    expect(backedIds(plan)).toEqual(["ai", "releases"]);
  });

  it("a requirement nothing in the files mentions is a gap with nothing to show", () => {
    const offer = { ...EXAMPLE_OFFER, requirements: [{ id: "k8s", line: "You run Kubernetes.", es: "Operas Kubernetes.", short: { en: "Kubernetes", es: "Kubernetes" }, match: ["kubernetes"] }] };
    expect(statusOf(applyPlan(ctx.model, offer), "k8s")).toEqual({ kind: "gap", reason: { kind: "nothing" } });
  });

  it("the corrected Kerf statement, which names the deploy engine, never backs the deploy requirement", async () => {
    const c = await built();
    const kerf = claimByText(c.db, c.workspaceId, c.profile.exampleCorrection.claim);
    reviewClaim(c.db, c.token, kerf.id, { action: "correct", text: c.profile.exampleCorrection.text, attribution: "contributor" });
    await evaluateGoal(c.db, c.token, fixtureDeps);
    const model = buildPortfolio(c.db, c.workspaceId, { audience: "owner" })!;
    expect(model.projects.find((p) => p.slug === "kerf")!.rinPart.map((r) => r.text)).toContain(c.profile.exampleCorrection.text);
    expect(statusOf(applyPlan(model, EXAMPLE_OFFER), "deploys")).toMatchObject({ kind: "gap", reason: { kind: "others", who: "Contributor C" } });
  });

  it("the adapted intro names every backed requirement, and the gaps only where it says they are not shown", () => {
    const plan = applyPlan(ctx.model, EXAMPLE_OFFER);
    for (const lang of LANGS) {
      const intro = adaptedIntro(plan, ctx.model, lang);
      const [claimed, missing, ...rest] = intro.split(/(?<=\.)\s+/);
      expect(rest).toEqual([]);
      expect(intro).toMatch(/\b4\b/);
      expect(intro).toMatch(/\b6\b/);
      for (const r of plan.requirements) {
        const short = r.short[lang];
        if (r.status.kind === "backed") {
          expect(claimed).toContain(short);
          expect(missing).not.toContain(short);
        } else {
          expect(claimed).not.toContain(short);
          expect(missing).toContain(short);
        }
      }
    }
  });
});

describe("strengthen the portfolio", () => {
  it("ties every improvement to files in the model, and reads today from the model", () => {
    const { db, model } = ctx;
    const sources = db.select().from(t.sources).all();
    for (const goal of EXAMPLE_STRENGTHEN.goals) {
      const plan = strengthenPlan(model, EXAMPLE_STRENGTHEN, goal.id);
      expect(plan.improvements.map((i) => [i.id, i.priority])).toEqual(goal.improvements.map((id, i) => [id, i + 1]));
      for (const b of plan.improvements.flatMap((i) => i.buildsOn)) {
        const project = model.projects.find((p) => p.title === b.project)!;
        expect(project.files).toContain(b.locator);
        const source = sources.find((s) => s.id === b.sourceId);
        expect(source, `${b.project} ${b.locator}`).toBeDefined();
        expect([source!.projectId, source!.locator]).toEqual([project.id, b.locator]);
      }
    }
    const byId = (goal: string, id: string) => strengthenPlan(model, EXAMPLE_STRENGTHEN, goal).improvements.find((i) => i.id === id)!;
    expect(byId("own-goal", "production-pilot").today).toEqual({ name: "Run it in production for real users", support: "unknown" });
    expect(byId("fieldmark", "own-deploys").today).toBeNull();

    const shipped: PortfolioModel = structuredClone(model);
    shipped.capabilities.find((c) => c.name === "Run it in production for real users")!.support = "demonstrated";
    expect(strengthenPlan(shipped, EXAMPLE_STRENGTHEN, "own-goal").improvements.find((i) => i.id === "production-pilot")!.today!.support).toBe("demonstrated");

    expect(() => strengthenPlan(model, EXAMPLE_STRENGTHEN, "no-such-goal")).toThrow();
  });
});

describe("find a cofounder", () => {
  it("takes Rin's side from evidenced parts, the needs from the model's own gaps, and drafts nothing that was sent", () => {
    const { model } = ctx;
    const plan = cofounderPlan(model, EXAMPLE_COFOUNDER)!;
    expect(plan.needs).toHaveLength(EXAMPLE_COFOUNDER.needs.length);
    for (const need of plan.needs) expect(model.nextBuild!.gaps).toContain(need.because);
    expect(plan.brings.length).toBeGreaterThan(0);
    for (const part of plan.brings) {
      expect(part.proof.length).toBeGreaterThan(0);
      expect(part.support).not.toBe("unknown");
    }
    expect(plan.person.synthetic).toBe(true);
    for (const lang of LANGS) {
      expect(plan.draft[lang]).toContain("Rin");
      expect(plan.draft[lang]).not.toMatch(/\bsent\b|enviad[oa]|\{/i);
    }
    expect(plan.draft.en).toContain("an offline field-notes app with AI tagging");
    expect(plan.draft.es).toContain("una app de notas de campo offline con etiquetado por IA");
  });

  it("drops a need the model has no gap for, and plans nothing without the matching next build", () => {
    const { model } = ctx;
    const extra = { ...EXAMPLE_COFOUNDER, needs: [...EXAMPLE_COFOUNDER.needs, { gap: "Funding", text: { en: "Money", es: "Dinero" } }] };
    expect(cofounderPlan(model, extra)!.needs).toHaveLength(EXAMPLE_COFOUNDER.needs.length);
    expect(cofounderPlan({ ...model, nextBuild: null }, EXAMPLE_COFOUNDER)).toBeNull();
    expect(cofounderPlan(model, { ...EXAMPLE_COFOUNDER, project: "Something else" })).toBeNull();
  });
});

/** The model's own words that the portfolio and next steps render through the dictionary. */
function contentStrings(m: PortfolioModel): string[] {
  return [
    m.person.role,
    m.person.headline,
    m.person.intro,
    m.person.location,
    m.person.goal,
    m.question,
    ...m.projects.flatMap((p) => [p.summary, p.role, ...p.rinPart.map((r) => r.text), p.outcome?.text, p.openQuestion]),
    ...m.capabilities.flatMap((c) => [c.name, c.limit]),
    ...(m.nextBuild ? [m.nextBuild.title, m.nextBuild.summary, ...m.nextBuild.parts.map((x) => x.name), ...m.nextBuild.gaps] : []),
  ].filter((s): s is string => !!s);
}

const NAMES = ["Rin", "Tidepool", "Quietroom", "Kerf", "Contributor B", "Contributor C", "Fieldmark", "San Francisco", "PR-12", "PR-7", "PR-31"];
const facts = (s: string) => ({
  digits: (s.match(/\d+/g) ?? []).sort(),
  names: NAMES.map((n) => (s.match(new RegExp(`\\b${n}\\b`, "g")) ?? []).length),
});

describe("the Spanish dictionary", () => {
  it("covers every content string of the EXAMPLE, has no stale entries, and never changes a number or a name", () => {
    const strings = new Set(contentStrings(ctx.model));
    const keys = Object.keys(es.content);
    expect(keys.filter((k) => !strings.has(k) && k !== ctx.profile.exampleCorrection.text)).toEqual([]);
    expect([...strings].filter((s) => !content(s, "es", true).translated)).toEqual([]);
    for (const [en, translation] of Object.entries(es.content)) expect(facts(translation), en).toEqual(facts(en));
  });

  it("translates only the EXAMPLE, and only into Spanish", () => {
    const headline = ctx.model.person.headline;
    expect(content(headline, "es", true).translated).toBe(true);
    expect(content(headline, "en", true)).toEqual({ text: headline, translated: false });
    expect(content(headline, "es", false)).toEqual({ text: headline, translated: false });
  });
});

describe("the consultation kit", () => {
  it("contains none of the posting, the scenario or the cofounder", () => {
    const packet = JSON.stringify(buildPacket(ctx.db, ctx.workspaceId));
    expect(packet).toContain("Tidepool");
    for (const r of EXAMPLE_OFFER.requirements) expect(packet).not.toContain(r.line);
    expect(packet).not.toContain("Sol Arrieta");
    for (const i of EXAMPLE_STRENGTHEN.improvements) expect(packet).not.toContain(i.title.en);
  });
});
