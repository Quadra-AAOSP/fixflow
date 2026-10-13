/**
 * Presentation helpers with no side effects. Every formatter degrades
 * gracefully when the runtime's `Intl` data is incomplete (Hermes builds are
 * compiled with varying ICU support), so a missing locale never blanks a
 * screen.
 */

const FALLBACK_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const WEEKDAY_LABELS = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function fallbackDate(date: Date, includeTime: boolean): string {
  const base = `${FALLBACK_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  if (!includeTime) return base;
  return `${base}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Formats an ISO timestamp for display. Returns `Not available` for missing
 * or unparseable values — which is the truthful state for the server-masked
 * report fields, not an error.
 */
export function formatDate(
  value: string | null | undefined,
  includeTime = false,
): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';

  try {
    return new Intl.DateTimeFormat(
      undefined,
      includeTime
        ? { dateStyle: 'medium', timeStyle: 'short' }
        : { dateStyle: 'medium' },
    ).format(date);
  } catch {
    return fallbackDate(date, includeTime);
  }
}

/** Short weekday label for chart axes — index matches `Date.getDay()`. */
export function weekdayLabel(date: Date): string {
  return WEEKDAY_LABELS[date.getDay()];
}

/**
 * Formats a minor-unit amount (cents) using the currency metadata that came
 * with the payload, so no float maths ever happens on money.
 */
export function formatMoney(
  minor: number,
  minorUnitDigits: number,
  currency: string,
): string {
  const digits = Number.isInteger(minorUnitDigits) ? minorUnitDigits : 2;
  const value = minor / 10 ** digits;

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return `${value.toFixed(digits)} ${currency}`;
  }
}

/** `resolved_pending_confirmation` → `Resolved pending confirmation`. */
export const humanize = (value: string): string =>
  value.replaceAll('_', ' ').replace(/^./, (char) => char.toUpperCase());

/** `Ada Lovelace` → `AL`. Used for avatar placeholders. */
export const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

/** `Ada Lovelace` → `Ada Lovelace`; trims and collapses inner whitespace. */
export const fullName = (first: string, last: string): string =>
  `${first} ${last}`.replace(/\s+/g, ' ').trim();

/**
 * Client-generated idempotency key for order submission.
 *
 * The web build uses `crypto.randomUUID()`, which Hermes does not expose.
 * This is a time-ordered, collision-resistant identifier for a single
 * client's checkout attempts — the server only needs it to recognise a
 * retry of the *same* request.
 */
let idempotencyCounter = 0;

export function createIdempotencyKey(): string {
  idempotencyCounter = (idempotencyCounter + 1) % 1_000_000;
  const time = Date.now().toString(36);
  const counter = idempotencyCounter.toString(36).padStart(4, '0');
  const random = Math.random().toString(36).slice(2, 10);
  return `${time}-${counter}-${random}`;
}

/** Truncates long free text for list rows. */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
