import { describe, expect, it } from 'vitest';
import { makeEntity } from '../testing/mock-hass';
import {
  ANGLE_SERVICE,
  MAX_SWEEP,
  TIMER_MAX_MINUTES,
  TIMER_PRESETS,
  TIMER_SERVICE,
  airflowCall,
  autoPresetOf,
  deviceBearing,
  dialButtonsFor,
  fanCapabilities,
  fanSpeedStep,
  hvacCall,
  isMinSweep,
  nightModeCall,
  normaliseSweep,
  oscillationCall,
  powerCall,
  presetCall,
  speedCall,
  sweepAim,
  sweepAimDrag,
  sweepBearing,
  sweepFromFront,
  sweepHandleDrag,
  sweepNudge,
  sweepRotate,
  timerCall,
  timerLabel,
  unwrapBearing,
} from './fan-capabilities';
import type { FanEntities } from './fan-capabilities';

/** Live Tung Chung TP09, HA 2026.7.1 (probed 2026-08-02). */
const FAN = makeEntity('fan.tp09', 'on', {
  preset_modes: ['Auto', 'Normal'],
  direction: 'forward',
  oscillating: true,
  percentage: 20,
  percentage_step: 10,
  preset_mode: 'Normal',
  angle_low: 5,
  angle_high: 355,
  friendly_name: 'TP09',
  supported_features: 63,
});

const CLIMATE = makeEntity('climate.tp09', 'cool', {
  hvac_modes: ['off', 'cool', 'heat'],
  min_temp: 1,
  max_temp: 37,
  current_temperature: 24.2,
  temperature: 27,
  friendly_name: 'TP09',
  supported_features: 385,
});

const NIGHT = makeEntity('switch.tp09_night_mode', 'off', { friendly_name: 'TP09 Night Mode' });

const SERVICES = { dyson_local: { set_angle: {}, set_timer: {} } };

function entities(overrides: Partial<FanEntities> = {}): FanEntities {
  return {
    fan: FAN,
    climate: CLIMATE,
    nightMode: NIGHT,
    services: SERVICES,
    platform: 'dyson_local',
    ...overrides,
  };
}

describe('fanCapabilities', () => {
  it('reads every capability the live TP09 reports', () => {
    const caps = fanCapabilities(entities());
    expect(caps).toMatchObject({
      power: true,
      speed: true,
      autoPreset: true,
      oscillation: true,
      direction: true,
      cooling: true,
      heating: true,
      night: true,
      timer: true,
    });
  });

  it('drops speed, oscillation and direction when the mask omits them', () => {
    const plain = makeEntity('fan.plain', 'on', { supported_features: 48 });
    const caps = fanCapabilities({ fan: plain });
    expect(caps.speed).toBe(false);
    expect(caps.oscillation).toBe(false);
    expect(caps.direction).toBe(false);
    expect(caps.power).toBe(true);
  });

  it('drops the auto preset when no preset is named auto', () => {
    const fan = makeEntity('fan.x', 'on', {
      supported_features: 63,
      preset_modes: ['Normal', 'Sleep'],
    });
    expect(fanCapabilities({ fan }).autoPreset).toBe(false);
  });

  it('gates cooling and heating on the climate entity actually offering the mode', () => {
    const coolOnly = makeEntity('climate.x', 'cool', { hvac_modes: ['off', 'cool'] });
    const caps = fanCapabilities(entities({ climate: coolOnly }));
    expect(caps.cooling).toBe(true);
    expect(caps.heating).toBe(false);
  });

  it('drops climate-backed controls entirely when there is no climate sibling', () => {
    const caps = fanCapabilities(entities({ climate: undefined }));
    expect(caps.cooling).toBe(false);
    expect(caps.heating).toBe(false);
  });

  it('drops night mode when the sibling switch is absent', () => {
    expect(fanCapabilities(entities({ nightMode: undefined })).night).toBe(false);
  });

  it('drops the timer when the integration does not register the service', () => {
    expect(fanCapabilities(entities({ services: {} })).timer).toBe(false);
    expect(fanCapabilities(entities({ services: undefined })).timer).toBe(false);
    expect(fanCapabilities(entities({ services: { dyson_local: {} } })).timer).toBe(false);
  });

  /**
   * hass.services is instance-wide, so the service has to be looked up under
   * the platform that actually provides this entity — otherwise one purifier
   * gives every fan in the house a timer dial that does nothing.
   */
  it('does not lend one integration’s timer service to another platform’s fan', () => {
    expect(fanCapabilities(entities({ platform: 'esphome' })).timer).toBe(false);
    expect(fanCapabilities(entities({ platform: undefined })).timer).toBe(false);
  });

  it('reports nothing for an unavailable fan', () => {
    const off = makeEntity('fan.tp09', 'unavailable', { supported_features: 63 });
    const caps = fanCapabilities(entities({ fan: off }));
    expect(caps.power).toBe(false);
    expect(caps.speed).toBe(false);
  });
});

