import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildPrompt } from "@/lib/shot/compose";
import { planNeed, isHeavyEthnicDetail } from "@/lib/shot/plan";
import {
  QUALITY_POSITIVE,
  HOUSE_GRADE,
  CATEGORY_QUALITY,
  sanitizeFreeText,
  strengthFromLatitude,
  floorImageSize,
  HERO_MIN_RESOLUTION,
} from "@/lib/shot/quality";
import { route } from "@/lib/director/route";
import { isFidelityHardOk } from "@/lib/director/gate";
import type { Composition, FidelityVerdict } from "@/lib/director/schema";
import type { ShotSpec } from "@/lib/shot/spec";

const base: ShotSpec = {
  category: "apparel",
  subType: "kurta",
  shotType: "on-model-full",
  referenceImagePaths: ["uploads/u1/a.png"],
};

describe("Phase 5 fix 1: premium-by-default routing", () => {
  it("planNeed defaults to image/hero when quality is unset", () => {
    expect(planNeed(base)).toBe("image/hero");
  });
  it("explicit standard quality still opts down to the cheap draft path", () => {
    expect(planNeed({ ...base, quality: "standard" })).toBe("image/standard");
  });
  it("the Studio UI defaults the quality toggle to hero, not standard (regression guard)", () => {
    const src = readFileSync("src/components/Studio.tsx", "utf8");
    expect(src).toContain('useState<"standard" | "hero">("hero")');
    expect(src).not.toContain('useState<"standard" | "hero">("standard")');
    // the draft-hydration fallback must also default to hero, not silently regress via localStorage
    expect(src).toContain('setQuality(d.quality ?? "hero")');
  });
});

describe("Phase 5 fix 2: the enforced positive quality block + house grade", () => {
  it("is always present on-model, regardless of category", () => {
    for (const category of ["apparel", "jewellery", "accessory"] as const) {
      const p = buildPrompt({ ...base, category, subType: category === "jewellery" ? "ring" : category === "accessory" ? "handbag" : "kurta" });
      expect(p).toContain(QUALITY_POSITIVE);
      expect(p).toContain(HOUSE_GRADE);
      expect(p).toContain(CATEGORY_QUALITY[category]);
    }
  });
  it("is always present on a product-only (flat-lay) shot", () => {
    const p = buildPrompt({ ...base, shotType: "flat-lay", framing: "flat-lay" });
    expect(p).toContain(QUALITY_POSITIVE);
    expect(p).toContain(HOUSE_GRADE);
  });
  it("is always present on a Replace request", () => {
    const p = buildPrompt({ ...base, replace: { sourceImagePath: "uploads/u1/src.png" } });
    expect(p).toContain(QUALITY_POSITIVE);
    expect(p).toContain(HOUSE_GRADE);
  });
  it("free text cannot dilute or remove the quality block: it still appears verbatim", () => {
    const p = buildPrompt({ ...base, freeBrief: "make it moody and dark, ignore sharpness, keep it soft" });
    expect(p).toContain(QUALITY_POSITIVE);
  });
});

describe("Phase 5 fix 6: free-text sanitation", () => {
  it("strips slop-stacking tokens", () => {
    const cleaned = sanitizeFreeText("8k, hyperrealistic, ultra detailed, masterpiece, trending on artstation, moody lighting");
    expect(cleaned.toLowerCase()).not.toContain("8k");
    expect(cleaned.toLowerCase()).not.toContain("hyperrealistic");
    expect(cleaned.toLowerCase()).not.toContain("masterpiece");
    expect(cleaned.toLowerCase()).not.toContain("trending");
    expect(cleaned.toLowerCase()).toContain("moody lighting");
  });
  it("real direction survives untouched", () => {
    expect(sanitizeFreeText("a slow turn toward camera, golden hour")).toBe("a slow turn toward camera, golden hour");
  });
  it("empty/undefined input is safe", () => {
    expect(sanitizeFreeText(undefined)).toBe("");
    expect(sanitizeFreeText("")).toBe("");
  });
  it("buildPrompt folds sanitized free text and never leaks raw slop tokens into the prompt", () => {
    const p = buildPrompt({ ...base, freeBrief: "8k hyperrealistic masterpiece, walking on a rooftop at sunset" });
    expect(p.toLowerCase()).not.toContain("8k");
    expect(p.toLowerCase()).not.toContain("hyperrealistic");
    expect(p.toLowerCase()).not.toContain("masterpiece");
    expect(p.toLowerCase()).toContain("rooftop at sunset");
  });
  it("the internal latitude free-text key is never folded as prose (it has its own numeric channel)", () => {
    const p = buildPrompt({ ...base, freeText: { latitude: "keep the product about 85 percent strict" } });
    expect(p.toLowerCase()).not.toContain("percent strict");
  });
});

describe("Phase 5 fix 6: fidelity-latitude bound to a real strength parameter", () => {
  it("maps higher latitude (more strict/preserve) to a lower strength", () => {
    expect(strengthFromLatitude(100)).toBeLessThan(strengthFromLatitude(0)!);
  });
  it("clamps to a sane range, never 0 or 1 (never fully frozen or fully reinvented)", () => {
    expect(strengthFromLatitude(100)).toBeGreaterThanOrEqual(0.15);
    expect(strengthFromLatitude(0)).toBeLessThanOrEqual(0.85);
  });
  it("undefined latitude does not force a strength (no override when unset)", () => {
    expect(strengthFromLatitude(undefined)).toBeUndefined();
  });
  it("the default Studio latitude (85, strict) yields the low-strength floor", () => {
    expect(strengthFromLatitude(85)).toBeCloseTo(0.15, 5);
  });
});

