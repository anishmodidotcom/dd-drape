import { NextResponse } from "next/server";

// Liveness probe. No auth, no secrets. Whitelisted in middleware.
export function GET() {
  return NextResponse.json({ ok: true, service: "drape", version: "v1" });
}
