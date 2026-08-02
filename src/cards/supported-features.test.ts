import { describe, expect, it } from 'vitest';
import { makeEntity } from '../testing/mock-hass';
import {
  angleForSpan,
  ANGLE_MAX,
  ANGLE_MIN,
  ANGLE_SPANS,
  CLIMATE_FEATURE,
  climateTargetTemperature,
  COVER_FEATURE,
  coverTiltPosition,
  FAN_FEATURE,
  fanOscillationAngle,
  fanPercentage,
  HUMIDIFIER_FEATURE,
  humidifierTargetHumidity,
  nearestSpan,
  optionList,
  selectableOptions,
  snapToStep,
  supportsFeature,
} from './supported-features';

/*
 * The fixtures below are verbatim copies of what the live Tung Chung instance
 * (HA 2026.7.1) returns from GET /api/states, so the controls we generate are
 * tested against the devices they actually have to drive.
 */

/** Sensibo AC. supported_features 937 = 512|256|128|32|8|1. */
const sensibo = makeEntity('climate.steven_bedroom', 'cool', {
  hvac_modes: ['cool', 'heat', 'fan_only', 'dry', 'heat_cool', 'off'],
  min_temp: 17,
  max_temp: 30,
  target_temp_step: 1,
  fan_modes: ['quiet', 'low', 'medium', 'high', 'auto', 'strong'],
  swing_modes: ['stopped', 'rangefull'],
  swing_horizontal_modes: ['stopped', 'rangefull'],
  current_temperature: 21.9,
  temperature: 23,
  fan_mode: 'low',
  supported_features: 937,
});

/** Dyson TP09 climate half. supported_features 385 = 256|128|1. */
const dysonClimate = makeEntity('climate.tp09', 'off', {
  hvac_modes: ['off', 'cool', 'heat'],
  min_temp: 1,
  max_temp: 37,
  current_temperature: 22.7,
  temperature: 27.0,
  hvac_action: 'off',
  supported_features: 385,
});

/** Dyson TP09 fan half. supported_features 63 = every fan feature. */
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

/** Xiaomi dehumidifier. supported_features 1 = MODES. */
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

/** Dooya curtain motor. supported_features 15 = OPEN|CLOSE|SET_POSITION|STOP. */
const dooya = makeEntity('cover.dooya_m1_fe9b_curtain', 'open', {
  current_position: 83,
  device_class: 'curtain',
  supported_features: 15,
});

describe('supportsFeature', () => {
  it('decodes the live Sensibo bitmask 937', () => {
    expect(supportsFeature(sensibo, CLIMATE_FEATURE.TARGET_TEMPERATURE)).toBe(true);
    expect(supportsFeature(sensibo, CLIMATE_FEATURE.FAN_MODE)).toBe(true);
    expect(supportsFeature(sensibo, CLIMATE_FEATURE.SWING_MODE)).toBe(true);
    expect(supportsFeature(sensibo, CLIMATE_FEATURE.SWING_HORIZONTAL_MODE)).toBe(true);
    expect(supportsFeature(sensibo, CLIMATE_FEATURE.TURN_ON)).toBe(true);
    expect(supportsFeature(sensibo, CLIMATE_FEATURE.PRESET_MODE)).toBe(false);
    expect(supportsFeature(sensibo, CLIMATE_FEATURE.TARGET_HUMIDITY)).toBe(false);
    expect(supportsFeature(sensibo, CLIMATE_FEATURE.TARGET_TEMPERATURE_RANGE)).toBe(false);
  });

  it('decodes the live Dyson climate bitmask 385', () => {
    expect(supportsFeature(dysonClimate, CLIMATE_FEATURE.TARGET_TEMPERATURE)).toBe(true);
    expect(supportsFeature(dysonClimate, CLIMATE_FEATURE.FAN_MODE)).toBe(false);
    expect(supportsFeature(dysonClimate, CLIMATE_FEATURE.SWING_MODE)).toBe(false);
  });

  it('decodes the live Dyson fan bitmask 63 as every fan feature', () => {
    for (const feature of Object.values(FAN_FEATURE)) {
      expect(supportsFeature(dysonFan, feature)).toBe(true);
    }
  });

  it('decodes the live dehumidifier bitmask 1', () => {
    expect(supportsFeature(dehumidifier, HUMIDIFIER_FEATURE.MODES)).toBe(true);
  });

  it('decodes the live Dooya bitmask 15 as position but no tilt', () => {
    expect(supportsFeature(dooya, COVER_FEATURE.SET_POSITION)).toBe(true);
    expect(supportsFeature(dooya, COVER_FEATURE.STOP)).toBe(true);
    expect(supportsFeature(dooya, COVER_FEATURE.SET_TILT_POSITION)).toBe(false);
    expect(supportsFeature(dooya, COVER_FEATURE.OPEN_TILT)).toBe(false);
  });

  it('requires every bit of a composite feature to be set', () => {
    const entity = makeEntity('cover.a', 'open', { supported_features: 1 });
    expect(supportsFeature(entity, COVER_FEATURE.OPEN)).toBe(true);
    expect(supportsFeature(entity, COVER_FEATURE.OPEN | COVER_FEATURE.CLOSE)).toBe(false);
  });

  it('is false when supported_features is missing or unparseable', () => {
    expect(supportsFeature(undefined, 1)).toBe(false);
    expect(supportsFeature(makeEntity('fan.a', 'on'), FAN_FEATURE.SET_SPEED)).toBe(false);
    expect(
      supportsFeature(makeEntity('fan.a', 'on', { supported_features: 'lots' }), 1),
    ).toBe(false);
  });
});

