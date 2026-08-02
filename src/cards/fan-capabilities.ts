import type { HassEntity } from '../types/home-assistant';
import type { ServiceCall } from './device-controls';
import {
  ANGLE_MAX,
  ANGLE_MIN,
  FAN_FEATURE,
  optionList,
  supportsFeature,
  type OscillationAngle,
} from './supported-features';

/**
 * Capability model for the Dyson-style fan card.
 *
 * Every control the card draws is derived from what the device itself reports —
 * its `supported_features` mask, its own attributes, the sibling entities it
 * exposes, and whether the integration actually registered the service the
 * control calls. Nothing keys off a brand string or an integration name, and a
 * control whose backing capability is absent is omitted rather than rendered
 * dead. Service names and payload shapes below were verified against a live
 * instance (HA 2026.7.1, `GET /api/services`) on 2026-08-02.
 */

/** Registered-services map, keyed by domain then service name (`hass.services`). */
export type ServiceRegistry = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

/** The entities one physical fan/purifier presents across HA domains. */
export interface FanEntities {
  readonly fan?: HassEntity;
  /** Same device, `climate` domain — carries the heat/cool modes. */
  readonly climate?: HassEntity;
  /** Same device, a `switch` carrying night mode (an `entity_category: config` entity). */
  readonly nightMode?: HassEntity;
  readonly services?: ServiceRegistry;
  /**
   * The integration that provides the fan entity. Integration-specific services
   * live under a domain named for the platform, so this is what turns "the
   * instance has a set_timer service somewhere" into "this device has a timer".
   */
  readonly platform?: string;
}

export interface FanCapabilities {
  readonly power: boolean;
  readonly speed: boolean;
  readonly autoPreset: boolean;
  readonly oscillation: boolean;
  readonly direction: boolean;
  readonly cooling: boolean;
  readonly heating: boolean;
  readonly night: boolean;
  readonly timer: boolean;
}

/**
 * `dyson_local.set_angle` declares no `target` block, so `entity_id` travels in
 * `data` rather than alongside it.
 */
export const ANGLE_SERVICE = { domain: 'dyson_local', service: 'set_angle' } as const;
export const TIMER_SERVICE = { domain: 'dyson_local', service: 'set_timer' } as const;
/** Integration-specific service names, looked up under the entity's platform. */
export const TIMER_SERVICE_NAME = 'set_timer';

/** `dyson_local.set_timer` accepts 0..540 minutes; 0 clears the timer. */
export const TIMER_MAX_MINUTES = 540;
/** Figma `modal/timer` presets. 0 is "Off". */
export const TIMER_PRESETS: ReadonlyArray<number> = [0, 15, 30, 60, 120, 240, 480];

/**
 * The narrowest sweep the control will set.
 *
 * The hardware accepts 5°, but a 5° sweep is a fan that jitters rather than
 * oscillates: the two handles overlap at that width, the wedge has no readable
 * body to drag, and the device spends the whole sweep decelerating. 30° is the
 * floor the design pins to (Figma `modal/oscillation-v2`, 113:11176) and the
 * width at which the wedge is still a target.
 */
export const MIN_SWEEP = 30;
/** Arrow keys move a handle this far; shift refines to `SWEEP_FINE_STEP`. */
export const SWEEP_COARSE_STEP = 5;
export const SWEEP_FINE_STEP = 1;
/** The device reports 180 when it faces straight ahead. */
export const FRONT_ANGLE = 180;

const LIVE_STATES = new Set(['on', 'off', 'cool', 'heat', 'auto', 'dry', 'fan_only', 'idle']);

function isLive(entity: HassEntity | undefined): boolean {
  return entity !== undefined && LIVE_STATES.has(entity.state);
}

/**
 * The entity's own spelling of its auto preset and the manual preset to fall
 * back to — Dyson reports "Auto"/"Normal", other integrations use other casing.
 */
export function autoPresetOf(
  entity: HassEntity | undefined,
): { readonly auto: string; readonly manual: string } | undefined {
  const presets = optionList(entity, 'preset_modes');
  const auto = presets.find((preset) => preset.toLowerCase() === 'auto');
  if (auto === undefined) {
    return undefined;
  }
  const manual = presets.find((preset) => preset !== auto);
  return { auto, manual: manual ?? auto };
}

