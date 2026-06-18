import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";

// FULL scripted QA audit (signup -> generation), live against the real stack. RUN_LIVE=1.
//   RUN_LIVE=1 npx vitest run __tests__/live-qa-audit.test.ts
// Spends real credits/fal (~$1.5). Logs observations per check for the findings report.

const RUN = process.env.RUN_LIVE === "1";
type SB = import("@supabase/supabase-js").SupabaseClient;

function loadEnv() {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    if (!line.includes("=") || line.trimStart().startsWith("#")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
  }
}

describe.runIf(RUN)("QA AUDIT: signup -> generation", () => {
  let admin: SB;
  let uid: string;
  let email: string;
  let productPath: string;
  let productUrl: string;
  let resultPath: string | undefined;

  const bal = async (u = uid) =>
    (await admin.from("drape_credit_balances").select("balance").eq("user_id", u).single()).data!.balance as number;

  beforeAll(async () => {
    loadEnv();
    const { createClient } = await import("@supabase/supabase-js");
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    email = `drape-audit-${Math.random().toString(36).slice(2, 8)}@example.com`;
    uid = (await admin.auth.admin.createUser({ email, password: `Drape!${Date.now()}`, email_confirm: true })).data.user!.id;
    await new Promise((r) => setTimeout(r, 900));
  });

  it("A. signup grants 400 credits", async () => {
    const b = await bal();
    console.log("[A] balance after signup:", b);
    expect(b).toBe(400);
  });

  it("B. upload validation rejects bad files and accepts a good one", async () => {
    const { validateImageUpload } = await import("@/lib/engine/image-validate");
    const { storeUpload } = await import("@/lib/engine/storage");
    const { runSync } = await import("@/lib/engine/fal");
    const { firstOutputUrl } = await import("@/lib/engine/run");

    const nonImage = validateImageUpload(new TextEncoder().encode("#!/bin/sh\nrm -rf /"));
    console.log("[B] non-image rejected:", !nonImage.ok, "-", nonImage.reason);
    expect(nonImage.ok).toBe(false);

    const tinyPng = (() => {
      const b = new Uint8Array(24);
      b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
      b.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
      b[18] = 0x03; b[19] = 0x20; b[22] = 0x03; b[23] = 0x20; // 800x800
      return b;
    })();
    const tiny = validateImageUpload(tinyPng);
    console.log("[B] tiny 800x800 rejected:", !tiny.ok, "-", tiny.reason);
    expect(tiny.ok).toBe(false);

    // Good upload: a real generated product image.
    const prod = await runSync("fal-ai/bytedance/seedream/v4.5/text-to-image", {
      prompt: "Flat-lay product photo of a royal blue cotton kurta with white block print on white background, no model, ecommerce",
      image_size: { width: 1365, height: 1024 },
    });
    const url = firstOutputUrl(prod.data)!;
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    const good = validateImageUpload(bytes);
    console.log("[B] good image accepted:", good.ok, good.mime, good.width + "x" + good.height);
    expect(good.ok).toBe(true);
    productPath = await storeUpload(uid, good.cleaned!, "image/png", "png");
    const { signedUrl } = await import("@/lib/engine/storage");
    productUrl = await signedUrl(productPath, 3600);
    expect(productPath.startsWith(`uploads/${uid}/`)).toBe(true);
  }, 120000);

  it("C. analysis caches on drape_products", async () => {
    const { getOrAnalyzeProduct } = await import("@/lib/director/products");
    const t0 = Date.now();
    const a1 = await getOrAnalyzeProduct(uid, productPath, productUrl);
    const t1 = Date.now() - t0;
    const row = (await admin.from("drape_products").select("analysis").eq("user_id", uid).eq("image_path", productPath).single()).data!;
    const t2start = Date.now();
    const a2 = await getOrAnalyzeProduct(uid, productPath, productUrl);
    const t2 = Date.now() - t2start;
    console.log("[C] first analyze:", t1 + "ms, cached fetch:", t2 + "ms; category:", a1?.product_category, "color:", a1?.primary_color_name);
    expect(a1?.product_category).toBe("apparel");
    expect(row.analysis).toBeTruthy();
    expect(a2?.primary_color_name).toBe(a1?.primary_color_name);
    expect(t2).toBeLessThan(t1); // cache hit is much faster (no Claude call)
  }, 120000);

  it("D. generate with the fidelity gate (product preserved)", async () => {
    const { runShot } = await import("@/lib/engine/run-shot");
    const before = await bal();
    const res = await runShot(uid, email, {
      category: "apparel",
      subType: "kurta",
      shotType: "on-model-full",
      referenceImagePaths: [productPath],
      background: "white",
      framing: "full-length",
      quality: "standard", // cheap edit slug
    });
    const after = await bal();
    console.log("[D] status:", res.status, "tier:", res.tier, "spend:", before - after, "credits");
    expect(res.status).toBe("done");
    expect(before - after).toBe(4);
    resultPath = res.resultPath;
    expect(resultPath).toBeTruthy();
  }, 180000);

  it("E. insufficient-credits gate rejects an unaffordable reserve (no spend)", async () => {
    // Exercise the exact gate the product uses at submit (reserveCredits -> drape_debit_credits,
    // gated). A separate user, drained low, cannot reserve more than it holds.
    const { reserveCredits } = await import("@/lib/engine/credits");
    const { InsufficientCreditsError } = await import("@/lib/engine/ledger");
    const u2 = (await admin.auth.admin.createUser({ email: `drape-broke-${Date.now()}@example.com`, password: "Drape!xyz123", email_confirm: true })).data.user!.id;
    await new Promise((r) => setTimeout(r, 900));
    await admin.rpc("drape_debit_credits", { p_user_id: u2, p_amount: 398, p_job_id: null, p_kind: "reserve", p_gate: true, p_note: "drain" }); // -> 2
    const before = await bal(u2);
    let threw = false;
    try {
      await reserveCredits(u2, 15, crypto.randomUUID(), "audit reserve over balance");
    } catch (e) {
      threw = e instanceof InsufficientCreditsError;
    }
    const after = await bal(u2);
    console.log("[E] threw InsufficientCredits:", threw, "| balance unchanged:", before === after, `(${before} -> ${after})`);
    expect(threw).toBe(true);
    expect(after).toBe(before);
    await admin.auth.admin.deleteUser(u2).catch(() => {});
  }, 60000);

  it("F. generation failure auto-refunds", async () => {
    const { runJob } = await import("@/lib/engine/run");
    const before = await bal();
    const res = await runJob({
      userId: uid,
      userEmail: email,
      need: "image/standard",
      falInput: { prompt: "x", image_urls: ["https://invalid.example.test/nope.png"] },
    });
    const after = await bal();
    const failedJob = (await admin.from("drape_jobs").select("status,last_error").eq("id", res.jobId).single()).data!;
    console.log("[F] status:", res.status, "| balance restored:", before === after, "| job:", failedJob.status);
    expect(res.status).toBe("failed");
    expect(after).toBe(before);
    expect(failedJob.status).toBe("failed");
  }, 120000);

  it("G. create + reuse a model", async () => {
    const { generateModel } = await import("@/lib/models/generate");
    const { directShot } = await import("@/lib/director");
    const m = await generateModel(uid, email, "Audit Model", { gender: "women", ethnicity: "South Asian", ageRange: "20s", bodyType: "slim" });
    console.log("[G] model status:", m.status, "angles:", m.imagePaths?.length);
    expect(m.status).toBe("ready");
    expect(m.imagePaths).toHaveLength(4);

    const { signedUrl } = await import("@/lib/engine/storage");
    const modelUrl = await signedUrl(m.imagePaths![0], 3600);
    const directed = await directShot({
      spec: { category: "apparel", subType: "kurta", shotType: "on-model-full", referenceImagePaths: [productPath], modelImagePaths: m.imagePaths },
      productImageUrls: [productUrl],
      modelIdentityUrls: [modelUrl],
    });
    console.log("[G] reuse route:", directed.routed.need);
    expect(directed.routed.need).toBe("tryon");
    (globalThis as Record<string, unknown>).__auditModelPaths = m.imagePaths;
  }, 240000);

  it("H. previews resolve via signed URL + ownership is enforced", async () => {
    const { signedUrl, pathBelongsToUser } = await import("@/lib/engine/storage");
    const u = await signedUrl(resultPath!, 600);
    const code = (await fetch(u)).status;
    console.log("[H] result signed URL http:", code, "| ownership(other user):", pathBelongsToUser(resultPath!, "00000000-0000-0000-0000-000000000000"));
    expect(code).toBe(200);
    expect(pathBelongsToUser(resultPath!, uid)).toBe(true);
    expect(pathBelongsToUser(resultPath!, "00000000-0000-0000-0000-000000000000")).toBe(false);
  }, 60000);

  it("I. retry affordance recovers a stuck job (refund)", async () => {
    const { reconcileOneJob } = await import("@/lib/engine/reconcile");
    const stuck = (await admin.from("drape_jobs").insert({
      tenant_id: uid, user_id: uid, type: "video/standard", status: "queued",
      estimated_credits: 56, updated_at: new Date(Date.now() - 3600000).toISOString(),
    }).select("*").single()).data!;
    // reserve so there is something to refund
    await admin.rpc("drape_debit_credits", { p_user_id: uid, p_amount: 56, p_job_id: stuck.id, p_kind: "reserve", p_gate: true, p_note: "stuck reserve" });
    const before = await bal();
    const r = await reconcileOneJob(stuck as never);
    const after = await bal();
    console.log("[I] recover result:", r.status, "| refunded:", after - before, "credits |", r.message);
    expect(r.status).toBe("failed");
    expect(after - before).toBe(56);
  }, 60000);

  it("Z. cleanup", async () => {
    const paths = (globalThis as Record<string, unknown>).__auditModelPaths as string[] | undefined;
    const all = [productPath, resultPath, ...(paths ?? [])].filter(Boolean) as string[];
    await admin.storage.from("drape-outputs").remove(all).catch(() => {});
    await admin.auth.admin.deleteUser(uid).catch(() => {});
    expect(true).toBe(true);
  }, 60000);
});
