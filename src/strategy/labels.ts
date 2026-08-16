import { humanizeEntityId } from '../cards/display-name';
import type { TranslationKey } from '../i18n/locales/en';
import { t } from '../i18n/translate';
import type { HassEntity } from '../types/home-assistant';
import type { HomeConfig } from './config';
import type { AreaEntry } from './registry';
import type { StrategyContext } from './types';

/**
 * Room-scoped labelling (spec §8 display quality).
 *
 * A card that already says "Steven Bedroom" in its title must not repeat the
 * room name in the widgets inside it. Two rules follow from that:
 *
 *  - a device chip answers "what kind of device is this, and is it on?", so it
 *    is labelled by device type ("Lights", "Aircon", "Curtain"), not by name;
 *  - a card inside a room view keeps its own name minus the room name.
 *
 * Both resolve collisions rather than showing two identical labels, and both
 * end at a humanized entity id — never a bare one.
 */

export interface LabeledEntity {
  readonly entityId: string;
  readonly label: string;
}

const DOMAIN_KEYS: Readonly<Record<string, TranslationKey>> = {
  light: 'device.lights',
  climate: 'device.aircon',
  fan: 'device.fan',
  humidifier: 'device.humidifier',
  cover: 'device.cover',
  media_player: 'device.media',
  switch: 'device.switch',
  vacuum: 'device.vacuum',
  camera: 'device.camera',
};

const COVER_CLASS_KEYS: Readonly<Record<string, TranslationKey>> = {
  curtain: 'device.curtain',
  shade: 'device.shade',
  awning: 'device.shade',
  blind: 'device.blind',
  shutter: 'device.shutter',
  garage: 'device.garage',
  gate: 'device.gate',
  door: 'device.door',
  window: 'device.window',
};

const MEDIA_CLASS_KEYS: Readonly<Record<string, TranslationKey>> = {
  tv: 'device.tv',
  speaker: 'device.speaker',
  receiver: 'device.speaker',
};

const HUMIDIFIER_CLASS_KEYS: Readonly<Record<string, TranslationKey>> = {
  dehumidifier: 'device.dehumidifier',
  humidifier: 'device.humidifier',
};

const CLASS_KEYS_BY_DOMAIN: Readonly<Record<string, Readonly<Record<string, TranslationKey>>>> = {
  cover: COVER_CLASS_KEYS,
  media_player: MEDIA_CLASS_KEYS,
  humidifier: HUMIDIFIER_CLASS_KEYS,
};

/** Separators left behind once a room name is cut off either end of a label. */
const EDGE_SEPARATORS = /^[\s\-–—_:/|·,、。]+|[\s\-–—_:/|·,、。]+$/g;

/** Short device-type key from domain + device_class; undefined when there is none. */
export function deviceTypeKey(
  entityId: string,
  state: HassEntity | undefined,
): TranslationKey | undefined {
  const domain = entityId.split('.')[0] ?? '';
  const deviceClass: unknown = state?.attributes['device_class'];
  const byClass =
    typeof deviceClass === 'string' ? CLASS_KEYS_BY_DOMAIN[domain]?.[deviceClass] : undefined;
  return byClass ?? DOMAIN_KEYS[domain];
}

/** Room name a card shows: config override first, then the registry area name. */
export function roomName(home: HomeConfig, area: AreaEntry): string {
  return home.rooms?.[area.area_id]?.name ?? area.name;
}

/** Every name this room is known by — override, registry name, HA + config aliases. */
export function areaNameVariants(home: HomeConfig, area: AreaEntry): ReadonlyArray<string> {
  const variants = [
    roomName(home, area),
    area.name,
    ...area.aliases,
    ...(home.rooms?.[area.area_id]?.aliases ?? []),
  ]
    .map((variant) => variant.trim())
    .filter((variant) => variant !== '');
  return [...new Set(variants)];
}

/**
 * Removes a room name from either end of a label, case-insensitively, and
 * tidies the separator it leaves behind. Only exact prefix/suffix matches are
 * cut, so partially overlapping names ("Steven Room" in "Steven Bedroom") stay
 * intact rather than becoming ambiguous. Returns '' when nothing is left.
 */
export function stripAreaName(name: string, areaNames: ReadonlyArray<string>): string {
  const source = name.trim();
  const targets = areaNames
    .map((areaName) => areaName.trim())
    .filter((areaName) => areaName !== '')
    .sort((a, b) => b.length - a.length);
  for (const target of targets) {
    if (source.length < target.length) {
      continue;
    }
    const lower = source.toLowerCase();
    const needle = target.toLowerCase();
    if (lower.startsWith(needle)) {
      return source.slice(target.length).replace(EDGE_SEPARATORS, '').trim();
    }
    if (lower.endsWith(needle)) {
      return source.slice(0, source.length - target.length).replace(EDGE_SEPARATORS, '').trim();
    }
  }
  return source;
}

