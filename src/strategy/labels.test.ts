import { describe, expect, it } from 'vitest';
import { makeEntity } from '../testing/mock-hass';
import { makeContext, mockArea, mockRegEntity } from '../testing/mock-registry';
import {
  areaNameVariants,
  chipLabels,
  deviceTypeKey,
  roomName,
  roomScopedLabels,
  stripAreaName,
} from './labels';

const AREA = mockArea('steven_bedroom', 'Steven Bedroom', { aliases: ['儿子房'] });

function contextWith(
  rows: ReadonlyArray<{ id: string; state?: string; attributes?: Record<string, unknown> }>,
): ReturnType<typeof makeContext> {
  return makeContext({
    snapshot: {
      areas: [AREA],
      devices: [],
      entities: rows.map((row) => mockRegEntity(row.id, { area_id: AREA.area_id })),
    },
    entities: rows.map((row) => makeEntity(row.id, row.state ?? 'on', row.attributes ?? {})),
  });
}

describe('deviceTypeKey', () => {
  it('maps domains to short device-type keys', () => {
    expect(deviceTypeKey('light.bedroom', undefined)).toBe('device.lights');
    expect(deviceTypeKey('climate.steven_bedroom', undefined)).toBe('device.aircon');
    expect(deviceTypeKey('fan.tp09', undefined)).toBe('device.fan');
    expect(deviceTypeKey('switch.exhaust', undefined)).toBe('device.switch');
    expect(deviceTypeKey('vacuum.dreame', undefined)).toBe('device.vacuum');
    expect(deviceTypeKey('camera.porch', undefined)).toBe('device.camera');
  });

  it('refines covers, media players and humidifiers by device_class', () => {
    const withClass = (id: string, deviceClass: string): ReturnType<typeof deviceTypeKey> =>
      deviceTypeKey(id, makeEntity(id, 'on', { device_class: deviceClass }));
    expect(withClass('cover.a', 'curtain')).toBe('device.curtain');
    expect(withClass('cover.a', 'shade')).toBe('device.shade');
    expect(withClass('cover.a', 'blind')).toBe('device.blind');
    expect(withClass('cover.a', 'garage')).toBe('device.garage');
    expect(withClass('media_player.a', 'tv')).toBe('device.tv');
    expect(withClass('media_player.a', 'speaker')).toBe('device.speaker');
    expect(withClass('humidifier.a', 'dehumidifier')).toBe('device.dehumidifier');
  });

  it('falls back to the domain key for unknown device classes', () => {
    expect(deviceTypeKey('cover.a', makeEntity('cover.a', 'open', { device_class: 'nonsense' }))).toBe(
      'device.cover',
    );
    expect(deviceTypeKey('media_player.a', undefined)).toBe('device.media');
  });

  it('returns undefined for domains with no device-type label', () => {
    expect(deviceTypeKey('sensor.temp', undefined)).toBeUndefined();
    expect(deviceTypeKey('bogus', undefined)).toBeUndefined();
  });
});

describe('stripAreaName', () => {
  it('strips the area name as a prefix or suffix, case-insensitively', () => {
    expect(stripAreaName('Living Room Curtain', ['Living Room'])).toBe('Curtain');
    expect(stripAreaName('Curtain Living Room', ['Living Room'])).toBe('Curtain');
    expect(stripAreaName('LIVING ROOM Curtain', ['Living Room'])).toBe('Curtain');
  });

  it('trims leftover separators and whitespace', () => {
    expect(stripAreaName('Living Room - Curtain', ['Living Room'])).toBe('Curtain');
    expect(stripAreaName('Living Room: Curtain', ['Living Room'])).toBe('Curtain');
    expect(stripAreaName('Curtain — Living Room', ['Living Room'])).toBe('Curtain');
  });

  it('strips CJK area names with no word separators', () => {
    expect(stripAreaName('客厅窗帘', ['客厅'])).toBe('窗帘');
    expect(stripAreaName('窗帘客厅', ['客厅'])).toBe('窗帘');
  });

  it('returns an empty string when the name is only the area name', () => {
    expect(stripAreaName('Living Room', ['Living Room'])).toBe('');
    expect(stripAreaName('  living room  ', ['Living Room'])).toBe('');
  });

  it('leaves names that merely overlap the area name alone', () => {
    expect(stripAreaName('Steven Room Ceiling', ['Steven Bedroom'])).toBe('Steven Room Ceiling');
    expect(stripAreaName('Bedside', ['Steven Bedroom'])).toBe('Bedside');
  });
});

describe('areaNameVariants', () => {
  it('collects the config override, the area name and its aliases', () => {
    const ctx = makeContext({ home: { rooms: { steven_bedroom: { name: "Steven's Room" } } } });
    expect(areaNameVariants(ctx.home, AREA)).toEqual(["Steven's Room", 'Steven Bedroom', '儿子房']);
  });

  it('de-duplicates when no override is configured', () => {
    const ctx = makeContext({});
    expect(areaNameVariants(ctx.home, AREA)).toEqual(['Steven Bedroom', '儿子房']);
  });

  it('includes config aliases for rooms whose devices are named after another name', () => {
    const ctx = makeContext({ home: { rooms: { steven_bedroom: { aliases: ['Steven Room'] } } } });
    expect(areaNameVariants(ctx.home, AREA)).toEqual(['Steven Bedroom', '儿子房', 'Steven Room']);
  });
});

describe('stripAreaName variant ordering', () => {
  it('prefers the longest matching room name so shorter ones cannot half-strip it', () => {
    expect(stripAreaName('Living Room Curtain', ['Living', 'Living Room'])).toBe('Curtain');
  });
});

