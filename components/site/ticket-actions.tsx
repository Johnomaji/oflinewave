"use client";

import { Pencil, Send } from "lucide-react";
import { useActionState, useState } from "react";
import { renameTicketAction, transferTicketAction, type TicketActionState } from "@/app/actions/transfers";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type Credentials = { ticketToken?: string; orderToken?: string };

/** Transfer / rename controls under a ticket. Hidden fields carry the access credential. */
export function TicketActions({
  ticketId,
  credentials,
  holderName,
  windowOpen,
  closesLabel,
}: {
  ticketId: string;
  credentials: Credentials;
  holderName: string;
  windowOpen: boolean;
  closesLabel: string | null;
}) {
  const [open, setOpen] = useState<"transfer" | "rename" | null>(null);
  const [transferState, transfer, transferring] = useActionState<TicketActionState, FormData>(transferTicketAction, {});
  const [renameState, rename, renaming] = useActionState<TicketActionState, FormData>(renameTicketAction, {});

  if (!windowOpen) {
    return <p className="text-xs text-muted">{closesLabel ?? "Transfers are closed for this event."}</p>;
  }

  const hidden = (
    <>
      <input type="hidden" name="ticketId" value={ticketId} />
      {credentials.ticketToken && <input type="hidden" name="ticketToken" value={credentials.ticketToken} />}
      {credentials.orderToken && <input type="hidden" name="orderToken" value={credentials.orderToken} />}
    </>
  );

  if (transferState.ok) {
    return (
      <p role="status" className="rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">
        {transferState.ok}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={open === "transfer" ? "primary" : "outline"} onClick={() => setOpen(open === "transfer" ? null : "transfer")} aria-expanded={open === "transfer"}>
          <Send /> Transfer
        </Button>
        <Button type="button" size="sm" variant={open === "rename" ? "primary" : "outline"} onClick={() => setOpen(open === "rename" ? null : "rename")} aria-expanded={open === "rename"}>
          <Pencil /> Change name
        </Button>
        {closesLabel && <span className="self-center text-xs text-muted">{closesLabel}</span>}
      </div>

      {open === "transfer" && (
        <form action={transfer} className="space-y-3 rounded-xl border border-line p-4">
          {hidden}
          <p className="text-sm text-muted">They get a fresh QR by email. Yours stops working straight away.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`to-name-${ticketId}`}>Their name</Label>
              <Input id={`to-name-${ticketId}`} name="name" required autoComplete="off" />
            </div>
            <div>
              <Label htmlFor={`to-email-${ticketId}`}>Their email</Label>
              <Input id={`to-email-${ticketId}`} name="email" type="email" required autoComplete="off" />
            </div>
          </div>
          {transferState.error && (
            <p role="alert" className="text-sm text-danger">
              {transferState.error}
            </p>
          )}
          <Button type="submit" size="sm" disabled={transferring}>
            {transferring ? "Sending…" : "Send ticket"}
          </Button>
        </form>
      )}

      {open === "rename" && (
        <form action={rename} className="space-y-3 rounded-xl border border-line p-4">
          {hidden}
          <div>
            <Label htmlFor={`rename-${ticketId}`}>Name on ticket</Label>
            <Input id={`rename-${ticketId}`} name="name" required defaultValue={holderName} />
          </div>
          {renameState.error && (
            <p role="alert" className="text-sm text-danger">
              {renameState.error}
            </p>
          )}
          {renameState.ok && (
            <p role="status" className="text-sm text-success">
              {renameState.ok}
            </p>
          )}
          <Button type="submit" size="sm" disabled={renaming}>
            {renaming ? "Saving…" : "Save name"}
          </Button>
        </form>
      )}
    </div>
  );
}
