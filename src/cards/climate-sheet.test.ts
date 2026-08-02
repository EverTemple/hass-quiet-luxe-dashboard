import { describe, expect, it } from 'vitest';
import type { HassEntity } from '../types/home-assistant';
import {
  climateSheetCall,
  climateSheetGroups,
  climateTargetHumidity,
  hasClimateSheet,
} from './climate-sheet';

function makeEntity(entityId: string, state: string, attributes: Record<string, unknown>): HassEntity {
  return { entity_id: entityId, state, attributes } as unknown as HassEntity;
}

/**
 * The three live devices this sheet was built against, probed from the Tung
 * Chung instance on HA 2026.7.1. Keeping the real masks and attribute lists
 * here is what makes the gating tests meaningful rather than circular.
 */

/** climate.steven_bedroom — Sensibo. 937 = TARGET_TEMPERATURE|FAN|SWING|ON|OFF|SWING_H. */
const sensibo = (): HassEntity =>
  makeEntity('climate.steven_bedroom', 'cool', {
    supported_features: 937,
    hvac_modes: ['cool', 'heat', 'fan_only', 'dry', 'heat_cool', 'off'],
    min_temp: 17,
    max_temp: 30,
    target_temp_step: 1,
    fan_modes: ['quiet', 'low', 'medium', 'high', 'auto', 'strong'],
    swing_modes: ['stopped', 'rangefull'],
    swing_horizontal_modes: ['stopped', 'rangefull'],
    current_temperature: 21.9,
    temperature: 23,
    current_humidity: 78.3,
    fan_mode: 'low',
    swing_mode: 'rangefull',
    swing_horizontal_mode: 'rangefull',
  });

/** climate.tp09 — 385 = TARGET_TEMPERATURE|TURN_ON|TURN_OFF. Nothing else. */
const tp09 = (): HassEntity =>
  makeEntity('climate.tp09', 'cool', {
    supported_features: 385,
    hvac_modes: ['off', 'cool', 'heat'],
    min_temp: 1,
    max_temp: 37,
    current_temperature: 24.2,
    temperature: 27,
    current_humidity: 60,
    hvac_action: 'cooling',
  });

/** humidifier.dmaker_22ht_b0bf_dehumidifier — 1 = MODES. */
const dehumidifier = (): HassEntity =>
  makeEntity('humidifier.dmaker_22ht_b0bf_dehumidifier', 'on', {
    supported_features: 1,
    min_humidity: 40,
    max_humidity: 70,
    available_modes: ['Off', 'Smart', 'Sleep', 'Clothes Drying'],
    current_humidity: 62,
    humidity: 50,
    mode: 'Clothes Drying',
    device_class: 'dehumidifier',
  });

function groupTitles(entity: HassEntity): string[] {
  return climateSheetGroups(entity).map((group) => group.titleKey);
}

function controlIds(entity: HassEntity): string[] {
  return climateSheetGroups(entity).flatMap((group) => group.controls.map((c) => c.id));
}