describe('autoPresetOf', () => {
  it('matches the entity’s own capitalisation rather than a hard-coded string', () => {
    expect(autoPresetOf(FAN)).toEqual({ auto: 'Auto', manual: 'Normal' });
  });

  it('is undefined when the entity offers no auto preset', () => {
    expect(autoPresetOf(makeEntity('fan.x', 'on', { preset_modes: ['Normal'] }))).toBeUndefined();
  });
});

describe('dialButtonsFor', () => {
  it('lays the full grid out in Figma order and skips unsupported controls', () => {
    const full = dialButtonsFor(fanCapabilities(entities()), 'full');
    expect(full).toEqual([
      'power',
      'cooling',
      'auto',
      'speed',
      'heating',
      'oscillation',
      'timer',
      'night',
      'direction',
    ]);
  });

  it('compact keeps the three primaries plus More', () => {
    expect(dialButtonsFor(fanCapabilities(entities()), 'compact')).toEqual([
      'power',
      'auto',
      'oscillation',
      'more',
    ]);
  });

  it('omits dead buttons rather than rendering them', () => {
    const caps = fanCapabilities({ fan: makeEntity('fan.p', 'on', { supported_features: 48 }) });
    expect(dialButtonsFor(caps, 'full')).toEqual(['power']);
  });

  it('compact falls back to the next available primary when auto is unsupported', () => {
    const caps = fanCapabilities(
      entities({ fan: makeEntity('fan.x', 'on', { supported_features: 63 }) }),
    );
    expect(dialButtonsFor(caps, 'compact')).toEqual(['power', 'oscillation', 'speed', 'more']);
  });
});

describe('fanSpeedStep', () => {
  it('maps percentage to a 1..10 step using the entity step', () => {
    expect(fanSpeedStep(FAN)).toEqual({ step: 2, steps: 10 });
  });

  it('treats a zero percentage as step 0', () => {
    const idle = makeEntity('fan.x', 'off', { supported_features: 1, percentage: 0, percentage_step: 10 });
    expect(fanSpeedStep(idle)).toEqual({ step: 0, steps: 10 });
  });

  it('falls back to ten steps when the entity omits percentage_step', () => {
    const fan = makeEntity('fan.x', 'on', { supported_features: 1, percentage: 50 });
    expect(fanSpeedStep(fan)).toEqual({ step: 5, steps: 10 });
  });
});

describe('sweepFromFront', () => {
  it('reports a symmetric sweep as +/- half its span', () => {
    expect(sweepFromFront({ low: 135, high: 225, span: 90 })).toEqual({ start: -45, end: 45 });
  });

  it('reports the full-width sweep the live device is set to', () => {
    expect(sweepFromFront({ low: 5, high: 355, span: 350 })).toEqual({ start: -175, end: 175 });
  });

  it('reports an asymmetric sweep without re-centring it', () => {
    expect(sweepFromFront({ low: 142, high: 187, span: 45 })).toEqual({ start: -38, end: 7 });
  });
});

