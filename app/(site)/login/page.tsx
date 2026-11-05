import type { Metadata } from "next";
import { Suspense } from "react";
import { signInWithGoogle } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { EmailSignIn } from "@/components/site/email-sign-in";
import { Glow } from "@/components/site/wave";
import { googleEnabled } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const ERRORS: Record<string, string> = {
  forbidden: "That account doesn't have access to that page.",
  Verification: "That link expired or was already used. Grab a new one.",
  default: "Something went wrong signing you in. Try again.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="relative mx-auto grid min-h-[70vh] max-w-md place-items-center px-5 py-16">
      <Glow className="left-1/2 top-10 size-80 -translate-x-1/2" />
      <div className="relative w-full rounded-card border border-line bg-surface p-6 md:p-8">
        <h1 className="text-4xl font-extrabold">Tap in.</h1>
        <p className="mt-2 text-muted">We&apos;ll email you a one-tap sign-in link. No passwords.</p>
        <Suspense>
          <LoginForms searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function LoginForms({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/tickets";
  const errorKey = typeof sp.error === "string" ? sp.error : null;
  return (
    <>
      {errorKey && (
        <p role="alert" className="mt-5 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {ERRORS[errorKey] ?? ERRORS.default}
        </p>
      )}
      <div className="mt-6">
        <EmailSignIn next={next} />
      </div>
      {googleEnabled && (
        <>
          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <Button type="submit" variant="secondary" size="lg" className="w-full">
              Continue with Google
            </Button>
          </form>
        </>
      )}
    </>
  );
}
