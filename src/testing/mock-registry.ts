import type { HassEntity } from '../types/home-assistant';
import type { Locale } from '../i18n/types';
import { validateHomeConfig, type HomeConfig } from '../strategy/config';
import {
  buildRegistryIndex,
  type AreaEntry,
  type DeviceEntry,
  type EntityEntry,
  type LabelEntry,
  type RegistrySnapshot,
} from '../strategy/registry';
import type { StrategyContext, Tier } from '../strategy/types';
import { makeEntity } from './mock-hass';

export function mockArea(areaId: string, name: string, extra: Partial<AreaEntry> = {}): AreaEntry {
  return { area_id: areaId, name, picture: null, labels: [], aliases: [], ...extra };
}

export function mockDevice(
  id: string,
  areaId: string | null = null,
  extra: Partial<DeviceEntry> = {},
): DeviceEntry {
  return { id, area_id: areaId, labels: [], ...extra };
}

export function mockRegEntity(entityId: string, extra: Partial<EntityEntry> = {}): EntityEntry {
  return {
    entity_id: entityId,
    area_id: null,
    device_id: null,
    labels: [],
    hidden_by: null,
    disabled_by: null,
    entity_category: null,
    platform: 'test',
    name: null,
    ...extra,
  };
}

/**
 * A label as HA stores it: the user types the name, HA slugifies it into the
 * id that every other registry row then carries. Fixtures must go through this
 * so they never repeat the bug where code compared against the display name.
 */
export function mockLabel(name: string, labelId?: string): LabelEntry {
  return { label_id: labelId ?? name.trim().toLowerCase().replace(/[\s-]+/g, '_'), name };
}

/** The id an entity/device/area row would carry for a label of this name. */
export function labelId(name: string): string {
  return mockLabel(name).label_id;
}

/** Snapshot literal for tests; `labels` defaults to "instance defines none". */
export type MockSnapshot = Omit<RegistrySnapshot, 'labels'> & {
  readonly labels?: ReadonlyArray<LabelEntry>;
};

export function mockSnapshot(snapshot: MockSnapshot): RegistrySnapshot {
  return { ...snapshot, labels: snapshot.labels ?? [] };
}

export interface MockContextOptions {
  /**
   * Raw home config merged over { name: 'Test Home' } and validated. The
   * HomeConfig union member lets tests pass reference configs (interfaces are
   * not assignable to Record<string, unknown> under strict TS).
   */
  readonly home?: Record<string, unknown> | HomeConfig;
  readonly snapshot?: MockSnapshot;
  readonly entities?: ReadonlyArray<HassEntity>;
  readonly locale?: Locale;
  readonly tier?: Tier;
  readonly hasApexcharts?: boolean;
  readonly hasWebrtcCard?: boolean;
}

export function makeContext(options: MockContextOptions = {}): StrategyContext {
  const snapshot = mockSnapshot(options.snapshot ?? { areas: [], devices: [], entities: [] });
  const states = Object.fromEntries(
    (options.entities ?? []).map((entity) => [entity.entity_id, entity]),
  );
  return {
    home: validateHomeConfig({ name: 'Test Home', ...(options.home ?? {}) }),
    registry: buildRegistryIndex(snapshot, states),
    states,
    locale: options.locale ?? 'en',
    tier: options.tier ?? 'admin',
    hasApexcharts: options.hasApexcharts ?? false,
    hasWebrtcCard: options.hasWebrtcCard ?? false,
  };
}

/* ------------------------------------------------------------------ */
/* Reference-home registry fixtures (pair with src/strategy/reference-homes.ts) */

export type ReferenceHomeName = 'subang' | 'tungchung' | 'xiamen';

export interface ReferenceHome {
  readonly snapshot: RegistrySnapshot;
  readonly entities: ReadonlyArray<HassEntity>;
}

interface Row {
  readonly id: string;
  readonly state: string;
  readonly area?: string;
  readonly device?: string;
  readonly platform?: string;
  /** Label *names*; stored on the row as the label_ids HA would derive. */
  readonly labels?: ReadonlyArray<string>;
  readonly attributes?: Record<string, unknown>;
}

/**
 * Rows name their labels, and the fixture derives both the row's label_ids and
 * the label registry from those names — exactly the split a real instance has.
 */
function build(
  areas: ReadonlyArray<AreaEntry>,
  devices: ReadonlyArray<DeviceEntry>,
  rows: ReadonlyArray<Row>,
): ReferenceHome {
  const names = [...new Set(rows.flatMap((row) => row.labels ?? []))];
  return {
    snapshot: {
      areas,
      devices,
      labels: names.map((name) => mockLabel(name)),
      entities: rows.map((row) =>
        mockRegEntity(row.id, {
          area_id: row.area ?? null,
          device_id: row.device ?? null,
          platform: row.platform ?? 'test',
          labels: (row.labels ?? []).map((name) => labelId(name)),
        }),
      ),
    },
    entities: rows.map((row) => makeEntity(row.id, row.state, row.attributes ?? {})),
  };
}

