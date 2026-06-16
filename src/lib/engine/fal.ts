import "server-only";
import { fal } from "@fal-ai/client";

// fal.ai client wrapper. ONE key, server-side only, never committed.
// Short jobs (images, try-on, edits) use subscribe() within the Vercel timeout.
// Long jobs (video) use queue.submit() with a webhook URL and are driven by the worker.

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("Missing FAL_KEY");
  fal.config({ credentials: key });
  configured = true;
}

export interface SubscribeResult {
  data: unknown;
  requestId: string;
}

/** Run a short job to completion (images / try-on / edits). */
export async function runSync(
  slug: string,
  input: Record<string, unknown>
): Promise<SubscribeResult> {
  ensureConfigured();
  const result = await fal.subscribe(slug, { input, logs: false });
  return { data: result.data, requestId: result.requestId };
}

/** Submit a long job to the fal queue with a webhook callback (video). Returns request id. */
export async function submitAsync(
  slug: string,
  input: Record<string, unknown>,
  webhookUrl: string
): Promise<string> {
  ensureConfigured();
  const { request_id } = await fal.queue.submit(slug, { input, webhookUrl });
  return request_id;
}

/** Fetch a queued job's result after a webhook fires (worker / webhook route uses this). */
export async function fetchResult(slug: string, requestId: string): Promise<unknown> {
  ensureConfigured();
  const result = await fal.queue.result(slug, { requestId });
  return result.data;
}
