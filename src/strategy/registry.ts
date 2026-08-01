import type { HomeAssistant } from '../types/home-assistant';

export const LABEL_FAVORITE = 'ql-favorite';
export const LABEL_HIDDEN = 'ql-hidden';
export const LABEL_PRIMARY_CAMERA = 'ql-primary-camera';

export interface AreaEntry {
  readonly area_id: string;
  readonly name: string;
  readonly picture: string | null;
  readonly labels: ReadonlyArray<string>;
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

export interface RegistrySnapshot {
  readonly areas: ReadonlyArray<AreaEntry>;
  readonly devices: ReadonlyArray<DeviceEntry>;
  readonly entities: ReadonlyArray<EntityEntry>;
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

/**
 * Reads the three HA registries over WebSocket — the documented custom-strategy
 * data path (developers.home-assistant.io custom-strategy, verified 2026-08-01).
 */
export async function fetchRegistrySnapshot(hass: HomeAssistant): Promise<RegistrySnapshot> {
  const callWS = hass.callWS;
  if (callWS === undefined) {
    throw new QuietLuxeRegistryError('hass.callWS is unavailable');
  }
  try {
    const [areas, devices, entities] = await Promise.all([
      callWS<ReadonlyArray<RawAreaEntry>>({ type: 'config/area_registry/list' }),
      callWS<ReadonlyArray<RawDeviceEntry>>({ type: 'config/device_registry/list' }),
      callWS<ReadonlyArray<RawEntityEntry>>({ type: 'config/entity_registry/list' }),
    ]);
    return {
      areas: areas.map((area) => ({
        area_id: area.area_id,
        name: area.name,
        picture: area.picture ?? null,
        labels: area.labels ?? [],
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
