import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Webhook auth layer 1 (rule 8): machine-to-machine routes MUST be whitelisted so a POST with
// no login cookie is not bounced as 401. Everything under /app requires a session.

const PUBLIC_API_PREFIXES = [
  "/api/jobs/fal-webhook", // fal posts here; signature-verified inside the route
  "/api/health",
  "/api/worker", // worker callbacks, gated by WORKER_SHARED_SECRET inside the route
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Whitelist machine-to-machine API routes.
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Refresh the Supabase session cookie and read the user.
  let response = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured yet, do not block public pages.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        response = NextResponse.next({ request: req });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Gate the authenticated app.
  if (pathname.startsWith("/app") && !user) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Run on everything except static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
