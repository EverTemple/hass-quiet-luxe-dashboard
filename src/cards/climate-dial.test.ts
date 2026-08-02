import { describe, expect, it } from 'vitest';
import type { HassEntity } from '../types/home-assistant';
import {
  ambientTemperature,
  angleForOffset,
  angleForValue,
  cardHvacModes,
  arcPath,
  clampRange,
  climateScale,
  DEFAULT_TEMP_STEP,
  DIAL_DESIGN_MAX,
  DIAL_DESIGN_MIN,
  DIAL_START_ANGLE,
  DIAL_SWEEP,
  dialMode,
  dialSetpoints,
  fineTickValues,
  hasDialSetpoint,
  normaliseAngle,
  nudgeValue,
  polarPoint,
  setTemperatureCall,
  tickInterval,
  tickValues,
  valueForAngle,
  type DialScale,
} from './climate-dial';

function entity(state: string, attributes: Record<string, unknown>): HassEntity {
  return {
    entity_id: 'climate.test',
    state,
    attributes,
  } as unknown as HassEntity;
}

/** The design's own band: 15–30 over 270° is 18° per degree. */
const DESIGN: DialScale = { min: DIAL_DESIGN_MIN, max: DIAL_DESIGN_MAX, step: 0.5 };
/** Live: climate.steven_bedroom (Sensibo). */
const SENSIBO: DialScale = { min: 17, max: 30, step: 1 };
/** Live: climate.tp09 — a 36-degree band with no published step. */
const TP09: DialScale = { min: 1, max: 37, step: DEFAULT_TEMP_STEP };

describe('dial geometry', () => {
  it('opens the ring at the bottom', () => {
    expect(DIAL_START_ANGLE).toBe(135);
    expect(DIAL_SWEEP).toBe(270);
    // 135 + 270 = 405 = 45: the track ends lower-right, mirroring its start.
    expect(normaliseAngle(DIAL_START_ANGLE + DIAL_SWEEP)).toBe(45);
  });

  it('maps the design band at 18 degrees per degree Celsius', () => {
    expect(angleForValue(DESIGN, 15)).toBeCloseTo(135, 10);
    expect(angleForValue(DESIGN, 16)).toBeCloseTo(153, 10);
    expect(angleForValue(DESIGN, 22.5)).toBeCloseTo(270, 10);
    expect(angleForValue(DESIGN, 30)).toBeCloseTo(405, 10);
  });

  it('rescales to whatever band the entity reports', () => {
    // Sensibo's 17–30 is 13 degrees over 270°.
    expect(angleForValue(SENSIBO, 17)).toBeCloseTo(135, 10);
    expect(angleForValue(SENSIBO, 30)).toBeCloseTo(405, 10);
    expect(angleForValue(SENSIBO, 23.5)).toBeCloseTo(270, 10);
    // TP09's 1–37 is 36 degrees over the same sweep.
    expect(angleForValue(TP09, 19)).toBeCloseTo(270, 10);
  });

  it('clamps a value outside the band to the ends of the track', () => {
    expect(angleForValue(SENSIBO, 5)).toBeCloseTo(135, 10);
    expect(angleForValue(SENSIBO, 99)).toBeCloseTo(405, 10);
  });

  it('reads an angle back to a value on the step grid', () => {
    expect(valueForAngle(SENSIBO, 135)).toBe(17);
    expect(valueForAngle(SENSIBO, 405)).toBe(30);
    expect(valueForAngle(SENSIBO, 270)).toBe(24);
    // Half a degree of arc must still land on the entity's 1° grid.
    expect(valueForAngle(SENSIBO, 272)).toBe(24);
  });

  it('round-trips every value on the grid', () => {
    for (let value = SENSIBO.min; value <= SENSIBO.max; value += SENSIBO.step) {
      expect(valueForAngle(SENSIBO, angleForValue(SENSIBO, value))).toBe(value);
    }
  });

  it('snaps a fractional-grid device to its half degrees', () => {
    const angle = angleForValue(TP09, 27.3);
    expect(valueForAngle(TP09, angle)).toBe(27.5);
  });

  it('parks a drag into the gap under the dial at the nearer end', () => {
    // The gap runs 45°→135° clockwise; its midpoint is 90° (straight down).
    expect(valueForAngle(SENSIBO, 60)).toBe(30);
    expect(valueForAngle(SENSIBO, 120)).toBe(17);
    expect(valueForAngle(SENSIBO, 89)).toBe(30);
    expect(valueForAngle(SENSIBO, 91)).toBe(17);
  });

  it('reads a pointer offset as a clockwise screen angle', () => {
    expect(angleForOffset(10, 0)).toBeCloseTo(0, 10);
    expect(angleForOffset(0, 10)).toBeCloseTo(90, 10);
    expect(angleForOffset(-10, 0)).toBeCloseTo(180, 10);
    expect(angleForOffset(0, -10)).toBeCloseTo(270, 10);
    expect(angleForOffset(-10, 10)).toBeCloseTo(135, 10);
  });

  it('places a point on the circle clockwise from +x', () => {
    const [x, y] = polarPoint(110, 110, 103, 270);
    expect(x).toBeCloseTo(110, 6);
    expect(y).toBeCloseTo(7, 6);
  });

  it('draws the full track as a large arc and a short one as a small arc', () => {
    expect(arcPath(110, 110, 103, 135, 405)).toContain(' 0 1 1 ');
    expect(arcPath(110, 110, 103, 135, 200)).toContain(' 0 0 1 ');
  });
});

