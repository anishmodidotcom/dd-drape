import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { generateModel } from "@/lib/models/generate";
import type { ModelInputs } from "@/lib/models/schema";

// POST /api/models  { name, inputs }
// Creates a saved model: 4 consistent white-background reference angles. Costs credits.

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { name?: string; inputs?: ModelInputs };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const result = await generateModel(
    user.id,
    user.email ?? null,
    (body.name ?? "").trim() || "Untitled model",
    body.inputs ?? {}
  );

  if (result.status === "insufficient") {
    return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
  }
  if (result.status === "failed") {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }
  return NextResponse.json(result, { status: 201 });
}
