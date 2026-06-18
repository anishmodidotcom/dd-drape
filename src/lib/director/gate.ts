import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { DIRECTOR_MODEL, getAnthropic, imageBlock, firstToolInput } from "./client";
import { GATE_SYSTEM } from "./prompts";
import type { FidelityVerdict } from "./schema";

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
      reasons: { type: "array", items: { type: "string" } },
    },
    required: ["match", "color_ok", "pattern_ok", "garment_ok", "reasons"],
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
          { type: "text", text: "Does the generated product match the source? Be strict." },
        ],
      },
    ],
  });

  const input = firstToolInput(message);
  if (!input) throw new Error("gate: model returned no tool use");
  return input as unknown as FidelityVerdict;
}
