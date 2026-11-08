"use client";

import type { MouseEvent, ReactNode, Ref, SyntheticEvent } from "react";
import { cn } from "@/lib/cn";

/**
 * Contract of every modal in the panel. A native `<dialog>` supplies the focus
 * trap, Escape and the top layer without a dependency; the component owns the
 * one visual pattern (surface background, foreground text and backdrop token)
 * so no dialog can fall back to the UA's black `CanvasText` on a dark surface.
 *
 * The caller keeps the element with a ref: `showModal()` to open and `close()`
 * to dismiss. Dismissal through Escape (`onCancel`), `close` (`onClose`, used
 * to clear state) and backdrop clicks (`onBackdropClick`) stay under the
 * caller's control, so a pending request can block them.
 */
export interface DialogProps {
  /** Id of the element that names the dialog; prefer it over a raw label. */
  labelledBy: string;
  ref?: Ref<HTMLDialogElement>;
  onCancel?: (event: SyntheticEvent<HTMLDialogElement>) => void;
  onClose?: () => void;
  /** Fired when the backdrop — not the dialog box — is clicked. */
  onBackdropClick?: () => void;
  className?: string;
  children: ReactNode;
}

const baseClasses =
  "m-auto max-h-[85vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-card border border-border bg-surface p-4 text-foreground backdrop:bg-foreground/40 sm:w-full";

export function Dialog({
  labelledBy,
  ref,
  onCancel,
  onClose,
  onBackdropClick,
  className,
  children,
}: DialogProps) {
  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    // The dialog box fills the top layer; a click whose target is the box
    // itself (never a child) means the backdrop was hit.
    if (event.target === event.currentTarget) onBackdropClick?.();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={onCancel}
      onClose={onClose}
      onClick={onBackdropClick ? handleClick : undefined}
      className={cn(baseClasses, className)}
    >
      {children}
    </dialog>
  );
}
