import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { storeUpload, signedUrl } from "@/lib/engine/storage";

// POST /api/uploads  (multipart/form-data, field "file")
// Stores a product photo or vibe reference under the user's uploads/ namespace.

export const runtime = "nodejs";
export const maxDuration = 60;

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

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
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return NextResponse.json({ error: `unsupported type ${file.type}` }, { status: 415 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = await storeUpload(user.id, bytes, file.type, ext);
    const url = await signedUrl(path, 3600);
    return NextResponse.json({ path, url });
  } catch (err) {
    console.error("upload failed", err);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}
