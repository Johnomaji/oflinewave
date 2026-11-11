import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { changePassword } from "@/app/actions/auth";
import { ChangePasswordForm } from "@/components/site/password-sign-in";
import { Glow } from "@/components/site/wave";
import { SCAN_ROLES, getCurrentUser } from "@/lib/dal";

export const metadata: Metadata = { title: "Change password", robots: { index: false } };

export default function ChangePasswordPage({ searchParams }: PageProps<"/account/password">) {
  return (
    <div className="relative mx-auto grid min-h-[70vh] max-w-md place-items-center px-5 py-16">
      <Glow className="left-1/2 top-10 size-80 -translate-x-1/2" />
      <div className="relative w-full rounded-card border border-line bg-surface p-6 md:p-8">
        <h1 className="text-4xl font-extrabold">New password.</h1>
        <Suspense>
          <PasswordForm searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function PasswordForm({ searchParams }: { searchParams: PageProps<"/account/password">["searchParams"] }) {
  const user = await getCurrentUser();
  if (!user || !SCAN_ROLES.includes(user.role)) redirect("/login?staff=1&next=/account/password");
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <>
      <p className="mt-2 text-muted">
        {user.mustChangePassword
          ? "You signed in with a temporary password. Choose your own to continue."
          : `Signed in as ${user.email}.`}
      </p>
      <div className="mt-6">
        <ChangePasswordForm action={changePassword} next={next} />
      </div>
    </>
  );
}
