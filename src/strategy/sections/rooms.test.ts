import { describe, expect, it } from 'vitest';
import { t } from '../../i18n/translate';
import { makeEntity } from '../../testing/mock-hass';
import { makeContext, mockArea, mockRegEntity } from '../../testing/mock-registry';
import { headingCard, sectionOf } from './heading';
import { orderedAreas, roomCardFor, roomPhoto, roomsSection } from './rooms';

const snapshot = {
  areas: [
    mockArea('living', 'Living Room'),
    mockArea('bedroom', 'Bedroom'),
    mockArea('empty', 'Empty Room'),
  ],
  devices: [],
  entities: [
    mockRegEntity('light.living_ceiling', { area_id: 'living' }),
    mockRegEntity('climate.living_ac', { area_id: 'living' }),
    mockRegEntity('sensor.living_temp', { area_id: 'living' }),
    mockRegEntity('light.bedroom_lamp', { area_id: 'bedroom' }),
  ],
};
const entities = [
  makeEntity('light.living_ceiling', 'on'),
  makeEntity('climate.living_ac', 'cool'),
  makeEntity('sensor.living_temp', '24.0', { device_class: 'temperature' }),
  makeEntity('light.bedroom_lamp', 'off'),
];

describe('headingCard / sectionOf', () => {
  it('renders translated headings with optional navigation', () => {
    expect(headingCard('en', 'section.rooms')).toEqual({ type: 'heading', heading: 'Rooms' });
    expect(headingCard('zh-Hant', 'section.rooms', '/quiet-luxe/home')).toEqual({
      type: 'heading',
      heading: t('zh-Hant', 'section.rooms'),
      tap_action: { action: 'navigate', navigation_path: '/quiet-luxe/home' },
    });
  });

  it('returns null when there are no cards (missing integration never renders)', () => {
    expect(sectionOf(headingCard('en', 'section.rooms'), [])).toBeNull();
  });
});

describe('orderedAreas', () => {
  it('drops areas with no visible entities and honours room_order, then name order', () => {
    const ctx = makeContext({ home: { room_order: ['bedroom'] }, snapshot, entities });
    expect(orderedAreas(ctx).map((area) => area.area_id)).toEqual(['bedroom', 'living']);
  });

  it('drops rooms hidden by override', () => {
    const ctx = makeContext({ home: { rooms: { bedroom: { hidden: true } } }, snapshot, entities });
    expect(orderedAreas(ctx).map((area) => area.area_id)).toEqual(['living']);
  });
});

describe('roomPhoto', () => {
  it('prefers override photo, then area picture, then the photo_base default', () => {
    const ctx = makeContext({
      home: { rooms: { living: { photo: '/local/custom.jpg' } } },
      snapshot,
      entities,
    });
    expect(roomPhoto(ctx.home, mockArea('living', 'Living Room'))).toBe('/local/custom.jpg');
    expect(
      roomPhoto(ctx.home, mockArea('bedroom', 'Bedroom', { picture: '/api/area.jpg' })),
    ).toBe('/api/area.jpg');
    expect(roomPhoto(ctx.home, mockArea('bedroom', 'Bedroom'))).toBe(
      '/local/quiet-luxe/rooms/bedroom.jpg',
    );
  });
});

describe('roomCardFor / roomsSection', () => {
  it('emits the full room card config for a populated area', () => {
    const ctx = makeContext({ snapshot, entities });
    expect(roomCardFor(ctx, mockArea('living', 'Living Room'))).toEqual({
      type: 'custom:quiet-luxe-room-card',
      name: 'Living Room',
      image: '/local/quiet-luxe/rooms/living.jpg',
      navigation_path: '/quiet-luxe/room-living',
      temperature_entity: 'sensor.living_temp',
      aqi_entity: undefined,
      lights_entity: 'light.living_ceiling',
      chips: [
        { entity: 'light.living_ceiling', label: 'Lights' },
        { entity: 'climate.living_ac', label: 'Aircon' },
      ],
      grid_options: { columns: 6 },
    });
  });

  it('labels chips by device type instead of repeating the room name', () => {
    const ctx = makeContext({
      locale: 'zh-Hant',
      snapshot: {
        areas: [mockArea('bedroom', 'Steven Bedroom')],
        devices: [],
        entities: [
          mockRegEntity('light.bedroom', { area_id: 'bedroom' }),
          mockRegEntity('cover.dooya_3763', { area_id: 'bedroom' }),
        ],
      },
      entities: [
        makeEntity('light.bedroom', 'on', { friendly_name: 'Steven Room' }),
        makeEntity('cover.dooya_3763', 'open', {
          friendly_name: '窗帘 Curatain',
          device_class: 'curtain',
        }),
      ],
    });
    expect(roomCardFor(ctx, mockArea('bedroom', 'Steven Bedroom')).chips).toEqual([
      { entity: 'light.bedroom', label: t('zh-Hant', 'device.lights') },
      { entity: 'cover.dooya_3763', label: t('zh-Hant', 'device.curtain') },
    ]);
  });

  it('returns a two-column section with heading, and null on an empty registry', () => {
    const populated = roomsSection(makeContext({ snapshot, entities }));
    expect(populated?.column_span).toBe(2);
    expect(populated?.cards[0]).toEqual({ type: 'heading', heading: 'Rooms' });
    expect(populated?.cards).toHaveLength(3); // heading + living + bedroom
    expect(roomsSection(makeContext({}))).toBeNull();
  });
});
