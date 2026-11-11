"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInWithEmail, type SignInState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";

export function EmailSignIn({ next, cta = "Send my link" }: { next: string; cta?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInWithEmail, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <div>
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@email.com"
          aria-invalid={!!state.error}
        />
        <FieldError>{state.error}</FieldError>
        {state.staff && (
          <Link href={`/login?staff=1&next=${encodeURIComponent(next)}`} className="mt-1.5 inline-block text-sm font-semibold text-brand hover:underline">
            Sign in with your password
          </Link>
        )}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending…" : cta}
      </Button>
    </form>
  );
}
