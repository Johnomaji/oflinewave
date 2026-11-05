import * as Sentry from "@sentry/nextjs";

/** Server-side error monitoring. Inert until NEXT_PUBLIC_SENTRY_DSN is set. */
export function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // No cookies, bodies, user info or query strings: order and ticket links carry access tokens.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { allow: ["user-agent", "referer"] }, response: false },
      httpBodies: [],
      urlQueryParams: false,
    },
  });
}

/** Reports errors thrown while rendering, in server actions and route handlers. */
export const onRequestError = Sentry.captureRequestError;
