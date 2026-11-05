"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function Result({ state }: { state: ActionState }) {
  if (state.error)
    return (
      <p role="alert" className="text-sm text-danger">
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p role="status" className="text-sm text-success">
        {state.ok}
      </p>
    );
  return null;
}

export function SettingsForm({
  action,
  values,
}: {
  action: Action;
  values: {
    brandName: string;
    contactEmail: string;
    feePercent: number;
    feeFlatNaira: number;
    defaultFeeMode: string;
    instagramUrl: string;
    twitterUrl: string;
    tiktokUrl: string;
  };
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  return (
    <Card className="p-6">
      <form action={formAction} className="space-y-6">
        <div>
          <h2 className="mb-4 text-xl font-bold">Brand</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="brandName">Brand name</Label>
              <Input id="brandName" name="brandName" defaultValue={values.brandName} required />
            </div>
            <div>
              <Label htmlFor="contactEmail">Contact email</Label>
              <Input id="contactEmail" name="contactEmail" type="email" defaultValue={values.contactEmail} required />
            </div>
          </div>
        </div>
        <div>
          <h2 className="mb-1 text-xl font-bold">Service fee</h2>
          <p className="mb-4 text-sm text-muted">Charged per order: percentage of the ticket total plus a flat amount per paid ticket. Free tickets never carry a fee.</p>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="feePercent">Percent (%)</Label>
              <Input id="feePercent" name="feePercent" type="number" step="0.1" min={0} max={30} defaultValue={values.feePercent} />
            </div>
            <div>
              <Label htmlFor="feeFlatNaira">Flat per ticket (₦)</Label>
              <Input id="feeFlatNaira" name="feeFlatNaira" type="number" min={0} defaultValue={values.feeFlatNaira} />
            </div>
            <div>
              <Label htmlFor="defaultFeeMode">Default</Label>
              <Select id="defaultFeeMode" name="defaultFeeMode" defaultValue={values.defaultFeeMode}>
                <option value="PASS_TO_BUYER">Pass to buyer</option>
                <option value="ABSORB">Absorb</option>
              </Select>
            </div>
          </div>
        </div>
        <div>
          <h2 className="mb-4 text-xl font-bold">Socials</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {(["instagramUrl", "twitterUrl", "tiktokUrl"] as const).map((key) => (
              <div key={key}>
                <Label htmlFor={key}>{{ instagramUrl: "Instagram", twitterUrl: "X / Twitter", tiktokUrl: "TikTok" }[key]}</Label>
                <Input id={key} name={key} type="url" defaultValue={values[key]} placeholder="https://" />
              </div>
            ))}
          </div>
        </div>
        <Result state={state} />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </form>
    </Card>
  );
}

export function TeamForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
        <div>
          <label htmlFor="team-email" className="sr-only">
            Email
          </label>
          <Input id="team-email" name="email" type="email" required placeholder="teammate@email.com" />
        </div>
        <div>
          <label htmlFor="team-role" className="sr-only">
            Role
          </label>
          <Select id="team-role" name="role" defaultValue="DOOR_STAFF">
            <option value="DOOR_STAFF">Door staff</option>
            <option value="ORGANIZER">Organizer</option>
            <option value="SUPER_ADMIN">Super admin</option>
            <option value="ATTENDEE">Remove access</option>
          </Select>
        </div>
        <Button type="submit" className="h-12" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      <Result state={state} />
    </form>
  );
}
