import type { HassEntity, HomeAssistant } from '../types/home-assistant';

export const LABEL_FAVORITE = 'ql-favorite';
export const LABEL_HIDDEN = 'ql-hidden';
export const LABEL_PRIMARY_CAMERA = 'ql-primary-camera';

export interface AreaEntry {
  readonly area_id: string;
  readonly name: string;
  readonly picture: string | null;
  readonly labels: ReadonlyArray<string>;
  /** HA area aliases — extra names the room is known by (used to de-duplicate labels). */
  readonly aliases: ReadonlyArray<string>;
}

export interface DeviceEntry {
  readonly id: string;
  readonly area_id: string | null;
  readonly labels: ReadonlyArray<string>;
}

export interface EntityEntry {
  readonly entity_id: string;
  readonly area_id: string | null;
  readonly device_id: string | null;
  readonly labels: ReadonlyArray<string>;
  readonly hidden_by: string | null;
  readonly disabled_by: string | null;
  readonly entity_category: string | null;
  readonly platform: string;
  readonly name: string | null;
}

/**
 * A row of HA's label registry. The user types a `name`; HA derives `label_id`
 * from it by slugifying ("ql-hidden" → "ql_hidden"). Every other registry row
 * stores label_ids, never names, so the registry is what connects the two.
 */
export interface LabelEntry {
  readonly label_id: string;
  readonly name: string;
}

export interface RegistrySnapshot {
  readonly areas: ReadonlyArray<AreaEntry>;
  readonly devices: ReadonlyArray<DeviceEntry>;
  readonly entities: ReadonlyArray<EntityEntry>;
  readonly labels: ReadonlyArray<LabelEntry>;
}

export class QuietLuxeRegistryError extends Error {
  constructor(message: string) {
    super(`[quiet-luxe] registry read failed: ${message}`);
    this.name = 'QuietLuxeRegistryError';
  }
}

/* Raw WS payload rows; labels are absent before HA 2024.4, hence ?? [] below. */
interface RawAreaEntry {
  readonly area_id: string;
  readonly name: string;
  readonly picture?: string | null;
  readonly labels?: ReadonlyArray<string>;
  readonly aliases?: ReadonlyArray<string>;
}

interface RawDeviceEntry {
  readonly id: string;
  readonly area_id?: string | null;
  readonly labels?: ReadonlyArray<string>;
}

interface RawEntityEntry {
  readonly entity_id: string;
  readonly area_id?: string | null;
  readonly device_id?: string | null;
  readonly labels?: ReadonlyArray<string>;
  readonly hidden_by?: string | null;
  readonly disabled_by?: string | null;
  readonly entity_category?: string | null;
  readonly platform?: string;
  readonly name?: string | null;
}

interface RawLabelEntry {
  readonly label_id: string;
  readonly name?: string | null;
}

/**
 * The label registry arrived with HA 2024.4; older cores reject the command and
 * have no labels at all. Degrading to "no labels defined" keeps the dashboard
 * generating there, and the warning keeps the degrade visible.
 */
async function fetchLabels(
  callWS: NonNullable<HomeAssistant['callWS']>,
): Promise<ReadonlyArray<LabelEntry>> {
  try {
    const labels = await callWS<ReadonlyArray<RawLabelEntry>>({
      type: 'config/label_registry/list',
    });
    return labels.map((label) => ({
      label_id: label.label_id,
      name: label.name ?? label.label_id,
    }));
  } catch (error) {
    console.warn('[quiet-luxe] label registry unavailable; ql-* labels ignored', error);
    return [];
  }
}

/**
 * Reads the HA registries over WebSocket — the documented custom-strategy data
 * path (developers.home-assistant.io custom-strategy, verified 2026-08-01).
 */
