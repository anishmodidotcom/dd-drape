import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { generateModel, createUploadedModel } from "@/lib/models/generate";
import type { ModelInputs } from "@/lib/models/schema";

// POST /api/models
//   { name, inputs }                    -> generate a saved model (4 reference angles, costs credits)
//   { name, uploadedPaths: string[] }   -> save the user's OWN uploaded model (item 7, no credits)

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { name?: string; inputs?: ModelInputs; uploadedPaths?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const name = (body.name ?? "").trim() || "Untitled model";

  // Upload-your-own-model path (item 7).
  if (Array.isArray(body.uploadedPaths) && body.uploadedPaths.length > 0) {
    try {
      const result = await createUploadedModel(user.id, name, body.uploadedPaths, body.inputs ?? {});
      return NextResponse.json(result, { status: 201 });
    } catch (err) {
      return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 400 });
    }
  }

  const result = await generateModel(user.id, user.email ?? null, name, body.inputs ?? {});

  if (result.status === "insufficient") {
    return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
  }
  if (result.status === "failed") {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }
  return NextResponse.json(result, { status: 201 });
}
