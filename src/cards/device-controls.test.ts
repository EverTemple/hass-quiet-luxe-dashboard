import { describe, expect, it } from 'vitest';
import { makeEntity } from '../testing/mock-hass';
import {
  controlServiceCall,
  deviceControls,
  optionLabel,
  titleCase,
  type ControlId,
  type DeviceControl,
} from './device-controls';

/* Live shapes from the Tung Chung instance (HA 2026.7.1). */

const sensibo = makeEntity('climate.steven_bedroom', 'cool', {
  hvac_modes: ['cool', 'heat', 'fan_only', 'dry', 'heat_cool', 'off'],
  min_temp: 17,
  max_temp: 30,
  target_temp_step: 1,
  fan_modes: ['quiet', 'low', 'medium', 'high', 'auto', 'strong'],
  swing_modes: ['stopped', 'rangefull'],
  current_temperature: 21.9,
  temperature: 23,
  fan_mode: 'low',
  supported_features: 937,
});

const dysonClimate = makeEntity('climate.tp09', 'off', {
  hvac_modes: ['off', 'cool', 'heat'],
  min_temp: 1,
  max_temp: 37,
  current_temperature: 22.7,
  temperature: 27.0,
  supported_features: 385,
});

const dysonFan = makeEntity('fan.tp09', 'off', {
  preset_modes: ['Auto', 'Normal'],
  direction: 'forward',
  oscillating: true,
  percentage: 0,
  percentage_step: 10.0,
  preset_mode: 'Normal',
  angle_low: 142,
  angle_high: 187,
  supported_features: 63,
});

const dehumidifier = makeEntity('humidifier.dmaker_22ht_b0bf_dehumidifier', 'on', {
  min_humidity: 40,
  max_humidity: 70,
  available_modes: ['Off', 'Smart', 'Sleep', 'Clothes Drying'],
  current_humidity: 63,
  humidity: 60,
  mode: 'Clothes Drying',
  device_class: 'dehumidifier',
  supported_features: 1,
});

const dooya = makeEntity('cover.dooya_m1_fe9b_curtain', 'open', {
  current_position: 83,
  device_class: 'curtain',
  supported_features: 15,
});

function ids(controls: ReadonlyArray<DeviceControl>): ControlId[] {
  return controls.map((control) => control.id);
}

function byId(controls: ReadonlyArray<DeviceControl>, id: ControlId): DeviceControl {
  const found = controls.find((control) => control.id === id);
  if (found === undefined) {
    throw new Error(`no control ${id} in [${ids(controls).join(', ')}]`);
  }
  return found;
}

describe('deviceControls: climate', () => {
  it('gives the live Sensibo target temperature, mode and fan speed', () => {
    const controls = deviceControls(sensibo);
    expect(ids(controls)).toEqual(['temperature', 'hvac_mode', 'fan_mode']);

    expect(byId(controls, 'temperature')).toEqual({
      kind: 'stepper',
      id: 'temperature',
      labelKey: 'control.target',
      unit: '°',
      target: { value: 23, min: 17, max: 30, step: 1 },
    });
    expect(byId(controls, 'hvac_mode')).toMatchObject({
      kind: 'select',
      value: 'cool',
      options: ['cool', 'heat', 'fan_only', 'dry', 'heat_cool', 'off'],
    });
    expect(byId(controls, 'fan_mode')).toMatchObject({ kind: 'select', value: 'low' });
  });

  it('gives the live Dyson heat/cool mode and its wide setpoint', () => {
    const controls = deviceControls(dysonClimate);
    expect(ids(controls)).toEqual(['temperature', 'hvac_mode']);
    expect(byId(controls, 'hvac_mode')).toMatchObject({
      value: 'off',
      options: ['off', 'cool', 'heat'],
    });
    expect(byId(controls, 'temperature')).toMatchObject({
      target: { value: 27, min: 1, max: 37, step: 0.5 },
    });
  });

  it('omits fan speed for a climate entity that does not support it', () => {
    expect(ids(deviceControls(dysonClimate))).not.toContain('fan_mode');
  });

  it('offers presets only when the entity advertises them', () => {
    const withPreset = makeEntity('climate.a', 'heat', {
      hvac_modes: ['heat', 'off'],
      preset_modes: ['eco', 'comfort', 'boost'],
      preset_mode: 'eco',
      temperature: 21,
      supported_features: 1 | 16,
    });
    expect(ids(deviceControls(withPreset))).toEqual(['temperature', 'hvac_mode', 'preset_mode']);
    expect(byId(deviceControls(withPreset), 'preset_mode')).toMatchObject({ value: 'eco' });
  });

  it('still offers the mode select when the setpoint is missing', () => {
    const noSetpoint = makeEntity('climate.a', 'fan_only', {
      hvac_modes: ['fan_only', 'off'],
      supported_features: 384,
    });
    expect(ids(deviceControls(noSetpoint))).toEqual(['hvac_mode']);
  });
});

