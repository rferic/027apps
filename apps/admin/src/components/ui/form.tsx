import type { ReactNode } from "react";
import Link from "next/link";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { cn } from "@/lib/cn";
import { panelErrorCodeLabel } from "@/lib/panel-errors";

/**
 * Form primitives shared by page forms and destructive confirmations. They fix
 * the visual and accessibility pattern in one place: a `<label htmlFor>` tied
 * to the control, a muted hint, a destructive error message and a right-aligned
 * action row.
 *
 * The consumer owns the control and its `aria-invalid`/`aria-describedby`, as
 * the ids depend on the field name it reports to the API. Pass `hintId` and
 * `errorId` to keep those references in sync with `FormField`.
 */
export interface FormFieldProps {
  /** Id of the control rendered as `children`. */
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  /** Defaults to `${id}-hint`. */
  hintId?: string;
  /** Defaults to `${id}-error`. */
  errorId?: string;
  children: ReactNode;
}

export function FormField({
  id,
  label,
  hint,
  error,
  hintId = `${id}-hint`,
  errorId = `${id}-error`,
  children,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        {label}
      </label>
      {children}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs font-semibold text-destructive">
      {message}
    </p>
  );
}

export interface FormAlertProps {
  /** Heading of the failure, already translated. */
  message: string;
  code?: string;
  /** Translated code label when the caller needs a specific catalog. */
  codeLabel?: string;
  /** Extra translated details, such as `error.details.formErrors`. */
  details?: string[];
  requestId?: string;
  retryHref?: string;
  messages: TranslationMap;
  className?: string;
}

/**
 * Mutation failure banner, same pattern as `PanelError`: role alert,
 * translated code, copyable request id and an optional retry link.
 */
export function FormAlert({
  message,
  code,
  codeLabel,
  details,
  requestId,
  retryHref,
  messages,
  className,
}: FormAlertProps) {
  return (
    <div
      role="alert"
      className={cn("rounded-card border border-destructive bg-surface p-4 text-xs", className)}
    >
      <p className="text-sm font-semibold text-destructive">{message}</p>
      {code && (
        <p className="mt-2 text-muted-foreground">{codeLabel ?? panelErrorCodeLabel(code, messages)}</p>
      )}
      {details?.map((detail) => (
        <p key={detail} className="mt-2 text-muted-foreground">
          {detail}
        </p>
      ))}
      {requestId && (
        <p className="mt-2 text-muted-foreground">
          {t("Request ID", messages)}: <code className="select-all font-mono">{requestId}</code>
        </p>
      )}
      {retryHref && (
        <Link
          href={retryHref}
          className="mt-2 inline-block font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t("Try again", messages)}
        </Link>
      )}
    </div>
  );
}

/** Button row: right aligned, 44 px tall targets, one separation everywhere. */
export function FormActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-11 flex-wrap items-center justify-end gap-2", className)}>
      {children}
    </div>
  );
}

/** Groups a form block under a heading and an optional description. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
