export type ClassValue = string | false | null | undefined;

/** Joins conditional classes discarding empty values. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
