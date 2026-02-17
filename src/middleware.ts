import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/verify", "/api/webhooks"];
const AUTH_PATHS = ["/login", "/signup"];
const COOKIE_NAME = "__session";

/**
 * Edge Middleware — runs on every request.
 *
 * 1. Resolves institution from Host header (or default env var)
 * 2. Sets x-institution-id header for downstream server components
 * 3. Redirects unauthenticated users away from protected routes
 * 4. Redirects authenticated users away from login/signup
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // ─── Institution Resolution ────────────────────────────
  // The __institution cookie is set by /api/auth/session based on user's institutionId.
  // If not set (e.g., unauthenticated user), fall back to default.
  const institutionId =
    request.cookies.get("__institution")?.value ||
    process.env.NEXT_PUBLIC_DEFAULT_INSTITUTION_ID ||
    "ifs";

  response.headers.set("x-institution-id", institutionId);

  // Set the cookie only if it doesn't exist (avoid overwriting user-specific institution)
  if (!request.cookies.has("__institution")) {
    response.cookies.set("__institution", institutionId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 1 day
    });
  }

  // ─── Auth Check ────────────────────────────────────────
  const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;
  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const isAuthPath = AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const isApiRoute = pathname.startsWith("/api/");

  // Don't redirect API routes — they handle their own auth
  if (isApiRoute) {
    return response;
  }

  // Redirect unauthenticated users to login (unless on public path)
  if (!sessionCookie && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login/signup to dashboard
  if (sessionCookie && isAuthPath) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
