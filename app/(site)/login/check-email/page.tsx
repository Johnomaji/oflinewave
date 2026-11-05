import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";

export const metadata: Metadata = { title: "Check your email", robots: { index: false } };

export default function CheckEmailPage() {
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-5 py-16 text-center">
      <div>
        <MailCheck className="mx-auto size-12 text-brand" />
        <h1 className="mt-6 text-4xl font-extrabold">Check your inbox.</h1>
        <p className="mt-3 text-muted">Your sign-in link is on its way. Tap it on this device and you&apos;re in.</p>
        <p className="mt-6 text-sm text-muted">
          Nothing after a minute? Check spam, or{" "}
          <Link href="/login" className="text-brand hover:underline">
            try again
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