describe('dial ticks', () => {
  it('ticks the design band every degree', () => {
    expect(tickInterval(DESIGN)).toBe(1);
    expect(tickValues(DESIGN)).toHaveLength(16);
  });

  it('coarsens the interval rather than crowding a wide band', () => {
    expect(tickInterval({ min: 45, max: 95, step: 1 })).toBe(2);
    expect(tickValues({ min: 45, max: 95, step: 1 }).length).toBeLessThanOrEqual(41);
  });

  it('keeps the live TP09 band on single degrees', () => {
    expect(tickInterval(TP09)).toBe(1);
  });

  it('draws finer ticks only around the setpoint', () => {
    const fine = fineTickValues(SENSIBO, 23);
    expect(fine[0]).toBe(21);
    expect(fine[fine.length - 1]).toBe(25);
    expect(fine).toContain(23.25);
  });

  it('never draws a fine tick past the ends of the band', () => {
    for (const value of fineTickValues(SENSIBO, 17)) {
      expect(value).toBeGreaterThanOrEqual(SENSIBO.min);
      expect(value).toBeLessThanOrEqual(SENSIBO.max);
    }
  });
});

describe('scale from the entity', () => {
  it('reads the live Sensibo band and step', () => {
    expect(
      climateScale(entity('cool', { min_temp: 17, max_temp: 30, target_temp_step: 1 })),
    ).toEqual({ min: 17, max: 30, step: 1 });
  });

  it('falls back to HA’s default step when the device omits one', () => {
    // climate.tp09 publishes no target_temp_step.
    expect(climateScale(entity('cool', { min_temp: 1, max_temp: 37 }))).toEqual({
      min: 1,
      max: 37,
      step: DEFAULT_TEMP_STEP,
    });
  });

  it('refuses a degenerate band rather than dividing by zero', () => {
    expect(climateScale(entity('cool', { min_temp: 20, max_temp: 20 }))).toMatchObject({
      min: DIAL_DESIGN_MIN,
      max: DIAL_DESIGN_MAX,
    });
    expect(climateScale(undefined)).toMatchObject({ min: DIAL_DESIGN_MIN, max: DIAL_DESIGN_MAX });
  });
});

describe('dial mode', () => {
  it('follows the entity’s hvac mode', () => {
    expect(dialMode(entity('heat', {}))).toBe('heat');
    expect(dialMode(entity('cool', {}))).toBe('cool');
    expect(dialMode(entity('off', {}))).toBe('off');
  });

  it('treats heat_cool and auto as the two-grip dial', () => {
    expect(dialMode(entity('heat_cool', {}))).toBe('heat_cool');
    expect(dialMode(entity('auto', {}))).toBe('heat_cool');
  });

  it('does not colour a mode it has no palette for', () => {
    expect(dialMode(entity('dry', {}))).toBe('other');
    expect(dialMode(entity('fan_only', {}))).toBe('other');
  });
});

