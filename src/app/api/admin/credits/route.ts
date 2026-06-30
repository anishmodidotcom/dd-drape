import { NextRequest, NextResponse } from "next/server";
import { getAdminForApi } from "@/lib/admin/auth";
import { validateAdjustInput } from "@/lib/admin/allowlist";
import { adminAdjustCredits } from "@/lib/admin/data";

// POST /api/admin/credits  { userId, amount (signed: >0 grant, <0 revoke), reason }
// Privileged: server-side admin gate, validated, atomic ledger write, audited. A non-admin (or
// anonymous) request gets 403 with no data.

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const admin = await getAdminForApi();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const v = validateAdjustInput(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  try {
    const balance = await adminAdjustCredits({
      adminId: admin.id,
      adminEmail: admin.email ?? null,
      userId: v.value.userId,
      amount: v.value.amount,
      reason: v.value.reason,
    });
    return NextResponse.json({ ok: true, balance });
  } catch (err) {
    console.error("admin credit adjust failed", err);
    return NextResponse.json({ error: "adjust_failed" }, { status: 500 });
  }
}