describe('deviceControls: fan', () => {
  it('gives the live TP09 speed, preset, oscillation, airflow and rotation', () => {
    const controls = deviceControls(dysonFan);
    expect(ids(controls)).toEqual([
      'percentage',
      'fan_preset',
      'oscillate',
      'direction',
      'angle',
    ]);

    expect(byId(controls, 'percentage')).toMatchObject({
      kind: 'slider',
      target: { value: 0, min: 0, max: 100, step: 10 },
    });
    expect(byId(controls, 'fan_preset')).toMatchObject({
      options: ['Auto', 'Normal'],
      value: 'Normal',
    });
    expect(byId(controls, 'oscillate')).toEqual({
      kind: 'toggle',
      id: 'oscillate',
      labelKey: 'control.oscillate',
      on: true,
    });
    expect(byId(controls, 'direction')).toMatchObject({
      options: ['forward', 'reverse'],
      value: 'forward',
    });
    expect(byId(controls, 'angle')).toEqual({
      kind: 'span',
      id: 'angle',
      labelKey: 'control.angle',
      spans: [45, 90, 180, 350],
      value: 45,
    });
  });

  it('degrades to nothing but speed for a plain fan', () => {
    const plain = makeEntity('fan.plain', 'on', {
      percentage: 50,
      supported_features: 1 | 16 | 32,
    });
    expect(ids(deviceControls(plain))).toEqual(['percentage']);
  });

  it('omits rotation for a fan that oscillates but reports no sweep', () => {
    const noAngle = makeEntity('fan.a', 'on', {
      oscillating: false,
      supported_features: 2,
    });
    expect(ids(deviceControls(noAngle))).toEqual(['oscillate']);
  });

  it('leaves rotation unselected when the sweep matches no offered span', () => {
    const odd = makeEntity('fan.a', 'on', {
      angle_low: 100,
      angle_high: 220,
      supported_features: 2,
    });
    expect(byId(deviceControls(odd), 'angle')).toMatchObject({ value: undefined });
  });
});

describe('deviceControls: humidifier', () => {
  it('gives the live dehumidifier its target humidity and modes', () => {
    const controls = deviceControls(dehumidifier);
    expect(ids(controls)).toEqual(['humidity', 'humidifier_mode']);

    expect(byId(controls, 'humidity')).toEqual({
      kind: 'stepper',
      id: 'humidity',
      labelKey: 'control.humidity',
      unit: '%',
      target: { value: 60, min: 40, max: 70, step: 1 },
    });
    expect(byId(controls, 'humidifier_mode')).toMatchObject({
      options: ['Off', 'Smart', 'Sleep', 'Clothes Drying'],
      value: 'Clothes Drying',
    });
  });

  it('omits modes for a humidifier that has none', () => {
    const bare = makeEntity('humidifier.a', 'on', { humidity: 50, supported_features: 0 });
    expect(ids(deviceControls(bare))).toEqual(['humidity']);
  });
});