/** Strategy-time counterpart of the card's displayName chain (states are live here). */
export function entityName(ctx: StrategyContext, entityId: string): string {
  const friendly: unknown = ctx.states[entityId]?.attributes['friendly_name'];
  if (typeof friendly === 'string' && friendly.trim() !== '') {
    return friendly.trim();
  }
  return humanizeEntityId(entityId);
}

function duplicated(labels: ReadonlyArray<string>): ReadonlySet<string> {
  const seen = new Set<string>();
  const repeats = new Set<string>();
  for (const label of labels) {
    if (seen.has(label)) {
      repeats.add(label);
    }
    seen.add(label);
  }
  return repeats;
}

/**
 * First word of this entity's id that none of its colliding siblings share —
 * the shortest honest way to tell two identically-named devices apart.
 */
function distinguishingToken(
  entityId: string,
  siblings: ReadonlyArray<string>,
): string | undefined {
  const shared = new Set(siblings.flatMap((id) => humanizeEntityId(id).split(' ')));
  return humanizeEntityId(entityId)
    .split(' ')
    .find((word) => !shared.has(word));
}

/**
 * Labels every entity with `preferred`, swaps in `fallback` wherever that
 * repeats, and only then appends a distinguishing token — so the short label
 * wins whenever it is already unambiguous.
 */
function resolveLabels(
  entityIds: ReadonlyArray<string>,
  preferred: (entityId: string) => string,
  fallback: (entityId: string) => string,
): ReadonlyArray<LabeledEntity> {
  const first = entityIds.map((entityId) => ({ entityId, label: preferred(entityId) }));
  const repeats = duplicated(first.map((entry) => entry.label));
  const second = first.map((entry) => {
    if (!repeats.has(entry.label)) {
      return entry;
    }
    const alternative = fallback(entry.entityId);
    return { entityId: entry.entityId, label: alternative === '' ? entry.label : alternative };
  });
  const remaining = duplicated(second.map((entry) => entry.label));
  if (remaining.size === 0) {
    return second;
  }
  return second.map((entry, index) => {
    if (!remaining.has(entry.label)) {
      return entry;
    }
    const siblings = second
      .filter((other, otherIndex) => otherIndex !== index && other.label === entry.label)
      .map((other) => other.entityId);
    const token = distinguishingToken(entry.entityId, siblings);
    return token === undefined ? entry : { entityId: entry.entityId, label: `${entry.label} ${token}` };
  });
}

/**
 * Chip labels for a room card: device type first ("Lights", "Aircon",
 * "Curtain"), because the card title already names the room. Chips that would
 * share a type fall back to their own names with the room name stripped.
 */
export function chipLabels(
  ctx: StrategyContext,
  area: AreaEntry,
  entityIds: ReadonlyArray<string>,
): ReadonlyArray<LabeledEntity> {
  const variants = areaNameVariants(ctx.home, area);
  const scoped = (entityId: string): string => {
    const name = entityName(ctx, entityId);
    const stripped = stripAreaName(name, variants);
    return stripped === '' ? name : stripped;
  };
  const typed = (entityId: string): string => {
    const key = deviceTypeKey(entityId, ctx.states[entityId]);
    return key === undefined ? scoped(entityId) : t(ctx.locale, key);
  };
  return resolveLabels(entityIds, typed, scoped);
}

/**
 * Card names inside a room view: the entity's own name minus the room name the
 * view title already shows, falling back to the device type when that leaves
 * nothing, and to the untouched name when stripping would make two cards alike.
 */
export function roomScopedLabels(
  ctx: StrategyContext,
  area: AreaEntry,
  entityIds: ReadonlyArray<string>,
): ReadonlyArray<LabeledEntity> {
  const variants = areaNameVariants(ctx.home, area);
  const full = (entityId: string): string => entityName(ctx, entityId);
  const scoped = (entityId: string): string => {
    const stripped = stripAreaName(full(entityId), variants);
    if (stripped !== '') {
      return stripped;
    }
    const key = deviceTypeKey(entityId, ctx.states[entityId]);
    return key === undefined ? full(entityId) : t(ctx.locale, key);
  };
  return resolveLabels(entityIds, scoped, full);
}
