import { describe, expect, it } from 'vitest';
import { makeEntity, makeMockHass } from '../testing/mock-hass';
import { mockArea, mockDevice, mockRegEntity, referenceHome } from '../testing/mock-registry';
import { buildRegistryIndex, fetchRegistrySnapshot, QuietLuxeRegistryError } from './registry';

describe('fetchRegistrySnapshot', () => {
  const wsResponses = {
    'config/area_registry/list': [{ area_id: 'living', name: 'Living Room' }],
    'config/device_registry/list': [{ id: 'dev-1', area_id: 'living' }],
    'config/entity_registry/list': [
      { entity_id: 'light.pendant', device_id: 'dev-1', platform: 'hue' },
    ],
  };

  it('normalizes raw rows (labels/nullables) into the snapshot shape', async () => {
    const hass = makeMockHass([], { wsResponses });
    const snapshot = await fetchRegistrySnapshot(hass);
    expect(snapshot.areas).toEqual([
      { area_id: 'living', name: 'Living Room', picture: null, labels: [], aliases: [] },
    ]);
    expect(snapshot.devices).toEqual([{ id: 'dev-1', area_id: 'living', labels: [] }]);
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
    ]);
  });

  it('throws QuietLuxeRegistryError when callWS is missing', async () => {
    const hass = makeMockHass([], { wsResponses });
    const withoutWs = { ...hass, callWS: undefined };
    await expect(fetchRegistrySnapshot(withoutWs)).rejects.toBeInstanceOf(QuietLuxeRegistryError);
  });

  it('wraps WS failures loudly', async () => {
    const hass = makeMockHass([], { wsResponses: {} });
    await expect(fetchRegistrySnapshot(hass)).rejects.toThrowError(/registry read failed/);
  });
});

describe('buildRegistryIndex', () => {
  const snapshot = {
    areas: [mockArea('living', 'Living Room'), mockArea('bedroom', 'Bedroom')],
    devices: [mockDevice('dev-motion', 'living')],
    entities: [
      mockRegEntity('light.pendant', { area_id: 'living' }),
      mockRegEntity('light.fav_lamp', { area_id: 'living', labels: ['ql-favorite'] }),
      mockRegEntity('light.hidden_strip', { area_id: 'living', labels: ['ql-hidden'] }),
      mockRegEntity('sensor.living_temp', { area_id: 'living' }),
      mockRegEntity('sensor.diag_rssi', { area_id: 'living', entity_category: 'diagnostic' }),
      mockRegEntity('binary_sensor.hall_motion', { device_id: 'dev-motion' }),
      mockRegEntity('switch.hall_motion_detection', { device_id: 'dev-motion' }),
      mockRegEntity('light.disabled', { area_id: 'living', disabled_by: 'user' }),
      mockRegEntity('media_player.sonos', { area_id: 'bedroom', platform: 'sonos' }),
    ],
  };
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

describe('referenceHome fixtures', () => {
  it('subang fixture buckets hallmark entities', () => {
    const { snapshot: subang, entities } = referenceHome('subang');
    const states = Object.fromEntries(entities.map((entity) => [entity.entity_id, entity]));
    const index = buildRegistryIndex(subang, states);
    expect(index.inArea('main_living', 'light')).toContain('light.main_living_pendant');
    expect(index.all('camera')[0]).toBe('camera.front_gate'); // ql-favorite? no: primary label ordering is a section concern; alphabetical here
    expect(index.all('vacuum')).toEqual([]);
  });

  it('xiamen fixture has a vacuum and no calendars', () => {
    const { snapshot: xiamen, entities } = referenceHome('xiamen');
    const states = Object.fromEntries(entities.map((entity) => [entity.entity_id, entity]));
    const index = buildRegistryIndex(xiamen, states);
    expect(index.all('vacuum')).toEqual(['vacuum.dreame_x30']);
    expect(index.all('calendar')).toEqual([]);
  });
});
