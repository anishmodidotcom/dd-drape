import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";

// LIVE Phase C + B verification against the real tables. Gated behind RUN_LIVE=1.
//   RUN_LIVE=1 npx vitest run __tests__/live-models-reconcile.test.ts
// Spends real credits/fal ($ ~2.5: a model = 49 credits + a product generation).

const RUN = process.env.RUN_LIVE === "1";

function loadEnv() {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    if (!line.includes("=") || line.trimStart().startsWith("#")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
  }
}

describe.runIf(RUN)("LIVE Models studio + reconciler + idempotency", () => {
  let admin: import("@supabase/supabase-js").SupabaseClient;
  let userId: string;
  const email = `drape-qa-${Math.random().toString(36).slice(2, 8)}@example.com`;

  beforeAll(async () => {
    loadEnv();
    const { createClient } = await import("@supabase/supabase-js");
    admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const { data } = await admin.auth.admin.createUser({ email, password: `Drape!${Date.now()}`, email_confirm: true });
    userId = data.user!.id;
    await new Promise((r) => setTimeout(r, 900)); // signup-grant trigger
  });

  it("creates a saved model: 4 consistent angles, persisted to drape_models, credits settled", async () => {
    const { generateModel } = await import("@/lib/models/generate");

    const before = (await admin.from("drape_credit_balances").select("balance").eq("user_id", userId).single()).data!.balance as number;
    expect(before).toBe(400);

    const res = await generateModel(userId, email, "QA House Model", {
      gender: "women",
      ethnicity: "South Asian",
      ageRange: "20s",
      bodyType: "mid-size",
      hairstyle: "open waves",
      expression: "soft smile",
    });
    console.log("\n[model result]", res.status, res.modelId, res.imagePaths?.length, "angles");

    expect(res.status).toBe("ready");
    expect(res.imagePaths).toHaveLength(4);

    // Persisted with all 4 angle paths.
    const row = (await admin.from("drape_models").select("*").eq("id", res.modelId!).single()).data!;
    expect(row.user_id).toBe(userId);
    expect((row.image_paths as string[]).length).toBe(4);
    expect(row.status).toBe("ready");

    // Settled exactly 49 (4 base + 3 x 15).
    const after = (await admin.from("drape_credit_balances").select("balance").eq("user_id", userId).single()).data!.balance as number;
    expect(after).toBe(400 - 49);

    // Stash for the next test.
    (globalThis as Record<string, unknown>).__qaModelPaths = res.imagePaths;
  }, 240000);

  it("reuses the saved model on a product generation, with the product locked", async () => {
    const modelPaths = (globalThis as Record<string, unknown>).__qaModelPaths as string[];
    expect(modelPaths?.length).toBe(4);

    const { runSync } = await import("@/lib/engine/fal");
    const { directShot } = await import("@/lib/director");
    const { firstOutputUrl } = await import("@/lib/engine/run");
    const { signedUrl } = await import("@/lib/engine/storage");

    // A product (stand-in upload).
    const prod = await runSync("fal-ai/bytedance/seedream/v4.5/text-to-image", {
      prompt: "Flat-lay product photo of a teal silk saree with gold zari border on white background, no model, ecommerce",
    });
    const productUrl = firstOutputUrl(prod.data)!;
    const modelUrl = await signedUrl(modelPaths[0], 3600);

    const directed = await directShot({
      spec: {
        category: "apparel",
        subType: "saree",
        shotType: "on-model-full",
        referenceImagePaths: ["uploads/qa/saree.png"],
        modelImagePaths: modelPaths,
      },
      productImageUrls: [productUrl],
      modelIdentityUrls: [modelUrl],
    });

    console.log("[reuse route]", directed.routed.need, directed.routed.slug);
    // With a saved model + apparel on-model, the director routes to try-on and attaches BOTH.
    expect(directed.routed.need).toBe("tryon");
    expect(directed.routed.slug).toBe("fal-ai/fashn/tryon/v1.6");
    expect(directed.routed.falInput.garment_image).toBe(productUrl);
    expect(directed.routed.falInput.model_image).toBe(modelUrl);
  }, 120000);

  it("reconciler lists stale in-flight jobs and the ledger double-debit is idempotent", async () => {
    // Insert a fake in-flight job with an old updated_at + a request id (simulates a lost webhook).
    const stale = (await admin
      .from("drape_jobs")
      .insert({
        tenant_id: userId,
        user_id: userId,
        type: "video/standard",
        status: "running",
        fal_request_id: "qa-fake-req",
        estimated_credits: 56,
        updated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single()).data!;

    const list = await admin.rpc("drape_list_stale_jobs", { p_minutes: 15 });
    const ids = (list.data as { id: string }[]).map((j) => j.id);
    expect(ids).toContain(stale.id);

    // Idempotent double refund: reserve 56, then refund twice -> back to start, one refund row.
    await admin.rpc("drape_debit_credits", { p_user_id: userId, p_amount: 56, p_job_id: stale.id, p_kind: "reserve", p_gate: true, p_note: "qa reserve" });
    const balAfterReserve = (await admin.from("drape_credit_balances").select("balance").eq("user_id", userId).single()).data!.balance as number;

    await admin.rpc("drape_debit_credits", { p_user_id: userId, p_amount: -56, p_job_id: stale.id, p_kind: "refund", p_gate: false, p_note: "qa refund 1" });
    await admin.rpc("drape_debit_credits", { p_user_id: userId, p_amount: -56, p_job_id: stale.id, p_kind: "refund", p_gate: false, p_note: "qa refund 2 (idempotent)" });
    const balAfterRefunds = (await admin.from("drape_credit_balances").select("balance").eq("user_id", userId).single()).data!.balance as number;

    expect(balAfterRefunds).toBe(balAfterReserve + 56); // only one refund applied
    const refunds = (await admin.from("drape_credit_transactions").select("id").eq("job_id", stale.id).eq("kind", "refund")).data!;
    expect(refunds.length).toBe(1);
  }, 60000);

  it("cleanup", async () => {
    // Remove generated model objects, then the user (cascades drape_models/jobs/ledger rows).
    const paths = (globalThis as Record<string, unknown>).__qaModelPaths as string[] | undefined;
    if (paths?.length) {
      await admin.storage.from("drape-outputs").remove(paths).catch(() => {});
    }
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
    expect(true).toBe(true);
  }, 60000);
});
