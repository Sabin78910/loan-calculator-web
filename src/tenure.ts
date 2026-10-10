export type TenureUnit = "years" | "months";

/** Years text to whole months; null when not a non-negative number. */
export function yearsToMonths(text: string): number | null {
  if (text.trim() === "") return null;
  const y = Number(text);
  if (!Number.isFinite(y) || y < 0) return null;
  return Math.round(y * 12);
}

/** Months to years text, up to 2 decimals; empty when not a finite number. */
export function monthsToYears(months: number): string {
  if (!Number.isFinite(months)) return "";
  return String(Math.round((months / 12) * 100) / 100);
}
