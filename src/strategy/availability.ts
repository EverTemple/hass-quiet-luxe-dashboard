import type { StrategyContext } from './types';

/**
 * Spec §8 graceful degradation, generation half: "missing integration →
 * section never renders". A configured feature is not evidence that the
 * integration is installed — Tung Chung carries `car: audi` with placeholder
 * entity ids and has no Audi integration, and the car card still rendered a
 * shell of em-dashes. The rule these helpers encode:
 *
 * - `exists`   — the entity is in hass.states at generation time. An entity
 *                that exists but reads `unavailable` still renders (muted),
 *                because that is a device that is off/offline, not a feature
 *                the home does not have.
 * - `isUsable` — exists AND is not unavailable/unknown. Used where an entity
 *                that can never show anything is worse than no card at all
 *                (a dead media player, a camera with no stream).
 */

const DEAD_STATES = new Set(['unavailable', 'unknown']);

export function exists(ctx: StrategyContext, entityId: string | undefined): boolean {
  return entityId !== undefined && ctx.states[entityId] !== undefined;
}

export function isUsable(ctx: StrategyContext, entityId: string | undefined): boolean {
  if (!exists(ctx, entityId)) {
    return false;
  }
  return !DEAD_STATES.has(ctx.states[entityId as string]?.state ?? 'unavailable');
}

export function anyExists(
  ctx: StrategyContext,
  entityIds: ReadonlyArray<string | undefined>,
): boolean {
  return entityIds.some((entityId) => exists(ctx, entityId));
}
