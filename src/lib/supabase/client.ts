"use client";
import { createBrowserClient } from "@supabase/ssr";

// Browser client. Uses the public anon key only. RLS restricts every read to the
// signed-in user's own rows. The service-role key is NEVER exposed here.

export function getBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing Supabase public env vars for browser client");
  }
  return createBrowserClient(url, anonKey);
}
