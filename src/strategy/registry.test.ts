import { describe, expect, it, vi } from 'vitest';
import { makeEntity, makeMockHass } from '../testing/mock-hass';
import {
  mockArea,
  mockDevice,
  mockLabel,
  mockRegEntity,
  mockSnapshot,
  referenceHome,
} from '../testing/mock-registry';
import { buildRegistryIndex, fetchRegistrySnapshot, QuietLuxeRegistryError } from './registry';

describe('fetchRegistrySnapshot', () => {
  const wsResponses = {
    'config/area_registry/list': [{ area_id: 'living', name: 'Living Room' }],
    'config/device_registry/list': [{ id: 'dev-1', area_id: 'living' }],
    'config/entity_registry/list': [
      { entity_id: 'light.pendant', device_id: 'dev-1', platform: 'hue' },
    ],
    'config/label_registry/list': [{ label_id: 'ql_hidden', name: 'ql-hidden' }],
  };

  it('normalizes raw rows (labels/nullables) into the snapshot shape', async () => {
    const hass = makeMockHass([], { wsResponses });
    const snapshot = await fetchRegistrySnapshot(hass);
    expect(snapshot.areas).toEqual([
      { area_id: 'living', name: 'Living Room', picture: null, labels: [], aliases: [] },
    ]);
    expect(snapshot.devices).toEqual([{ id: 'dev-1', area_id: 'living', labels: [] }]);
    expect(snapshot.labels).toEqual([{ label_id: 'ql_hidden', name: 'ql-hidden' }]);
    expect(snapshot.entities).toEqual([
      {
        entity_id: 'light.pendant',
        area_id: null,
        device_id: 'dev-1',
        labels: [],
        hidden_by: null,
        disabled_by: null,
        entity_category: null,
        platform: 'hue',
        name: null,
      },
    ]);
    expect(hass.wsCalls.map((call) => call.type)).toEqual([
      'config/area_registry/list',
      'config/device_registry/list',
      'config/entity_registry/list',
      'config/label_registry/list',
    ]);
  });

  it('throws QuietLuxeRegistryError when callWS is missing', async () => {
    const hass = makeMockHass([], { wsResponses });
    const withoutWs = { ...hass, callWS: undefined };
    await expect(fetchRegistrySnapshot(withoutWs)).rejects.toBeInstanceOf(QuietLuxeRegistryError);
  });

  it('keeps generating, loudly, on cores with no label registry', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const older = { ...wsResponses, 'config/label_registry/list': undefined };
    const snapshot = await fetchRegistrySnapshot(makeMockHass([], { wsResponses: older }));
    expect(snapshot.labels).toEqual([]);
    expect(snapshot.entities).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('wraps WS failures loudly', async () => {
    const hass = makeMockHass([], { wsResponses: {} });
    await expect(fetchRegistrySnapshot(hass)).rejects.toThrowError(/registry read failed/);
  });
});

describe('buildRegistryIndex', () => {
  /* Real-instance shape: the registry holds the display names, and the rows
     carry the slugified label_ids HA derives from them. */
  const snapshot = mockSnapshot({
    areas: [mockArea('living', 'Living Room'), mockArea('bedroom', 'Bedroom')],
    devices: [mockDevice('dev-motion', 'living')],
    labels: [mockLabel('ql-favorite'), mockLabel('ql-hidden')],
    entities: [
      mockRegEntity('light.pendant', { area_id: 'living' }),
      mockRegEntity('light.fav_lamp', { area_id: 'living', labels: ['ql_favorite'] }),
      mockRegEntity('light.hidden_strip', { area_id: 'living', labels: ['ql_hidden'] }),
      mockRegEntity('sensor.living_temp', { area_id: 'living' }),
      mockRegEntity('sensor.diag_rssi', { area_id: 'living', entity_category: 'diagnostic' }),
      mockRegEntity('binary_sensor.hall_motion', { device_id: 'dev-motion' }),
      mockRegEntity('switch.hall_motion_detection', { device_id: 'dev-motion' }),
      mockRegEntity('light.disabled', { area_id: 'living', disabled_by: 'user' }),
      mockRegEntity('media_player.sonos', { area_id: 'bedroom', platform: 'sonos' }),
    ],
  });
  const states = Object.fromEntries(
    [
      makeEntity('light.pendant', 'on'),
      makeEntity('light.fav_lamp', 'off'),
      makeEntity('sensor.living_temp', '24.5', { device_class: 'temperature' }),
      makeEntity('binary_sensor.hall_motion', 'off', { device_class: 'motion' }),
      makeEntity('switch.hall_motion_detection', 'on'),
      makeEntity('media_player.sonos', 'idle'),
    ].map((entity) => [entity.entity_id, entity]),
  );
  const index = buildRegistryIndex(snapshot, states);

  it('sorts areas by name', () => {
    expect(index.areas.map((area) => area.area_id)).toEqual(['bedroom', 'living']);
  });

  it('excludes hidden/disabled/diagnostic/ql-hidden entities everywhere', () => {
    // Device-linked motion entities land in 'living' via dev-motion; favorites
    // first, then alphabetical.
    expect(index.inAreaAll('living')).toEqual([
      'light.fav_lamp',
      'binary_sensor.hall_motion',
      'light.pendant',
      'sensor.living_temp',
      'switch.hall_motion_detection',
    ]);
  });

  it('puts ql-favorite entities first within a bucket', () => {
    expect(index.inArea('living', 'light')).toEqual(['light.fav_lamp', 'light.pendant']);
  });

  it('assigns device-linked entities to the device area', () => {
    expect(index.inArea('living', 'binary_sensor', 'motion')).toEqual([
      'binary_sensor.hall_motion',
    ]);
  });

  it('filters by device_class read from states', () => {
    expect(index.all('sensor', 'temperature')).toEqual(['sensor.living_temp']);
    expect(index.all('sensor', 'aqi')).toEqual([]);
  });

  it('exposes labels, platform, and device siblings', () => {
    expect(index.hasLabel('light.fav_lamp', 'ql-favorite')).toBe(true);
    expect(index.platformOf('media_player.sonos')).toBe('sonos');
    expect(index.siblings('binary_sensor.hall_motion')).toEqual([
      'switch.hall_motion_detection',
    ]);
  });
});

describe('label resolution', () => {
  const hiddenIndex = (
    labels: ReadonlyArray<{ label_id: string; name: string }>,
    rowLabels: ReadonlyArray<string>,
  ): ReadonlyArray<string> =>
    buildRegistryIndex(
      mockSnapshot({
        areas: [mockArea('living', 'Living Room')],
        devices: [],
        labels,
        entities: [
          mockRegEntity('camera.dining_room', { area_id: 'living' }),
          mockRegEntity('camera.dining_room_profile_000', { area_id: 'living', labels: rowLabels }),
        ],
      }),
      {},
    ).inAreaAll('living');

  /* The shipped bug: HA slugifies the label name "ql-hidden" into the id
     "ql_hidden", entity rows carry that id, and the strategy compared against
     the name — so every labelled entity kept rendering. */
  it('hides an entity carrying the slugified label_id of a ql-hidden label', () => {
    expect(hiddenIndex([{ label_id: 'ql_hidden', name: 'ql-hidden' }], ['ql_hidden'])).toEqual([
      'camera.dining_room',
    ]);
  });

  it('resolves through the registry when HA disambiguated the id', () => {
    expect(hiddenIndex([{ label_id: 'ql_hidden_2', name: 'ql-hidden' }], ['ql_hidden_2'])).toEqual([
      'camera.dining_room',
    ]);
  });

  it('accepts the raw id spelling, any case, with no registry entry', () => {
    expect(hiddenIndex([], ['QL-Hidden'])).toEqual(['camera.dining_room']);
    expect(hiddenIndex([], ['ql-hidden'])).toEqual(['camera.dining_room']);
  });

  it('does not hide entities carrying unrelated labels', () => {
    expect(hiddenIndex([{ label_id: 'downstairs', name: 'Downstairs' }], ['downstairs'])).toEqual([
      'camera.dining_room',
      'camera.dining_room_profile_000',
    ]);
  });

  it('matches ql-primary-camera by resolved id via hasLabel', () => {
    const index = buildRegistryIndex(
      mockSnapshot({
        areas: [],
        devices: [],
        labels: [mockLabel('ql-primary-camera')],
        entities: [mockRegEntity('camera.front', { labels: ['ql_primary_camera'] })],
      }),
      {},
    );
    expect(index.hasLabel('camera.front', 'ql-primary-camera')).toBe(true);
    expect(index.hasLabel('camera.front', 'ql-favorite')).toBe(false);
  });
});

describe('referenceHome fixtures', () => {
  it('subang fixture buckets hallmark entities', () => {
    const { snapshot: subang, entities } = referenceHome('subang');
    const states = Object.fromEntries(entities.map((entity) => [entity.entity_id, entity]));
    const index = buildRegistryIndex(subang, states);
    expect(index.inArea('main_living', 'light')).toContain('light.main_living_pendant');
    expect(index.all('camera')[0]).toBe('camera.front_gate'); // ql-favorite? no: primary label ordering is a section concern; alphabetical here
    expect(index.all('vacuum')).toEqual([]);
  });

  it('tungchung fixture drops its ql-hidden camera and motion sensor', () => {
    const { snapshot: tungchung, entities } = referenceHome('tungchung');
    const states = Object.fromEntries(entities.map((entity) => [entity.entity_id, entity]));
    const index = buildRegistryIndex(tungchung, states);
    expect(index.all('camera')).toEqual(['camera.srihome_living']);
    expect(index.all('binary_sensor', 'motion')).toEqual(['binary_sensor.living_motion']);
  });

  it('xiamen fixture has a vacuum and no calendars', () => {
    const { snapshot: xiamen, entities } = referenceHome('xiamen');
    const states = Object.fromEntries(entities.map((entity) => [entity.entity_id, entity]));
    const index = buildRegistryIndex(xiamen, states);
    expect(index.all('vacuum')).toEqual(['vacuum.dreame_x30']);
    expect(index.all('calendar')).toEqual([]);
  });
});
