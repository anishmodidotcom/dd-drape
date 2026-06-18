import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { DIRECTOR_MODEL, getAnthropic, imageBlock, firstToolInput } from "./client";
import { ANALYZE_SYSTEM } from "./prompts";
import { emptyAnalysis, type ProductAnalysis } from "./schema";

// Stage 1 - Analyze (Claude vision, forced tool use, images-before-text). Runs once per product
// and is cached on drape_products.

const ANALYSIS_TOOL: Anthropic.Tool = {
  name: "record_analysis",
  description: "Record the observed attributes of the product in the photo.",
  input_schema: {
    type: "object",
    properties: {
      product_category: { type: ["string", "null"], enum: ["apparel", "jewellery", "accessory", null] },
      garment_subtype: { type: ["string", "null"] },
      primary_color_name: { type: ["string", "null"] },
      primary_color_hex: { type: ["string", "null"] },
      secondary_colors: { type: "array", items: { type: "string" } },
      fabric: { type: ["string", "null"] },
      weave_or_knit: { type: ["string", "null"] },
      sheerness: { type: ["string", "null"] },
      reflectivity: { type: ["string", "null"], enum: ["matte", "satin", "metallic", null] },
      print_or_pattern: { type: ["string", "null"] },
      print_scale: { type: ["string", "null"] },
      embroidery_type: { type: ["string", "null"] },
      embellishments: { type: "array", items: { type: "string" } },
      construction: {
        type: "object",
        properties: {
          neckline: { type: ["string", "null"] },
          sleeve: { type: ["string", "null"] },
          hem: { type: ["string", "null"] },
          closures: { type: ["string", "null"] },
          fit: { type: ["string", "null"] },
          drape_behavior: { type: ["string", "null"] },
        },
      },
      hardware: { type: "array", items: { type: "string" } },
      text_or_logos: { type: "array", items: { type: "string" } },
      jewellery: {
        type: ["object", "null"],
        properties: {
          metal_type: { type: ["string", "null"] },
          stone_type: { type: ["string", "null"] },
          setting: { type: ["string", "null"] },
          engraving_text: { type: ["string", "null"] },
        },
      },
      confidence: { type: "object", additionalProperties: { type: "number" } },
      recommended_shot_types: { type: "array", items: { type: "string" } },
      recommended_looks: {
        type: "array",
        items: {
          type: "object",
          properties: { label: { type: "string" }, one_line_brief: { type: "string" } },
          required: ["label", "one_line_brief"],
        },
      },
    },
    required: ["product_category", "primary_color_name", "confidence", "recommended_looks"],
  },
};

export async function analyzeProduct(imageUrl: string): Promise<ProductAnalysis> {
  const client = getAnthropic();
  const img = await imageBlock(imageUrl);

  const message = await client.messages.create({
    model: DIRECTOR_MODEL,
    max_tokens: 4000,
    system: [{ type: "text", text: ANALYZE_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: "tool", name: "record_analysis" },
    messages: [
      {
        role: "user",
        // Images BEFORE text (vision best practice).
        content: [img, { type: "text", text: "Analyze this product photo." }],
      },
    ],
  });

  const input = firstToolInput(message);
  if (!input) throw new Error("analyze: model returned no tool use");
  return { ...emptyAnalysis(), ...(input as Partial<ProductAnalysis>) } as ProductAnalysis;
}
