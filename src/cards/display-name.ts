import type { HomeAssistant } from '../types/home-assistant';

/**
 * Single source of truth for the label a card shows for an entity.
 *
 * A bare `entity_id` is never acceptable user-visible text, so every render
 * path resolves through here instead of `config.name ?? entity_id`.
 * Precedence (spec §8 display quality):
 *   1. explicit `name` in the card config — the integrator's override
 *   2. `friendly_name` on the state — what HA itself shows everywhere
 *   3. entity registry `name` — set but not yet reflected in a stale state
 *   4. humanized entity id — last resort, still readable
 */

function trimmed(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const text = value.trim();
  return text === '' ? undefined : text;
}

/** `cover.dooya_m1_fe9b_curtain` → `Dooya M1 Fe9b Curtain`. */
export function humanizeEntityId(entityId: string): string {
  const objectId = entityId.includes('.')
    ? entityId.slice(entityId.indexOf('.') + 1)
    : entityId;
  const words = objectId
    .split('_')
    .filter((word) => word !== '')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.length === 0 ? entityId : words.join(' ');
}

export function displayName(
  hass: HomeAssistant | undefined,
  entityId: string,
  configName?: string,
): string {
  return (
    trimmed(configName) ??
    trimmed(hass?.states[entityId]?.attributes['friendly_name']) ??
    trimmed(hass?.entities?.[entityId]?.name) ??
    humanizeEntityId(entityId)
  );
}
