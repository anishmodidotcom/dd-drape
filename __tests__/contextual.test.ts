import { describe, it, expect } from "vitest";
import { posesForCategory, POSE_CATEGORIES } from "@/lib/shot/spec";
import { motionsForCategory } from "@/lib/shot/motion";

describe("M4: controls are contextual to product category", () => {
  it("apparel never offers jewellery-specific poses (no earring/ring crops on a shirt)", () => {
    const apparel = posesForCategory("apparel");
    expect(apparel).not.toContain("ear-profile-crop");
    expect(apparel).not.toContain("adjusting-earring");
    expect(apparel).not.toContain("neck-decollete-crop");
    expect(apparel).toContain("s-curve");
    expect(apparel).toContain("walking");
  });

  it("jewellery offers its crops and not garment-only poses like twirl", () => {
    const jew = posesForCategory("jewellery");
    expect(jew).toContain("ear-profile-crop");
    expect(jew).toContain("adjusting-earring");
    expect(jew).not.toContain("twirl");
    expect(jew).not.toContain("walking");
  });

  it("every pose maps to at least one category", () => {
    for (const [pose, cats] of Object.entries(POSE_CATEGORIES)) {
      expect(cats.length, pose).toBeGreaterThan(0);
    }
  });

  it("motions filter by category: apparel excludes earring/ring, jewellery includes them", () => {
    const apparel = motionsForCategory("apparel").map((m) => m.id);
    const jew = motionsForCategory("jewellery").map((m) => m.id);
    expect(apparel).not.toContain("earring-adjust");
    expect(apparel).not.toContain("ring-turn");
    expect(apparel).toContain("model-turn");
    expect(jew).toContain("ring-turn");
    expect(jew).not.toContain("lehenga-twirl");
  });
});