export async function fetchRegistrySnapshot(hass: HomeAssistant): Promise<RegistrySnapshot> {
  const callWS = hass.callWS;
  if (callWS === undefined) {
    throw new QuietLuxeRegistryError('hass.callWS is unavailable');
  }
  try {
    const [areas, devices, entities, labels] = await Promise.all([
      callWS<ReadonlyArray<RawAreaEntry>>({ type: 'config/area_registry/list' }),
      callWS<ReadonlyArray<RawDeviceEntry>>({ type: 'config/device_registry/list' }),
      callWS<ReadonlyArray<RawEntityEntry>>({ type: 'config/entity_registry/list' }),
      fetchLabels(callWS),
    ]);
    return {
      labels,
      areas: areas.map((area) => ({
        area_id: area.area_id,
        name: area.name,
        picture: area.picture ?? null,
        labels: area.labels ?? [],
        aliases: area.aliases ?? [],
      })),
      devices: devices.map((device) => ({
        id: device.id,
        area_id: device.area_id ?? null,
        labels: device.labels ?? [],
      })),
      entities: entities.map((entity) => ({
        entity_id: entity.entity_id,
        area_id: entity.area_id ?? null,
        device_id: entity.device_id ?? null,
        labels: entity.labels ?? [],
        hidden_by: entity.hidden_by ?? null,
        disabled_by: entity.disabled_by ?? null,
        entity_category: entity.entity_category ?? null,
        platform: entity.platform ?? '',
        name: entity.name ?? null,
      })),
    };
  } catch (error) {
    throw new QuietLuxeRegistryError(error instanceof Error ? error.message : String(error));
  }
}

export interface RegistryIndex {
  /** All areas, sorted by name. Ordering/hiding per home config is a section concern. */
  readonly areas: ReadonlyArray<AreaEntry>;
  area(areaId: string): AreaEntry | undefined;
  /** All visible entity ids assigned (directly or via device) to the area. */
  inAreaAll(areaId: string): ReadonlyArray<string>;
  inArea(areaId: string, domain: string, deviceClass?: string): ReadonlyArray<string>;
  all(domain: string, deviceClass?: string): ReadonlyArray<string>;
  hasLabel(entityId: string, label: string): boolean;
  platformOf(entityId: string): string | undefined;
  /** Visible entities sharing the entity's device (motion-toggle discovery). */
  siblings(entityId: string): ReadonlyArray<string>;
  /**
   * Every enabled entity on the device, including the `entity_category`
   * config/diagnostic ones `siblings` hides. A device's own settings — a night
   * mode switch, a filter-life sensor — are config entities by design, so a
   * card that draws the whole device has to see past the listing filter.
   */
  deviceEntities(entityId: string): ReadonlyArray<string>;
}

const EMPTY: ReadonlyArray<string> = [];

/**
 * Case- and separator-insensitive form of a label token. HA slugifies a label's
 * name into its id ("ql-hidden" → "ql_hidden"), so the two spellings have to
 * collapse onto one key before anything can be compared.
 */
