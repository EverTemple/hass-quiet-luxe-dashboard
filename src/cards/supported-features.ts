import type { HassEntity } from '../types/home-assistant';

/**
 * Capability detection for the inline controls.
 *
 * Every control on a Quiet Luxe card is derived from what the entity itself
 * reports — its `supported_features` bitmask and its own attributes — never
 * from the integration name or a hard-coded device list. A device that omits
 * an attribute simply loses that control; nothing throws and nothing renders
 * a broken affordance.
 *
 * Bitmask values mirror Home Assistant's `*EntityFeature` enums
 * (homeassistant/components/{climate,fan,humidifier,cover}/const.py).
 */

/** homeassistant/components/climate/const.py ClimateEntityFeature */
export const CLIMATE_FEATURE = {
  TARGET_TEMPERATURE: 1,
  TARGET_TEMPERATURE_RANGE: 2,
  TARGET_HUMIDITY: 4,
  FAN_MODE: 8,
  PRESET_MODE: 16,
  SWING_MODE: 32,
  TURN_OFF: 128,
  TURN_ON: 256,
  SWING_HORIZONTAL_MODE: 512,
} as const;

/** homeassistant/components/fan/const.py FanEntityFeature */
export const FAN_FEATURE = {
  SET_SPEED: 1,
  OSCILLATE: 2,
  DIRECTION: 4,
  PRESET_MODE: 8,
  TURN_OFF: 16,
  TURN_ON: 32,
} as const;

/** homeassistant/components/humidifier/const.py HumidifierEntityFeature */
export const HUMIDIFIER_FEATURE = {
  MODES: 1,
} as const;

/** homeassistant/components/cover/const.py CoverEntityFeature */
export const COVER_FEATURE = {
  OPEN: 1,
  CLOSE: 2,
  SET_POSITION: 4,
  STOP: 8,
  OPEN_TILT: 16,
  CLOSE_TILT: 32,
  STOP_TILT: 64,
  SET_TILT_POSITION: 128,
} as const;

/** True only when every bit in `feature` is set. Missing mask → false. */
export function supportsFeature(entity: HassEntity | undefined, feature: number): boolean {
  const mask = Number(entity?.attributes.supported_features);
  if (!Number.isFinite(mask)) {
    return false;
  }
  return (mask & feature) === feature;
}

