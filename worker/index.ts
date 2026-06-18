// Drape video worker (Railway).
//
// Vercel functions time out at ~300s; video jobs run longer, so they run here. This worker:
//   1. Polls the jobs table for queued ASYNC (video) jobs.
//   2. Claims one atomically via claim_next_job (FOR UPDATE SKIP LOCKED) so parallel workers
//      never double-process.
//   3. Submits it to fal with the webhook URL. Settlement happens in the Next webhook route.
//
// DEPLOY SEPARATELY (rule 7): this worker deploys from the repo to Railway independently of the
// Vercel app. A merge to the Next app does NOT redeploy this worker. Keep both on current code.
//
// Credits were already RESERVED at submit time by the Next API route, so the worker never
// touches the ledger on the happy path; it only marks the job failed + the webhook refunds if
// fal submission errors.

import { createClient } from "@supabase/supabase-js";
import { fal } from "@fal-ai/client";

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const FAL_KEY = requireEnv("FAL_KEY");
const APP_URL = requireEnv("NEXT_PUBLIC_APP_URL");
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 5000);

// Async needs handled by the worker. Mirror the async entries in src/lib/engine/registry.ts.
const VIDEO_NEEDS = ["video/standard", "video/hero", "upscale/video"];
const SLUGS: Record<string, string> = {
  "video/standard": "fal-ai/bytedance/seedance-2.0/image-to-video",
  "video/hero": "fal-ai/veo3.1",
  "upscale/video": "fal-ai/topaz/upscale/video",
};

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
fal.config({ credentials: FAL_KEY });

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Worker missing required env var ${name}`);
  return v;
}

interface ClaimedJob {
  id: string;
  type: string;
  payload: { falInput?: Record<string, unknown> };
  user_id: string;
  estimated_credits: number;
}

async function claimNext(): Promise<ClaimedJob | null> {
  const { data, error } = await admin.rpc("drape_claim_next_job", { p_types: VIDEO_NEEDS });
  if (error) {
    console.error("claim_next_job failed:", error.message);
    return null;
  }
  return (data as ClaimedJob) ?? null;
}

async function processJob(job: ClaimedJob) {
  const slug = SLUGS[job.type];
  const falInput = job.payload?.falInput ?? {};
  const webhookUrl = `${APP_URL}/api/jobs/fal-webhook`;

  try {
    const { request_id } = await fal.queue.submit(slug, { input: falInput, webhookUrl });
    await admin
      .from("drape_jobs")
      .update({ fal_request_id: request_id, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    console.log(`submitted job ${job.id} -> fal ${request_id}`);
  } catch (err) {
    // Submission failed: mark failed and refund the reservation (nothing was spent).
    console.error(`job ${job.id} submit failed:`, err);
    await admin.rpc("drape_debit_credits", {
      p_user_id: job.user_id,
      p_amount: -job.estimated_credits, // negative debit = credit the reservation back
      p_job_id: job.id,
      p_kind: "refund",
      p_gate: false,
      p_note: "worker submit failure",
    });
    await admin
      .from("drape_jobs")
      .update({ status: "failed", last_error: String(err).slice(0, 2000) })
      .eq("id", job.id);
  }
}

// Periodically ask the app to reconcile in-flight jobs whose webhook never arrived.
async function reconcile() {
  const secret = process.env.WORKER_SHARED_SECRET;
  if (!secret) return;
  try {
    const res = await fetch(`${APP_URL}/api/jobs/reconcile`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    if (res.ok) {
      const s = await res.json();
      if (s.completed || s.failed) console.log("reconciled:", JSON.stringify(s));
    }
  } catch (err) {
    console.error("reconcile call failed:", err);
  }
}

async function loop() {
  console.log(`Drape worker started. Polling every ${POLL_MS}ms for ${VIDEO_NEEDS.join(", ")}`);
  // Graceful shutdown.
  let running = true;
  process.on("SIGTERM", () => (running = false));
  process.on("SIGINT", () => (running = false));

  let cycles = 0;
  while (running) {
    try {
      const job = await claimNext();
      if (job) {
        await processJob(job);
        continue; // drain queue without waiting
      }
      // Reconcile roughly once a minute (every ~12 idle cycles at 5s).
      if (++cycles % 12 === 0) await reconcile();
    } catch (err) {
      console.error("worker loop error:", err);
    }
    await sleep(POLL_MS);
  }
  console.log("Drape worker stopping.");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

loop().catch((err) => {
  console.error("worker crashed:", err);
  process.exit(1);
});