describe('sweepNudge', () => {
  const base = { low: 135, high: 225, span: 90 };

  it('moves the low handle by the coarse step', () => {
    expect(sweepNudge(base, 'low', -5)).toEqual({ low: 130, high: 225, span: 95 });
  });

  it('moves the high handle by the fine step', () => {
    expect(sweepNudge(base, 'high', 1)).toEqual({ low: 135, high: 226, span: 91 });
  });

  it('clamps the low handle at the hardware minimum', () => {
    expect(sweepNudge({ low: 7, high: 225, span: 218 }, 'low', -5)).toEqual({
      low: 5,
      high: 225,
      span: 220,
    });
  });

  it('clamps the high handle at the hardware maximum', () => {
    expect(sweepNudge({ low: 135, high: 353, span: 218 }, 'high', 5)).toEqual({
      low: 135,
      high: 355,
      span: 220,
    });
  });

  it('pins a handle at the 30 degree floor rather than crossing its partner', () => {
    expect(sweepNudge({ low: 180, high: 210, span: 30 }, 'low', 5)).toEqual({
      low: 180,
      high: 210,
      span: 30,
    });
    expect(sweepNudge({ low: 180, high: 210, span: 30 }, 'high', -5)).toEqual({
      low: 180,
      high: 210,
      span: 30,
    });
  });

  it('narrows only as far as the floor when a keypress overshoots it', () => {
    expect(sweepNudge({ low: 175, high: 210, span: 35 }, 'low', 20)).toEqual({
      low: 180,
      high: 210,
      span: 30,
    });
  });

  it('still widens freely away from the floor', () => {
    expect(sweepNudge({ low: 180, high: 210, span: 30 }, 'low', -5)).toEqual({
      low: 175,
      high: 210,
      span: 35,
    });
  });
});

describe('normaliseSweep', () => {
  it('leaves a sweep at or above the floor untouched', () => {
    expect(normaliseSweep({ low: 135, high: 225, span: 90 })).toEqual({
      low: 135,
      high: 225,
      span: 90,
    });
  });

  it('widens a device-reported sweep below the floor about its midpoint', () => {
    expect(normaliseSweep({ low: 180, high: 190, span: 10 })).toEqual({
      low: 170,
      high: 200,
      span: 30,
    });
  });

  it('slides a widened sweep inside the hardware range instead of clipping it', () => {
    expect(normaliseSweep({ low: 5, high: 10, span: 5 })).toEqual({
      low: 5,
      high: 35,
      span: 30,
    });
    expect(normaliseSweep({ low: 350, high: 355, span: 5 })).toEqual({
      low: 325,
      high: 355,
      span: 30,
    });
  });

  it('caps a sweep wider than the hardware arc', () => {
    expect(normaliseSweep({ low: 5, high: 355, span: 350 }).span).toBe(MAX_SWEEP);
  });
});

describe('isMinSweep', () => {
  it('is true on the floor and false above it', () => {
    expect(isMinSweep({ low: 180, high: 210, span: 30 })).toBe(true);
    expect(isMinSweep({ low: 180, high: 211, span: 31 })).toBe(false);
  });
});

describe('sweepRotate', () => {
  const base = { low: 135, high: 225, span: 90 };

  it('slides both edges, keeping the span', () => {
    expect(sweepRotate(base, 20)).toEqual({ low: 155, high: 245, span: 90 });
    expect(sweepRotate(base, -20)).toEqual({ low: 115, high: 205, span: 90 });
  });

  it('stops cleanly on the lower hardware limit', () => {
    expect(sweepRotate(base, -200)).toEqual({ low: 5, high: 95, span: 90 });
  });

  it('stops cleanly on the upper hardware limit', () => {
    expect(sweepRotate(base, 200)).toEqual({ low: 265, high: 355, span: 90 });
  });

  it('never wraps or inverts the pair at a limit', () => {
    const rotated = sweepRotate(base, 10_000);
    expect(rotated.low).toBeLessThan(rotated.high);
    expect(rotated.high).toBeLessThanOrEqual(355);
    expect(rotated.span).toBe(90);
  });

  it('cannot move a full-width sweep at all', () => {
    const full = { low: 5, high: 355, span: 350 };
    expect(sweepRotate(full, 40)).toEqual(full);
    expect(sweepRotate(full, -40)).toEqual(full);
  });
});

