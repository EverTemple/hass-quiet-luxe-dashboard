import type { HassEntity } from '../types/home-assistant';
import type { ServiceCall } from './device-controls';
import { CLIMATE_FEATURE, snapToStep, supportsFeature } from './supported-features';

/**
 * Geometry and state model for the climate ring dial (Figma `card/climate-dial`,
 * 55:4707).
 *
 * Angles are degrees from +x, increasing clockwise, which is what an SVG's
 * y-down coordinate system gives for free: `(cos θ, sin θ)` sweeps clockwise on
 * screen. The track starts at 135° (lower left) and sweeps 270° clockwise
 * through the top to 405° = 45° (lower right), leaving the 90° gap at the
 * bottom that the design opens the ring with.
 *
 * Everything here is pure: no DOM, no hass. The card turns a committed value
 * into a service call; the element turns a pointer into a value.
 */

/** Where the track begins, in degrees from +x, clockwise. */
export const DIAL_START_ANGLE = 135;
/** How far it sweeps. 270° leaves a 90° opening at the bottom. */
export const DIAL_SWEEP = 270;

/**
 * The band the design is drawn against: 15–30 °C over 270° is 18° per degree.
 * It is a reference for the drawing, never a clamp — a real entity's own
 * `min_temp`/`max_temp` always win, so a device reporting 1–37 simply gets a
 * coarser 7.5° per degree.
 */
export const DIAL_DESIGN_MIN = 15;
export const DIAL_DESIGN_MAX = 30;

/** HA's own default when a climate entity does not publish a step. */
export const DEFAULT_TEMP_STEP = 0.5;

