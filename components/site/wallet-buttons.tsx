import { Wallet } from "lucide-react";
import { ticketViewToken } from "@/lib/tickets/token";
import { walletConfig } from "@/lib/tickets/wallet";

/** Add-to-wallet links for one ticket; renders nothing until wallet keys are configured. */
export function WalletButtons({ ticketId, qrToken }: { ticketId: string; qrToken: string }) {
  const apple = walletConfig.apple();
  const google = walletConfig.google();
  if (!apple && !google) return null;
  const t = ticketViewToken(qrToken);
  const cls = "inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ink transition hover:bg-white/90";
  return (
    <div className="flex flex-wrap gap-2">
      {apple && (
        <a href={`/api/tickets/${ticketId}/wallet/apple?t=${t}`} className={cls}>
          <Wallet className="size-4" /> Add to Apple Wallet
        </a>
      )}
      {google && (
        <a href={`/api/tickets/${ticketId}/wallet/google?t=${t}`} className={cls} rel="noopener">
          <Wallet className="size-4" /> Save to Google Wallet
        </a>
      )}
    </div>
  );
}
