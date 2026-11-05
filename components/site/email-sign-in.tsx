"use client";

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
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending…" : cta}
      </Button>
    </form>
  );
}
