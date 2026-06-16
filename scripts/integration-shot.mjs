// Integrated end-to-end: exercises the exact runShot/runJob lifecycle against the REAL project
// (reserve -> fal generate -> store -> settle -> job done) over REST + fal, then verifies the
// ledger, the job row, and the signed output. Cleans up the test user.

import { readFileSync } from "node:fs";
import { fal } from "@fal-ai/client";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SRK = env.SUPABASE_SERVICE_ROLE_KEY;
fal.config({ credentials: env.FAL_KEY });

let pass = 0, fail = 0;
const ok = (n, c, x = "") => { c ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n} ${x}`)); };
const svc = (p, init = {}) => fetch(`${URL_}${p}`, { ...init, headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", ...(init.headers || {}) } });
const rpc = (fn, args) => svc(`/rest/v1/rpc/${fn}`, { method: "POST", body: JSON.stringify(args) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

async function main() {
  console.log("Drape integrated lifecycle test\n===============================");
  const rand = Math.random().toString(36).slice(2, 8);
  const email = `drape-int-${rand}@example.com`;
  const cu = await svc(`/auth/v1/admin/users`, { method: "POST", body: JSON.stringify({ email, password: `Drape!${rand}`, email_confirm: true }) });
  const uid = (await cu.json().catch(() => null))?.id;
  ok("test user created + granted", !!uid);
  if (!uid) return finish();
  await new Promise((r) => setTimeout(r, 800));

  try {
    const EST = 4; // image/standard Seedream = 4 credits

    // 1. create job (queued)
    const jr = await svc(`/rest/v1/drape_jobs`, { method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ tenant_id: uid, user_id: uid, type: "image/standard", estimated_credits: EST, tier: "green", status: "queued", payload: { meta: { category: "apparel", subType: "kurta" } } }) });
    const jobId = (await jr.json().catch(() => null))?.[0]?.id;
    ok("job created (queued)", !!jobId);

    // 2. RESERVE (gate on balance)
    const res = await rpc("drape_debit_credits", { p_user_id: uid, p_amount: EST, p_job_id: jobId, p_kind: "reserve", p_gate: true, p_note: "reserve image/standard" });
    ok("reserve -> 396", res.body === 396, JSON.stringify(res.body));

    // 3. real fal generation (cheapest model first)
    const t0 = Date.now();
    const gen = await fal.subscribe("fal-ai/bytedance/seedream/v4.5/text-to-image", { input: { prompt: "Premium ecommerce photo of a folded sage-green cotton kurta on pure white, soft studio light, photoreal, preserve exact fabric texture and stitching" }, logs: false });
    const outUrl = gen.data?.images?.[0]?.url || gen.data?.image?.url || gen.data?.url;
    ok("fal generated an output", !!outUrl, `${((Date.now() - t0) / 1000).toFixed(1)}s`);

    // 4. store output
    const img = await fetch(outUrl); const bytes = new Uint8Array(await img.arrayBuffer());
    const path = `results/${uid}/${jobId}.png`;
    const up = await svc(`/storage/v1/object/drape-outputs/${path}`, { method: "POST", headers: { "Content-Type": img.headers.get("content-type") || "image/png" }, body: bytes });
    ok("output stored in drape-outputs", up.status === 200, `status ${up.status}`);

    // 5. SETTLE (delta 0 for fixed-cost image)
    const settle = await rpc("drape_debit_credits", { p_user_id: uid, p_amount: 0, p_job_id: jobId, p_kind: "settle", p_gate: false, p_note: "settle" });
    ok("settle -> 396 (net spend = 4)", settle.body === 396, JSON.stringify(settle.body));

    // 6. mark job done
    const done = await svc(`/rest/v1/drape_jobs?id=eq.${jobId}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "done", result_ref: path, actual_credits: EST }) });
    const doneRow = (await done.json().catch(() => null))?.[0];
    ok("job marked done with result_ref", doneRow?.status === "done" && doneRow?.result_ref === path);

    // 7. signed URL serves the output
    const signed = await svc(`/storage/v1/object/sign/drape-outputs/${path}`, { method: "POST", body: JSON.stringify({ expiresIn: 600 }) });
    const signedBody = await signed.json().catch(() => null);
    ok("signed URL issued for output", !!signedBody?.signedURL);

    // 8. final balance + ledger trail
    const bal = await svc(`/rest/v1/drape_credit_balances?user_id=eq.${uid}&select=balance`).then((r) => r.json());
    ok("final balance is 396 (one $0.04 image)", bal?.[0]?.balance === 396, JSON.stringify(bal));
    const txns = await svc(`/rest/v1/drape_credit_transactions?user_id=eq.${uid}&select=kind&order=created_at.asc`).then((r) => r.json());
    const kinds = (txns || []).map((t) => t.kind);
    ok("ledger: grant -> reserve -> settle", kinds.join(",") === "grant,reserve,settle", kinds.join(","));
  } finally {
    // delete the stored output (storage is not FK-tied to the auth user), then the user (cascade
    // removes the drape_ rows).
    await svc(`/storage/v1/object/drape-outputs/results/${uid}`, { method: "DELETE" }).catch(() => {});
    await svc(`/auth/v1/admin/users/${uid}`, { method: "DELETE" }).catch(() => {});
    console.log("\n(cleaned up test user, its rows, and stored output)");
  }
  finish();
}
function finish() { console.log(`\n=============================== ${pass} passed, ${fail} failed`); process.exit(fail === 0 ? 0 : 1); }
main().catch((e) => { console.error("error:", e); process.exit(2); });
