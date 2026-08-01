import { describe, expect, it } from 'vitest';
import { makeEntity } from '../testing/mock-hass';
import { climateActivity, detectClimateDeviceType } from './climate-device-type';

describe('detectClimateDeviceType', () => {
  it('maps domains to device types', () => {
    expect(detectClimateDeviceType('climate.living_ac')).toBe('ac');
    expect(detectClimateDeviceType('humidifier.bedroom')).toBe('dehumidifier');
    expect(detectClimateDeviceType('fan.study')).toBe('fan');
    expect(detectClimateDeviceType('switch.bath_exhaust')).toBe('exhaust');
  });

  it('falls back to fan for unknown domains (config override expected)', () => {
    expect(detectClimateDeviceType('sensor.whatever')).toBe('fan');
    expect(detectClimateDeviceType('')).toBe('fan');
  });
});

describe('climateActivity', () => {
  it('off state is off', () => {
    expect(climateActivity(makeEntity('climate.a', 'off'))).toBe('off');
    expect(climateActivity(makeEntity('fan.a', 'off'))).toBe('off');
  });

  it('hvac_action idle is idle', () => {
    expect(climateActivity(makeEntity('climate.a', 'cool', { hvac_action: 'idle' }))).toBe('idle');
  });

  it('anything else running is active', () => {
    expect(climateActivity(makeEntity('climate.a', 'cool', { hvac_action: 'cooling' }))).toBe(
      'active',
    );
    expect(climateActivity(makeEntity('fan.a', 'on'))).toBe('active');
  });
});
