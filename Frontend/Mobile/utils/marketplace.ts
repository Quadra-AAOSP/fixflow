/** Max length for marketplace listing `broadLocation` (API / DB). */
export const MARKETPLACE_BROAD_LOCATION_MAX = 160;

/** Max length for marketplace listing `timing` (API / DB). */
export const MARKETPLACE_TIMING_MAX = 160;

/**
 * Default public broad location for a marketplace listing: site name plus the
 * location the reporter entered on the report.
 */
export function buildMarketplaceBroadLocation(
  siteName: string | null | undefined,
  reportAddress: string | null | undefined,
): string {
  const parts = [siteName, reportAddress]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part && part.length > 0);
  return parts.join(', ').slice(0, MARKETPLACE_BROAD_LOCATION_MAX);
}

/** Local wall-clock value used by `<input type="datetime-local">` and native pickers. */
const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/;

/** Serializes a Date to `YYYY-MM-DDTHH:mm` in local time (fits timing max length). */
export function toMarketplaceTimingValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parses a marketplace timing value; returns null for legacy free-text timings. */
export function parseMarketplaceTimingValue(value: string): Date | null {
  const match = LOCAL_DATETIME.exec(value.trim());
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  const date = new Date(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(hh),
    Number(mm),
    0,
    0,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** True when the timing string is a concrete local date+time (not free text). */
export function isMarketplaceDateTimeTiming(value: string): boolean {
  return parseMarketplaceTimingValue(value) !== null;
}

/** Display label for a stored timing value (formats date+time; keeps legacy free text). */
export function formatMarketplaceTimingDisplay(
  value: string,
  locale = 'en',
): string {
  const parsed = parseMarketplaceTimingValue(value);
  if (!parsed) return value;
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed);
  } catch {
    return value;
  }
}
