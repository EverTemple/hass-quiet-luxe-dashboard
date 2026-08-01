/** Exact display formatting for power/energy values (Figma `card/energy`). */
export function formatPower(watts: number | undefined): string {
  if (watts === undefined || !Number.isFinite(watts)) {
    return '—';
  }
  if (Math.abs(watts) < 1000) {
    return `${Math.round(watts)} W`;
  }
  return `${(watts / 1000).toFixed(2)} kW`;
}

export function formatEnergy(kwh: number | undefined): string {
  if (kwh === undefined || !Number.isFinite(kwh)) {
    return '—';
  }
  return `${kwh.toFixed(1)} kWh`;
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
