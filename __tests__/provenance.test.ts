import { describe, it, expect } from "vitest";
import { buildProvenanceManifest } from "@/lib/shot/provenance";

describe("provenance manifest (C2PA-style, compliance)", () => {
  const m = buildProvenanceManifest({
    jobId: "job1",
    modelSlug: "fal-ai/nano-banana-pro",
    need: "image/hero",
    category: "apparel",
    subType: "saree",
    tier: "red",
    outputFormat: "image/png",
  });

  it("declares trained algorithmic media as the digital source type", () => {
    const actions = m.assertions.find((a) => a.label === "c2pa.actions");
    const data = actions?.data as { actions: { digitalSourceType: string }[] };
    expect(data.actions[0].digitalSourceType).toContain("trainedAlgorithmicMedia");
  });

  it("records the model and marks the output AI generated", () => {
    const gen = m.assertions.find((a) => a.label === "com.drape.generation");
    expect((gen?.data as Record<string, unknown>).model).toBe("fal-ai/nano-banana-pro");
    expect((gen?.data as Record<string, unknown>).aiGenerated).toBe(true);
  });

  it("uses the Oviya Studio claim generator and a timestamp", () => {
    expect(m.claim_generator).toBe("Oviya Studio/1.0");
    expect(() => new Date(m.created_at).toISOString()).not.toThrow();
  });
});
