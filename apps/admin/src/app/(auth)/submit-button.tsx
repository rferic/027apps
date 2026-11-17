"use client";

import { Button } from "@/components/ui/button";
import { useFormStatus } from "react-dom";

/**
 * Submit button that disables itself while the server action is pending. The
 * pending label is localized by the caller: it used to be a hardcoded English
 * "Signing in…" in a product with nine languages.
 */
export function SubmitButton({
  label,
  pendingLabel,
  className,
  variant,
}: {
  label: string;
  pendingLabel: string;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className={className} variant={variant}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
