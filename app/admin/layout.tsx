import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/nav";
import { Logo } from "@/components/site/logo";
import { getCurrentUser } from "@/lib/dal";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · Oflinewave" }, robots: { index: false } };

async function UserBadge() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <p className="truncate text-xs text-muted">
      {user.email}
      <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase">{user.role.replace("_", " ").toLowerCase()}</span>
    </p>
  );
}

/**
 * Shell only. Every admin page and action calls requireAdmin() itself:
 * the layout is not an auth boundary.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-surface md:sticky md:top-0 md:h-dvh md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3 p-4 md:block md:p-6">
          <div>
            <Logo />
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-brand">Control room</p>
          </div>
          <div className="hidden md:mt-4 md:block">
            <Suspense>
              <UserBadge />
            </Suspense>
          </div>
        </div>
        <AdminNav />
      </aside>
      <main className="min-w-0 p-5 md:p-10">{children}</main>
    </div>
  );
}
