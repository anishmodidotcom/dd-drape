// Drape live exit-test harness (REST-based, runs over HTTPS which this environment allows).
// Run AFTER applying supabase/migrations/0001_drape_init.sql to the shared CGE project.
//
//   node scripts/exit-test.mjs
//
// It verifies, against the real project:
//   - drape_ tables exist
//   - signup grants 400 credits (drape_on_auth_user_created trigger)
//   - reserve -> settle -> refund ledger math and the insufficient-credits gate
//   - drape_jobs writes
//   - RLS: a user reads only their own rows; anon reads nothing
// Then it deletes the test users it created (cascades clean up drape_ rows).

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SRK = env.SUPABASE_SERVICE_ROLE_KEY;

let pass = 0,
  fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name} ${extra}`);
  }
};

const svc = (path, init = {}) =>
  fetch(`${URL_}${path}`, {
    ...init,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });

async function rpc(fn, args, key = SRK) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

async function adminCreateUser(email, password) {
  const r = await svc(`/auth/v1/admin/users`, {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}
async function adminDeleteUser(id) {
  return svc(`/auth/v1/admin/users/${id}`, { method: "DELETE" });
}
async function signIn(email, password) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return (await r.json().catch(() => null))?.access_token ?? null;
}
async function selectAs(table, key, query = "") {
  const r = await fetch(`${URL_}/rest/v1/${table}?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

async function main() {
  console.log("Drape live exit test\n====================");

  // 0. tables exist?
  const probe = await selectAs("drape_credit_balances", SRK, "limit=1");
  if (probe.status === 404 || (probe.body && probe.body.code === "42P01")) {
    console.log("\nSchema not applied yet: drape_ tables are missing.");
    console.log("Apply supabase/migrations/0001_drape_init.sql, then re-run this.");
    process.exit(3);
  }
  ok("drape_ tables exist", probe.status === 200);

  const rand = Math.random().toString(36).slice(2, 8);
  const userA = { email: `drape-exit+a-${rand}@example.com`, password: `Drape!${rand}A` };
  const userB = { email: `drape-exit+b-${rand}@example.com`, password: `Drape!${rand}B` };
  let idA, idB;

  try {
    // 1. signup grants 400 (trigger)
    const ca = await adminCreateUser(userA.email, userA.password);
    const cb = await adminCreateUser(userB.email, userB.password);
    idA = ca.body?.id;
    idB = cb.body?.id;
    ok("created two test users", !!idA && !!idB, `${ca.status}/${cb.status} ${JSON.stringify(ca.body)?.slice(0, 160)}`);

    // brief wait for trigger
    await new Promise((r) => setTimeout(r, 800));
    const balA = await selectAs("drape_credit_balances", SRK, `user_id=eq.${idA}&select=balance`);
    ok("signup granted 400 credits", balA.body?.[0]?.balance === 400, `got ${JSON.stringify(balA.body)}`);

    // 2. reserve -> settle (image $0.04)
    const r1 = await rpc("drape_debit_credits", { p_user_id: idA, p_amount: 4, p_job_id: null, p_kind: "reserve", p_gate: true, p_note: "exit reserve" });
    ok("reserve 4 -> balance 396", r1.body === 396, `got ${JSON.stringify(r1.body)} (${r1.status})`);
    const s1 = await rpc("drape_debit_credits", { p_user_id: idA, p_amount: 0, p_job_id: null, p_kind: "settle", p_gate: false, p_note: "exit settle" });
    ok("settle delta 0 -> balance 396", s1.body === 396, `got ${JSON.stringify(s1.body)}`);

    // 3. reserve -> refund (failure path)
    const r2 = await rpc("drape_debit_credits", { p_user_id: idA, p_amount: 15, p_job_id: null, p_kind: "reserve", p_gate: true });
    ok("reserve 15 -> balance 381", r2.body === 381, `got ${JSON.stringify(r2.body)}`);
    const ref = await rpc("drape_debit_credits", { p_user_id: idA, p_amount: -15, p_job_id: null, p_kind: "refund", p_gate: false });
    ok("refund -> balance 396 (no spend)", ref.body === 396, `got ${JSON.stringify(ref.body)}`);

    // 4. insufficient-credits gate (no free generations)
    const big = await rpc("drape_debit_credits", { p_user_id: idA, p_amount: 999999, p_job_id: null, p_kind: "reserve", p_gate: true });
    ok("insufficient reserve is rejected", big.status >= 400 && /insufficient_credits/.test(JSON.stringify(big.body)), `status ${big.status} ${JSON.stringify(big.body)?.slice(0, 120)}`);

    // 5. ledger transaction trail recorded
    const txns = await selectAs("drape_credit_transactions", SRK, `user_id=eq.${idA}&select=kind,amount&order=created_at.asc`);
    const kinds = (txns.body || []).map((t) => t.kind);
    ok("ledger recorded grant/reserve/settle/refund", kinds.includes("grant") && kinds.includes("reserve") && kinds.includes("settle") && kinds.includes("refund"), JSON.stringify(kinds));

    // 6. jobs table write
    const job = await svc(`/rest/v1/drape_jobs`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ tenant_id: idA, user_id: idA, type: "image/standard", estimated_credits: 4, tier: "green", status: "done" }),
    });
    const jobBody = await job.json().catch(() => null);
    const jobId = jobBody?.[0]?.id;
    ok("drape_jobs insert works", job.status === 201 && !!jobId, `status ${job.status}`);

    // 7. RLS: user B reads only own rows; cannot see A's.
    const tokenB = await signIn(userB.email, userB.password);
    ok("user B signed in", !!tokenB);
    if (tokenB) {
      const bSeesOwn = await selectAs("drape_credit_balances", tokenB, "select=user_id,balance");
      const rows = bSeesOwn.body || [];
      ok("RLS: B sees only own balance row", rows.length === 1 && rows[0].user_id === idB, `saw ${rows.length} rows`);
      const bSeesAJobs = await selectAs("drape_jobs", tokenB, `user_id=eq.${idA}`);
      ok("RLS: B cannot read A's jobs", Array.isArray(bSeesAJobs.body) && bSeesAJobs.body.length === 0, `saw ${JSON.stringify(bSeesAJobs.body)?.slice(0, 80)}`);
    }

    // 8. RLS: anon reads nothing
    const anonTxns = await selectAs("drape_credit_transactions", ANON, "select=id");
    ok("RLS: anon reads no transactions", Array.isArray(anonTxns.body) && anonTxns.body.length === 0, `saw ${JSON.stringify(anonTxns.body)?.slice(0, 80)}`);
  } finally {
    // cleanup
    if (idA) await adminDeleteUser(idA).catch(() => {});
    if (idB) await adminDeleteUser(idB).catch(() => {});
    console.log("\n(cleaned up test users)");
  }

  console.log(`\n==================== ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("harness error:", e);
  process.exit(2);
});