export interface DialScale {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * The scale the dial actually draws, taken from the entity. A device that
 * reports a degenerate or inverted band would make every angle meaningless, so
 * it falls back to the design's own band rather than dividing by zero.
 */
export function climateScale(entity: HassEntity | undefined): DialScale {
  const min = numberOr(entity?.attributes.min_temp, DIAL_DESIGN_MIN);
  const max = numberOr(entity?.attributes.max_temp, DIAL_DESIGN_MAX);
  const step = numberOr(entity?.attributes.target_temp_step, DEFAULT_TEMP_STEP);
  const usable = max > min;
  return {
    min: usable ? min : DIAL_DESIGN_MIN,
    max: usable ? max : DIAL_DESIGN_MAX,
    step: step > 0 ? step : DEFAULT_TEMP_STEP,
  };
}

/** Folds any angle into 0..360. */
export function normaliseAngle(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** θ(T) = START + ((T − min) / (max − min)) × SWEEP, clamped to the track. */
export function angleForValue(scale: DialScale, value: number): number {
  const span = scale.max - scale.min;
  const clamped = Math.min(scale.max, Math.max(scale.min, value));
  return DIAL_START_ANGLE + ((clamped - scale.min) / span) * DIAL_SWEEP;
}

/**
 * The inverse, snapped to the entity's step.
 *
 * A pointer can land in the 90° gap under the dial, where there is no value to
 * read. Rather than ignoring the drag — which feels like the grip has stuck —
 * the gap is split down its middle: below-left reads as the minimum, below-right
 * as the maximum, so dragging off the end of the track parks the grip there.
 */
export function valueForAngle(scale: DialScale, degrees: number): number {
  const relative = normaliseAngle(degrees - DIAL_START_ANGLE);
  const gapMidpoint = DIAL_SWEEP + (360 - DIAL_SWEEP) / 2;
  if (relative > DIAL_SWEEP) {
    return relative < gapMidpoint ? scale.max : scale.min;
  }
  const raw = scale.min + (relative / DIAL_SWEEP) * (scale.max - scale.min);
  return snapToStep({ value: raw, ...scale }, raw);
}

/** The angle of a pointer at (dx, dy) from the dial's centre. */
export function angleForOffset(dx: number, dy: number): number {
  return normaliseAngle((Math.atan2(dy, dx) * 180) / Math.PI);
}

export function polarPoint(
  cx: number,
  cy: number,
  radius: number,
  degrees: number,
): readonly [number, number] {
  const radians = (degrees * Math.PI) / 180;
  return [cx + radius * Math.cos(radians), cy + radius * Math.sin(radians)];
}

/** An open arc from one angle to another, always drawn clockwise. */
export function arcPath(
  cx: number,
  cy: number,
  radius: number,
  fromDegrees: number,
  toDegrees: number,
): string {
  const [x0, y0] = polarPoint(cx, cy, radius, fromDegrees);
  const [x1, y1] = polarPoint(cx, cy, radius, toDegrees);
  const largeArc = normaliseAngle(toDegrees - fromDegrees) > 180 ? 1 : 0;
  const n = (value: number): string => value.toFixed(3);
  return `M ${n(x0)} ${n(y0)} A ${n(radius)} ${n(radius)} 0 ${String(largeArc)} 1 ${n(x1)} ${n(y1)}`;
}

/**
 * Tick spacing, chosen so the ring never turns into a solid band. A 15–30 band
 * ticks every degree as the design draws it; a device reporting 1–37, or a
 * Fahrenheit device reporting 45–95, steps up to the next interval instead.
 */
export const TICK_INTERVALS: readonly [number, ...number[]] = [1, 2, 5, 10];
export const MAX_TICKS = 40;

export function tickInterval(scale: DialScale): number {
  const span = scale.max - scale.min;
  const coarsest = TICK_INTERVALS[TICK_INTERVALS.length - 1] ?? TICK_INTERVALS[0];
  return TICK_INTERVALS.find((interval) => span / interval <= MAX_TICKS) ?? coarsest;
}

/** Every major tick value on the scale, inclusive of both ends. */
export function tickValues(scale: DialScale): ReadonlyArray<number> {
  const interval = tickInterval(scale);
  const values: number[] = [];
  for (let value = scale.min; value <= scale.max + 1e-9; value += interval) {
    values.push(Math.round(value * 100) / 100);
  }
  return values;
}

/** How far either side of the setpoint the denser ticks run. */
export const FINE_TICK_REACH = 2;
/** How many fine ticks fill one major interval. */
export const FINE_TICK_DIVISIONS = 4;

/**
 * The denser marks the design draws around the setpoint — a quiet indication
 * that the dial reads finer than its major ticks suggest.
 */
export function fineTickValues(scale: DialScale, setpoint: number): ReadonlyArray<number> {
  const interval = tickInterval(scale);
  const fine = interval / FINE_TICK_DIVISIONS;
  const reach = interval * FINE_TICK_REACH;
  const values: number[] = [];
  for (let value = setpoint - reach; value <= setpoint + reach + 1e-9; value += fine) {
    if (value >= scale.min - 1e-9 && value <= scale.max + 1e-9) {
      values.push(Math.round(value * 100) / 100);
    }
  }
  return values;
}

/** How the dial is painted, which follows the entity's hvac mode. */
export type DialMode = 'heat' | 'cool' | 'heat_cool' | 'off' | 'other';

const DIAL_MODES: Readonly<Record<string, DialMode>> = {
  heat: 'heat',
  cool: 'cool',
  heat_cool: 'heat_cool',
  auto: 'heat_cool',
  off: 'off',
};

export function dialMode(entity: HassEntity | undefined): DialMode {
  if (entity === undefined) {
    return 'off';
  }
  return DIAL_MODES[entity.state] ?? 'other';
}

export type DialSetpointKind = 'single' | 'range' | 'none';

export interface DialSetpoints {
  readonly kind: DialSetpointKind;
  readonly value?: number;
  readonly low?: number;
  readonly high?: number;
}

/**
 * What the dial can actually drive, read from the entity's own feature mask and
 * attributes. A thermostat in `heat_cool` publishes a low/high pair; the same
 * thermostat in `heat` publishes a single `temperature`. An entity that has not
 * reported a setpoint yet gets `none` rather than a confident zero.
 */
export function dialSetpoints(entity: HassEntity | undefined): DialSetpoints {
  const low = optionalNumber(entity?.attributes.target_temp_low);
  const high = optionalNumber(entity?.attributes.target_temp_high);
  if (
    supportsFeature(entity, CLIMATE_FEATURE.TARGET_TEMPERATURE_RANGE) &&
    low !== undefined &&
    high !== undefined
  ) {
    return { kind: 'range', low, high };
  }
  const value = optionalNumber(entity?.attributes.temperature);
  if (supportsFeature(entity, CLIMATE_FEATURE.TARGET_TEMPERATURE) && value !== undefined) {
    return { kind: 'single', value };
  }
  return { kind: 'none' };
}

/** The reading the centre stack shows beneath the setpoint. */
export function ambientTemperature(entity: HassEntity | undefined): number | undefined {
  return optionalNumber(entity?.attributes.current_temperature);
}

/** True when a climate entity has a setpoint worth drawing a dial for. */
export function hasDialSetpoint(entity: HassEntity | undefined): boolean {
  return dialSetpoints(entity).kind !== 'none';
}

export interface TemperaturePatch {
  readonly temperature?: number;
  readonly targetLow?: number;
  readonly targetHigh?: number;
}

/**
 * One `climate.set_temperature` call. A range thermostat takes
 * `target_temp_low`/`target_temp_high`; a single-setpoint one takes
 * `temperature`. An empty patch returns undefined so a card never fires a
 * call with nothing in it.
 */
export function setTemperatureCall(
  entityId: string,
  patch: TemperaturePatch,
): ServiceCall | undefined {
  const data: Record<string, unknown> = { entity_id: entityId };
  if (patch.temperature !== undefined) {
    data.temperature = patch.temperature;
  }
  if (patch.targetLow !== undefined) {
    data.target_temp_low = patch.targetLow;
  }
  if (patch.targetHigh !== undefined) {
    data.target_temp_high = patch.targetHigh;
  }
  if (Object.keys(data).length === 1) {
    return undefined;
  }
  return { domain: 'climate', service: 'set_temperature', data };
}

/**
 * Moving one end of a range must not push it past the other. The moved end is
 * held one step clear of its neighbour, which is what a thermostat expects and
 * what stops a drag from silently inverting the band.
 */
export function clampRange(
  scale: DialScale,
  low: number,
  high: number,
  moved: 'low' | 'high',
): { readonly low: number; readonly high: number } {
  if (high - low >= scale.step) {
    return { low, high };
  }
  return moved === 'low'
    ? { low: snapToStep({ value: low, ...scale }, high - scale.step), high }
    : { low, high: snapToStep({ value: high, ...scale }, low + scale.step) };
}

/**
 * The four modes the design puts on the card, in its order. A half-column card
 * is about 230px wide, which is four equal pills — a six-mode Sensibo squeezed
 * into it truncates every label to a single letter.
 */
export const CARD_HVAC_MODES: ReadonlyArray<string> = ['heat', 'cool', 'heat_cool', 'auto', 'off'];

/**
 * The mode row for the card itself: the canonical modes the device has, plus
 * whatever it is doing right now if that is not one of them — so a thermostat
 * running `dry` still shows a selected segment. The complete list is always in
 * the sheet, so nothing is hidden, only deferred.
 */
export function cardHvacModes(
  modes: ReadonlyArray<string>,
  current: string,
): ReadonlyArray<string> {
  const canonical = modes.filter((mode) => CARD_HVAC_MODES.includes(mode));
  if (canonical.includes(current) || !modes.includes(current)) {
    return canonical;
  }
  // The active mode leads, so the row never opens with nothing selected.
  return [current, ...canonical];
}

/** Arrow keys move one step; shift moves a coarser one. */
export const DIAL_COARSE_MULTIPLIER = 5;

export function nudgeValue(
  scale: DialScale,
  value: number,
  direction: 1 | -1,
  coarse: boolean,
): number {
  const amount = scale.step * (coarse ? DIAL_COARSE_MULTIPLIER : 1);
  return snapToStep({ value, ...scale }, value + direction * amount);
}
