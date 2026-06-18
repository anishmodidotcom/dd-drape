import { describe, it, expect } from "vitest";
import { REGISTRY, lookup, assertReferenceCapable, type Need } from "@/lib/engine/registry";
import { route } from "@/lib/director/route";
import { fallbackRoute, fallbackCompose, fallbackAnalysis } from "@/lib/director/fallback";
import { directShot } from "@/lib/director";
import type { Composition } from "@/lib/director/schema";
import type { ShotSpec } from "@/lib/shot/spec";

const apparelSpec: ShotSpec = {
  category: "apparel",
  subType: "kurta",
  shotType: "on-model-full",
  referenceImagePaths: ["uploads/u1/white-kurta.png"],
};

describe("registry fidelity routing (the v2 fix)", () => {
  it("NO product capability routes to a text-to-image slug", () => {
    for (const need of Object.keys(REGISTRY) as Need[]) {
      const entry = REGISTRY[need];
      expect(entry.textToImage, `${need} must not be text-to-image`).toBe(false);
      expect(entry.slug, `${need} slug must not be a text-to-image endpoint`).not.toContain(
        "text-to-image"
      );
    }
  });

  it("image + try-on needs are reference-capable (guard never throws)", () => {
    for (const need of ["image/standard", "image/hero", "image/edit", "tryon"] as Need[]) {
      expect(() => assertReferenceCapable(need)).not.toThrow();
    }
  });

  it("edit slugs are the verified /edit endpoints", () => {
    expect(lookup("image/hero").slug).toBe("fal-ai/nano-banana-pro/edit");
    expect(lookup("image/standard").slug).toBe("fal-ai/bytedance/seedream/v4.5/edit");
    expect(lookup("tryon").slug).toBe("fal-ai/fashn/tryon/v1.6");
  });
});

describe("route() attaches the product image to the correct field", () => {
  const comp = (route_: Need): Composition => ({
    positive_prompt: "preserve the exact product",
    negative_prompt: "plastic skin",
    model_route: route_,
    params: { num_images: 1 },
    fidelity_locks: ["colour"],
  });

  it("edit models receive image_urls with the product first", () => {
    const r = route(comp("image/hero"), { product: ["https://s/p.png"] });
    expect(r.slug).toBe("fal-ai/nano-banana-pro/edit");
    expect(r.falInput.image_urls).toEqual(["https://s/p.png"]);
  });

  it("multiple roles append model identity then scene", () => {
    const r = route(comp("image/hero"), {
      product: ["https://s/p.png"],
      modelIdentity: ["https://s/m.png"],
      scene: "https://s/scene.png",
    });
    expect(r.falInput.image_urls).toEqual([
      "https://s/p.png",
      "https://s/m.png",
      "https://s/scene.png",
    ]);
  });

  it("try-on receives garment_image + model_image", () => {
    const r = route(comp("tryon"), {
      product: ["https://s/garment.png"],
      modelIdentity: ["https://s/model.png"],
    });
    expect(r.falInput.garment_image).toBe("https://s/garment.png");
    expect(r.falInput.model_image).toBe("https://s/model.png");
  });

  it("throws when no product image is provided (never text-only)", () => {
    expect(() => route(comp("image/hero"), { product: [] })).toThrow(/FIDELITY GUARD/);
  });

  it("throws when try-on has no model identity", () => {
    expect(() => route(comp("tryon"), { product: ["https://s/g.png"] })).toThrow(/FIDELITY GUARD/);
  });
});

describe("deterministic fallback (works without ANTHROPIC_API_KEY)", () => {
  it("on-model with a saved model routes to try-on", () => {
    expect(fallbackRoute(apparelSpec, true)).toBe("tryon");
  });
  it("on-model without a model routes to hero edit", () => {
    expect(fallbackRoute(apparelSpec, false)).toBe("image/hero");
  });
  it("standard quality routes to the cheap edit slug", () => {
    expect(fallbackRoute({ ...apparelSpec, quality: "standard" }, false)).toBe("image/standard");
  });
  it("background swap routes to the masked edit slug", () => {
    expect(fallbackRoute({ ...apparelSpec, shotType: "background-swap" }, false)).toBe("image/edit");
  });
  it("composition restates locks, pairs anti-slop negatives, and routes reference-capable", () => {
    const c = fallbackCompose(apparelSpec, fallbackAnalysis(apparelSpec), false);
    expect(c.positive_prompt.toLowerCase()).toContain("preserve the exact");
    expect(c.negative_prompt).toContain("plastic skin");
    expect(c.fidelity_locks.length).toBeGreaterThan(0);
    expect(() => assertReferenceCapable(c.model_route)).not.toThrow();
  });
});

describe("directShot end to end (fallback path): the red-lehenga failure is impossible", () => {
  it("attaches the real product to a reference-capable /edit slug, never text-to-image", async () => {
    const res = await directShot({
      spec: apparelSpec,
      productImageUrls: ["https://signed/white-kurta.png"],
    });
    // 1. reference-capable slug, not text-to-image
    expect(res.routed.slug).toContain("edit");
    expect(res.routed.slug).not.toContain("text-to-image");
    expect(() => assertReferenceCapable(res.routed.need)).not.toThrow();
    // 2. the actual product image is in the built body
    expect(res.routed.falInput.image_urls).toEqual(["https://signed/white-kurta.png"]);
    // 3. fidelity locks were produced
    expect(res.routed.fidelityLocks.length).toBeGreaterThan(0);
  });

  it("routes to try-on and attaches both garment and model when a saved model is supplied", async () => {
    const res = await directShot({
      spec: apparelSpec,
      productImageUrls: ["https://signed/garment.png"],
      modelIdentityUrls: ["https://signed/model.png"],
    });
    expect(res.routed.need).toBe("tryon");
    expect(res.routed.falInput.garment_image).toBe("https://signed/garment.png");
    expect(res.routed.falInput.model_image).toBe("https://signed/model.png");
  });
});