describe('sweepBearing and sweepAim', () => {
  it('reads the bisector', () => {
    expect(sweepBearing({ low: 135, high: 225, span: 90 })).toBe(180);
  });

  it('re-aims without changing the span', () => {
    const aimed = sweepAim({ low: 135, high: 225, span: 90 }, 120);
    expect(aimed).toEqual({ low: 75, high: 165, span: 90 });
  });

  it('stops on the limit rather than clipping the span it was told to keep', () => {
    const aimed = sweepAim({ low: 135, high: 225, span: 90 }, 20);
    expect(aimed.span).toBe(90);
    expect(aimed.low).toBe(5);
  });
});

describe('unwrapBearing', () => {
  it('leaves a nearby bearing alone', () => {
    expect(unwrapBearing(180, 190)).toBe(190);
  });

  it('runs past 360 rather than jumping back across the bottom seam', () => {
    expect(unwrapBearing(355, 5)).toBe(365);
  });

  it('runs below 0 rather than jumping forward across the seam', () => {
    expect(unwrapBearing(5, 355)).toBe(-5);
  });

  it('accumulates across repeated samples', () => {
    expect(unwrapBearing(unwrapBearing(350, 10), 30)).toBe(390);
  });
});

describe('sweepAimDrag', () => {
  const base = { low: 135, high: 225, span: 90 };

  it('aims the wedge at the pointer, keeping the span', () => {
    const { angle } = sweepAimDrag(base, 180, -100, 0);
    expect(angle).toEqual({ low: 45, high: 135, span: 90 });
  });

  it('stops on the limit when dragged across the bottom seam', () => {
    // Sweeping clockwise past straight down: the raw bearing reads ~1, which
    // unwraps to ~361 rather than flipping the fan to the other side.
    const { angle, bearing } = sweepAimDrag({ low: 265, high: 355, span: 90 }, 310, -2, 100);
    expect(bearing).toBeGreaterThan(355);
    expect(angle).toEqual({ low: 265, high: 355, span: 90 });
  });
});

describe('deviceBearing', () => {
  it('maps screen up to the device front', () => {
    expect(deviceBearing(0, -100)).toBe(180);
  });

  it('maps the horizontals to 90 and 270', () => {
    expect(deviceBearing(-100, 0)).toBe(90);
    expect(deviceBearing(100, 0)).toBe(270);
  });
});

describe('sweepHandleDrag', () => {
  const base = { low: 135, high: 225, span: 90 };

  it('maps straight up to the front of the device (180)', () => {
    expect(sweepHandleDrag(base, 'low', 0, -100).low).toBe(180);
  });

  it('maps the left horizontal to 90', () => {
    expect(sweepHandleDrag(base, 'low', -100, 0).low).toBe(90);
  });

  it('maps the right horizontal to 270', () => {
    expect(sweepHandleDrag({ low: 5, high: 350, span: 345 }, 'high', 100, 0).high).toBe(270);
  });

  it('clamps at the bottom limit rather than jumping across the gap', () => {
    // Just left of straight down is angle ~1 -> clamped up to the 5 minimum.
    expect(sweepHandleDrag({ low: 10, high: 350, span: 340 }, 'low', -2, 100).low).toBe(5);
    // Just right of straight down is ~359 -> clamped down to the 355 maximum.
    expect(sweepHandleDrag({ low: 10, high: 350, span: 340 }, 'high', 2, 100).high).toBe(355);
  });

  it('pins at the 30 degree floor when a handle is dragged past its partner', () => {
    const dragged = sweepHandleDrag(base, 'low', 100, 0);
    expect(dragged.high).toBe(225);
    expect(dragged.low).toBe(195);
    expect(dragged.span).toBe(30);
  });
});