describe('deviceControls: cover', () => {
  it('adds no tilt control for the live Dooya curtains', () => {
    expect(deviceControls(dooya)).toEqual([]);
  });

  it('adds tilt for a cover that supports it', () => {
    const blind = makeEntity('cover.blind', 'open', {
      current_position: 100,
      current_cover_tilt_position: 40,
      supported_features: 255,
    });
    expect(byId(deviceControls(blind), 'tilt')).toMatchObject({
      kind: 'slider',
      target: { value: 40, min: 0, max: 100, step: 1 },
    });
  });
});

describe('deviceControls: degradation', () => {
  it('draws nothing for an entity that is not answering', () => {
    expect(deviceControls(makeEntity('climate.a', 'unavailable', sensibo.attributes))).toEqual([]);
    expect(deviceControls(makeEntity('fan.a', 'unknown', dysonFan.attributes))).toEqual([]);
  });

  it('draws nothing for a missing entity', () => {
    expect(deviceControls(undefined)).toEqual([]);
  });

  it('draws nothing for a domain with no inline controls', () => {
    expect(deviceControls(makeEntity('switch.a', 'on'))).toEqual([]);
    expect(deviceControls(makeEntity('light.a', 'on'))).toEqual([]);
  });

  it('draws controls for a device that is off — a setpoint is still settable', () => {
    expect(ids(deviceControls(dysonClimate))).toContain('temperature');
    expect(ids(deviceControls(dysonFan))).toContain('percentage');
  });
});

