import { describe, it, expect } from "vitest";
import { buildPrompt, redPolicy } from "@/lib/shot/compose";
import { planRoute, planNeed } from "@/lib/shot/plan";
import type { ShotSpec } from "@/lib/shot/spec";

const base: ShotSpec = {
  category: "apparel",
  subType: "saree",
  shotType: "on-model-full",
  referenceImagePaths: ["uploads/u1/a.png"],
};

describe("prompt composition (product fidelity)", () => {
  it("always includes the fidelity clause locking the exact product", () => {
    const p = buildPrompt(base);
    expect(p.toLowerCase()).toContain("preserve the exact garment");
    expect(p.toLowerCase()).toContain("do not reinvent");
  });

  it("uses jewellery-specific fidelity language for jewellery", () => {
    const p = buildPrompt({ ...base, category: "jewellery", subType: "necklace" });
    expect(p.toLowerCase()).toContain("facet");
    expect(p.toLowerCase()).toContain("metal tone");
  });

  it("includes the realism guardrail against the AI tell", () => {
    expect(buildPrompt(base).toLowerCase()).toContain("no plastic skin");
  });

  it("contains no em dashes (brand rule)", () => {
    const p = buildPrompt({
      ...base,
      model: { ethnicity: "south-indian", body: "mid-size" },
      makeup: "dewy",
      hair: "updo",
      background: "heritage-interior",
      lighting: "diya-warm-tungsten",
      vibe: "festive",
    });
    expect(p).not.toContain("—");
    expect(p).not.toContain(" - ");
  });
});

describe("planRoute (single routing brain shared by estimate + director)", () => {
  it("default hero routes to image/hero", () => {
    expect(planRoute(base).need).toBe("image/hero");
  });

  it("standard quality routes to the cheapest edit slug", () => {
    expect(planNeed({ ...base, quality: "standard" })).toBe("image/standard");
  });

  it("background swap routes to the masked edit slug", () => {
    expect(planNeed({ ...base, shotType: "background-swap", subType: "t-shirt" })).toBe("image/edit");
  });

  it("a saved model on an apparel on-model shot routes to try-on", () => {
    expect(planNeed({ ...base, subType: "kurta", modelImagePaths: ["uploads/u/m.png"] })).toBe("tryon");
  });

  it("classifies tier (saree on-model-full = RED)", () => {
    expect(planRoute(base).tier).toBe("red");
  });
});

describe("RED-tier policy (no fabricated facets, no silent dead-ends)", () => {
  it("blocks jewellery macro hero with an honest message", () => {
    const spec: ShotSpec = {
      category: "jewellery",
      subType: "ring",
      shotType: "detail-macro",
      referenceImagePaths: ["uploads/u1/r.png"],
    };
    const plan = planRoute(spec);
    expect(plan.tier).toBe("red");
    expect(plan.blocked).toBeTruthy();
    expect(plan.blocked!.toLowerCase()).toContain("enhances");
  });

  it("RED on-model shots generate in enhancement mode, not blocked", () => {
    const plan = planRoute(base); // saree on-model-full = RED but not macro
    expect(plan.tier).toBe("red");
    expect(plan.blocked).toBeUndefined();
  });

  it("redPolicy returns not-blocked for non-red tiers", () => {
    expect(redPolicy({ ...base, shotType: "background-swap" }, "green").blocked).toBe(false);
  });
});
