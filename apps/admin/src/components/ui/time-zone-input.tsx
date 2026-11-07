import type { AriaAttributes, ChangeEvent } from "react";
import { cn } from "@/lib/cn";

/**
 * Computed once per module load: the list is static for the runtime, and
 * recomputing it on every render would rebuild the same array for nothing.
 */
const TIME_ZONES: readonly string[] = Intl.supportedValuesOf("timeZone");

export interface TimeZoneInputProps {
  id: string;
  name?: string;
  /** Controlled value. Pair with `onChange`. */
  value?: string;
  /** Initial value for uncontrolled use (forms read it through FormData). */
  defaultValue?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
}

/**
 * IANA time zone field with browser-provided suggestions. Free text is still
 * accepted: the Core validates the value on save.
 */
export function TimeZoneInput({
  id,
  name,
  value,
  defaultValue,
  onChange,
  required,
  className,
  disabled,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: TimeZoneInputProps) {
  const listId = `${id}-zones`;
  return (
    <>
      <input
        id={id}
        name={name}
        type="text"
        list={listId}
        autoComplete="off"
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        onChange={onChange}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        className={cn(
          "rounded-control border border-border bg-background px-2.5 py-1.5 text-sm text-foreground min-h-11 sm:min-h-0 focus-visible:outline-2 focus-visible:outline-accent",
          className,
        )}
      />
      <datalist id={listId}>
        {TIME_ZONES.map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>
    </>
  );
}
