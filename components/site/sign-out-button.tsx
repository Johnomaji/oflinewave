"use client";

import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

/** Signs out and wipes ticket pages the service worker saved on this device. */
export function SignOutButton({ email }: { email: string }) {
  return (
    <form
      action={signOutAction}
      onSubmit={() => navigator.serviceWorker?.controller?.postMessage("clear-pages")}
    >
      <Button variant="ghost" size="sm">
        Sign out {email}
      </Button>
    </form>
  );
}
