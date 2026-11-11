import type { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";

export const { GET } = handlers;

/**
 * Signing in only happens through the server actions in app/actions/auth.ts. They run Auth.js
 * in-process, behind our rate limits and checks. Auth.js's own POST sign-in endpoints would skip
 * all of that, so they're closed. Email links and Google come back by GET, which stays open.
 */
export function POST(request: NextRequest) {
  if (/^\/api\/auth\/(signin|callback)(\/|$)/.test(request.nextUrl.pathname)) {
    return new Response("Not found", { status: 404 });
  }
  return handlers.POST(request);
}