function hasHvacMode(entity: HassEntity | undefined, mode: string): boolean {
  return optionList(entity, 'hvac_modes').includes(mode);
}

export function fanCapabilities(entities: FanEntities): FanCapabilities {
  const { fan, climate, nightMode, services, platform } = entities;
  if (!isLive(fan)) {
    return {
      power: false,
      speed: false,
      autoPreset: false,
      oscillation: false,
      direction: false,
      cooling: false,
      heating: false,
      night: false,
      timer: false,
    };
  }
  return {
    power: supportsFeature(fan, FAN_FEATURE.TURN_ON) && supportsFeature(fan, FAN_FEATURE.TURN_OFF),
    speed: supportsFeature(fan, FAN_FEATURE.SET_SPEED),
    autoPreset:
      supportsFeature(fan, FAN_FEATURE.PRESET_MODE) && autoPresetOf(fan) !== undefined,
    oscillation: supportsFeature(fan, FAN_FEATURE.OSCILLATE),
    direction: supportsFeature(fan, FAN_FEATURE.DIRECTION),
    cooling: isLive(climate) && hasHvacMode(climate, 'cool'),
    heating: isLive(climate) && hasHvacMode(climate, 'heat'),
    night: isLive(nightMode),
    /* Not "some integration has a timer service" but "the integration behind
       this entity does" — otherwise every fan on the instance grows a timer. */
    timer: platform !== undefined && services?.[platform]?.[TIMER_SERVICE_NAME] !== undefined,
  };
}

export type DialId =
  | 'power'
  | 'cooling'
  | 'auto'
  | 'speed'
  | 'heating'
  | 'oscillation'
  | 'timer'
  | 'night'
  | 'direction'
  | 'more';

export type FanCardForm = 'compact' | 'full';

/** Figma `card/device-dyson` size=full reads across the 3x3 grid in this order. */
const FULL_ORDER: ReadonlyArray<Exclude<DialId, 'more'>> = [
  'power',
  'cooling',
  'auto',
  'speed',
  'heating',
  'oscillation',
  'timer',
  'night',
  'direction',
];

/** Compact shows the three most-reached-for controls the device actually has. */
const COMPACT_PRIORITY: ReadonlyArray<Exclude<DialId, 'more'>> = [
  'power',
  'auto',
  'oscillation',
  'speed',
  'cooling',
  'heating',
  'direction',
  'night',
  'timer',
];

const COMPACT_PRIMARIES = 3;

function isSupported(caps: FanCapabilities, id: Exclude<DialId, 'more'>): boolean {
  switch (id) {
    case 'power':
      return caps.power;
    case 'cooling':
      return caps.cooling;
    case 'auto':
      return caps.autoPreset;
    case 'speed':
      return caps.speed;
    case 'heating':
      return caps.heating;
    case 'oscillation':
      return caps.oscillation;
    case 'timer':
      return caps.timer;
    case 'night':
      return caps.night;
    case 'direction':
      return caps.direction;
  }
}

/**
 * The dials to draw, in Figma order, filtered to what the device supports.
 * Compact appends "More" only when it is actually hiding something.
 */
export function dialButtonsFor(
  caps: FanCapabilities,
  form: FanCardForm,
): ReadonlyArray<DialId> {
  const supported = FULL_ORDER.filter((id) => isSupported(caps, id));
  if (form === 'full') {
    return supported;
  }
  const primaries = COMPACT_PRIORITY.filter((id) => isSupported(caps, id)).slice(
    0,
    COMPACT_PRIMARIES,
  );
  return supported.length > primaries.length ? [...primaries, 'more'] : primaries;
}

/** Fan speed as a discrete step on the device's own grid (Dyson: 1..10). */
export function fanSpeedStep(entity: HassEntity | undefined): {
  readonly step: number;
  readonly steps: number;
} {
  const rawStep = Number(entity?.attributes.percentage_step);
  const size = Number.isFinite(rawStep) && rawStep > 0 ? rawStep : 10;
  const percentage = Number(entity?.attributes.percentage);
  const steps = Math.round(100 / size);
  if (!Number.isFinite(percentage)) {
    return { step: 0, steps };
  }
  return { step: Math.min(steps, Math.max(0, Math.round(percentage / size))), steps };
}

