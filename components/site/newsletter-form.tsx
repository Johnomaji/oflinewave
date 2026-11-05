"use client";

import { useActionState } from "react";
import { subscribe, type NewsletterState } from "@/app/actions/newsletter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewsletterForm() {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribe, { status: "idle" });

  return (
    <form action={action} className="w-full max-w-md">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <Input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@email.com"
          aria-describedby="newsletter-status"
          className="rounded-full"
        />
        <Button type="submit" disabled={pending} size="lg" className="h-12">
          {pending ? "Joining…" : "Join the wave"}
        </Button>
      </div>
      <p
        id="newsletter-status"
        role="status"
        className={`mt-3 min-h-5 text-sm ${state.status === "error" ? "text-danger" : "text-muted"}`}
      >
        {state.message}
      </p>
    </form>
  );
}
