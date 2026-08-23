import type { Locale } from './types';

/**
 * `Intl.NumberFormat` instances are expensive to construct and this dashboard
 * re-renders often, so one is built per locale+precision and reused — the
 * same reasoning as caching a compiled regex, applied to formatters instead
 * of `Intl.DateTimeFormat` in `schedule-data.ts`, which does not re-render at
 * this frequency and so does not need it.
 */
const formatterCache = new Map<string, Intl.NumberFormat>();

function cachedFormatter(
  locale: Locale,
  key: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const cacheKey = `${locale}:${key}`;
  let formatter = formatterCache.get(cacheKey);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(locale, options);
    formatterCache.set(cacheKey, formatter);
  }
  return formatter;
}

/**
 * Locale-correct replacement for `value.toFixed(digits)` in display text.
 * `id` renders the decimal comma (`22,3`), `en` the point (`22.3`) — a plain
 * `toFixed` call hardcodes the point for every locale.
 */
export function formatFixed(value: number, locale: Locale, digits: number): string {
  return cachedFormatter(locale, `fixed:${String(digits)}`, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/**
 * Locale-correct replacement for `String(Math.round(value))` in display text.
 * Rounding is delegated to `Intl.NumberFormat` itself rather than pre-rounded
 * with `Math.round`, so thousands grouping (e.g. AQI or particulate readings
 * past 999) is also locale-correct.
 */
export function formatInteger(value: number, locale: Locale): string {
  return cachedFormatter(locale, 'integer', { maximumFractionDigits: 0 }).format(value);
}

/**
 * Locale-correct replacement for `String(value)` on a number that may or may
 * not carry decimals — e.g. a 0.5°-step setpoint that is a whole number most
 * of the time (`21`) and fractional some of the time (`21.5`). Unlike
 * `formatFixed`, a whole number is not padded with a trailing zero.
 */
export function formatTrimmed(value: number, locale: Locale, maxDigits: number): string {
  return cachedFormatter(locale, `trimmed:${String(maxDigits)}`, {
    maximumFractionDigits: maxDigits,
  }).format(value);
}
