import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { signedUrl, pathBelongsToUser } from "@/lib/engine/storage";

// GET /api/media?path=<storage path>
// Returns a short-lived signed URL for an object the caller owns. Ownership is enforced by the
// path namespace; private bucket means no one can read another user's object.

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const path = req.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "path required" }, { status: 400 });

  if (!pathBelongsToUser(path, user.id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const url = await signedUrl(path, 3600);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
