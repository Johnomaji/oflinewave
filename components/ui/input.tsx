import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const fieldClass =
  "w-full rounded-xl border border-line bg-surface px-4 text-base text-white placeholder:text-muted/70 transition-colors focus:border-brand focus:outline-none focus-visible:outline-none aria-invalid:border-danger disabled:opacity-50 md:text-sm";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldClass, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldClass, "min-h-28 py-3", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldClass, "h-12 appearance-none pr-10", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-white/90", className)} {...props} />;
}

export function FieldError({ children }: { children?: string | string[] }) {
  const message = Array.isArray(children) ? children[0] : children;
  if (!message) return null;
  return <p className="mt-1.5 text-sm text-danger">{message}</p>;
}