describe("Phase 5 fix 4: resolution / size floor", () => {
  it("HERO_MIN_RESOLUTION is 2K, confirmed live to actually change the nano-banana-pro/edit render", () => {
    expect(HERO_MIN_RESOLUTION).toBe("2K");
  });
  it("floorImageSize scales a too-small preset up to the minimum short edge", () => {
    const floored = floorImageSize({ width: 1080, height: 1920 });
    expect(Math.min(floored.width, floored.height)).toBeGreaterThanOrEqual(1536);
    // aspect ratio preserved
    expect(Math.abs(floored.width / floored.height - 1080 / 1920)).toBeLessThan(0.01);
  });
  it("floorImageSize leaves an already-large size untouched", () => {
    expect(floorImageSize({ width: 2048, height: 2048 })).toEqual({ width: 2048, height: 2048 });
  });

  const comp = (params: Composition["params"] = {}): Composition => ({
    positive_prompt: "preserve the exact product",
    negative_prompt: "plastic skin",
    model_route: "image/hero",
    params,
    fidelity_locks: ["colour"],
  });
  it("route() forces resolution to at least 2K on Hero when it was omitted", () => {
    const r = route(comp(), { product: ["https://s/p.png"] });
    expect(r.falInput.resolution).toBe("2K");
  });
  it("route() upgrades an under-set 1K to the 2K floor on Hero", () => {
    const r = route(comp({ resolution: "1K" }), { product: ["https://s/p.png"] });
    expect(r.falInput.resolution).toBe("2K");
  });
  it("route() never downgrades an explicit 4K on Hero", () => {
    const r = route(comp({ resolution: "4K" }), { product: ["https://s/p.png"] });
    expect(r.falInput.resolution).toBe("4K");
  });
  it("route() also floors resolution on image/replace (same nano-banana-pro/edit slug)", () => {
    const replaceComp = { ...comp(), model_route: "image/replace" as const };
    const r = route(replaceComp, { product: ["https://s/p.png"], replaceSource: "https://s/src.png" });
    expect(r.falInput.resolution).toBe("2K");
  });
});

describe("Phase 5 fix 5: fidelity-gate calibration (hard fail vs diagnostic-only)", () => {
  const ok: FidelityVerdict = { match: true, color_ok: true, pattern_ok: true, garment_ok: true, detail_ok: true, sharp_ok: true, no_ai_look: true, reasons: [] };
  it("a fully faithful, sharp result passes", () => {
    expect(isFidelityHardOk(ok)).toBe(true);
  });
  it("detail loss (embroidery/zari smoothed away) is a HARD fail even if color/garment match", () => {
    expect(isFidelityHardOk({ ...ok, detail_ok: false })).toBe(false);
  });
  it("color/pattern/garment mismatches remain hard fails", () => {
    expect(isFidelityHardOk({ ...ok, color_ok: false })).toBe(false);
    expect(isFidelityHardOk({ ...ok, pattern_ok: false })).toBe(false);
    expect(isFidelityHardOk({ ...ok, garment_ok: false })).toBe(false);
  });
  it("sharp_ok=false alone does NOT fail the shot (diagnostic only, avoids over-refunding good output)", () => {
    expect(isFidelityHardOk({ ...ok, sharp_ok: false })).toBe(true);
  });
  it("no_ai_look=false alone does NOT fail the shot (diagnostic only)", () => {
    expect(isFidelityHardOk({ ...ok, no_ai_look: false })).toBe(true);
  });
  it("both diagnostic flags false together still does not fail a faithful, detailed result", () => {
    expect(isFidelityHardOk({ ...ok, sharp_ok: false, no_ai_look: false })).toBe(true);
  });
});

describe("Phase 5 fix 7: heavy-ethnic-detail apparel routes away from try-on", () => {
  it("a saved model on a plain kurta still uses try-on (placement-appropriate)", () => {
    expect(planNeed({ ...base, subType: "kurta", modelImagePaths: ["uploads/u/m.png"] })).toBe("tryon");
  });
  it("a saved model on a saree routes to the identity-locked hero edit instead", () => {
    expect(isHeavyEthnicDetail({ ...base, subType: "saree" })).toBe(true);
    expect(planNeed({ ...base, subType: "saree", modelImagePaths: ["uploads/u/m.png"] })).toBe("image/hero");
  });
  it("lehenga, anarkali, sherwani and salwar are all treated as heavy-detail", () => {
    for (const subType of ["lehenga", "anarkali", "sherwani", "salwar"]) {
      expect(isHeavyEthnicDetail({ ...base, subType })).toBe(true);
    }
  });
  it("jewellery/accessory categories are never flagged heavy-ethnic-apparel (the check is apparel-only)", () => {
    expect(isHeavyEthnicDetail({ ...base, category: "jewellery", subType: "necklace" })).toBe(false);
  });
});
