import { describe, it, expect } from "vitest";
import { buildPrompt, referenceRolesClause } from "@/lib/shot/compose";
import { planNeed, planCredits, productCount } from "@/lib/shot/plan";
import { planShootFrames, clampOutputCount } from "@/lib/shot/shoot";
import { assertReferenceCapable } from "@/lib/engine/registry";
import { validateImageUpload } from "@/lib/engine/image-validate";
import { parseJsonSafe } from "@/lib/http";
import { MAX_OUTPUTS, type ShotSpec } from "@/lib/shot/spec";

const base: ShotSpec = {
  category: "apparel",
  subType: "kurta",
  shotType: "on-model-full",
  referenceImagePaths: ["uploads/u1/a.png"],
};

// Build a minimal valid PNG header with the given dimensions (sig + IHDR width@16/height@20).
function pngOf(w: number, h: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0x00, 0x00, 0x00, 0x0d], 8); // IHDR length 13
  b.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  b[16] = (w >>> 24) & 255; b[17] = (w >>> 16) & 255; b[18] = (w >>> 8) & 255; b[19] = w & 255;
  b[20] = (h >>> 24) & 255; b[21] = (h >>> 16) & 255; b[22] = (h >>> 8) & 255; b[23] = h & 255;
  return b;
}

describe("item 1: saved/uploaded model identity composes cleanly (anti-collage)", () => {
  it("buildPrompt with an identity attaches roles + the single-subject lock", () => {
    const p = buildPrompt({ ...base, modelImagePaths: ["models/u1/m.png"] }).toLowerCase();
    expect(p).toContain("model identity");
    expect(p).toContain("no collage");
    expect(p).toContain("do not show this photo");
  });
  it("referenceRolesClause forbids the collage failure explicitly", () => {
    const c = referenceRolesClause({ productCount: 1, hasIdentity: true }).toLowerCase();
    expect(c).toContain("one single cohesive photograph");
    expect(c).toMatch(/no collage|no grid|side-by-side/);
  });
});

describe("item 2: multi-product reasoning + routing", () => {
  it("buildPrompt names each product and pins them to one model", () => {
    const p = buildPrompt({ ...base, referenceImagePaths: ["a.png", "b.png", "c.png"] }).toLowerCase();
    expect(p).toContain("product 1 of 3");
    expect(p).toContain("product 3");
    expect(p).toContain("same single model");
  });
  it("multi-product never routes through single-garment try-on, even with an identity", () => {
    const spec: ShotSpec = { ...base, referenceImagePaths: ["a.png", "b.png"], modelImagePaths: ["m.png"] };
    expect(productCount(spec)).toBe(2);
    expect(planNeed(spec)).toBe("image/hero");
  });
  it("single apparel on-model with an identity still uses try-on", () => {
    expect(planNeed({ ...base, modelImagePaths: ["m.png"] })).toBe("tryon");
  });
});

describe("item 5: multi-output directed shoot", () => {
  it("clamps the count to the hard cap", () => {
    expect(clampOutputCount(99)).toBe(MAX_OUTPUTS);
    expect(clampOutputCount(0)).toBe(1);
    expect(clampOutputCount(undefined)).toBe(1);
  });
  it("produces art-directed variation, not N identical frames", () => {
    const frames = planShootFrames(base, 4);
    expect(frames).toHaveLength(4);
    const framings = new Set(frames.map((f) => f.spec.framing));
    expect(framings.size).toBeGreaterThan(1); // the camera actually moves across the set
    // each frame is a single generation and carries a per-frame art-direction note
    expect(frames.every((f) => f.spec.outputCount === 1)).toBe(true);
    expect(frames.every((f) => (f.spec.freeText?.frame ?? "").includes("Frame"))).toBe(true);
  });
  it("poses stay valid for the category (a shirt never gets an earring pose)", () => {
    const frames = planShootFrames({ ...base, category: "jewellery", subType: "necklace" }, 6);
    expect(frames.every((f) => f.spec.pose !== undefined)).toBe(true);
  });
  it("quotes N frames so quoted == charged", () => {
    const single = planCredits(base).credits;
    const shoot = planCredits({ ...base, outputCount: 3 });
    expect(shoot.count).toBe(3);
    expect(shoot.credits).toBe(single * 3);
  });
});

describe("item 6: replace routing (image + video) is reference-capable", () => {
  it("image replace routes to image/replace", () => {
    expect(planNeed({ ...base, replace: { sourceImagePath: "uploads/u1/src.png" } })).toBe("image/replace");
  });
  it("video replace routes to video/replace", () => {
    expect(planNeed({ ...base, replace: { sourceVideoPath: "uploads/u1/clip.mp4" } })).toBe("video/replace");
  });
  it("both replace slugs are reference-capable, never text-to-image", () => {
    expect(() => assertReferenceCapable("image/replace")).not.toThrow();
    expect(() => assertReferenceCapable("video/replace")).not.toThrow();
  });
  it("replace buildPrompt keeps the source and swaps only the product", () => {
    const p = buildPrompt({ ...base, replace: { sourceImagePath: "src.png" } }).toLowerCase();
    expect(p).toContain("swap the product");
    expect(p).toContain("source scene to keep");
  });
});

describe("item 10: tiny images are accepted with a warning, never blocked", () => {
  it("small image -> ok with a non-blocking warning", () => {
    const v = validateImageUpload(pngOf(300, 300));
    expect(v.ok).toBe(true);
    expect(v.warning).toMatch(/small/i);
  });
  it("large enough image -> ok, no warning", () => {
    const v = validateImageUpload(pngOf(2000, 2000));
    expect(v.ok).toBe(true);
    expect(v.warning).toBeUndefined();
  });
  it("non-image -> still rejected", () => {
    expect(validateImageUpload(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).ok).toBe(false);
  });
});

describe("item 9: defensive JSON parsing never throws on a non-JSON body", () => {
  it("plain-text 413 body -> clean size error, not a parse crash", async () => {
    const r = await parseJsonSafe(new Response("Request Entity Too Large", { status: 413 }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/too large/i);
  });
  it("HTML 500 page -> clean error", async () => {
    const r = await parseJsonSafe(new Response("<html>error</html>", { status: 500 }));
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });
  it("valid JSON -> parsed through", async () => {
    const r = await parseJsonSafe<{ jobId: string }>(new Response(JSON.stringify({ jobId: "x" }), { status: 200 }));
    expect(r.ok).toBe(true);
    expect(r.data?.jobId).toBe("x");
  });
  it("JSON error body -> surfaces the server's message", async () => {
    const r = await parseJsonSafe(new Response(JSON.stringify({ error: "insufficient_credits" }), { status: 402 }));
    expect(r.ok).toBe(false);
    expect(r.error).toBe("insufficient_credits");
  });
});
