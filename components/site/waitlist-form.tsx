"use client";

import { useActionState } from "react";
import { joinWaitlist, type WaitlistState } from "@/app/actions/waitlist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WaitlistForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(joinWaitlist, { status: "idle" });

  if (state.status === "ok") {
    return (
      <p role="status" className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="eventId" value={eventId} />
      <label htmlFor="waitlist-email" className="sr-only">
        Email
      </label>
      <Input id="waitlist-email" name="email" type="email" required autoComplete="email" placeholder="you@email.com" />
      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {pending ? "Adding you…" : "Join the waitlist"}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}
