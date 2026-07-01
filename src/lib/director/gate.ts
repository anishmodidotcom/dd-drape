import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { DIRECTOR_MODEL, getAnthropic, imageBlock, firstToolInput } from "./client";
import { GATE_SYSTEM } from "./prompts";
import type { FidelityVerdict } from "./schema";

// Phase 5 calibration (docs/ENGINE_QUALITY_AUDIT.md 3.5), extracted as a pure function so the
// hard-fail/soft-signal split is unit-testable independent of the live Claude call. detail_ok
// (fine surface detail - embroidery/zari/weave/facets) is a HARD fidelity concern: it closes the
// exact audit gap where a result that smooths away the chikankari or melts the zari used to pass.
// sharp_ok/no_ai_look are diagnostic-only and never fail a shot: judging sharpness/glow from a
// single vision pass is more subjective, and hard-failing on them risked over-refunding good,
// faithful output.
export function isFidelityHardOk(verdict: FidelityVerdict): boolean {
  return verdict.match && verdict.color_ok && verdict.pattern_ok && verdict.garment_ok && verdict.detail_ok;
}

// Stage 3.3 - Fidelity gate (Claude vision critique). Compares source product vs generated output
// and returns a strict verdict. The trust backbone: a non-match is auto-refunded / regenerated,
// never shipped as final.

const VERDICT_TOOL: Anthropic.Tool = {
  name: "record_verdict",
  description: "Record whether the generated product matches the source product.",
  input_schema: {
    type: "object",
    properties: {
      match: { type: "boolean" },
      color_ok: { type: "boolean" },
      pattern_ok: { type: "boolean" },
      garment_ok: { type: "boolean" },
      detail_ok: { type: "boolean", description: "Fine surface detail (embroidery/zari/weave/facets) preserved, not smoothed away." },
      sharp_ok: { type: "boolean", description: "Diagnostic only. Product region is critically sharp, not soft or blurred." },
      no_ai_look: { type: "boolean", description: "Diagnostic only. No plastic/waxy sheen, bloom, haze, or unnatural glow on the product." },
      reasons: { type: "array", items: { type: "string" } },
    },
    required: ["match", "color_ok", "pattern_ok", "garment_ok", "detail_ok", "sharp_ok", "no_ai_look", "reasons"],
  },
};

export async function checkFidelity(
  sourceUrl: string,
  outputUrl: string
): Promise<FidelityVerdict> {
  const client = getAnthropic();
  const [src, out] = await Promise.all([imageBlock(sourceUrl), imageBlock(outputUrl)]);

  const message = await client.messages.create({
    model: DIRECTOR_MODEL,
    max_tokens: 1024,
    system: [{ type: "text", text: GATE_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [VERDICT_TOOL],
    tool_choice: { type: "tool", name: "record_verdict" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Image 1 is the SOURCE product:" },
          src,
          { type: "text", text: "Image 2 is the GENERATED output:" },
          out,
          {
            type: "text",
            text:
              "Does the generated product match the source in colour, pattern and identity, AND has fine " +
              "surface detail (embroidery, zari, weave, facets) been preserved rather than smoothed away? " +
              "Be strict on all four. Separately and honestly, report whether the product region is sharp " +
              "and free of an artificial glow, as diagnostic signals only.",
          },
        ],
      },
    ],
  });

  const input = firstToolInput(message);
  if (!input) throw new Error("gate: model returned no tool use");
  return input as unknown as FidelityVerdict;
}