describe('climateTargetTemperature', () => {
  it('reads the live Sensibo setpoint and its own bounds and step', () => {
    expect(climateTargetTemperature(sensibo)).toEqual({
      value: 23,
      min: 17,
      max: 30,
      step: 1,
    });
  });

  it('reads the live Dyson setpoint with its much wider range', () => {
    expect(climateTargetTemperature(dysonClimate)).toEqual({
      value: 27,
      min: 1,
      max: 37,
      step: 0.5,
    });
  });

  it('is undefined when the entity cannot set a single setpoint', () => {
    const rangeOnly = makeEntity('climate.a', 'heat_cool', {
      target_temp_low: 18,
      target_temp_high: 24,
      supported_features: CLIMATE_FEATURE.TARGET_TEMPERATURE_RANGE,
    });
    expect(climateTargetTemperature(rangeOnly)).toBeUndefined();
  });

  it('is undefined when the setpoint has not been reported yet', () => {
    const pending = makeEntity('climate.a', 'cool', {
      supported_features: CLIMATE_FEATURE.TARGET_TEMPERATURE,
      temperature: null,
    });
    expect(climateTargetTemperature(pending)).toBeUndefined();
  });

  it('falls back to HA’s default bounds when the entity omits them', () => {
    const sparse = makeEntity('climate.a', 'cool', {
      temperature: 21,
      supported_features: CLIMATE_FEATURE.TARGET_TEMPERATURE,
    });
    expect(climateTargetTemperature(sparse)).toEqual({ value: 21, min: 7, max: 35, step: 0.5 });
  });
});

describe('humidifierTargetHumidity', () => {
  it('reads the live dehumidifier target and its 40–70% hardware range', () => {
    expect(humidifierTargetHumidity(dehumidifier)).toEqual({
      value: 60,
      min: 40,
      max: 70,
      step: 1,
    });
  });

  it('is undefined when no target humidity is reported', () => {
    expect(humidifierTargetHumidity(makeEntity('humidifier.a', 'on'))).toBeUndefined();
  });
});

describe('fanPercentage', () => {
  it('reads the live Dyson speed with its 10% step', () => {
    expect(fanPercentage(dysonFan)).toEqual({ value: 0, min: 0, max: 100, step: 10 });
  });

  it('is undefined for a fan that cannot set a speed', () => {
    const onOff = makeEntity('fan.a', 'on', {
      supported_features: FAN_FEATURE.OSCILLATE,
    });
    expect(fanPercentage(onOff)).toBeUndefined();
  });

  it('falls back to a 1% step when the fan omits percentage_step', () => {
    const noStep = makeEntity('fan.a', 'on', {
      percentage: 40,
      supported_features: FAN_FEATURE.SET_SPEED,
    });
    expect(fanPercentage(noStep)).toEqual({ value: 40, min: 0, max: 100, step: 1 });
  });
});

describe('coverTiltPosition', () => {
  it('is undefined for the live Dooya curtains, which do not tilt', () => {
    expect(coverTiltPosition(dooya)).toBeUndefined();
  });

  it('reads tilt for a venetian blind that supports it', () => {
    const blind = makeEntity('cover.blind', 'open', {
      current_position: 100,
      current_cover_tilt_position: 40,
      device_class: 'blind',
      supported_features: 255,
    });
    expect(coverTiltPosition(blind)).toEqual({ value: 40, min: 0, max: 100, step: 1 });
  });

  it('reports 0 when a tilt-capable cover has not reported a tilt yet', () => {
    const blind = makeEntity('cover.blind', 'open', {
      supported_features: COVER_FEATURE.SET_TILT_POSITION,
    });
    expect(coverTiltPosition(blind)?.value).toBe(0);
  });
});