/** Sweep edges expressed as degrees either side of the device's front. */
export function sweepFromFront(angle: OscillationAngle): {
  readonly start: number;
  readonly end: number;
} {
  return { start: angle.low - FRONT_ANGLE, end: angle.high - FRONT_ANGLE };
}

export type SweepHandle = 'low' | 'high';

function clampRange(value: number): number {
  return Math.min(ANGLE_MAX, Math.max(ANGLE_MIN, value));
}

/** The widest sweep the hardware can express. */
export const MAX_SWEEP = ANGLE_MAX - ANGLE_MIN;

/**
 * A sweep that is safe to drive the control from.
 *
 * A device can report a span narrower than the floor — the TP09 remembers
 * whatever was last set, including sweeps set by Dyson's own app. Widening it on
 * read, rather than at the moment of a drag, keeps every handle rule below able
 * to assume the invariant instead of re-checking it. The sweep is widened about
 * its own midpoint and then slid inside the hardware range, so a sweep parked
 * against a limit stays against it.
 */
export function normaliseSweep(angle: OscillationAngle): OscillationAngle {
  const span = Math.min(MAX_SWEEP, Math.max(MIN_SWEEP, angle.high - angle.low));
  if (span === angle.high - angle.low) {
    return { low: angle.low, high: angle.high, span };
  }
  const midpoint = (angle.low + angle.high) / 2;
  const low = clampRange(Math.round(midpoint - span / 2));
  const slid = Math.min(low, ANGLE_MAX - span);
  return { low: slid, high: slid + span, span };
}

/** True when the sweep is sitting on its floor and cannot narrow further. */
export function isMinSweep(angle: OscillationAngle): boolean {
  return angle.high - angle.low <= MIN_SWEEP;
}

/** Applies a new position to one handle, keeping the pair ordered and in range. */
function withHandle(
  angle: OscillationAngle,
  handle: SweepHandle,
  next: number,
): OscillationAngle {
  const clamped = clampRange(Math.round(next));
  if (handle === 'low') {
    // The floor pins the handle rather than pushing its neighbour: the user
    // grabbed one edge, so the other one stays where it was put.
    const low = clampRange(Math.min(clamped, angle.high - MIN_SWEEP));
    return { low, high: angle.high, span: angle.high - low };
  }
  const high = clampRange(Math.max(clamped, angle.low + MIN_SWEEP));
  return { low: angle.low, high, span: high - angle.low };
}

/**
 * Slides the whole sweep by `delta` degrees, keeping its span.
 *
 * The hardware arc runs 5..355 and does not wrap, so a rotation that would
 * carry an edge past a limit stops with that edge on the limit. It never wraps
 * to the far side and never inverts the pair — a sweep that ran left-to-right
 * before the drag still runs left-to-right after it.
 */
export function sweepRotate(angle: OscillationAngle, delta: number): OscillationAngle {
  const span = Math.min(MAX_SWEEP, Math.max(MIN_SWEEP, angle.high - angle.low));
  const low = Math.min(ANGLE_MAX - span, Math.max(ANGLE_MIN, Math.round(angle.low + delta)));
  return { low, high: low + span, span };
}

/** Where the sweep is pointing: the bisector of its two edges. */
export function sweepBearing(angle: OscillationAngle): number {
  return (angle.low + angle.high) / 2;
}

/** Re-aims the sweep so its bisector lands on `bearing`, keeping its span. */
export function sweepAim(angle: OscillationAngle, bearing: number): OscillationAngle {
  return sweepRotate(angle, bearing - sweepBearing(angle));
}

/**
 * Folds a bearing onto the branch nearest `previous`.
 *
 * The only bearing the fan cannot face is straight down, which is exactly where
 * the 0/360 seam falls. Reading each pointer sample as an absolute bearing would
 * make a drag across the bottom of the dial jump from 355 to 5 — the sweep would
 * flip to the opposite side of the room mid-gesture. Unwrapping against the
 * previous sample instead lets the value run past 360 (or below 0), where
 * `sweepRotate` then stops it cleanly on the limit.
 */
export function unwrapBearing(previous: number, next: number): number {
  const delta = ((((next - previous) % 360) + 540) % 360) - 180;
  return previous + delta;
}

/** Keyboard nudge: `delta` is signed degrees. */
export function sweepNudge(
  angle: OscillationAngle,
  handle: SweepHandle,
  delta: number,
): OscillationAngle {
  return withHandle(angle, handle, (handle === 'low' ? angle.low : angle.high) + delta);
}

