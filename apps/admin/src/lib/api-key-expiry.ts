export type ExpiryUnit = "hours" | "days" | "months" | "years";

/**
 * What the expiry field submits: `never` removes any expiry (`null` on the
 * wire), `keep` leaves the stored one untouched (the field is not sent) and
 * `relative` is an offset from now.
 */
export type ExpiryChoice =
  | { mode: "never" }
  | { mode: "keep" }
  | { mode: "relative"; amount: number; unit: ExpiryUnit };

/** Display order of the relative units. */
export const EXPIRY_UNITS: readonly ExpiryUnit[] = ["hours", "days", "months", "years"];

/** Mirrors the Core limit; the API still validates the instant. */
export const MAX_EXPIRY_AMOUNT = 10_000;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function isAllowedAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount >= 1 && amount <= MAX_EXPIRY_AMOUNT;
}

/**
 * The instant a choice stores, always computed in UTC:
 * `never` → `null` (clear it), `keep` → `undefined` (do not send it),
 * `relative` → ISO string. An amount outside `1..MAX_EXPIRY_AMOUNT` is a
 * programming error, not a server error, so it throws `RangeError` and the
 * caller turns it into a form error.
 */
export function expiresAtFrom(
  choice: ExpiryChoice,
  now: Date = new Date(),
): string | null | undefined {
  if (choice.mode === "never") return null;
  if (choice.mode === "keep") return undefined;

  const { amount, unit } = choice;
  if (!isAllowedAmount(amount)) {
    throw new RangeError(
      `expiry amount must be an integer between 1 and ${MAX_EXPIRY_AMOUNT}`,
    );
  }

  const date = new Date(now.getTime());
  if (unit === "hours") date.setTime(date.getTime() + amount * HOUR_MS);
  else if (unit === "days") date.setTime(date.getTime() + amount * DAY_MS);
  else if (unit === "months") date.setUTCMonth(date.getUTCMonth() + amount);
  else date.setUTCFullYear(date.getUTCFullYear() + amount);
  return date.toISOString();
}

function isExpiryUnit(value: string): value is ExpiryUnit {
  return (EXPIRY_UNITS as readonly string[]).includes(value);
}

/**
 * Reads the expiry field from a submitted form. `null` means the payload is
 * unusable (unknown mode, unknown unit, amount missing or outside the range);
 * the caller decides how to report it. It does not check whether `keep` is
 * offered: only the caller knows whether the key already has an expiry.
 */
export function parseExpiryFormData(formData: FormData): ExpiryChoice | null {
  const mode = formData.get("expiry_mode");
  if (mode === "never") return { mode: "never" };
  if (mode === "keep") return { mode: "keep" };
  if (mode !== "relative") return null;

  const rawAmount = formData.get("expiry_amount");
  const rawUnit = formData.get("expiry_unit");
  if (typeof rawAmount !== "string" || rawAmount.trim() === "") return null;
  if (typeof rawUnit !== "string" || !isExpiryUnit(rawUnit)) return null;

  const amount = Number(rawAmount);
  if (!isAllowedAmount(amount)) return null;
  return { mode: "relative", amount, unit: rawUnit };
}