describe('service payloads', () => {
  it('powerCall toggles the fan domain', () => {
    expect(powerCall('fan.tp09', true)).toEqual({
      domain: 'fan',
      service: 'turn_on',
      data: { entity_id: 'fan.tp09' },
    });
    expect(powerCall('fan.tp09', false)).toEqual({
      domain: 'fan',
      service: 'turn_off',
      data: { entity_id: 'fan.tp09' },
    });
  });

  it('speedCall converts a step back to a percentage', () => {
    expect(speedCall('fan.tp09', 7, 10)).toEqual({
      domain: 'fan',
      service: 'set_percentage',
      data: { entity_id: 'fan.tp09', percentage: 70 },
    });
  });

  it('presetCall uses the entity’s own preset spelling', () => {
    expect(presetCall('fan.tp09', 'Auto')).toEqual({
      domain: 'fan',
      service: 'set_preset_mode',
      data: { entity_id: 'fan.tp09', preset_mode: 'Auto' },
    });
  });

  it('airflowCall maps front and back to forward and reverse', () => {
    expect(airflowCall('fan.tp09', 'front').data).toEqual({
      entity_id: 'fan.tp09',
      direction: 'forward',
    });
    expect(airflowCall('fan.tp09', 'back').data).toEqual({
      entity_id: 'fan.tp09',
      direction: 'reverse',
    });
  });

  it('hvacCall sets the mode, and turns the climate off when deselected', () => {
    expect(hvacCall('climate.tp09', 'cool', false).data).toEqual({
      entity_id: 'climate.tp09',
      hvac_mode: 'cool',
    });
    expect(hvacCall('climate.tp09', 'cool', true).data).toEqual({
      entity_id: 'climate.tp09',
      hvac_mode: 'off',
    });
  });

  it('nightModeCall toggles the sibling switch', () => {
    expect(nightModeCall('switch.tp09_night_mode', true)).toEqual({
      domain: 'switch',
      service: 'turn_on',
      data: { entity_id: 'switch.tp09_night_mode' },
    });
  });

  it('oscillationCall stops oscillating without touching the angle', () => {
    expect(oscillationCall('fan.tp09', undefined)).toEqual([
      { domain: 'fan', service: 'oscillate', data: { entity_id: 'fan.tp09', oscillating: false } },
    ]);
  });

  /**
   * dyson_local.set_angle declares no `target` block, so entity_id must ride
   * in `data` — verified against GET /api/services on the live instance.
   */
  it('oscillationCall enables oscillation then sets the angle in one batch', () => {
    expect(oscillationCall('fan.tp09', { low: 135, high: 225, span: 90 })).toEqual([
      { domain: 'fan', service: 'oscillate', data: { entity_id: 'fan.tp09', oscillating: true } },
      {
        domain: 'dyson_local',
        service: 'set_angle',
        data: { entity_id: 'fan.tp09', angle_low: 135, angle_high: 225 },
      },
    ]);
  });

  it('exposes the verified integration service names', () => {
    expect(ANGLE_SERVICE).toEqual({ domain: 'dyson_local', service: 'set_angle' });
    expect(TIMER_SERVICE).toEqual({ domain: 'dyson_local', service: 'set_timer' });
  });

  it('timerCall sends minutes, and 0 to clear', () => {
    expect(timerCall('fan.tp09', 120)).toEqual({
      domain: 'dyson_local',
      service: 'set_timer',
      data: { entity_id: 'fan.tp09', timer: 120 },
    });
    expect(timerCall('fan.tp09', 0).data).toEqual({ entity_id: 'fan.tp09', timer: 0 });
  });

  it('timerCall clamps to the service maximum', () => {
    expect(timerCall('fan.tp09', 9999).data).toMatchObject({ timer: TIMER_MAX_MINUTES });
    expect(timerCall('fan.tp09', -5).data).toMatchObject({ timer: 0 });
  });

  it('offers the Figma timer presets, all inside the service range', () => {
    expect(TIMER_PRESETS).toEqual([0, 15, 30, 60, 120, 240, 480]);
    for (const preset of TIMER_PRESETS) {
      expect(preset).toBeLessThanOrEqual(TIMER_MAX_MINUTES);
    }
  });
});

describe('timerLabel', () => {
  it('renders minutes under an hour and whole hours above it', () => {
    expect(timerLabel(15)).toBe('15m');
    expect(timerLabel(60)).toBe('1h');
    expect(timerLabel(120)).toBe('2h');
    expect(timerLabel(480)).toBe('8h');
  });

  it('renders a mixed duration', () => {
    expect(timerLabel(90)).toBe('1h 30m');
  });

  it('has no label for a cleared timer', () => {
    expect(timerLabel(0)).toBeUndefined();
  });
});
