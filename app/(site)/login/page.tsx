import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signInWithGoogle } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { EmailSignIn } from "@/components/site/email-sign-in";
import { PasswordSignIn } from "@/components/site/password-sign-in";
import { Glow } from "@/components/site/wave";
import { googleEnabled } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const ERRORS: Record<string, string> = {
  forbidden: "That account doesn't have access to that page.",
  Verification: "That link expired or was already used. Grab a new one.",
  UsePassword: "Staff accounts sign in with a password here, not an email link.",
  default: "Something went wrong signing you in. Try again.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="relative mx-auto grid min-h-[70vh] max-w-md place-items-center px-5 py-16">
      <Glow className="left-1/2 top-10 size-80 -translate-x-1/2" />
      <div className="relative w-full rounded-card border border-line bg-surface p-6 md:p-8">
        <h1 className="text-4xl font-extrabold">Tap in.</h1>
        <Suspense>
          <LoginForms searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function LoginForms({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  const nextParam = typeof sp.next === "string" ? sp.next : undefined;
  const errorKey = typeof sp.error === "string" ? sp.error : null;
  // Staff areas send people here with ?staff=1 or a next of /admin or /scan.
  const staff = sp.staff === "1" || /^\/(admin|scan)(\/|$|\?)/.test(nextParam ?? "");
  const tabHref = (toStaff: boolean) => {
    const q = new URLSearchParams();
    if (toStaff) q.set("staff", "1");
    if (nextParam) q.set("next", nextParam);
    return `/login${q.size ? `?${q}` : ""}`;
  };

  return (
    <>
      <div role="tablist" aria-label="Sign-in type" className="mt-5 grid grid-cols-2 gap-1 rounded-full border border-line p-1 text-sm font-semibold">
        {[
          { label: "My tickets", active: !staff, href: tabHref(false) },
          { label: "Staff", active: staff, href: tabHref(true) },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            role="tab"
            aria-selected={tab.active}
            replace
            className={cn("rounded-full py-2 text-center transition", tab.active ? "bg-brand text-ink" : "text-muted hover:text-white")}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <p className="mt-5 text-muted">
        {staff ? "Door staff, organizers and admins: sign in with your password." : "We'll email you a one-tap sign-in link. No passwords."}
      </p>

      {errorKey && (
        <p role="alert" className="mt-5 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {ERRORS[errorKey] ?? ERRORS.default}
        </p>
      )}

      <div className="mt-6">{staff ? <PasswordSignIn next={nextParam} /> : <EmailSignIn next={nextParam ?? "/tickets"} />}</div>

      {!staff && googleEnabled && (
        <>
          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={nextParam ?? "/tickets"} />
            <Button type="submit" variant="secondary" size="lg" className="w-full">
              Continue with Google
            </Button>
          </form>
        </>
      )}
    </>
  );
}
