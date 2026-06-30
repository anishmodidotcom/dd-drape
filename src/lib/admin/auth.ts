import "server-only";
import { notFound } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getUser } from "@/lib/supabase/server";
import { isAdminEmail } from "./allowlist";

// Server-side admin gate. Every /admin page and /api/admin route MUST go through one of these.
// The check is always against the live session user's email vs the server allowlist; the client is
// never trusted.

/** Returns the user iff they are an admin, else null. */
export async function getAdminUser(): Promise<User | null> {
  const user = await getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

/** For server components / pages: 404 (not 403) for non-admins, so the route's existence never leaks. */
export async function requireAdminPage(): Promise<User> {
  const user = await getAdminUser();
  if (!user) notFound();
  return user;
}

/** For route handlers: returns the admin user or null; the caller returns 403 on null. */
export async function getAdminForApi(): Promise<User | null> {
  return getAdminUser();
}
