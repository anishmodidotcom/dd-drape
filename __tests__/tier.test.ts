import { describe, it, expect } from "vitest";
import { classifyTier } from "@/lib/engine/tier";

describe("AI-readiness tier router (Section 6 matrix)", () => {
  it("simple apparel background swap is GREEN", () => {
    expect(classifyTier({ category: "apparel", subType: "t-shirt", shotType: "background-swap" })).toBe(
      "green"
    );
  });

  it("complex apparel (saree) on-model full-length is RED", () => {
    expect(classifyTier({ category: "apparel", subType: "saree", shotType: "on-model-full" })).toBe(
      "red"
    );
  });

  it("simple apparel on-model full-length is AMBER", () => {
    expect(classifyTier({ category: "apparel", subType: "denim", shotType: "on-model-full" })).toBe(
      "amber"
    );
  });

  it("jewellery background swap is AMBER, never GREEN", () => {
    expect(classifyTier({ category: "jewellery", subType: "necklace", shotType: "background-swap" })).toBe(
      "amber"
    );
  });

  it("jewellery detail-macro is RED (we enhance and place, never fabricate facets)", () => {
    expect(classifyTier({ category: "jewellery", subType: "ring", shotType: "detail-macro" })).toBe(
      "red"
    );
  });

  it("accessory lifestyle is AMBER", () => {
    expect(classifyTier({ category: "accessory", subType: "handbag", shotType: "lifestyle" })).toBe(
      "amber"
    );
  });

  it("complex apparel flat-lay is AMBER (drape/print needs review)", () => {
    expect(classifyTier({ category: "apparel", subType: "lehenga", shotType: "flat-lay" })).toBe(
      "amber"
    );
  });

  it("sub-type matching is case and whitespace tolerant", () => {
    expect(classifyTier({ category: "apparel", subType: " Saree ", shotType: "on-model-full" })).toBe(
      "red"
    );
  });
});
