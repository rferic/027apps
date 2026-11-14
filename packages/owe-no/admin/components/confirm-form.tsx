"use client";

import { useRef, useTransition } from "react";

/**
 * A destructive action behind a confirmation dialog. The panel's rule is that
 * nothing irreversible happens on a single click: the button opens a native
 * `<dialog>` (focus trap, Escape and the top layer for free) and the form only
 * submits from inside it. The server action arrives from the page as a prop, so
 * the package stays free of Next imports.
 */
export function ConfirmForm({
  action,
  fields,
  label,
  title,
  body,
  confirmLabel,
  cancelLabel,
  variant = "danger",
  className = "",
}: {
  action: (formData: FormData) => Promise<void>;
  fields: Record<string, string>;
  label: string;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  variant?: "danger" | "neutral";
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const titleId = `confirm-${fields.member ?? fields.movement ?? fields.group ?? "action"}-${label.length}`;

  const trigger =
    variant === "danger"
      ? "min-h-11 justify-center rounded-control border border-border px-3 text-xs font-semibold text-destructive hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      : "min-h-11 justify-center rounded-control border border-border px-3 text-xs font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={`inline-flex items-center ${trigger} ${className}`}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-card border border-border bg-surface p-4 text-foreground backdrop:bg-foreground/40"
      >
        <h2 id={titleId} className="text-sm font-bold">
          {title}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{body}</p>
        <form
          action={action}
          className="mt-4 flex flex-wrap items-center justify-end gap-3"
          onSubmit={() => startTransition(() => undefined)}
        >
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="inline-flex min-h-11 items-center rounded-control border border-border px-3 text-xs font-semibold hover:bg-muted"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center rounded-control bg-destructive px-3 text-xs font-semibold text-destructive-foreground disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </form>
      </dialog>
    </>
  );
}