describe('sheet gating — climate.steven_bedroom (Sensibo, 937)', () => {
  it('offers mode, temperature, fan and both swing axes', () => {
    expect(groupTitles(sensibo())).toEqual([
      'control.hvac_mode',
      'control.temperature_range',
      'control.fan',
      'control.swing',
    ]);
  });

  it('omits humidity and preset, which the device does not report', () => {
    expect(controlIds(sensibo())).not.toContain('target_humidity');
    expect(controlIds(sensibo())).not.toContain('preset_mode');
  });

  it('offers all six hvac modes the device lists', () => {
    const [hvac] = climateSheetGroups(sensibo());
    expect(hvac?.controls[0]).toMatchObject({
      kind: 'select',
      options: ['cool', 'heat', 'fan_only', 'dry', 'heat_cool', 'off'],
      value: 'cool',
    });
  });

  it('bounds the temperature stepper by the device’s own band and step', () => {
    const group = climateSheetGroups(sensibo())[1];
    expect(group?.controls[0]).toMatchObject({
      kind: 'stepper',
      id: 'temperature',
      target: { value: 23, min: 17, max: 30, step: 1 },
    });
  });

  it('draws a two-position swing axis as a switch', () => {
    const swing = climateSheetGroups(sensibo()).find((g) => g.titleKey === 'control.swing');
    expect(swing?.controls).toHaveLength(2);
    expect(swing?.controls[0]).toEqual({
      kind: 'toggle',
      id: 'swing_mode',
      labelKey: 'control.swing_vertical',
      on: true,
      onValue: 'rangefull',
      offValue: 'stopped',
    });
    expect(swing?.controls[1]).toMatchObject({ id: 'swing_horizontal_mode', on: true });
  });

  it('draws a swing axis with more than two positions as a picker', () => {
    const entity = sensibo();
    const many = makeEntity('climate.x', 'cool', {
      ...entity.attributes,
      swing_modes: ['off', 'low', 'mid', 'high'],
      swing_mode: 'mid',
    });
    const swing = climateSheetGroups(many).find((g) => g.titleKey === 'control.swing');
    expect(swing?.controls[0]).toMatchObject({ kind: 'select', id: 'swing_mode', value: 'mid' });
  });
});

describe('sheet gating — climate.tp09 (385)', () => {
  it('offers only mode and temperature', () => {
    expect(groupTitles(tp09())).toEqual(['control.hvac_mode', 'control.temperature_range']);
  });

  it('omits fan, swing, humidity and preset entirely', () => {
    const ids = controlIds(tp09());
    for (const absent of ['fan_mode', 'swing_mode', 'swing_horizontal_mode', 'target_humidity', 'preset_mode']) {
      expect(ids).not.toContain(absent);
    }
  });

  it('uses the device’s own 1–37 band and HA’s default step', () => {
    expect(climateSheetGroups(tp09())[1]?.controls[0]).toMatchObject({
      target: { value: 27, min: 1, max: 37, step: 0.5 },
    });
  });
});

describe('sheet gating — humidifier.dmaker_22ht (1)', () => {
  it('offers target humidity and humidity mode', () => {
    expect(groupTitles(dehumidifier())).toEqual(['control.humidity', 'control.humidity_mode']);
  });

  it('bounds the stepper by the device’s own 40–70 band', () => {
    expect(climateSheetGroups(dehumidifier())[0]?.controls[0]).toMatchObject({
      kind: 'stepper',
      id: 'target_humidity',
      unit: '%',
      target: { value: 50, min: 40, max: 70, step: 1 },
    });
  });

  it('offers the four vendor modes verbatim', () => {
    expect(climateSheetGroups(dehumidifier())[1]?.controls[0]).toMatchObject({
      options: ['Off', 'Smart', 'Sleep', 'Clothes Drying'],
      value: 'Clothes Drying',
    });
  });

  it('never offers a climate control to a humidifier', () => {
    expect(controlIds(dehumidifier())).not.toContain('hvac_mode');
    expect(controlIds(dehumidifier())).not.toContain('temperature');
  });
});

describe('sheet gating — edges', () => {
  it('offers nothing for a device that is not answering', () => {
    const offline = makeEntity('climate.a', 'unavailable', { supported_features: 937 });
    expect(climateSheetGroups(offline)).toEqual([]);
    expect(hasClimateSheet(offline)).toBe(false);
    expect(climateSheetGroups(undefined)).toEqual([]);
  });

  it('offers nothing for a domain it does not drive', () => {
    expect(climateSheetGroups(makeEntity('fan.a', 'on', { supported_features: 63 }))).toEqual([]);
  });

  it('drops a select with only one option, which is a label not a choice', () => {
    const single = makeEntity('climate.a', 'cool', {
      supported_features: 9,
      hvac_modes: ['cool'],
      fan_modes: ['auto'],
    });
    expect(controlIds(single)).toEqual([]);
  });

  it('shows a range thermostat two ends instead of one target', () => {
    const range = makeEntity('climate.a', 'heat_cool', {
      supported_features: 3,
      min_temp: 15,
      max_temp: 30,
      target_temp_step: 0.5,
      target_temp_low: 21,
      target_temp_high: 25,
      temperature: 23,
    });
    expect(controlIds(range)).toEqual(['temp_low', 'temp_high']);
  });

  it('reads a climate entity’s own humidity target when it has one', () => {
    const entity = makeEntity('climate.a', 'cool', {
      supported_features: 5,
      humidity: 55,
      min_humidity: 30,
      max_humidity: 80,
    });
    expect(climateTargetHumidity(entity)).toEqual({ value: 55, min: 30, max: 80, step: 1 });
    expect(climateTargetHumidity(tp09())).toBeUndefined();
  });
});

