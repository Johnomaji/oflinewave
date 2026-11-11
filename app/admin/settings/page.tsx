import { Suspense } from "react";
import { saveEmailTemplates, saveSettings, sendTestEmail, setStaffRole } from "./actions";
import { EmailTemplatesForm } from "@/components/admin/email-templates-form";
import { DEFAULT_TEMPLATES, TEMPLATE_META, type EmailTemplate, type TemplateKey } from "@/lib/email/templates";
import { SettingsForm, TeamForm } from "@/components/admin/settings-forms";
import { AdminSkeleton, PageHeader, TableWrap, td, th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { isMockPaymentsEnabled } from "@/lib/payments";
import { readSettings } from "@/lib/settings";
import { walletConfig } from "@/lib/tickets/wallet";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  await requireRole(["SUPER_ADMIN"], "/admin/settings");
  const [settings, staff] = await Promise.all([readSettings(), db.staffMember.findMany({ orderBy: { createdAt: "asc" } })]);

  // Show only what admins customised; blanks display the default as a placeholder.
  const stored = (settings.emailTemplates ?? {}) as Partial<Record<TemplateKey, Partial<EmailTemplate>>>;
  const savedTemplates = Object.fromEntries(
    (Object.keys(DEFAULT_TEMPLATES) as TemplateKey[]).map((k) => [k, { subject: stored[k]?.subject ?? "", heading: stored[k]?.heading ?? "", body: stored[k]?.body ?? "" }]),
  );

  const integrations = [
    { name: "Paystack", ok: Boolean(process.env.PAYSTACK_SECRET_KEY), note: isMockPaymentsEnabled() ? "Test simulator active" : "PAYSTACK_SECRET_KEY" },
    { name: "Resend (email)", ok: Boolean(process.env.RESEND_API_KEY), note: "RESEND_API_KEY" },
    { name: "Google sign-in", ok: Boolean(process.env.AUTH_GOOGLE_ID), note: "AUTH_GOOGLE_ID / SECRET" },
    { name: "Image uploads", ok: Boolean(process.env.BLOB_READ_WRITE_TOKEN), note: "BLOB_READ_WRITE_TOKEN" },
    { name: "Error monitoring (Sentry)", ok: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN), note: "NEXT_PUBLIC_SENTRY_DSN" },
    { name: "Plausible analytics", ok: Boolean(process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN), note: "NEXT_PUBLIC_PLAUSIBLE_DOMAIN (optional)" },
    { name: "Apple Wallet", ok: walletConfig.apple(), note: "APPLE_PASS_*" },
    { name: "Google Wallet", ok: walletConfig.google(), note: "GOOGLE_WALLET_*" },
  ];

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader title="Settings" description="Brand, fees, team and integrations." />

      <SettingsForm
        action={saveSettings}
        values={{
          brandName: settings.brandName,
          contactEmail: settings.contactEmail,
          feePercent: settings.feePercentBps / 100,
          feeFlatNaira: settings.feeFlat / 100,
          defaultFeeMode: settings.defaultFeeMode,
          instagramUrl: settings.instagramUrl ?? "",
          twitterUrl: settings.twitterUrl ?? "",
          tiktokUrl: settings.tiktokUrl ?? "",
        }}
      />

      <EmailTemplatesForm
        templates={savedTemplates}
        defaults={DEFAULT_TEMPLATES}
        meta={TEMPLATE_META}
        saveAction={saveEmailTemplates}
        testAction={sendTestEmail}
      />

      <Card className="p-6">
        <h2 className="mb-1 text-xl font-bold">Team</h2>
        <p className="mb-5 text-sm text-muted">Door staff can only scan. Organizers run events and orders. Super admins manage settings and the team. New people need a temporary password; they choose their own on first sign-in. To reset someone&apos;s password, save them again with a new temporary one.</p>
        <TableWrap>
          <table className="w-full text-sm">
            <thead className="border-b border-line">
              <tr>
                <th className={th}>Email</th>
                <th className={th}>Role</th>
                <th className={th}>Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {staff.map((s) => (
                <tr key={s.id}>
                  <td className={td}>{s.email}</td>
                  <td className={td}>{s.role.replace("_", " ").toLowerCase()}</td>
                  <td className={td}>{s.acceptedAt ? <Badge variant="success">active</Badge> : <Badge variant="outline">invited</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <div className="mt-5">
          <TeamForm action={setStaffRole} />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 text-xl font-bold">Integrations</h2>
        <p className="mb-5 text-sm text-muted">Keys live in environment variables, never in the database. Set them in Vercel → Settings → Environment Variables.</p>
        <ul className="divide-y divide-line">
          {integrations.map((i) => (
            <li key={i.name} className="flex items-center justify-between py-3 text-sm">
              <span>
                {i.name} <span className="ml-2 font-mono text-xs text-muted">{i.note}</span>
              </span>
              <Badge variant={i.ok ? "success" : "warning"}>{i.ok ? "connected" : "not set"}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
