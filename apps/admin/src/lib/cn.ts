export type ClassValue = string | false | null | undefined;

/** Une clases condicionales descartando valores vacíos. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}