import { describe, expect, it } from 'vitest';
import { formatEnergy, formatPower, ringDasharray } from './energy-format';

describe('formatPower', () => {
  it('renders watts below 1 kW and kW with two decimals above', () => {
    expect(formatPower(0, 'en')).toBe('0 W');
    expect(formatPower(824.4, 'en')).toBe('824 W');
    expect(formatPower(1236, 'en')).toBe('1.24 kW');
    expect(formatPower(11500, 'en')).toBe('11.50 kW');
  });

  it('placeholders non-finite input', () => {
    expect(formatPower(undefined, 'en')).toBe('—');
    expect(formatPower(Number.NaN, 'en')).toBe('—');
  });

  it('formats the decimal point per locale', () => {
    expect(formatPower(1234.5, 'id')).toBe('1,23 kW');
    expect(formatPower(1234.5, 'en')).toBe('1.23 kW');
  });
});

describe('formatEnergy', () => {
  it('renders kWh with one decimal', () => {
    expect(formatEnergy(8.61, 'en')).toBe('8.6 kWh');
    expect(formatEnergy(0, 'en')).toBe('0.0 kWh');
  });

  it('placeholders non-finite input', () => {
    expect(formatEnergy(undefined, 'en')).toBe('—');
  });

  it('formats the decimal point per locale', () => {
    expect(formatEnergy(22.3, 'id')).toBe('22,3 kWh');
    expect(formatEnergy(22.3, 'en')).toBe('22.3 kWh');
  });
});

describe('ringDasharray', () => {
  it('maps load fraction onto the circle circumference', () => {
    expect(ringDasharray(2300, 4600, 20)).toBe('62.83 125.66');
  });

  it('clamps to the full circle and handles a zero max', () => {
    expect(ringDasharray(9999, 4600, 20)).toBe('125.66 125.66');
    expect(ringDasharray(-5, 4600, 20)).toBe('0.00 125.66');
    expect(ringDasharray(5, 0, 20)).toBe('0.00 125.66');
  });
});
