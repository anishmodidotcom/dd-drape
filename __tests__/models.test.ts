import { describe, it, expect } from "vitest";
import { buildModelIdentity, buildModelPrompt, MODEL_NEGATIVE } from "@/lib/models/prompt";
import { MODEL_ANGLES, MODEL_CREATE_CREDITS } from "@/lib/models/schema";

describe("model prompt builder", () => {
  const inputs = {
    gender: "women",
    ethnicity: "South Asian",
    ageRange: "20s",
    bodyType: "mid-size",
    skinTone: "wheatish",
    hairstyle: "open waves",
    expression: "soft smile",
  };

  it("builds an identity description from the inputs", () => {
    const id = buildModelIdentity(inputs);
    expect(id).toContain("South Asian");
    expect(id).toContain("mid size build");
    expect(id).toContain("soft smile");
  });

  it("free-text describe is appended", () => {
    const id = buildModelIdentity({ ...inputs, describe: "light freckles" });
    expect(id).toContain("light freckles");
  });

  it("every angle prompt asks for the same person on a white background", () => {
    for (const a of MODEL_ANGLES) {
      const p = buildModelPrompt(inputs, a.instruction);
      expect(p.toLowerCase()).toContain("white seamless studio background");
      expect(p.toLowerCase()).toContain("same person");
      expect(p).toContain(a.instruction);
    }
  });

  it("negative library guards against AI slop and busy backgrounds", () => {
    expect(MODEL_NEGATIVE).toContain("plastic skin");
    expect(MODEL_NEGATIVE).toContain("busy background");
  });

  it("there are four angles and the cost matches (4 + 3x15)", () => {
    expect(MODEL_ANGLES.length).toBe(4);
    expect(MODEL_CREATE_CREDITS).toBe(49);
  });
});
