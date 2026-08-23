import { describe, expect, it } from 'vitest';
import { formatFixed, formatInteger, formatTrimmed } from './format-number';

describe('formatFixed', () => {
  it('renders the decimal point per locale', () => {
    expect(formatFixed(22.3, 'en', 1)).toBe('22.3');
    expect(formatFixed(22.3, 'id', 1)).toBe('22,3');
  });

  it('pads and rounds to the requested digits', () => {
    expect(formatFixed(8, 'en', 1)).toBe('8.0');
    expect(formatFixed(24.46, 'en', 1)).toBe('24.5');
  });

  it('groups thousands per locale', () => {
    expect(formatFixed(1234.5, 'en', 1)).toBe('1,234.5');
    expect(formatFixed(1234.5, 'id', 1)).toBe('1.234,5');
  });
});

describe('formatInteger', () => {
  it('rounds and renders per locale', () => {
    expect(formatInteger(18.4, 'en')).toBe('18');
    expect(formatInteger(61.8, 'en')).toBe('62');
  });

  it('groups thousands per locale', () => {
    expect(formatInteger(1234, 'en')).toBe('1,234');
    expect(formatInteger(1234, 'id')).toBe('1.234');
  });
});

describe('formatTrimmed', () => {
  it('drops the decimal for a whole number', () => {
    expect(formatTrimmed(21, 'en', 1)).toBe('21');
    expect(formatTrimmed(21, 'id', 1)).toBe('21');
  });

  it('keeps the decimal per locale when the value is fractional', () => {
    expect(formatTrimmed(21.5, 'en', 1)).toBe('21.5');
    expect(formatTrimmed(21.5, 'id', 1)).toBe('21,5');
  });
});
