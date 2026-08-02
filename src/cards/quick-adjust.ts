import { climateScale, type DialScale, type DialSetpoints } from './climate-dial';
import { snapToStep } from './supported-features';
import type { HassEntity } from '../types/home-assistant';

/**
 * The model behind `control/quick-adjust` (Figma 99:7312): the minus and plus
 * glyphs that flank the climate dial.
 *
 * Everything here is pure. The element turns a press into a direction; the card
 * turns a settled setpoint into one service call. Neither knows the other's
 * timings, which live here so they are stated once and tested.
 */

/** Which way a press moves the setpoint. */
export type AdjustDirection = 1 | -1;

/**
 * How long a press is held before it starts repeating. Long enough that a
 * deliberate single tap never repeats, short enough that holding feels
 * immediate rather than stuck.
 */
export const QUICK_ADJUST_REPEAT_DELAY_MS = 400;
/** How often a held press repeats — about eight steps a second. */
export const QUICK_ADJUST_REPEAT_INTERVAL_MS = 120;
/**
 * How long the setpoint sits still before the card commits it.
 *
 * A rapid tap-tap-tap is one intent, not three, and `climate.set_temperature`
 * is a round trip to a physical device. Holding the last value for this long
 * collapses a burst into a single call while still feeling instant on screen,
 * because the numeral follows the press and only the call is deferred.
 */
export const QUICK_ADJUST_COMMIT_DELAY_MS = 400;

/**
 * The step the entity itself publishes. A device that does not publish one
 * falls back to HA's own default via `climateScale`, never to a guess of ours.
 */
export function quickAdjustStep(entity: HassEntity | undefined): number {
  return climateScale(entity).step;
}

/** The setpoint one step away, snapped to the entity's own grid and clamped. */
export function nextSetpoint(scale: DialScale, value: number, direction: AdjustDirection): number {
  return snapToStep({ value, ...scale }, value + direction * scale.step);
}

/**
 * Whether a press can still move anything. A dial already parked on its band's
 * floor has no smaller value to offer, so the glyph goes to `surface/border`
 * rather than staying live and doing nothing.
 */
export function canAdjust(
  scale: DialScale,
  setpoints: DialSetpoints,
  direction: AdjustDirection,
): boolean {
  return adjustSetpoints(scale, setpoints, direction) !== undefined;
}

/**
 * One press applied to whatever the dial is showing.
 *
 * A single-setpoint thermostat moves its one value. A range thermostat moves
 * the whole band, keeping its width: "make it warmer" is the intent, and
 * narrowing the band would be a different instruction than the one given. The
 * band stops as a whole at either end, so a press that would clip it returns
 * undefined and the glyph reads disabled instead.
 */
export function adjustSetpoints(
  scale: DialScale,
  setpoints: DialSetpoints,
  direction: AdjustDirection,
): DialSetpoints | undefined {
  if (setpoints.kind === 'single' && setpoints.value !== undefined) {
    const next = nextSetpoint(scale, setpoints.value, direction);
    return next === setpoints.value ? undefined : { kind: 'single', value: next };
  }
  if (setpoints.kind === 'range' && setpoints.low !== undefined && setpoints.high !== undefined) {
    const low = nextSetpoint(scale, setpoints.low, direction);
    const high = nextSetpoint(scale, setpoints.high, direction);
    // Either end hitting its limit stops the band; letting one end move alone
    // would silently narrow a span the user did not ask to change.
    if (low === setpoints.low || high === setpoints.high) {
      return undefined;
    }
    return { kind: 'range', low, high };
  }
  return undefined;
}
