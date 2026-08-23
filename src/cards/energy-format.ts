import { formatFixed, formatInteger } from '../i18n/format-number';
import type { Locale } from '../i18n/types';

/** Exact display formatting for power/energy values (Figma `card/energy`). */
export function formatPower(watts: number | undefined, locale: Locale): string {
  if (watts === undefined || !Number.isFinite(watts)) {
    return '—';
  }
  if (Math.abs(watts) < 1000) {
    return `${formatInteger(watts, locale)} W`;
  }
  return `${formatFixed(watts / 1000, locale, 2)} kW`;
}

export function formatEnergy(kwh: number | undefined, locale: Locale): string {
  if (kwh === undefined || !Number.isFinite(kwh)) {
    return '—';
  }
  return `${formatFixed(kwh, locale, 1)} kWh`;
}

/**
 * stroke-dasharray for the per-phase donut: `<filled> <circumference>`,
 * clamped to 0..1 of max. Radius is the SVG circle radius in px.
 */
export function ringDasharray(watts: number, maxWatts: number, radius: number): string {
  const circumference = 2 * Math.PI * radius;
  const fraction = maxWatts <= 0 ? 0 : Math.min(Math.max(watts / maxWatts, 0), 1);
  return `${(circumference * fraction).toFixed(2)} ${circumference.toFixed(2)}`;
}