/**
 * Pointer drag: `dx`/`dy` are offsets from the dial centre in screen pixels.
 *
 * Screen up is the device's front (180), and the reachable arc runs 5..355, so
 * the only unreachable bearing is straight down — dragging through it clamps at
 * whichever limit is nearer instead of jumping to the far end of the range.
 */
export function sweepHandleDrag(
  angle: OscillationAngle,
  handle: SweepHandle,
  dx: number,
  dy: number,
): OscillationAngle {
  return withHandle(angle, handle, deviceBearing(dx, dy));
}

/** The device bearing a pointer at (dx, dy) from the dial centre points at. */
export function deviceBearing(dx: number, dy: number): number {
  const screenDegrees = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (((screenDegrees + 270) % 360) + 360) % 360;
}

/**
 * The wedge body dragged to a new aim.
 *
 * `previous` is the bearing the last sample resolved to, which is what makes a
 * drag across the bottom seam continuous rather than a jump to the far side.
 * Returns the new sweep and the unwrapped bearing to carry into the next sample.
 */
export function sweepAimDrag(
  angle: OscillationAngle,
  previous: number,
  dx: number,
  dy: number,
): { readonly angle: OscillationAngle; readonly bearing: number } {
  const bearing = unwrapBearing(previous, deviceBearing(dx, dy));
  return { angle: sweepAim(angle, bearing), bearing };
}

export function powerCall(entityId: string, on: boolean): ServiceCall {
  return { domain: 'fan', service: on ? 'turn_on' : 'turn_off', data: { entity_id: entityId } };
}

export function speedCall(entityId: string, step: number, steps: number): ServiceCall {
  const percentage = Math.round((Math.min(steps, Math.max(0, step)) / steps) * 100);
  return { domain: 'fan', service: 'set_percentage', data: { entity_id: entityId, percentage } };
}

export function presetCall(entityId: string, preset: string): ServiceCall {
  return {
    domain: 'fan',
    service: 'set_preset_mode',
    data: { entity_id: entityId, preset_mode: preset },
  };
}

export type AirflowDirection = 'front' | 'back';

export function airflowCall(entityId: string, direction: AirflowDirection): ServiceCall {
  return {
    domain: 'fan',
    service: 'set_direction',
    data: { entity_id: entityId, direction: direction === 'front' ? 'forward' : 'reverse' },
  };
}

/** Tapping the mode that is already running turns the climate entity off. */
export function hvacCall(entityId: string, mode: string, active: boolean): ServiceCall {
  return {
    domain: 'climate',
    service: 'set_hvac_mode',
    data: { entity_id: entityId, hvac_mode: active ? 'off' : mode },
  };
}

export function nightModeCall(entityId: string, on: boolean): ServiceCall {
  return { domain: 'switch', service: on ? 'turn_on' : 'turn_off', data: { entity_id: entityId } };
}

/**
 * Oscillation is two services: the core `fan.oscillate` flag and, for devices
 * that report a sweep, the integration's angle service. `undefined` means stop.
 */
export function oscillationCall(
  entityId: string,
  angle: OscillationAngle | undefined,
): ReadonlyArray<ServiceCall> {
  const oscillate: ServiceCall = {
    domain: 'fan',
    service: 'oscillate',
    data: { entity_id: entityId, oscillating: angle !== undefined },
  };
  if (angle === undefined) {
    return [oscillate];
  }
  return [
    oscillate,
    {
      ...ANGLE_SERVICE,
      data: { entity_id: entityId, angle_low: angle.low, angle_high: angle.high },
    },
  ];
}

export function timerCall(
  entityId: string,
  minutes: number,
  domain: string = TIMER_SERVICE.domain,
): ServiceCall {
  const timer = Math.round(Math.min(TIMER_MAX_MINUTES, Math.max(0, minutes)));
  return { domain, service: TIMER_SERVICE_NAME, data: { entity_id: entityId, timer } };
}

/** Compact duration for the dial's state word. `undefined` when cleared. */
export function timerLabel(minutes: number): string | undefined {
  if (minutes <= 0) {
    return undefined;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${String(rest)}m`;
  }
  return rest === 0 ? `${String(hours)}h` : `${String(hours)}h ${String(rest)}m`;
}
