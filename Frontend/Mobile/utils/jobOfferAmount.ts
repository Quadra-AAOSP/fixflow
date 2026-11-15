/**
 * Parse a user-entered major-unit pay amount into minor units (cents).
 * Returns null when the value is missing, non-numeric, or not positive.
 */
export function parseOfferAmountMinor(raw: string): number | null {
  const amountMinor = Math.round(Number(String(raw).trim()) * 100);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) return null;
  return amountMinor;
}
