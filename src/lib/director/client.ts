import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Anthropic client for the prompt-director. Gated on ANTHROPIC_API_KEY: when it is not set, the
// director falls back to deterministic local composition (the fidelity fix still holds because the
// router always attaches the product image to a reference-capable slug).

export const DIRECTOR_MODEL = "claude-opus-4-8";

let cached: Anthropic | null = null;

export function directorEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function getAnthropic(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  cached = new Anthropic({ apiKey });
  return cached;
}

// Fetch an image URL and return a base64 image block for Claude vision (images-before-text).
export async function imageBlock(url: string): Promise<Anthropic.ImageBlockParam> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`director: failed to fetch image ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "image/png";
  const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
  const media = (["image/png", "image/jpeg", "image/webp", "image/gif"].includes(contentType)
    ? contentType
    : "image/png") as "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  return { type: "image", source: { type: "base64", media_type: media, data: b64 } };
}

// Pull the input of the first tool_use block out of a response (forced tool use).
export function firstToolInput(message: Anthropic.Message): Record<string, unknown> | null {
  for (const block of message.content) {
    if (block.type === "tool_use") return block.input as Record<string, unknown>;
  }
  return null;
}
