"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Last-resort boundary (root layout failed). Plain markup: our layout and CSS may be what broke. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0A0A0A", color: "#fff", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
        <div>
          <h1 style={{ fontSize: 32 }}>Lost the signal.</h1>
          <p style={{ color: "#A3A3A3" }}>Something broke on our side. Try again in a moment.</p>
          <button onClick={reset} style={{ marginTop: 16, background: "#FF5A1F", color: "#0A0A0A", border: 0, borderRadius: 999, padding: "12px 24px", fontWeight: 700, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
