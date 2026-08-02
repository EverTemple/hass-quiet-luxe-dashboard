import { describe, expect, it } from 'vitest';
import { makeEntity } from '../testing/mock-hass';
import {
  adjustSetpoints,
  canAdjust,
  nextSetpoint,
  quickAdjustStep,
  QUICK_ADJUST_COMMIT_DELAY_MS,
  QUICK_ADJUST_REPEAT_DELAY_MS,
  QUICK_ADJUST_REPEAT_INTERVAL_MS,
} from './quick-adjust';
import { DEFAULT_TEMP_STEP } from './climate-dial';

const scale = { min: 17, max: 30, step: 1 };
const halfStep = { min: 16, max: 30, step: 0.5 };

describe('quickAdjustStep', () => {
  it('reads the entity own target_temp_step', () => {
    const entity = makeEntity('climate.bedroom', 'cool', { target_temp_step: 1 });
    expect(quickAdjustStep(entity)).toBe(1);
  });

  it('falls back to the HA default when the entity publishes none', () => {
    const entity = makeEntity('climate.tp09', 'off', { min_temp: 1, max_temp: 37 });
    expect(quickAdjustStep(entity)).toBe(DEFAULT_TEMP_STEP);
  });

  it('rejects a non-positive step rather than dividing the band by zero', () => {
    const entity = makeEntity('climate.odd', 'cool', { target_temp_step: 0 });
    expect(quickAdjustStep(entity)).toBe(DEFAULT_TEMP_STEP);
  });
});

describe('nextSetpoint', () => {
  it('moves one step in either direction', () => {
    expect(nextSetpoint(scale, 21, 1)).toBe(22);
    expect(nextSetpoint(scale, 21, -1)).toBe(20);
  });

  it('snaps a half-step grid without float noise', () => {
    expect(nextSetpoint(halfStep, 21.5, 1)).toBe(22);
    expect(nextSetpoint(halfStep, 21.5, -1)).toBe(21);
  });

  it('holds at the band edges', () => {
    expect(nextSetpoint(scale, 30, 1)).toBe(30);
    expect(nextSetpoint(scale, 17, -1)).toBe(17);
  });

  it('snaps an off-grid reading onto the entity own grid', () => {
    expect(nextSetpoint(scale, 21.4, 1)).toBe(22);
  });
});

describe('adjustSetpoints — single', () => {
  it('moves the one value', () => {
    expect(adjustSetpoints(scale, { kind: 'single', value: 21 }, 1)).toEqual({
      kind: 'single',
      value: 22,
    });
  });

  it('returns undefined at the maximum', () => {
    expect(adjustSetpoints(scale, { kind: 'single', value: 30 }, 1)).toBeUndefined();
  });

  it('returns undefined at the minimum', () => {
    expect(adjustSetpoints(scale, { kind: 'single', value: 17 }, -1)).toBeUndefined();
  });

  it('still moves away from a limit it is sitting on', () => {
    expect(adjustSetpoints(scale, { kind: 'single', value: 30 }, -1)).toEqual({
      kind: 'single',
      value: 29,
    });
  });
});

describe('adjustSetpoints — range', () => {
  it('shifts the whole band, keeping its width', () => {
    expect(adjustSetpoints(scale, { kind: 'range', low: 20, high: 24 }, 1)).toEqual({
      kind: 'range',
      low: 21,
      high: 25,
    });
  });

  it('stops the band as a whole when the high end reaches the maximum', () => {
    expect(adjustSetpoints(scale, { kind: 'range', low: 26, high: 30 }, 1)).toBeUndefined();
  });

  it('stops the band as a whole when the low end reaches the minimum', () => {
    expect(adjustSetpoints(scale, { kind: 'range', low: 17, high: 21 }, -1)).toBeUndefined();
  });
});

describe('adjustSetpoints — nothing to adjust', () => {
  it('returns undefined for a dial with no setpoint', () => {
    expect(adjustSetpoints(scale, { kind: 'none' }, 1)).toBeUndefined();
  });

  it('returns undefined when a range is missing an end', () => {
    expect(adjustSetpoints(scale, { kind: 'range', low: 20 }, 1)).toBeUndefined();
  });
});

describe('canAdjust', () => {
  it('is true in the middle of the band and false at the edge', () => {
    expect(canAdjust(scale, { kind: 'single', value: 21 }, 1)).toBe(true);
    expect(canAdjust(scale, { kind: 'single', value: 30 }, 1)).toBe(false);
  });
});

describe('timings', () => {
  it('waits longer before repeating than between repeats', () => {
    expect(QUICK_ADJUST_REPEAT_DELAY_MS).toBeGreaterThan(QUICK_ADJUST_REPEAT_INTERVAL_MS);
  });

  it('holds a commit for at least one repeat interval so a burst is one call', () => {
    expect(QUICK_ADJUST_COMMIT_DELAY_MS).toBeGreaterThan(QUICK_ADJUST_REPEAT_INTERVAL_MS);
  });
});
