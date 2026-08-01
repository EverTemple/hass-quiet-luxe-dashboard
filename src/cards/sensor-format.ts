import type { QlStatus } from '../elements/ql-status-dot';

export type SensorMetric = 'aqi' | 'temp' | 'humidity' | 'uv' | 'rain';

export const SENSOR_METRICS: ReadonlyArray<SensorMetric> = [
  'aqi',
  'temp',
  'humidity',
  'uv',
  'rain',
];

function numeric(state: string | undefined): number | undefined {
  if (state === undefined || state === '') {
    return undefined;
  }
  const value = Number(state);
  return Number.isFinite(value) ? value : undefined;
}

/** Exact display formatting per metric; '—' placeholder for non-numeric. */
export function formatSensorValue(metric: SensorMetric, state: string | undefined): string {
  const value = numeric(state);
  if (value === undefined) {
    return '—';
  }
  switch (metric) {
    case 'aqi':
      return String(Math.round(value));
    case 'temp':
      return `${value.toFixed(1)}°`;
    case 'humidity':
      return `${Math.round(value)}%`;
    case 'uv':
      return String(Math.round(value));
    case 'rain':
      return `${Math.round(value)}%`;
  }
}

/**
 * Status-dot thresholds:
 * - aqi: <=50 good, <=100 warn, else alert (US AQI bands)
 * - uv: <6 good, <8 warn, else alert (WHO UV index)
 * - humidity: 30-70 good, 20-30/70-80 warn, else alert (comfort band)
 * - rain: >=60% probability warn, else neutral
 * - temp: always neutral (no universal good/bad)
 */
export function sensorStatus(metric: SensorMetric, state: string | undefined): QlStatus {
  const value = numeric(state);
  if (value === undefined) {
    return 'neutral';
  }
  switch (metric) {
    case 'aqi':
      return value <= 50 ? 'good' : value <= 100 ? 'warn' : 'alert';
    case 'uv':
      return value < 6 ? 'good' : value < 8 ? 'warn' : 'alert';
    case 'humidity':
      if (value >= 30 && value <= 70) {
        return 'good';
      }
      return value >= 20 && value <= 80 ? 'warn' : 'alert';
    case 'rain':
      return value >= 60 ? 'warn' : 'neutral';
    case 'temp':
      return 'neutral';
  }
}