describe('sheet service calls', () => {
  it('sets an hvac mode', () => {
    expect(climateSheetCall('climate.tp09', 'hvac_mode', 'heat', tp09())).toEqual({
      domain: 'climate',
      service: 'set_hvac_mode',
      data: { entity_id: 'climate.tp09', hvac_mode: 'heat' },
    });
  });

  it('sets a single target temperature', () => {
    expect(climateSheetCall('climate.tp09', 'temperature', 27.5, tp09())).toEqual({
      domain: 'climate',
      service: 'set_temperature',
      data: { entity_id: 'climate.tp09', temperature: 27.5 },
    });
  });

  it('carries the untouched end of a range so HA cannot drop it', () => {
    const range = makeEntity('climate.a', 'heat_cool', {
      supported_features: 3,
      target_temp_low: 21,
      target_temp_high: 25,
    });
    expect(climateSheetCall('climate.a', 'temp_low', 22, range)).toEqual({
      domain: 'climate',
      service: 'set_temperature',
      data: { entity_id: 'climate.a', target_temp_low: 22, target_temp_high: 25 },
    });
    expect(climateSheetCall('climate.a', 'temp_high', 26, range)).toEqual({
      domain: 'climate',
      service: 'set_temperature',
      data: { entity_id: 'climate.a', target_temp_low: 21, target_temp_high: 26 },
    });
  });

  it('refuses a range change when the device has not reported both ends', () => {
    expect(climateSheetCall('climate.a', 'temp_low', 22, tp09())).toBeUndefined();
  });

  it('sets fan and both swing axes through their own services', () => {
    expect(climateSheetCall('climate.steven_bedroom', 'fan_mode', 'high', sensibo())).toMatchObject({
      service: 'set_fan_mode',
      data: { fan_mode: 'high' },
    });
    expect(climateSheetCall('climate.steven_bedroom', 'swing_mode', 'stopped', sensibo())).toMatchObject({
      service: 'set_swing_mode',
      data: { swing_mode: 'stopped' },
    });
    expect(
      climateSheetCall('climate.steven_bedroom', 'swing_horizontal_mode', 'stopped', sensibo()),
    ).toMatchObject({
      service: 'set_swing_horizontal_mode',
      data: { swing_horizontal_mode: 'stopped' },
    });
  });

  it('routes target humidity to the entity’s own domain', () => {
    expect(
      climateSheetCall('humidifier.dmaker_22ht_b0bf_dehumidifier', 'target_humidity', 55, dehumidifier()),
    ).toEqual({
      domain: 'humidifier',
      service: 'set_humidity',
      data: { entity_id: 'humidifier.dmaker_22ht_b0bf_dehumidifier', humidity: 55 },
    });
    expect(climateSheetCall('climate.a', 'target_humidity', 55, undefined)).toMatchObject({
      domain: 'climate',
      service: 'set_humidity',
    });
  });

  it('sets a humidifier mode', () => {
    expect(
      climateSheetCall('humidifier.dmaker_22ht_b0bf_dehumidifier', 'humidifier_mode', 'Smart', dehumidifier()),
    ).toMatchObject({ domain: 'humidifier', service: 'set_mode', data: { mode: 'Smart' } });
  });

  it('never fires a call for a value of the wrong shape', () => {
    expect(climateSheetCall('climate.a', 'hvac_mode', 3, tp09())).toBeUndefined();
    expect(climateSheetCall('climate.a', 'temperature', 'warm', tp09())).toBeUndefined();
  });
});
