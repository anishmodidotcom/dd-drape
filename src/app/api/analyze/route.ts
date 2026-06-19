import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { signedUrl, pathBelongsToUser } from "@/lib/engine/storage";
import { getOrAnalyzeProduct } from "@/lib/director/products";
import { directorEnabled } from "@/lib/director/client";

// POST /api/analyze { path }
// The Studio calls this right after a product upload so the casting director's read of the piece is
// VISIBLE and confirmable before any shoot. Reuses the same cached analysis the engine uses
// (drape_products), so this never double-charges or diverges from generation. No spend.
// Gemini is brand/preset imagery only; product analysis is Claude vision on the real upload.

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { path?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const path = body.path;
  if (!path) return NextResponse.json({ error: "path required" }, { status: 400 });
  if (!pathBelongsToUser(path, user.id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // When the director is not configured we cannot read the piece. Tell the client honestly so it
  // falls back to manual category selection (no fabricated read).
  if (!directorEnabled()) {
    return NextResponse.json({ analysis: null, available: false });
  }

  try {
    const url = await signedUrl(path, 3600);
    const analysis = await getOrAnalyzeProduct(user.id, path, url);
    return NextResponse.json({ analysis, available: true });
  } catch (err) {
    console.error("analyze failed", err);
    return NextResponse.json({ analysis: null, available: false });
  }
}