describe('setpoints from the entity', () => {
  it('reads the live Sensibo single setpoint', () => {
    expect(dialSetpoints(entity('cool', { supported_features: 937, temperature: 23 }))).toEqual({
      kind: 'single',
      value: 23,
    });
  });

  it('reads the live TP09 single setpoint', () => {
    expect(dialSetpoints(entity('cool', { supported_features: 385, temperature: 27 }))).toEqual({
      kind: 'single',
      value: 27,
    });
  });

  it('prefers the range pair when the device supports one', () => {
    expect(
      dialSetpoints(
        entity('heat_cool', {
          supported_features: 3,
          temperature: 23,
          target_temp_low: 21,
          target_temp_high: 25,
        }),
      ),
    ).toEqual({ kind: 'range', low: 21, high: 25 });
  });

  it('reports none for a device with no setpoint at all', () => {
    // A purifier's climate entity: turn on/off only.
    expect(dialSetpoints(entity('cool', { supported_features: 384 }))).toEqual({ kind: 'none' });
    expect(hasDialSetpoint(entity('cool', { supported_features: 384 }))).toBe(false);
  });

  it('reports none rather than a confident zero for an unreported setpoint', () => {
    expect(dialSetpoints(entity('cool', { supported_features: 1, temperature: null }))).toEqual({
      kind: 'none',
    });
  });

  it('reads the ambient temperature the centre stack shows', () => {
    expect(ambientTemperature(entity('cool', { current_temperature: 21.9 }))).toBe(21.9);
    expect(ambientTemperature(entity('cool', {}))).toBeUndefined();
  });
});

describe('service payloads', () => {
  it('sends a single setpoint as temperature', () => {
    expect(setTemperatureCall('climate.tp09', { temperature: 27.5 })).toEqual({
      domain: 'climate',
      service: 'set_temperature',
      data: { entity_id: 'climate.tp09', temperature: 27.5 },
    });
  });

  it('sends a range as the low/high pair', () => {
    expect(
      setTemperatureCall('climate.a', { targetLow: 21, targetHigh: 25 }),
    ).toEqual({
      domain: 'climate',
      service: 'set_temperature',
      data: { entity_id: 'climate.a', target_temp_low: 21, target_temp_high: 25 },
    });
  });

  it('never fires an empty call', () => {
    expect(setTemperatureCall('climate.a', {})).toBeUndefined();
  });
});

describe('range clamping', () => {
  it('leaves a healthy band alone', () => {
    expect(clampRange(SENSIBO, 21, 25, 'low')).toEqual({ low: 21, high: 25 });
  });

  it('holds the low end a step below the high one', () => {
    expect(clampRange(SENSIBO, 26, 25, 'low')).toEqual({ low: 24, high: 25 });
  });

  it('holds the high end a step above the low one', () => {
    expect(clampRange(SENSIBO, 21, 20, 'high')).toEqual({ low: 21, high: 22 });
  });
});

describe('keyboard nudges', () => {
  it('moves by the entity’s own step', () => {
    expect(nudgeValue(SENSIBO, 23, 1, false)).toBe(24);
    expect(nudgeValue(TP09, 27, 1, false)).toBe(27.5);
  });

  it('moves further with shift held', () => {
    expect(nudgeValue(SENSIBO, 23, 1, true)).toBe(28);
    expect(nudgeValue(TP09, 27, -1, true)).toBe(24.5);
  });

  it('never leaves the entity’s band', () => {
    expect(nudgeValue(SENSIBO, 30, 1, true)).toBe(30);
    expect(nudgeValue(SENSIBO, 17, -1, false)).toBe(17);
  });
});

describe('the card’s own mode row', () => {
  const SENSIBO_MODES = ['cool', 'heat', 'fan_only', 'dry', 'heat_cool', 'off'];

  it('keeps a six-mode device to the four the card has room for', () => {
    // A half-column card is ~230px: six equal pills leave 19px of text each.
    expect(cardHvacModes(SENSIBO_MODES, 'cool')).toEqual(['cool', 'heat', 'heat_cool', 'off']);
  });

  it('leads with the active mode when it is not one of the four', () => {
    expect(cardHvacModes(SENSIBO_MODES, 'dry')).toEqual([
      'dry',
      'cool',
      'heat',
      'heat_cool',
      'off',
    ]);
  });

  it('passes a short list through untouched', () => {
    expect(cardHvacModes(['off', 'cool', 'heat'], 'cool')).toEqual(['off', 'cool', 'heat']);
  });

  it('never invents a mode the device does not have', () => {
    expect(cardHvacModes(['off', 'cool'], 'unavailable')).toEqual(['off', 'cool']);
    expect(cardHvacModes([], 'cool')).toEqual([]);
  });
});
