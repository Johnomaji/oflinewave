"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center px-5 text-center">
      <div>
        <h1 className="text-4xl font-extrabold">The DJ tripped over a cable.</h1>
        <p className="mt-3 text-muted">Something broke on our side. Give it another go.</p>
        {error.digest && <p className="mt-2 font-mono text-xs text-muted">Ref {error.digest}</p>}
        <Button onClick={reset} className="mt-8">
          Try again
        </Button>
      </div>
    </main>
  );
}
