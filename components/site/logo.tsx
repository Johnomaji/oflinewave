import Image from "next/image";
import Link from "next/link";
import logo from "@/public/brand/logo.png";
import { cn } from "@/lib/utils";

/** Wordmark. Height comes from className (h-9 by default); width follows the artwork. */
export function Logo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Link href="/" className={cn("inline-flex h-9 shrink-0", className)} aria-label="Oflinewave home">
      <Image src={logo} alt="Oflinewave" priority={priority} sizes="200px" className="h-full w-auto" />
    </Link>
  );
}
