import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import { runSync } from "@/lib/engine/fal";
import { firstOutputUrl } from "@/lib/engine/run";
import { storeFromUrlAt } from "@/lib/engine/storage";
import { createJob, markJobDone, markJobFailed } from "@/lib/engine/jobs";
import { reserveCredits, settleCredits, refundCredits } from "@/lib/engine/credits";
import { buildModelPrompt, MODEL_NEGATIVE } from "./prompt";
import { MODEL_ANGLES, MODEL_CREATE_CREDITS, type ModelInputs } from "./schema";
import type { Json } from "@/lib/supabase/types";

// Generate a saved model: 4 consistent white-background reference angles. The first angle is
// text-to-image (a NEW person, not the user's product, so the product fidelity guard does not
// apply here). The other three are conditioned on the first image to lock identity across angles.

const MODEL_BASE_SLUG = "fal-ai/bytedance/seedream/v4.5/text-to-image";
const MODEL_ANGLE_SLUG = "fal-ai/nano-banana-pro/edit";

export interface GenerateModelResult {
  status: "ready" | "failed" | "insufficient";
  modelId?: string;
  imagePaths?: string[];
  message?: string;
}

export async function generateModel(
  userId: string,
  userEmail: string | null,
  name: string,
  inputs: ModelInputs
): Promise<GenerateModelResult> {
  const admin = getAdminClient();

  const job = await createJob({
    userId,
    userEmail,
    type: "model/create",
    payload: { inputs: inputs as unknown as Record<string, unknown> },
    estimatedCredits: MODEL_CREATE_CREDITS,
  });

  // RESERVE (gates on balance).
  try {
    await reserveCredits(userId, MODEL_CREATE_CREDITS, job.id, "Model generation");
  } catch {
    await markJobFailed(job.id, "insufficient credits for model creation");
    return { status: "insufficient", message: "Not enough credits to create a model." };
  }

  const modelId = crypto.randomUUID();
  try {
    // 1. Base angle (front), text-to-image.
    const front = MODEL_ANGLES[0];
    const baseRes = await runSync(MODEL_BASE_SLUG, {
      prompt: buildModelPrompt(inputs, front.instruction),
      negative_prompt: MODEL_NEGATIVE,
      image_size: { width: 1536, height: 2048 },
    });
    const frontUrl = firstOutputUrl(baseRes.data);
    if (!frontUrl) throw new Error("model base angle returned no image");

    const paths: string[] = [];
    paths.push(await storeFromUrlAt(`models/${userId}/${modelId}/${front.id}.png`, frontUrl));

    // 2. Remaining angles, conditioned on the front image for identity lock.
    for (const angle of MODEL_ANGLES.slice(1)) {
      const res = await runSync(MODEL_ANGLE_SLUG, {
        prompt:
          buildModelPrompt(inputs, angle.instruction) +
          " Keep the exact same person as the reference image: same face, hair, body and skin tone.",
        negative_prompt: MODEL_NEGATIVE,
        image_urls: [frontUrl],
        resolution: "2K",
      });
      const url = firstOutputUrl(res.data);
      if (!url) throw new Error(`model angle ${angle.id} returned no image`);
      paths.push(await storeFromUrlAt(`models/${userId}/${modelId}/${angle.id}.png`, url));
    }

    // SETTLE + persist the model.
    await settleCredits(userId, MODEL_CREATE_CREDITS, MODEL_CREATE_CREDITS, job.id, "Model generation");
    await admin.from("drape_models").insert({
      id: modelId,
      user_id: userId,
      name: name.slice(0, 80) || "Untitled model",
      inputs: inputs as unknown as Json,
      image_paths: paths,
      status: "ready",
    });
    await markJobDone(job.id, paths[0], MODEL_CREATE_CREDITS);

    return { status: "ready", modelId, imagePaths: paths };
  } catch (err) {
    await refundCredits(userId, MODEL_CREATE_CREDITS, job.id, "Model generation, refunded");
    await markJobFailed(job.id, `model creation failed: ${String(err)}`);
    return { status: "failed", message: "Model creation failed. Your credits were refunded." };
  }
}
