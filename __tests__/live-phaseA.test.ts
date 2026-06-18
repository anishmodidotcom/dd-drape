import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";

// FULL LIVE Phase A exit test. Real Claude (Analyze -> Compose -> fidelity gate) + real fal
// (generate through the reference-capable edit slug). Gated behind RUN_LIVE=1 so it never runs in
// the default `npm test` (it spends money and takes ~60s). Run with:
//   RUN_LIVE=1 npx vitest run __tests__/live-phaseA.test.ts

const RUN = process.env.RUN_LIVE === "1";

describe.runIf(RUN)("LIVE Phase A: fidelity engine end to end", () => {
  beforeAll(() => {
    // Load .env.local into process.env so the director + fal clients pick up the real keys.
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      if (!line.includes("=") || line.trimStart().startsWith("#")) continue;
      const i = line.indexOf("=");
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  });

  it(
    "white kurta stays a white kurta: analyze -> compose -> edit-slug generate -> fidelity gate passes",
    async () => {
      const { runSync } = await import("@/lib/engine/fal");
      const { directShot } = await import("@/lib/director");
      const { checkFidelity } = await import("@/lib/director/gate");
      const { assertReferenceCapable } = await import("@/lib/engine/registry");
      const { firstOutputUrl } = await import("@/lib/engine/run");

      // 0. Stand-in "uploaded product": a plain white chikankari kurta flat-lay (no model).
      const prod = await runSync("fal-ai/bytedance/seedream/v4.5/text-to-image", {
        prompt:
          "Flat-lay product photo of a plain WHITE chikankari cotton kurta on pure white background, no model, ecommerce",
      });
      const productUrl = firstOutputUrl(prod.data);
      expect(productUrl, "stand-in product generated").toBeTruthy();
      console.log("\n[product]", productUrl);

      // 1+2+3. Analyze (Claude vision) -> Compose (Claude) -> Route (deterministic, guarded).
      const directed = await directShot({
        spec: {
          category: "apparel",
          subType: "kurta",
          shotType: "on-model-full",
          referenceImagePaths: ["uploads/live/kurta.png"],
          model: { ethnicity: "south-asian-medium", body: "mid-size" },
          background: "white",
          lighting: "soft-two-zone",
          framing: "full-length",
          vibe: "clinical-ecom",
          quality: "standard", // cheapest edit slug first (test-first rule)
        },
        productImageUrls: [productUrl!],
      });

      console.log("[usedClaude]", directed.usedClaude);
      console.log("[analysis.category]", directed.analysis.product_category);
      console.log("[analysis.primary_color]", directed.analysis.primary_color_name);
      console.log("[route]", directed.routed.need, directed.routed.slug);
      console.log("[fidelity_locks]", directed.routed.fidelityLocks);

      // Director assertions: Claude ran, slug is reference-capable, product attached.
      expect(directed.usedClaude, "Claude director ran").toBe(true);
      expect(directed.analysis.product_category).toBe("apparel");
      expect(() => assertReferenceCapable(directed.routed.need)).not.toThrow();
      expect(directed.routed.slug).toContain("edit");
      expect(directed.routed.slug).not.toContain("text-to-image");
      expect(directed.routed.falInput.image_urls).toEqual([productUrl]);

      // 4. Generate on the routed reference-capable slug.
      const gen = await runSync(directed.routed.slug, directed.routed.falInput);
      const outUrl = firstOutputUrl(gen.data);
      expect(outUrl, "on-model still generated").toBeTruthy();
      console.log("[output]", outUrl);

      // 5. Fidelity gate (Claude vision): does the generated product match the source?
      const verdict = await checkFidelity(productUrl!, outUrl!);
      console.log("[verdict]", JSON.stringify(verdict));
      expect(verdict.match, `fidelity gate reasons: ${verdict.reasons.join("; ")}`).toBe(true);
      expect(verdict.color_ok).toBe(true);
      expect(verdict.garment_ok).toBe(true);
    },
    240000
  );
});