describe('controlServiceCall', () => {
  it('sets a climate target temperature', () => {
    expect(controlServiceCall('climate.steven_bedroom', 'temperature', 24)).toEqual({
      domain: 'climate',
      service: 'set_temperature',
      data: { entity_id: 'climate.steven_bedroom', temperature: 24 },
    });
  });

  it('sets an hvac mode — this is how the TP09 gets heat or cool', () => {
    expect(controlServiceCall('climate.tp09', 'hvac_mode', 'heat')).toEqual({
      domain: 'climate',
      service: 'set_hvac_mode',
      data: { entity_id: 'climate.tp09', hvac_mode: 'heat' },
    });
  });

  it('sets climate fan and preset modes', () => {
    expect(controlServiceCall('climate.a', 'fan_mode', 'strong')).toEqual({
      domain: 'climate',
      service: 'set_fan_mode',
      data: { entity_id: 'climate.a', fan_mode: 'strong' },
    });
    expect(controlServiceCall('climate.a', 'preset_mode', 'eco')).toEqual({
      domain: 'climate',
      service: 'set_preset_mode',
      data: { entity_id: 'climate.a', preset_mode: 'eco' },
    });
  });

  it('sets humidifier target humidity and mode', () => {
    expect(
      controlServiceCall('humidifier.dmaker_22ht_b0bf_dehumidifier', 'humidity', 55),
    ).toEqual({
      domain: 'humidifier',
      service: 'set_humidity',
      data: { entity_id: 'humidifier.dmaker_22ht_b0bf_dehumidifier', humidity: 55 },
    });
    expect(
      controlServiceCall('humidifier.dmaker_22ht_b0bf_dehumidifier', 'humidifier_mode', 'Smart'),
    ).toEqual({
      domain: 'humidifier',
      service: 'set_mode',
      data: { entity_id: 'humidifier.dmaker_22ht_b0bf_dehumidifier', mode: 'Smart' },
    });
  });

  it('sets fan speed, preset, oscillation and airflow direction', () => {
    expect(controlServiceCall('fan.tp09', 'percentage', 40)).toEqual({
      domain: 'fan',
      service: 'set_percentage',
      data: { entity_id: 'fan.tp09', percentage: 40 },
    });
    expect(controlServiceCall('fan.tp09', 'fan_preset', 'Auto')).toEqual({
      domain: 'fan',
      service: 'set_preset_mode',
      data: { entity_id: 'fan.tp09', preset_mode: 'Auto' },
    });
    expect(controlServiceCall('fan.tp09', 'oscillate', false)).toEqual({
      domain: 'fan',
      service: 'oscillate',
      data: { entity_id: 'fan.tp09', oscillating: false },
    });
    expect(controlServiceCall('fan.tp09', 'direction', 'reverse')).toEqual({
      domain: 'fan',
      service: 'set_direction',
      data: { entity_id: 'fan.tp09', direction: 'reverse' },
    });
  });

  it('sets a cover tilt position', () => {
    expect(controlServiceCall('cover.blind', 'tilt', 30)).toEqual({
      domain: 'cover',
      service: 'set_cover_tilt_position',
      data: { entity_id: 'cover.blind', tilt_position: 30 },
    });
  });

  it('widens the live TP09 sweep around its midpoint', () => {
    expect(controlServiceCall('fan.tp09', 'angle', 90, dysonFan)).toEqual({
      domain: 'dyson_local',
      service: 'set_angle',
      data: { entity_id: 'fan.tp09', angle_low: 120, angle_high: 210 },
    });
  });

  it('sets the full-width sweep to the whole hardware range', () => {
    expect(controlServiceCall('fan.tp09', 'angle', 350, dysonFan)).toEqual({
      domain: 'dyson_local',
      service: 'set_angle',
      data: { entity_id: 'fan.tp09', angle_low: 5, angle_high: 355 },
    });
  });

  it('refuses a rotation change when the device reports no sweep', () => {
    expect(controlServiceCall('fan.a', 'angle', 90, makeEntity('fan.a', 'on'))).toBeUndefined();
    expect(controlServiceCall('fan.a', 'angle', 90)).toBeUndefined();
  });

  it('refuses a value of the wrong shape rather than sending a broken call', () => {
    expect(controlServiceCall('climate.a', 'temperature', 'warm')).toBeUndefined();
    expect(controlServiceCall('climate.a', 'hvac_mode', 21)).toBeUndefined();
    expect(controlServiceCall('fan.a', 'oscillate', 'yes')).toBeUndefined();
    expect(controlServiceCall('fan.a', 'direction', 'sideways')).toBeUndefined();
  });
});

describe('option labels', () => {
  it('localizes the hvac vocabulary', () => {
    expect(optionLabel('en', 'hvac_mode', 'heat_cool')).toBe('Auto');
    expect(optionLabel('en', 'hvac_mode', 'fan_only')).toBe('Fan');
    expect(optionLabel('en', 'hvac_mode', 'off')).toBe('Off');
    expect(optionLabel('zh-Hant', 'hvac_mode', 'cool')).toBe('製冷');
  });

  it('names the TP09’s airflow directions the way the user does', () => {
    expect(optionLabel('en', 'direction', 'forward')).toBe('Front');
    expect(optionLabel('en', 'direction', 'reverse')).toBe('Back');
    expect(optionLabel('zh-Hans', 'direction', 'forward')).toBe('前方');
  });

  it('title-cases vendor vocabulary rather than showing a raw token', () => {
    expect(optionLabel('en', 'fan_mode', 'quiet')).toBe('Quiet');
    expect(optionLabel('en', 'humidifier_mode', 'Clothes Drying')).toBe('Clothes Drying');
    expect(optionLabel('en', 'fan_preset', 'Normal')).toBe('Normal');
  });

  it('falls back to title case for an hvac mode outside the vocabulary', () => {
    expect(optionLabel('en', 'hvac_mode', 'super_eco')).toBe('Super Eco');
  });

  it('title-cases predictably', () => {
    expect(titleCase('clothes drying')).toBe('Clothes Drying');
    expect(titleCase('fan_only')).toBe('Fan Only');
    expect(titleCase('')).toBe('');
  });
});
