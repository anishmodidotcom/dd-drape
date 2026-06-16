import { describe, it, expect } from "vitest";
import { buildPrompt, buildGeneration, redPolicy } from "@/lib/shot/compose";
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

describe("generation builder (model + reference selection)", () => {
  it("reference-locked hero generation passes image_urls and routes to Nano Banana Pro", () => {
    const g = buildGeneration(base, ["https://signed/a.png"]);
    expect(g.need).toBe("image/hero");
    expect(g.falInput.image_urls).toEqual(["https://signed/a.png"]);
  });

  it("standard quality routes to the cheapest model (Seedream) for testing", () => {
    const g = buildGeneration({ ...base, quality: "standard" }, ["https://signed/a.png"]);
    expect(g.need).toBe("image/standard");
  });

  it("background swap is an edit of the uploaded product", () => {
    const g = buildGeneration(
      { ...base, shotType: "background-swap", subType: "t-shirt", category: "apparel" },
      ["https://signed/a.png"]
    );
    expect(g.need).toBe("image/edit");
  });

  it("classifies tier and exposes it on the generation", () => {
    // saree on-model-full = RED
    expect(buildGeneration(base, ["u"]).tier).toBe("red");
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
    const g = buildGeneration(spec, ["u"]);
    expect(g.tier).toBe("red");
    expect(g.blocked).toBeTruthy();
    expect(g.blocked!.toLowerCase()).toContain("enhances");
  });

  it("RED on-model shots generate in enhancement mode, not blocked", () => {
    const g = buildGeneration(base, ["u"]); // saree on-model-full = RED but not macro
    expect(g.tier).toBe("red");
    expect(g.blocked).toBeUndefined();
  });

  it("redPolicy returns not-blocked for non-red tiers", () => {
    expect(redPolicy({ ...base, shotType: "background-swap" }, "green").blocked).toBe(false);
  });
});
