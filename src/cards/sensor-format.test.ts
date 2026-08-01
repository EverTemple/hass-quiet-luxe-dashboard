import { describe, expect, it } from 'vitest';
import { formatSensorValue, sensorStatus } from './sensor-format';

describe('formatSensorValue', () => {
  it('formats each metric exactly', () => {
    expect(formatSensorValue('aqi', '18.4')).toBe('18');
    expect(formatSensorValue('temp', '24.46')).toBe('24.5°');
    expect(formatSensorValue('humidity', '61.8')).toBe('62%');
    expect(formatSensorValue('uv', '7.2')).toBe('7');
    expect(formatSensorValue('rain', '80')).toBe('80%');
  });

  it('returns the placeholder for non-numeric or absent states', () => {
    expect(formatSensorValue('aqi', 'unknown')).toBe('—');
    expect(formatSensorValue('temp', undefined)).toBe('—');
    expect(formatSensorValue('uv', '')).toBe('—');
  });
});

describe('sensorStatus', () => {
  it('AQI: <=50 good, <=100 warn, else alert', () => {
    expect(sensorStatus('aqi', '50')).toBe('good');
    expect(sensorStatus('aqi', '51')).toBe('warn');
    expect(sensorStatus('aqi', '100')).toBe('warn');
    expect(sensorStatus('aqi', '101')).toBe('alert');
  });

  it('UV: <6 good, <8 warn, else alert (WHO index bands)', () => {
    expect(sensorStatus('uv', '5')).toBe('good');
    expect(sensorStatus('uv', '6')).toBe('warn');
    expect(sensorStatus('uv', '8')).toBe('alert');
  });

  it('humidity: 30-70 good, 20-30/70-80 warn, else alert', () => {
    expect(sensorStatus('humidity', '45')).toBe('good');
    expect(sensorStatus('humidity', '25')).toBe('warn');
    expect(sensorStatus('humidity', '75')).toBe('warn');
    expect(sensorStatus('humidity', '15')).toBe('alert');
    expect(sensorStatus('humidity', '85')).toBe('alert');
  });

  it('rain: >=60 warn, else neutral; temp always neutral', () => {
    expect(sensorStatus('rain', '59')).toBe('neutral');
    expect(sensorStatus('rain', '60')).toBe('warn');
    expect(sensorStatus('temp', '35')).toBe('neutral');
  });

  it('non-numeric states are neutral', () => {
    expect(sensorStatus('aqi', 'unknown')).toBe('neutral');
    expect(sensorStatus('uv', undefined)).toBe('neutral');
  });
});