describe('optionList / selectableOptions', () => {
  it('reads the live option lists', () => {
    expect(optionList(sensibo, 'hvac_modes')).toEqual([
      'cool',
      'heat',
      'fan_only',
      'dry',
      'heat_cool',
      'off',
    ]);
    expect(optionList(dysonFan, 'preset_modes')).toEqual(['Auto', 'Normal']);
    expect(optionList(dehumidifier, 'available_modes')).toEqual([
      'Off',
      'Smart',
      'Sleep',
      'Clothes Drying',
    ]);
  });

  it('returns an empty list for a missing or malformed attribute', () => {
    expect(optionList(sensibo, 'preset_modes')).toEqual([]);
    expect(optionList(makeEntity('climate.a', 'cool', { hvac_modes: 'cool' }), 'hvac_modes')).toEqual(
      [],
    );
  });

  it('drops non-string entries rather than rendering blank segments', () => {
    const messy = makeEntity('fan.a', 'on', { preset_modes: ['Auto', '', null, 7, 'Eco'] });
    expect(optionList(messy, 'preset_modes')).toEqual(['Auto', 'Eco']);
  });

  it('gates on the feature bit when one is given', () => {
    expect(selectableOptions(sensibo, 'fan_modes', CLIMATE_FEATURE.FAN_MODE)).toHaveLength(6);
    expect(selectableOptions(dysonClimate, 'fan_modes', CLIMATE_FEATURE.FAN_MODE)).toEqual([]);
  });

  it('suppresses a control that offers no real choice', () => {
    const single = makeEntity('fan.a', 'on', {
      preset_modes: ['Auto'],
      supported_features: FAN_FEATURE.PRESET_MODE,
    });
    expect(selectableOptions(single, 'preset_modes', FAN_FEATURE.PRESET_MODE)).toEqual([]);
  });
});

describe('snapToStep', () => {
  const target = { value: 23, min: 17, max: 30, step: 1 };

  it('clamps to the entity’s own bounds', () => {
    expect(snapToStep(target, 99)).toBe(30);
    expect(snapToStep(target, -5)).toBe(17);
  });

  it('snaps onto the step grid measured from min', () => {
    expect(snapToStep({ value: 20, min: 17, max: 30, step: 0.5 }, 20.3)).toBe(20.5);
    expect(snapToStep({ value: 20, min: 0, max: 100, step: 10 }, 44)).toBe(40);
  });

  it('keeps half-degree grids free of float noise', () => {
    expect(snapToStep({ value: 21, min: 7, max: 35, step: 0.5 }, 21.5)).toBe(21.5);
    expect(snapToStep({ value: 21, min: 7, max: 35, step: 0.1 }, 21.3)).toBe(21.3);
  });

  it('treats a zero or negative step as 1 rather than dividing by zero', () => {
    expect(snapToStep({ value: 5, min: 0, max: 10, step: 0 }, 7.4)).toBe(7);
  });
});

describe('fan oscillation angle', () => {
  it('reads the live TP09 sweep as a 45° span', () => {
    expect(fanOscillationAngle(dysonFan)).toEqual({ low: 142, high: 187, span: 45 });
    expect(nearestSpan({ low: 142, high: 187, span: 45 })).toBe(45);
  });

  it('is undefined for a fan that reports no sweep, which is every non-Dyson fan', () => {
    expect(fanOscillationAngle(makeEntity('fan.a', 'on', { oscillating: true }))).toBeUndefined();
    expect(fanOscillationAngle(undefined)).toBeUndefined();
  });

  it('is undefined when the reported sweep is inverted', () => {
    const broken = makeEntity('fan.a', 'on', { angle_low: 200, angle_high: 100 });
    expect(fanOscillationAngle(broken)).toBeUndefined();
  });

  it('widens the live sweep around its midpoint', () => {
    const current = { low: 142, high: 187, span: 45 };
    // midpoint 164.5 → 90° sweep centred on it
    expect(angleForSpan(current, 90)).toEqual({ low: 120, high: 210, span: 90 });
    expect(angleForSpan(current, 180)).toEqual({ low: 75, high: 255, span: 180 });
  });

  it('slides a wide sweep inside the hardware range instead of narrowing it', () => {
    const nearTop = { low: 300, high: 345, span: 45 };
    const widened = angleForSpan(nearTop, 180);
    expect(widened.span).toBe(180);
    expect(widened.high).toBeLessThanOrEqual(ANGLE_MAX);
    expect(widened.low).toBeGreaterThanOrEqual(ANGLE_MIN);
    expect(widened).toEqual({ low: 175, high: 355, span: 180 });
  });

  it('pins the full-width sweep to the whole hardware range', () => {
    expect(angleForSpan({ low: 142, high: 187, span: 45 }, 350)).toEqual({
      low: ANGLE_MIN,
      high: ANGLE_MAX,
      span: 350,
    });
  });

  it('never exceeds the hardware range even if asked for more', () => {
    const full = angleForSpan({ low: 10, high: 20, span: 10 }, 999);
    expect(full).toEqual({ low: ANGLE_MIN, high: ANGLE_MAX, span: ANGLE_MAX - ANGLE_MIN });
  });

  it('offers the sweeps Dyson’s own app offers', () => {
    expect(ANGLE_SPANS).toEqual([45, 90, 180, 350]);
  });

  it('matches a live sweep to a span with rounding tolerance, else nothing', () => {
    expect(nearestSpan({ low: 5, high: 355, span: 350 })).toBe(350);
    expect(nearestSpan({ low: 100, high: 191, span: 91 })).toBe(90);
    expect(nearestSpan({ low: 100, high: 220, span: 120 })).toBeUndefined();
  });
});
