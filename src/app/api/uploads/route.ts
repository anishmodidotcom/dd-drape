import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { storeUpload, signedUrl } from "@/lib/engine/storage";
import { validateImageUpload } from "@/lib/engine/image-validate";

// POST /api/uploads  (multipart/form-data, field "file")
// Stores a product photo or vibe reference under the user's uploads/ namespace. Validates the
// real MIME from magic bytes (not the client-declared type), enforces a minimum resolution, and
// strips EXIF before storage.

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

const CONTENT_TYPE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large (max 25MB)" }, { status: 413 });
  }

  const raw = new Uint8Array(await file.arrayBuffer());
  const v = validateImageUpload(raw);
  if (!v.ok) {
    return NextResponse.json({ error: v.reason }, { status: 415 });
  }

  try {
    const path = await storeUpload(user.id, v.cleaned!, CONTENT_TYPE[v.ext!], v.ext!);
    const url = await signedUrl(path, 3600);
    // Item 10: a small image is accepted; the advisory rides along, the client shows it dismissibly.
    return NextResponse.json({ path, url, width: v.width, height: v.height, warning: v.warning ?? null });
  } catch (err) {
    console.error("upload failed", err);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}
