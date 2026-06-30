import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import { grantCredits } from "@/lib/engine/credits";
import type { JobRow } from "@/lib/engine/jobs";

// Admin reads via the service-role client. Every caller is gated by requireAdminPage / getAdminForApi
// first, so RLS is intentionally bypassed here without weakening it for normal users.

export interface AdminUserRow {
  id: string;
  email: string | null;
  created_at: string;
  confirmed: boolean;
  last_sign_in_at: string | null;
  balance: number;
}

export async function listUsers(query?: string, limit = 200): Promise<AdminUserRow[]> {
  const admin = getAdminClient();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: Math.min(1000, limit) });
  let users = data?.users ?? [];
  if (query) {
    const q = query.toLowerCase();
    users = users.filter((u) => (u.email ?? "").toLowerCase().includes(q) || u.id.includes(q));
  }
  const ids = users.map((u) => u.id);
  const balById = new Map<string, number>();
  if (ids.length) {
    const { data: bals } = await admin.from("drape_credit_balances").select("user_id, balance").in("user_id", ids);
    for (const b of bals ?? []) balById.set(b.user_id as string, (b.balance as number) ?? 0);
  }
  return users.map((u) => ({
    id: u.id,
    email: u.email ?? null,
    created_at: u.created_at,
    confirmed: !!(u.email_confirmed_at || (u as { confirmed_at?: string }).confirmed_at),
    last_sign_in_at: u.last_sign_in_at ?? null,
    balance: balById.get(u.id) ?? 0,
  }));
}

export interface AdminUserDetail {
  user: AdminUserRow;
  transactions: { id: string; kind: string; amount: number; balance_after: number; note: string | null; created_at: string }[];
  jobs: JobRow[];
  models: { id: string; name: string; image_paths: string[]; status: string; created_at: string }[];
  products: { image_path: string; name: string | null; created_at: string }[];
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const admin = getAdminClient();
  const { data: ures } = await admin.auth.admin.getUserById(userId);
  const u = ures?.user;
  if (!u) return null;
  const [bal, txns, jobs, models, products] = await Promise.all([
    admin.from("drape_credit_balances").select("balance").eq("user_id", userId).maybeSingle(),
    admin.from("drape_credit_transactions").select("id, kind, amount, balance_after, note, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    admin.from("drape_jobs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
    admin.from("drape_models").select("id, name, image_paths, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    admin.from("drape_products").select("image_path, name, created_at").eq("user_id", userId).eq("saved", true).order("created_at", { ascending: false }),
  ]);
  return {
    user: {
      id: u.id, email: u.email ?? null, created_at: u.created_at,
      confirmed: !!(u.email_confirmed_at || (u as { confirmed_at?: string }).confirmed_at),
      last_sign_in_at: u.last_sign_in_at ?? null, balance: (bal.data?.balance as number) ?? 0,
    },
    transactions: (txns.data as AdminUserDetail["transactions"]) ?? [],
    jobs: (jobs.data as unknown as JobRow[]) ?? [],
    models: (models.data as AdminUserDetail["models"]) ?? [],
    products: (products.data as AdminUserDetail["products"]) ?? [],
  };
}

export async function listAllJobs(opts: { status?: string; type?: string; limit?: number } = {}): Promise<JobRow[]> {
  const admin = getAdminClient();
  let q = admin.from("drape_jobs").select("*").order("created_at", { ascending: false }).limit(opts.limit ?? 150);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.type === "video") q = q.like("type", "video/%");
  else if (opts.type === "image") q = q.like("type", "image/%");
  else if (opts.type === "model") q = q.like("type", "model/%");
  const { data } = await q;
  return (data as unknown as JobRow[]) ?? [];
}

export interface AdminOverview {
  totalUsers: number;
  signups7d: number;
  activeUsers7d: number;
  totalGenerations: number;
  stills: number;
  videos: number;
  failed: number;
  failureRate: number;
  creditsGranted: number;
  creditsSpent: number;
  creditsRefunded: number;
  signupSeries: { day: string; count: number }[];
}

export async function getOverview(): Promise<AdminOverview> {
  const admin = getAdminClient();
  const since7 = new Date(Date.now() - 7 * 864e5).toISOString();

  const [uc, gc, vc, fc] = await Promise.all([
    admin.from("drape_credit_balances").select("*", { count: "exact", head: true }),
    admin.from("drape_jobs").select("*", { count: "exact", head: true }).not("type", "like", "model/%"),
    admin.from("drape_jobs").select("*", { count: "exact", head: true }).like("type", "video/%"),
    admin.from("drape_jobs").select("*", { count: "exact", head: true }).eq("status", "failed"),
  ]);
  const totalUsers = uc.count ?? 0;
  const totalGenerations = gc.count ?? 0;
  const videos = vc.count ?? 0;
  const failed = fc.count ?? 0;
  const stills = Math.max(0, totalGenerations - videos);

  // Signups (signup_grant transactions) + ledger sums + active users, fetched and reduced.
  const [signupRows, grantRows, activeRows] = await Promise.all([
    admin.from("drape_credit_transactions").select("created_at").eq("note", "signup_grant").order("created_at", { ascending: false }).limit(2000),
    admin.from("drape_credit_transactions").select("kind, amount").limit(20000),
    admin.from("drape_jobs").select("user_id").gte("created_at", since7).limit(20000),
  ]);

  const signups = signupRows.data ?? [];
  const signups7d = signups.filter((s) => (s.created_at as string) >= since7).length;
  const activeUsers7d = new Set((activeRows.data ?? []).map((r) => r.user_id as string)).size;

  let creditsGranted = 0, creditsSpent = 0, creditsRefunded = 0;
  for (const t of grantRows.data ?? []) {
    const amt = (t.amount as number) ?? 0;
    const kind = t.kind as string;
    if (kind === "grant" || (kind === "adjust" && amt > 0)) creditsGranted += amt;
    else if ((kind === "reserve" || kind === "settle") && amt < 0) creditsSpent += -amt;
    else if (kind === "refund" && amt > 0) creditsRefunded += amt;
  }

  // 14-day signup series.
  const buckets = new Map<string, number>();
  for (let i = 13; i >= 0; i--) buckets.set(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), 0);
  for (const s of signups) {
    const d = (s.created_at as string).slice(0, 10);
    if (buckets.has(d)) buckets.set(d, (buckets.get(d) ?? 0) + 1);
  }
  const signupSeries = [...buckets.entries()].map(([day, c]) => ({ day, count: c }));

