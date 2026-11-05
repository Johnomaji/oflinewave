import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate only: bounce visitors with no session cookie away from staff
 * areas before rendering. Real authorization (role checks) happens in
 * requireAdmin()/requireScanner() on every page, action and API route.
 */
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSession) return NextResponse.next();

  const url = new URL("/login", request.url);
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/scan"],
};