const SUBANG: ReferenceHome = build(
  [
    mockArea('main_living', 'Main Living'),
    mockArea('side_living', 'Side Living'),
    mockArea('master_bedroom', 'Master Bedroom'),
  ],
  [mockDevice('dev-hall-motion', 'main_living')],
  [
    { id: 'light.main_living_pendant', state: 'on', area: 'main_living', attributes: { friendly_name: 'Pendant' } },
    { id: 'light.master_lamp', state: 'off', area: 'master_bedroom' },
    { id: 'climate.main_living_ac', state: 'cool', area: 'main_living' },
    { id: 'climate.master_ac', state: 'off', area: 'master_bedroom' },
    { id: 'fan.side_living_fan', state: 'on', area: 'side_living' },
    { id: 'cover.main_living_shade', state: 'open', area: 'main_living', attributes: { device_class: 'shade', current_position: 70 } },
    { id: 'cover.master_curtain', state: 'closed', area: 'master_bedroom', attributes: { device_class: 'curtain', current_position: 0 } },
    { id: 'sensor.main_living_temp', state: '24.5', area: 'main_living', attributes: { device_class: 'temperature' } },
    { id: 'sensor.main_living_humidity', state: '61', area: 'main_living', attributes: { device_class: 'humidity' } },
    { id: 'sensor.main_living_aqi', state: '18', area: 'main_living', attributes: { device_class: 'aqi' } },
    { id: 'media_player.living_sonos', state: 'playing', area: 'main_living', platform: 'sonos', attributes: { friendly_name: 'Living Sonos', media_title: 'So What' } },
    { id: 'media_player.kitchen_sonos', state: 'idle', platform: 'sonos', attributes: { friendly_name: 'Kitchen Sonos' } },
    { id: 'media_player.living_tv', state: 'off', area: 'main_living', platform: 'samsungtv', attributes: { device_class: 'tv', friendly_name: 'Living TV' } },
    { id: 'camera.front_gate', state: 'idle', platform: 'dahua', labels: ['ql-primary-camera'] },
    { id: 'camera.porch', state: 'idle', platform: 'dahua' },
    { id: 'person.steven', state: 'home', attributes: { friendly_name: 'Steven' } },
    { id: 'person.mei', state: 'home', attributes: { friendly_name: 'Mei' } },
    { id: 'calendar.family', state: 'off', platform: 'google_calendar' },
    { id: 'todo.family_tasks', state: '3', platform: 'google_tasks' },
    { id: 'weather.subang', state: 'rainy', attributes: { temperature: 31 } },
    { id: 'sensor.shelly_3em_total_power', state: '2350', attributes: { device_class: 'power' } },
    { id: 'sensor.shelly_3em_total_energy_today', state: '12.4', attributes: { device_class: 'energy' } },
    { id: 'sensor.shelly_3em_phase_a_power', state: '820', attributes: { device_class: 'power' } },
    { id: 'sensor.shelly_3em_phase_b_power', state: '640', attributes: { device_class: 'power' } },
    { id: 'sensor.shelly_3em_phase_c_power', state: '890', attributes: { device_class: 'power' } },
    { id: 'binary_sensor.front_door', state: 'off', attributes: { device_class: 'door', friendly_name: 'Front Door' } },
    { id: 'binary_sensor.hall_motion', state: 'off', area: 'main_living', device: 'dev-hall-motion', attributes: { device_class: 'motion', friendly_name: 'Hall Motion' } },
    { id: 'switch.hall_motion_detection', state: 'on', area: 'main_living', device: 'dev-hall-motion', attributes: { friendly_name: 'Hall Motion Detection' } },
    { id: 'switch.living_fan_rf', state: 'off', area: 'main_living', platform: 'broadlink', attributes: { friendly_name: 'Ceiling Fan' } },
    { id: 'switch.nr_guest_wifi', state: 'on', attributes: { friendly_name: 'Guest Wi-Fi' } },
    { id: 'switch.nr_plex_forward', state: 'off', attributes: { friendly_name: 'Plex port forward' } },
    { id: 'sensor.bmw_battery', state: '76', attributes: { device_class: 'battery' } },
    { id: 'sensor.bmw_range', state: '412' },
    { id: 'binary_sensor.bmw_lock', state: 'off', attributes: { device_class: 'lock' } },
    { id: 'device_tracker.bmw', state: 'home' },
  ],
);