  return {
    totalUsers, signups7d, activeUsers7d, totalGenerations, stills, videos, failed,
    failureRate: totalGenerations ? failed / totalGenerations : 0,
    creditsGranted, creditsSpent, creditsRefunded, signupSeries,
  };
}

export async function getHealth(): Promise<{ stuck: JobRow[]; recentFailures: JobRow[]; qc: Record<string, number> }> {
  const admin = getAdminClient();
  const stale = new Date(Date.now() - 20 * 60_000).toISOString();
  const [stuck, fails, qcRows] = await Promise.all([
    admin.from("drape_jobs").select("*").in("status", ["queued", "running"]).lt("created_at", stale).order("created_at", { ascending: false }).limit(50),
    admin.from("drape_jobs").select("*").eq("status", "failed").order("created_at", { ascending: false }).limit(30),
    admin.from("drape_jobs").select("qc_status").limit(20000),
  ]);
  const qc: Record<string, number> = {};
  for (const r of qcRows.data ?? []) qc[(r.qc_status as string) ?? "none"] = (qc[(r.qc_status as string) ?? "none"] ?? 0) + 1;
  return { stuck: (stuck.data as unknown as JobRow[]) ?? [], recentFailures: (fails.data as unknown as JobRow[]) ?? [], qc };
}

export interface AuditRow { id: string; admin_email: string | null; action: string; target_user_id: string | null; amount: number | null; reason: string | null; created_at: string }

export async function listAudit(limit = 100): Promise<AuditRow[]> {
  try {
    const admin = getAdminClient();
    const { data } = await admin.from("drape_admin_actions").select("id, admin_email, action, target_user_id, amount, reason, created_at").order("created_at", { ascending: false }).limit(limit);
    return (data as AuditRow[]) ?? [];
  } catch {
    return []; // table not migrated yet
  }
}

// The privileged write: adjust a user's credits (signed) and audit it. Returns the new balance.
export async function adminAdjustCredits(args: { adminId: string; adminEmail: string | null; userId: string; amount: number; reason: string }): Promise<number> {
  const admin = getAdminClient();
  let balance: number;
  if (args.amount > 0) {
    // positive: reuse the grant function (logs a 'grant' txn) for a clean ledger story
    balance = await grantCredits(args.userId, args.amount, `admin grant: ${args.reason}`);
  } else {
    const { data, error } = await admin.rpc("drape_admin_adjust", { p_user_id: args.userId, p_amount: args.amount, p_note: `admin revoke: ${args.reason}` });
    if (error) throw new Error(error.message);
    balance = data as number;
  }
  // Audit (best-effort; never block the adjust if the audit table is not migrated yet).
  try {
    await admin.from("drape_admin_actions").insert({
      admin_id: args.adminId, admin_email: args.adminEmail, action: "credit_adjust",
      target_user_id: args.userId, amount: args.amount, reason: args.reason,
    });
  } catch { /* table not migrated */ }
  return balance;
}
