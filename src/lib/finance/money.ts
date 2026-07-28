/**
 * Money is always an integer number of minor units (cents) — never a
 * floating-point dollar amount. These are the only places dollars-as-typed-
 * by-a-human get converted to/from cents; every other financial calculation
 * in `src/lib/finance/` works in cents throughout.
 */

/** Parses a user-typed dollar string ("1,234.5", "$42", "-10") into integer cents. Throws on invalid input. */
export function parseDollarsToCents(input: string): number {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "" || Number.isNaN(Number(cleaned))) {
    throw new Error(`"${input}" is not a valid dollar amount`);
  }
  // Round rather than truncate so "19.999" doesn't become 1999 cents.
  return Math.round(Number(cleaned) * 100);
}

/** Formats integer cents as a localized currency string, e.g. 123456 -> "$1,234.56". */
export function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