const TUNGCHUNG: ReferenceHome = build(
  [mockArea('living', 'Living Room'), mockArea('bedroom', 'Bedroom')],
  [mockDevice('dev-living-motion', 'living')],
  [
    { id: 'light.living_ceiling', state: 'on', area: 'living' },
    { id: 'light.bedroom_lamp', state: 'off', area: 'bedroom' },
    { id: 'climate.living_ac', state: 'cool', area: 'living' },
    { id: 'cover.living_curtain', state: 'open', area: 'living', attributes: { device_class: 'curtain', current_position: 100 } },
    { id: 'sensor.living_temp', state: '27.0', area: 'living', attributes: { device_class: 'temperature' } },
    { id: 'sensor.living_aqi', state: '35', area: 'living', attributes: { device_class: 'aqi' } },
    { id: 'media_player.lg_tv', state: 'off', area: 'living', platform: 'webostv', attributes: { device_class: 'tv' } },
    { id: 'camera.srihome_living', state: 'idle', platform: 'generic' },
    /* The live Tung Chung instance labels its duplicate profile streams and the
       chattering per-cell motion sensors ql-hidden; both must stay off every
       view. */
    { id: 'camera.living_room_profile_000', state: 'idle', platform: 'generic', labels: ['ql-hidden'] },
    {
      id: 'binary_sensor.living_room_cell_motion_detection_2',
      state: 'off',
      area: 'living',
      device: 'dev-living-motion',
      labels: ['ql-hidden'],
      attributes: { device_class: 'motion' },
    },
    { id: 'person.steven', state: 'home', attributes: { friendly_name: 'Steven' } },
    { id: 'calendar.family', state: 'off', platform: 'google_calendar' },
    { id: 'todo.family_tasks', state: '1', platform: 'google_tasks' },
    { id: 'weather.tungchung', state: 'sunny', attributes: { temperature: 29 } },
    { id: 'binary_sensor.entry_door', state: 'off', attributes: { device_class: 'door' } },
    { id: 'binary_sensor.living_motion', state: 'off', area: 'living', device: 'dev-living-motion', attributes: { device_class: 'motion' } },
    { id: 'switch.living_motion_detection', state: 'on', area: 'living', device: 'dev-living-motion' },
    { id: 'switch.bedroom_fan_rf', state: 'off', area: 'bedroom', platform: 'broadlink' },
    { id: 'switch.nr_cam_uplink', state: 'on' },
    { id: 'sensor.audi_battery', state: '58', attributes: { device_class: 'battery' } },
    { id: 'sensor.audi_range', state: '230' },
  ],
);

const XIAMEN: ReferenceHome = build(
  [mockArea('living', 'Living Room'), mockArea('bedroom', 'Bedroom'), mockArea('storage', 'Storage')],
  [mockDevice('dev-entry-motion', 'living')],
  [
    { id: 'light.living_ceiling', state: 'on', area: 'living' },
    { id: 'light.storage_light', state: 'off', area: 'storage' },
    { id: 'climate.living_ac', state: 'cool', area: 'living' },
    { id: 'climate.bedroom_ac', state: 'off', area: 'bedroom' },
    { id: 'cover.living_curtain', state: 'open', area: 'living', attributes: { device_class: 'curtain', current_position: 100 } },
    { id: 'sensor.living_temp', state: '26.1', area: 'living', attributes: { device_class: 'temperature' } },
    { id: 'sensor.living_aqi', state: '52', area: 'living', attributes: { device_class: 'aqi' } },
    { id: 'media_player.tcl_tv', state: 'off', area: 'living', platform: 'tcl', attributes: { device_class: 'tv' } },
    { id: 'camera.dahua_living', state: 'idle', platform: 'dahua' },
    { id: 'vacuum.dreame_x30', state: 'docked', attributes: { battery_level: 100, friendly_name: 'Dreame X30 Pro' } },
    { id: 'person.steven', state: 'not_home', attributes: { friendly_name: 'Steven' } },
    { id: 'weather.xiamen', state: 'cloudy', attributes: { temperature: 33 } },
    { id: 'binary_sensor.entry_door', state: 'off', attributes: { device_class: 'door' } },
    { id: 'binary_sensor.entry_motion', state: 'off', area: 'living', device: 'dev-entry-motion', attributes: { device_class: 'motion' } },
    { id: 'switch.entry_motion_detection', state: 'on', area: 'living', device: 'dev-entry-motion' },
    { id: 'sensor.liauto_battery', state: '64', attributes: { device_class: 'battery' } },
    { id: 'sensor.liauto_fuel', state: '41' },
    { id: 'sensor.liauto_range', state: '588' },
  ],
);

export function referenceHome(name: ReferenceHomeName): ReferenceHome {
  return { subang: SUBANG, tungchung: TUNGCHUNG, xiamen: XIAMEN }[name];
}
