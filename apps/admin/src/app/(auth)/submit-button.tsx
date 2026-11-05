"use client";

import { Button } from "@/components/ui/button";
import { useFormStatus } from "react-dom";

/** Submit button that disables itself while the server action is pending. */
export function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Signing in…" : label}
    </Button>
  );
}