/** A numeric control's current value and the bounds it must stay inside. */
export interface NumericTarget {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * `Number(null)` and `Number('')` are both 0, and HA reports `null` for a
 * setpoint a device has not sent yet — coercing that to 0 would render a
 * confident, wrong target. Only genuine numerics count.
 */
function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Clamps to the range and snaps to the step grid measured from `min`. */
export function snapToStep(target: NumericTarget, next: number): number {
  const step = target.step > 0 ? target.step : 1;
  const clamped = Math.min(target.max, Math.max(target.min, next));
  const steps = Math.round((clamped - target.min) / step);
  const snapped = target.min + steps * step;
  // Step grids like 0.5 accumulate float noise; two decimals is beyond any
  // thermostat's resolution and keeps the numeral clean.
  return Math.min(target.max, Math.max(target.min, Math.round(snapped * 100) / 100));
}

/**
 * Target temperature for a climate entity, or undefined when the entity does
 * not support a single setpoint (e.g. range-only thermostats) or has not
 * reported one yet.
 */
export function climateTargetTemperature(
  entity: HassEntity | undefined,
): NumericTarget | undefined {
  if (!supportsFeature(entity, CLIMATE_FEATURE.TARGET_TEMPERATURE)) {
    return undefined;
  }
  const value = optionalNumber(entity?.attributes.temperature);
  if (value === undefined) {
    return undefined;
  }
  return {
    value,
    min: numberOr(entity?.attributes.min_temp, 7),
    max: numberOr(entity?.attributes.max_temp, 35),
    step: numberOr(entity?.attributes.target_temp_step, 0.5),
  };
}

/** Target humidity for a humidifier/dehumidifier entity. */
export function humidifierTargetHumidity(
  entity: HassEntity | undefined,
): NumericTarget | undefined {
  const value = optionalNumber(entity?.attributes.humidity);
  if (value === undefined) {
    return undefined;
  }
  return {
    value,
    min: numberOr(entity?.attributes.min_humidity, 0),
    max: numberOr(entity?.attributes.max_humidity, 100),
    step: 1,
  };
}

/** Fan speed as a percentage, using the entity's own `percentage_step`. */
export function fanPercentage(entity: HassEntity | undefined): NumericTarget | undefined {
  if (!supportsFeature(entity, FAN_FEATURE.SET_SPEED)) {
    return undefined;
  }
  const step = numberOr(entity?.attributes.percentage_step, 1);
  return {
    value: numberOr(entity?.attributes.percentage, 0),
    min: 0,
    max: 100,
    step: step > 0 ? step : 1,
  };
}

/** Cover tilt position, only when the cover can actually be tilted to a value. */
export function coverTiltPosition(entity: HassEntity | undefined): NumericTarget | undefined {
  if (!supportsFeature(entity, COVER_FEATURE.SET_TILT_POSITION)) {
    return undefined;
  }
  return {
    value: numberOr(entity?.attributes.current_cover_tilt_position, 0),
    min: 0,
    max: 100,
    step: 1,
  };
}

/**
 * Reads a list-of-options attribute (`hvac_modes`, `fan_modes`, …), keeping
 * only non-empty strings. Returns an empty list when the attribute is absent
 * or malformed, which callers treat as "no control".
 */
export function optionList(
  entity: HassEntity | undefined,
  attribute: string,
): ReadonlyArray<string> {
  const raw = entity?.attributes[attribute];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((option): option is string => typeof option === 'string' && option !== '');
}

/**
 * A select-style control is only worth rendering when the entity offers a
 * genuine choice; one option is a label, not a control.
 */
export function selectableOptions(
  entity: HassEntity | undefined,
  attribute: string,
  feature?: number,
): ReadonlyArray<string> {
  if (feature !== undefined && !supportsFeature(entity, feature)) {
    return [];
  }
  const options = optionList(entity, attribute);
  return options.length > 1 ? options : [];
}

/**
 * Oscillation sweep reported by Dyson fans through the `ha-dyson` integration
 * as `angle_low`/`angle_high` on the fan entity. Absent on every other fan,
 * which is exactly how the control stays Dyson-specific without naming Dyson.
 */
export interface OscillationAngle {
  readonly low: number;
  readonly high: number;
  readonly span: number;
}

/** Dyson reports and accepts angles in 5..355 degrees. */
export const ANGLE_MIN = 5;
export const ANGLE_MAX = 355;
/** The sweeps Dyson's own app offers. 350 is "full width". */
export const ANGLE_SPANS: ReadonlyArray<number> = [45, 90, 180, 350];

export function fanOscillationAngle(entity: HassEntity | undefined): OscillationAngle | undefined {
  const low = optionalNumber(entity?.attributes.angle_low);
  const high = optionalNumber(entity?.attributes.angle_high);
  if (low === undefined || high === undefined || high < low) {
    return undefined;
  }
  return { low, high, span: high - low };
}

/**
 * Re-centres the sweep on its current midpoint at a new width, then slides it
 * back inside the hardware range rather than clipping it — a clipped sweep
 * would silently narrow the span the user just asked for.
 */
export function angleForSpan(current: OscillationAngle, span: number): OscillationAngle {
  const width = Math.min(span, ANGLE_MAX - ANGLE_MIN);
  const midpoint = (current.low + current.high) / 2;
  let low = Math.round(midpoint - width / 2);
  if (low < ANGLE_MIN) {
    low = ANGLE_MIN;
  }
  if (low + width > ANGLE_MAX) {
    low = ANGLE_MAX - width;
  }
  return { low, high: low + width, span: width };
}

/** Matches a live sweep to one of the offered spans, tolerating rounding. */
export function nearestSpan(current: OscillationAngle): number | undefined {
  return ANGLE_SPANS.find((span) => Math.abs(current.span - span) <= 2);
}
