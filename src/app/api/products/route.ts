import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { pathBelongsToUser } from "@/lib/engine/storage";
import { saveProductToCollection, listSavedProducts } from "@/lib/director/products";

// Saved products collection (item 8). GET lists the user's saved products; POST marks an uploaded
// product path saved (with an optional name) for reuse as a future input.
// Requires migration 0005_drape_saved_products.sql.

export const runtime = "nodejs";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const products = await listSavedProducts(user.id);
    return NextResponse.json({ products });
  } catch (err) {
    console.error("list saved products failed", err);
    return NextResponse.json({ products: [] });
  }
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { path?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.path) return NextResponse.json({ error: "path required" }, { status: 400 });
  if (!pathBelongsToUser(body.path, user.id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    await saveProductToCollection(user.id, body.path, body.name);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("save product failed", err);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
