"use client";

import { useActionState } from "react";
import { signInWithPassword, type SignInState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";

export function PasswordSignIn({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInWithPassword, {});
  return (
    <form action={action} className="space-y-3">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <Label htmlFor="staff-email">Email</Label>
        <Input id="staff-email" name="email" type="email" required autoComplete="username" inputMode="email" placeholder="you@email.com" />
      </div>
      <div>
        <Label htmlFor="staff-password">Password</Label>
        <Input id="staff-password" name="password" type="password" required autoComplete="current-password" aria-invalid={!!state.error} />
        <FieldError>{state.error}</FieldError>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export function ChangePasswordForm({ action, next }: { action: (prev: SignInState, formData: FormData) => Promise<SignInState>; next?: string }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-3">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <Label htmlFor="pw-current">Current password</Label>
        <Input id="pw-current" name="current" type="password" required autoComplete="current-password" />
      </div>
      <div>
        <Label htmlFor="pw-new">New password</Label>
        <Input id="pw-new" name="password" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <div>
        <Label htmlFor="pw-confirm">New password again</Label>
        <Input id="pw-confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" aria-invalid={!!state.error} />
        <FieldError>{state.error}</FieldError>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
