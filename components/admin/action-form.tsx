"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";

/**
 * Small form wrapper for admin actions: pending state, inline result,
 * optional confirm step for destructive actions (no browser dialogs).
 */
export function ActionForm({
  action,
  fields,
  label,
  pendingLabel = "Working…",
  variant = "outline",
  confirmLabel,
  children,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  label: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "outline" | "danger" | "ghost";
  /** When set, the button reveals a second "are you sure" button. */
  confirmLabel?: string;
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-2">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      {confirmLabel ? (
        <details className="group">
          <summary className="list-none">
            <span className={`inline-flex h-9 cursor-pointer items-center rounded-full border px-4 text-sm font-semibold ${variant === "danger" ? "border-danger/50 text-danger hover:bg-danger/10" : "border-line hover:bg-white/5"}`}>
              {label}
            </span>
          </summary>
          <Button type="submit" size="sm" variant={variant} disabled={pending} className="mt-2">
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </details>
      ) : (
        <Button type="submit" size="sm" variant={variant} disabled={pending}>
          {pending ? pendingLabel : label}
        </Button>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-success">
          {state.ok}
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
