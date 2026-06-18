import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { DIRECTOR_MODEL, getAnthropic, firstToolInput } from "./client";
import { COMPOSE_SYSTEM } from "./prompts";
import type { Composition, ProductAnalysis } from "./schema";

// Stage 2 - Compose (Claude text, forced tool use). Turns the analysis + user intent into a
// reference-locked generation plan.

const COMPOSE_TOOL: Anthropic.Tool = {
  name: "record_composition",
  description: "Record the reference-locked generation plan.",
  input_schema: {
    type: "object",
    properties: {
      positive_prompt: { type: "string" },
      negative_prompt: { type: "string" },
      model_route: {
        type: "string",
        // Still-image routes only - all reference-capable. Never a text-to-image slug.
        enum: ["image/standard", "image/hero", "image/edit", "tryon"],
      },
      params: {
        type: "object",
        properties: {
          resolution: { type: "string", enum: ["1K", "2K", "4K"] },
          num_images: { type: "number" },
          image_size: {
            type: "object",
            properties: { width: { type: "number" }, height: { type: "number" } },
          },
          aspect_ratio: { type: "string" },
          strength: { type: "number" },
        },
      },
      video_prompt: { type: "string" },
      fidelity_locks: { type: "array", items: { type: "string" } },
      clarifying_questions: { type: "array", items: { type: "string" } },
    },
    required: ["positive_prompt", "negative_prompt", "model_route", "fidelity_locks"],
  },
};

export interface ComposeIntent {
  /** Free-text brief and/or structured selections, already serialized to text. */
  intentText: string;
  /** Whether a saved model identity is attached (enables the tryon route). */
  hasModelIdentity: boolean;
  /** Number of reference images attached, for the reference-roles instruction. */
  referenceCount: number;
}

export async function composeShot(
  analysis: ProductAnalysis,
  intent: ComposeIntent
): Promise<Composition> {
  const client = getAnthropic();

  const userText = [
    "PRODUCT ANALYSIS (JSON):",
    JSON.stringify(analysis),
    "",
    `REFERENCE IMAGES ATTACHED: ${intent.referenceCount} (Image 1 is the exact product).`,
    `SAVED MODEL IDENTITY PROVIDED: ${intent.hasModelIdentity ? "yes" : "no"}.`,
    "",
    "USER INTENT:",
    intent.intentText,
  ].join("\n");

  const message = await client.messages.create({
    model: DIRECTOR_MODEL,
    max_tokens: 4000,
    system: [{ type: "text", text: COMPOSE_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [COMPOSE_TOOL],
    tool_choice: { type: "tool", name: "record_composition" },
    messages: [{ role: "user", content: userText }],
  });

  const input = firstToolInput(message);
  if (!input) throw new Error("compose: model returned no tool use");
  const c = input as unknown as Composition;
  if (!c.params) c.params = {};
  if (!c.fidelity_locks) c.fidelity_locks = [];
  return c;
}
