import { describe, expect, it } from 'vitest';
import { sensorEntity } from '../testing/mock-hass';
import {
  airReadings,
  bandFor,
  DEFAULT_AIR_QUALITY_THRESHOLDS,
  NO2_THRESHOLDS,
  PM10_THRESHOLDS,
  PM25_THRESHOLDS,
  resolveThresholds,
  summaryBand,
  VOC_THRESHOLDS,
  worstBand,
} from './air-quality';

describe('bandFor — PM2.5 boundaries', () => {
  it('treats the corroborated 35 boundary as still good', () => {
    expect(bandFor(PM25_THRESHOLDS, 35)).toBe('good');
    expect(bandFor(PM25_THRESHOLDS, 35.1)).toBe('fair');
  });

  it('classifies each band and its exact boundary', () => {
    expect(bandFor(PM25_THRESHOLDS, 0)).toBe('good');
    expect(bandFor(PM25_THRESHOLDS, 53)).toBe('fair');
    expect(bandFor(PM25_THRESHOLDS, 54)).toBe('poor');
    expect(bandFor(PM25_THRESHOLDS, 70)).toBe('poor');
    expect(bandFor(PM25_THRESHOLDS, 71)).toBe('very-poor');
  });

  it('reproduces the sample readings drawn in the Figma component', () => {
    expect(bandFor(PM25_THRESHOLDS, 4)).toBe('good');
    expect(bandFor(PM25_THRESHOLDS, 42)).toBe('fair');
    expect(bandFor(PM25_THRESHOLDS, 61)).toBe('poor');
    expect(bandFor(PM25_THRESHOLDS, 96)).toBe('very-poor');
  });
});

describe('bandFor — PM10, VOC and NO2', () => {
  it('bands PM10 at its community boundaries', () => {
    expect(bandFor(PM10_THRESHOLDS, 50)).toBe('good');
    expect(bandFor(PM10_THRESHOLDS, 75)).toBe('fair');
    expect(bandFor(PM10_THRESHOLDS, 100)).toBe('poor');
    expect(bandFor(PM10_THRESHOLDS, 140)).toBe('very-poor');
  });

  it('bands the Dyson 0-9 indices evenly across four bands', () => {
    expect(bandFor(VOC_THRESHOLDS, 2)).toBe('good');
    expect(bandFor(VOC_THRESHOLDS, 4)).toBe('fair');
    expect(bandFor(VOC_THRESHOLDS, 6)).toBe('poor');
    expect(bandFor(VOC_THRESHOLDS, 8)).toBe('very-poor');
    expect(bandFor(NO2_THRESHOLDS, 1)).toBe('good');
    expect(bandFor(NO2_THRESHOLDS, 7)).toBe('very-poor');
  });

  it('bands a fractional index reading', () => {
    expect(bandFor(VOC_THRESHOLDS, 6.4)).toBe('very-poor');
    expect(bandFor(NO2_THRESHOLDS, 0.2)).toBe('good');
  });
});

describe('worstBand', () => {
  it('picks the worst of a set', () => {
    expect(worstBand(['good', 'poor', 'fair'])).toBe('poor');
    expect(worstBand(['good', 'good'])).toBe('good');
    expect(worstBand(['fair', 'very-poor', 'poor'])).toBe('very-poor');
  });

  it('has no answer for no readings', () => {
    expect(worstBand([])).toBeUndefined();
  });
});

describe('resolveThresholds', () => {
  it('returns the defaults when nothing is overridden', () => {
    expect(resolveThresholds(undefined)).toBe(DEFAULT_AIR_QUALITY_THRESHOLDS);
  });

  it('overrides one bound and leaves the rest alone', () => {
    const resolved = resolveThresholds({ pm25: { good: 15 } });
    expect(resolved.pm25).toEqual({ good: 15, fair: 53, poor: 70 });
    expect(resolved.pm10).toEqual(PM10_THRESHOLDS);
  });

  it('changes the banding it is asked to change', () => {
    const resolved = resolveThresholds({ pm25: { good: 15 } });
    expect(bandFor(resolved.pm25, 20)).toBe('fair');
    expect(bandFor(DEFAULT_AIR_QUALITY_THRESHOLDS.pm25, 20)).toBe('good');
  });

  it('refuses an out-of-order scale rather than silently reordering it', () => {
    expect(() => resolveThresholds({ voc: { good: 8 } })).toThrow(/must increase/);
  });

  it('ignores a non-numeric bound', () => {
    const resolved = resolveThresholds({ pm25: { good: Number.NaN } });
    expect(resolved.pm25.good).toBe(35);
  });
});

describe('airReadings', () => {
  const states = [
    sensorEntity('sensor.tp09_pm_2_5', '4'),
    sensorEntity('sensor.tp09_pm_10', '6'),
    sensorEntity('sensor.tp09_voc', '6.4'),
    sensorEntity('sensor.tp09_no2', '0.2'),
  ];
  const lookup = (id: string): ReturnType<typeof sensorEntity> | undefined =>
    states.find((entity) => entity.entity_id === id);

  it('draws every pollutant the device reports, in design order', () => {
    const readings = airReadings(
      {
        pm25: 'sensor.tp09_pm_2_5',
        pm10: 'sensor.tp09_pm_10',
        voc: 'sensor.tp09_voc',
        no2: 'sensor.tp09_no2',
      },
      lookup,
    );
    expect(readings.map((reading) => reading.id)).toEqual(['pm25', 'pm10', 'voc', 'no2']);
    expect(readings.map((reading) => reading.text)).toEqual(['4', '6', '6.4', '0.2']);
  });

  it('degrades to the one sensor a device actually has', () => {
    const readings = airReadings({ pm25: 'sensor.tp09_pm_2_5' }, lookup);
    expect(readings).toHaveLength(1);
    expect(readings[0]?.label).toBe('PM2.5');
  });

  it('drops a sensor that is not reporting a number', () => {
    const readings = airReadings(
      { pm25: 'sensor.tp09_pm_2_5', pm10: 'sensor.missing' },
      lookup,
    );
    expect(readings.map((reading) => reading.id)).toEqual(['pm25']);
  });

  it('has nothing to draw for a device with no air sensors', () => {
    expect(airReadings({}, lookup)).toEqual([]);
  });

  it('summarises to the worst pollutant, not the first', () => {
    const readings = airReadings(
      { pm25: 'sensor.tp09_pm_2_5', voc: 'sensor.tp09_voc' },
      lookup,
    );
    expect(readings[0]?.band).toBe('good');
    expect(summaryBand(readings)).toBe('very-poor');
  });

  it('has no summary when there is nothing to summarise', () => {
    expect(summaryBand([])).toBeUndefined();
  });
});
