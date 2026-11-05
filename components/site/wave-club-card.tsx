import { Gift, Waves } from "lucide-react";
import { createReferralCode } from "@/app/actions/wave-club";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { REFERRAL_DISCOUNT_PERCENT, REFERRAL_POINTS, getAccount, tierFor } from "@/lib/services/loyalty";
import { appUrl } from "@/lib/utils";
import { CopyButton } from "./copy-button";

/** Wave Club status for the signed-in user: tier, points, perks, referral code. */
export async function WaveClubCard({ email }: { email: string }) {
  const account = await getAccount(email);
  const lifetime = account?.lifetimePoints ?? 0;
  const { current, next, toNext } = tierFor(lifetime);
  const member = lifetime > 0;

  return (
    <section className="mt-8 overflow-hidden rounded-card border border-brand/40 bg-gradient-to-br from-brand/15 via-surface to-surface p-6" aria-labelledby="wave-club-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            <Waves className="size-4" aria-hidden /> Wave Club
          </p>
          <h2 id="wave-club-heading" className="mt-2 text-3xl font-extrabold">
            {member ? `${current.name} tier` : "Join by going out"}
          </h2>
          <p className="mt-1 text-sm text-muted">{member ? current.perk : "Your first ticket makes you a member. Points on every order."}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-4xl font-extrabold">{(account?.points ?? 0).toLocaleString("en-NG")}</p>
          <p className="text-xs text-muted">points</p>
        </div>
      </div>

      {next && (
        <div className="mt-5">
          <ProgressBar value={lifetime - current.min} max={next.min - current.min} label={`Progress to ${next.name}`} />
          <p className="mt-2 text-xs text-muted">
            {toNext.toLocaleString("en-NG")} points to {next.name}. 1 point per ₦100 spent.
          </p>
        </div>
      )}

      {member && (
        <div className="mt-6 rounded-xl border border-line bg-ink/50 p-4">
          <p className="flex items-center gap-2 font-semibold">
            <Gift className="size-4 text-brand" aria-hidden /> Bring your people
          </p>
          <p className="mt-1 text-sm text-muted">
            Friends get {REFERRAL_DISCOUNT_PERCENT}% off with your code. You get {REFERRAL_POINTS} points every time it&apos;s used.
          </p>
          {account?.referralCode ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code className="rounded-lg bg-white/10 px-3 py-2 font-mono text-lg font-bold tracking-widest">{account.referralCode}</code>
              <CopyButton text={`Use my code ${account.referralCode} for ${REFERRAL_DISCOUNT_PERCENT}% off Oflinewave tickets: ${appUrl("/events")}`} label="Copy invite" />
            </div>
          ) : (
            <form action={createReferralCode} className="mt-3">
              <Button size="sm">Get my code</Button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
