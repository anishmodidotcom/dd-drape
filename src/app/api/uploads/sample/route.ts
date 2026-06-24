import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { storeUpload, signedUrl } from "@/lib/engine/storage";
import { validateImageUpload } from "@/lib/engine/image-validate";

// POST /api/uploads/sample
// Onboarding (4C): copies the Phase 1 sample product into the user's own uploads namespace so a
// brand-new user can reach a real first result fast, without finding a photo. Returns the same shape
// as /api/uploads.

export const runtime = "nodejs";

const CONTENT_TYPE: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const origin = new URL(req.url).origin;
    const res = await fetch(`${origin}/v4/empty/sample-product.png`);
    if (!res.ok) throw new Error("sample asset unavailable");
    const raw = new Uint8Array(await res.arrayBuffer());
    const v = validateImageUpload(raw);
    if (!v.ok) return NextResponse.json({ error: "sample invalid" }, { status: 500 });
    const path = await storeUpload(user.id, v.cleaned!, CONTENT_TYPE[v.ext!], v.ext!);
    const url = await signedUrl(path, 3600);
    return NextResponse.json({ path, url, sample: true });
  } catch (err) {
    console.error("sample upload failed", err);
    return NextResponse.json({ error: "sample_failed" }, { status: 500 });
  }
}
