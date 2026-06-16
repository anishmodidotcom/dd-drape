import { describe, it, expect } from "vitest";
import { buildMotionPrompt, MOTION_PRESETS, getMotionPreset } from "@/lib/shot/motion";
import { PRESETS, presetsForCategory, getPreset } from "@/lib/shot/presets";
import { FORMATS, getFormat } from "@/lib/shot/formats";
import { SUBTYPES } from "@/lib/shot/subtypes";
import type { ShotSpec } from "@/lib/shot/spec";

const apparel: ShotSpec = {
  category: "apparel",
  subType: "lehenga",
  shotType: "lifestyle",
  referenceImagePaths: ["uploads/u/a.png"],
};
const jewellery: ShotSpec = {
  category: "jewellery",
  subType: "ring",
  shotType: "detail-macro",
  referenceImagePaths: ["uploads/u/r.png"],
};

describe("motion prompt builder (rule 2: describe motion fully)", () => {
  it("adds a rigid, non-bend clause for jewellery", () => {
    const p = buildMotionPrompt(jewellery, "ring-turn");
    expect(p.toLowerCase()).toContain("rigid");
    expect(p.toLowerCase()).toContain("does not bend");
  });

  it("preserves fabric detailing for apparel", () => {
    const p = buildMotionPrompt(apparel, "lehenga-twirl");
    expect(p.toLowerCase()).toContain("exact colour");
    expect(p.toLowerCase()).toContain("natural fabric motion");
  });

  it("always includes camera path and a realism guardrail", () => {
    const p = buildMotionPrompt(apparel, "walk");
    expect(p.toLowerCase()).toContain("camera");
    expect(p.toLowerCase()).toContain("no melting hands");
  });

  it("contains no em dashes", () => {
    for (const m of MOTION_PRESETS) {
      expect(buildMotionPrompt(apparel, m.id)).not.toContain("—");
    }
  });

  it("falls back to a default preset for unknown ids", () => {
    expect(getMotionPreset("nope").id).toBe(MOTION_PRESETS[0].id);
  });
});

describe("preset library", () => {
  it("ships the starter presets", () => {
    const ids = PRESETS.map((p) => p.id);
    expect(ids).toContain("marketplace-clean");
    expect(ids).toContain("bridal-regal");
    expect(ids).toContain("demi-fine-everyday");
  });

  it("filters presets by category (jewellery shows jewellery + any)", () => {
    const j = presetsForCategory("jewellery");
    expect(j.every((p) => p.categoryTag === "jewellery" || p.categoryTag === "any")).toBe(true);
    expect(j.find((p) => p.id === "demi-fine-everyday")).toBeTruthy();
  });

  it("every preset carries a shotType so tiering works", () => {
    for (const p of PRESETS) {
      expect(p.spec.shotType, p.id).toBeTruthy();
    }
  });

  it("getPreset returns a known preset", () => {
    expect(getPreset("quiet-luxury")?.label).toBe("Quiet luxury");
  });
});

describe("output formats + subtypes", () => {
  it("includes the marketplace + social targets", () => {
    const ids = FORMATS.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(["myntra", "amazon-in", "meesho", "instagram-story"]));
  });

  it("getFormat falls back to the first format", () => {
    expect(getFormat(undefined).id).toBe(FORMATS[0].id);
  });

  it("every category has sub-types", () => {
    expect(SUBTYPES.apparel.length).toBeGreaterThan(5);
    expect(SUBTYPES.jewellery.find((s) => s.id === "necklace")).toBeTruthy();
    expect(SUBTYPES.accessory.find((s) => s.id === "handbag")).toBeTruthy();
  });
});
