/**
 * Formats an amount in cents into a localized price string, e.g. 1850 EUR
 * becomes "18,50 €". Amounts are integers in cents everywhere (contract
 * convention); euros only exist at display time.
 */
export function formatPriceCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}
