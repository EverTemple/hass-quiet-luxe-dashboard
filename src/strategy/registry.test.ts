import { describe, expect, it } from 'vitest';
import { makeMockHass } from '../testing/mock-hass';
import { fetchRegistrySnapshot, QuietLuxeRegistryError } from './registry';

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
      { area_id: 'living', name: 'Living Room', picture: null, labels: [] },
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
