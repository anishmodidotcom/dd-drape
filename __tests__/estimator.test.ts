import { describe, it, expect } from "vitest";
import { estimate } from "@/lib/engine/estimator";

describe("cost estimator (1 credit = $0.01 = 1 cent, round up)", () => {
  it("cheapest image model Seedream EDIT is 4 credits ($0.04) for one image", () => {
    const e = estimate({ need: "image/standard" });
    // v2: reference-capable EDIT slug, never text-to-image.
    expect(e.slug).toBe("fal-ai/bytedance/seedream/v4.5/edit");
    expect(e.credits).toBe(4);
  });

  it("scales with image count", () => {
    expect(estimate({ need: "image/standard", count: 3 }).credits).toBe(12);
  });

  it("hero image (Nano Banana Pro) is 15 credits", () => {
    expect(estimate({ need: "image/hero" }).credits).toBe(15);
  });

  it("video estimates by the second and rounds up", () => {
    // v2: Kling v3 pro i2v $0.112/sec * 5s = 56 credits
    expect(estimate({ need: "video/standard", seconds: 5 }).credits).toBe(56);
  });

  it("hero video Veo is 40 credits/sec", () => {
    expect(estimate({ need: "video/hero", seconds: 8 }).credits).toBe(320);
  });

  it("a live-fetched unit cost overrides the registry default", () => {
    const e = estimate({ need: "image/standard", liveUnitCostCents: 5 });
    expect(e.credits).toBe(5);
  });

  it("video without seconds is a hard error (never under-estimate)", () => {
    expect(() => estimate({ need: "video/standard" })).toThrow();
  });
});
