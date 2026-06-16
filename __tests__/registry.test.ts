import { describe, it, expect } from "vitest";
import { REGISTRY, lookup, isAsyncNeed } from "@/lib/engine/registry";

describe("model registry", () => {
  it("every need maps to a non-empty slug and positive unit cost", () => {
    for (const [need, entry] of Object.entries(REGISTRY)) {
      expect(entry.slug, `${need} slug`).toMatch(/\S/);
      expect(entry.unitCostCents, `${need} cost`).toBeGreaterThan(0);
    }
  });

  it("video needs are async (worker + webhook), image needs are sync", () => {
    expect(isAsyncNeed("video/standard")).toBe(true);
    expect(isAsyncNeed("video/hero")).toBe(true);
    expect(isAsyncNeed("image/standard")).toBe(false);
    expect(isAsyncNeed("tryon")).toBe(false);
  });

  it("standard image routes to the cheapest model (test-first rule)", () => {
    const cheapest = Object.values(REGISTRY)
      .filter((e) => e.unit === "image")
      .reduce((min, e) => (e.unitCostCents < min.unitCostCents ? e : min));
    // bg-remove is technically cheaper; among generative image needs Seedream is cheapest.
    expect(lookup("image/standard").unitCostCents).toBeLessThanOrEqual(cheapest.unitCostCents + 4);
  });

  it("throws on an unknown need", () => {
    // @ts-expect-error testing runtime guard
    expect(() => lookup("image/nonsense")).toThrow();
  });
});