function canonicalLabel(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** Tests one registry row's label_ids against a label named in our code. */
export interface LabelMatcher {
  matches(labels: ReadonlyArray<string>, wanted: string): boolean;
}

/**
 * Resolves a label *name* used in code (`ql-hidden`) to the *label_ids* HA
 * actually stamps on registry rows. Two layers, deliberately:
 *
 * 1. The label registry maps name → label_id, so renaming a label, or HA
 *    disambiguating an id (`ql_hidden_2`), still resolves to the right rows.
 * 2. A canonical-form comparison, so a label whose id or name the user spelled
 *    with hyphens, underscores, or mixed case matches what they intended even
 *    when the registry is unavailable.
 */
export function buildLabelMatcher(labels: ReadonlyArray<LabelEntry>): LabelMatcher {
  const idsByCanonical = new Map<string, Set<string>>();
  for (const label of labels) {
    for (const key of [canonicalLabel(label.name), canonicalLabel(label.label_id)]) {
      const ids = idsByCanonical.get(key) ?? new Set<string>();
      ids.add(label.label_id);
      idsByCanonical.set(key, ids);
    }
  }
  const noIds: ReadonlySet<string> = new Set<string>();
  return {
    matches: (rowLabels, wanted): boolean => {
      if (rowLabels.length === 0) {
        return false;
      }
      const key = canonicalLabel(wanted);
      const resolved = idsByCanonical.get(key) ?? noIds;
      return rowLabels.some((label) => resolved.has(label) || canonicalLabel(label) === key);
    },
  };
}

/**
 * Pure index over a registry snapshot. Visibility rules (spec §8):
 * hidden_by/disabled_by set, entity_category set (config/diagnostic), or the
 * ql-hidden label → excluded everywhere. ql-favorite sorts first per bucket.
 */
export function buildRegistryIndex(
  snapshot: RegistrySnapshot,
  states: Readonly<Record<string, HassEntity>>,
): RegistryIndex {
  const areaById = new Map(snapshot.areas.map((area) => [area.area_id, area]));
  const deviceById = new Map(snapshot.devices.map((device) => [device.id, device]));
  const labelMatcher = buildLabelMatcher(snapshot.labels);
  const favoriteRank = (entity: EntityEntry): number =>
    labelMatcher.matches(entity.labels, LABEL_FAVORITE) ? 0 : 1;
  const visible = snapshot.entities
    .filter(
      (entity) =>
        entity.hidden_by === null &&
        entity.disabled_by === null &&
        entity.entity_category === null &&
        !labelMatcher.matches(entity.labels, LABEL_HIDDEN),
    )
    .sort(
      (a, b) => favoriteRank(a) - favoriteRank(b) || a.entity_id.localeCompare(b.entity_id),
    );
  const entityById = new Map(visible.map((entity) => [entity.entity_id, entity]));
  const ordered = visible.map((entity) => entity.entity_id);

  const effectiveArea = (entity: EntityEntry): string | null =>
    entity.area_id ??
    (entity.device_id === null ? null : (deviceById.get(entity.device_id)?.area_id ?? null));

  const byArea = new Map<string, string[]>();
  const byDevice = new Map<string, string[]>();
  for (const entity of visible) {
    const areaId = effectiveArea(entity);
    if (areaId !== null) {
      byArea.set(areaId, [...(byArea.get(areaId) ?? []), entity.entity_id]);
    }
    if (entity.device_id !== null) {
      byDevice.set(entity.device_id, [...(byDevice.get(entity.device_id) ?? []), entity.entity_id]);
    }
  }

  /* Device membership over every enabled entity, config/diagnostic included. */
  const enabled = snapshot.entities.filter((entity) => entity.disabled_by === null);
  const deviceIdOf = new Map(enabled.map((entity) => [entity.entity_id, entity.device_id]));
  const allByDevice = new Map<string, string[]>();
  for (const entity of enabled) {
    if (entity.device_id !== null) {
      allByDevice.set(entity.device_id, [
        ...(allByDevice.get(entity.device_id) ?? []),
        entity.entity_id,
      ]);
    }
  }

  const domainOf = (id: string): string => id.split('.')[0] ?? '';
  const deviceClassOf = (id: string): string | undefined => {
    const deviceClass: unknown = states[id]?.attributes.device_class;
    return typeof deviceClass === 'string' ? deviceClass : undefined;
  };
  const matching = (
    ids: ReadonlyArray<string>,
    domain: string,
    deviceClass?: string,
  ): ReadonlyArray<string> =>
    ids.filter(
      (id) =>
        domainOf(id) === domain && (deviceClass === undefined || deviceClassOf(id) === deviceClass),
    );

  return {
    areas: [...snapshot.areas].sort((a, b) => a.name.localeCompare(b.name)),
    area: (areaId) => areaById.get(areaId),
    inAreaAll: (areaId) => byArea.get(areaId) ?? EMPTY,
    inArea: (areaId, domain, deviceClass) => matching(byArea.get(areaId) ?? EMPTY, domain, deviceClass),
    all: (domain, deviceClass) => matching(ordered, domain, deviceClass),
    hasLabel: (entityId, label): boolean => {
      const entity = entityById.get(entityId);
      return entity !== undefined && labelMatcher.matches(entity.labels, label);
    },
    platformOf: (entityId) => entityById.get(entityId)?.platform,
    siblings: (entityId): ReadonlyArray<string> => {
      const deviceId = entityById.get(entityId)?.device_id ?? null;
      if (deviceId === null) {
        return EMPTY;
      }
      return (byDevice.get(deviceId) ?? EMPTY).filter((id) => id !== entityId);
    },
    deviceEntities: (entityId): ReadonlyArray<string> => {
      const deviceId = deviceIdOf.get(entityId) ?? null;
      if (deviceId === null) {
        return EMPTY;
      }
      return allByDevice.get(deviceId) ?? EMPTY;
    },
  };
}