describe('roomName', () => {
  it('prefers the config override over the registry area name', () => {
    const ctx = makeContext({ home: { rooms: { steven_bedroom: { name: 'Steven' } } } });
    expect(roomName(ctx.home, AREA)).toBe('Steven');
    expect(roomName(makeContext({}).home, AREA)).toBe('Steven Bedroom');
  });
});

describe('chipLabels', () => {
  it('labels chips by device type, never by the room name', () => {
    const ctx = contextWith([
      { id: 'light.bedroom', attributes: { friendly_name: 'Steven Room' } },
      { id: 'climate.steven_bedroom', attributes: { friendly_name: 'Steven Bedroom' } },
      {
        id: 'cover.dooya_m1_3763_curtain',
        attributes: { friendly_name: '窗帘 Curatain', device_class: 'curtain' },
      },
    ]);
    expect(
      chipLabels(ctx, AREA, [
        'light.bedroom',
        'climate.steven_bedroom',
        'cover.dooya_m1_3763_curtain',
      ]),
    ).toEqual([
      { entityId: 'light.bedroom', label: 'Lights' },
      { entityId: 'climate.steven_bedroom', label: 'Aircon' },
      { entityId: 'cover.dooya_m1_3763_curtain', label: 'Curtain' },
    ]);
  });

  it('translates device-type labels', () => {
    const ctx = makeContext({
      locale: 'zh-Hant',
      snapshot: { areas: [AREA], devices: [], entities: [] },
      entities: [makeEntity('light.bedroom', 'on')],
    });
    expect(chipLabels(ctx, AREA, ['light.bedroom'])[0]?.label).toBe('燈光');
  });

  it('falls back to the entity name when two chips share a device type', () => {
    const ctx = contextWith([
      {
        id: 'cover.dooya_m1_3763_curtain',
        attributes: { friendly_name: '窗帘 Curatain', device_class: 'curtain' },
      },
      {
        id: 'cover.dooya_m1_6e04_curtain',
        attributes: { friendly_name: '窗纱 Curatain', device_class: 'curtain' },
      },
    ]);
    const labels = chipLabels(ctx, AREA, [
      'cover.dooya_m1_3763_curtain',
      'cover.dooya_m1_6e04_curtain',
    ]).map((entry) => entry.label);
    expect(labels).toEqual(['窗帘 Curatain', '窗纱 Curatain']);
    expect(new Set(labels).size).toBe(2);
  });

  it('strips the room name from the disambiguating fallback', () => {
    const ctx = contextWith([
      {
        id: 'cover.a',
        attributes: { friendly_name: 'Steven Bedroom Sheer', device_class: 'curtain' },
      },
      {
        id: 'cover.b',
        attributes: { friendly_name: 'Steven Bedroom Blackout', device_class: 'curtain' },
      },
    ]);
    expect(chipLabels(ctx, AREA, ['cover.a', 'cover.b']).map((entry) => entry.label)).toEqual([
      'Sheer',
      'Blackout',
    ]);
  });

  it('appends a distinguishing token when stripping leaves the labels identical', () => {
    const ctx = contextWith([
      { id: 'cover.dooya_9845', attributes: { friendly_name: 'Curtain', device_class: 'curtain' } },
      { id: 'cover.dooya_fe9b', attributes: { friendly_name: 'Curtain', device_class: 'curtain' } },
    ]);
    const labels = chipLabels(ctx, AREA, ['cover.dooya_9845', 'cover.dooya_fe9b']).map(
      (entry) => entry.label,
    );
    expect(labels).toEqual(['Curtain 9845', 'Curtain Fe9b']);
  });

  it('never renders a bare entity id, even with no state and no device type', () => {
    const ctx = makeContext({ snapshot: { areas: [AREA], devices: [], entities: [] } });
    expect(chipLabels(ctx, AREA, ['sensor.hallway_lux'])).toEqual([
      { entityId: 'sensor.hallway_lux', label: 'Hallway Lux' },
    ]);
  });
});

describe('roomScopedLabels', () => {
  it('drops the room name a room view already shows in its title', () => {
    const ctx = contextWith([
      { id: 'light.a', attributes: { friendly_name: 'Steven Bedroom Ceiling' } },
      { id: 'light.b', attributes: { friendly_name: 'Bedside' } },
      { id: 'light.c', attributes: { friendly_name: '儿子房 Window' } },
    ]);
    expect(
      roomScopedLabels(ctx, AREA, ['light.a', 'light.b', 'light.c']).map((entry) => entry.label),
    ).toEqual(['Ceiling', 'Bedside', 'Window']);
  });

  it('falls back to the device-type label when the name is only the room name', () => {
    const ctx = contextWith([{ id: 'light.a', attributes: { friendly_name: 'Steven Bedroom' } }]);
    expect(roomScopedLabels(ctx, AREA, ['light.a'])[0]?.label).toBe('Lights');
  });

  it('restores the full name when stripping would collide', () => {
    const ctx = contextWith([
      { id: 'light.a', attributes: { friendly_name: 'Steven Bedroom Lamp' } },
      { id: 'light.b', attributes: { friendly_name: 'Lamp' } },
    ]);
    expect(roomScopedLabels(ctx, AREA, ['light.a', 'light.b']).map((entry) => entry.label)).toEqual([
      'Steven Bedroom Lamp',
      'Lamp',
    ]);
  });

  it('never renders a bare entity id', () => {
    const ctx = makeContext({ snapshot: { areas: [AREA], devices: [], entities: [] } });
    expect(roomScopedLabels(ctx, AREA, ['switch.dooya_m1_3763_mode'])).toEqual([
      { entityId: 'switch.dooya_m1_3763_mode', label: 'Dooya M1 3763 Mode' },
    ]);
  });
});
