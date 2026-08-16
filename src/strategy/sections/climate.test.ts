import { describe, expect, it } from 'vitest';
import { makeEntity } from '../../testing/mock-hass';
import { labelId, makeContext, mockArea, mockLabel, mockRegEntity } from '../../testing/mock-registry';
import type { StrategyContext } from '../types';
import { climateCards, climateEntityIds, climateSection } from './climate';

const snapshot = {
  areas: [mockArea('living', 'Living Room'), mockArea('bedroom', 'Bedroom')],
  devices: [],
  entities: [
    mockRegEntity('climate.living_ac', { area_id: 'living' }),
    mockRegEntity('climate.bedroom_ac', { area_id: 'bedroom' }),
    mockRegEntity('fan.living_purifier', { area_id: 'living' }),
    mockRegEntity('humidifier.bedroom_dehumidifier', { area_id: 'bedroom' }),
  ],
};
const entities = [
  makeEntity('climate.living_ac', 'off'),
  makeEntity('climate.bedroom_ac', 'cool'),
  makeEntity('fan.living_purifier', 'on'),
  makeEntity('humidifier.bedroom_dehumidifier', 'off'),
];

describe('climateEntityIds', () => {
  it('collects climate/fan/humidifier domains, active devices first', () => {
    const ctx = makeContext({ snapshot, entities });
    expect(climateEntityIds(ctx)).toEqual([
      'climate.bedroom_ac',
      'fan.living_purifier',
      'climate.living_ac',
      'humidifier.bedroom_dehumidifier',
    ]);
  });

  it('scopes to an area when given', () => {
    const ctx = makeContext({ snapshot, entities });
    expect(climateEntityIds(ctx, 'living')).toEqual([
      'fan.living_purifier',
      'climate.living_ac',
    ]);
  });
});

describe('climateSection', () => {
  it('limits cards, links the heading to the climates view, sizes cards 4 columns', () => {
    const ctx = makeContext({ snapshot, entities });
    const section = climateSection(ctx, { limit: 3 });
    expect(section?.cards[0]).toMatchObject({
      type: 'heading',
      tap_action: { action: 'navigate', navigation_path: '/quiet-luxe/climates' },
    });
    expect(section?.cards).toHaveLength(4); // heading + 3
    /* The section is one view track wide, so nothing in it takes a half-track. */
    expect(section?.cards[1]).toEqual({
      type: 'custom:quiet-luxe-climate-card',
      entity: 'climate.bedroom_ac',
      grid_options: { columns: 12, rows: 'auto' },
    });
    for (const card of section?.cards.slice(1) ?? []) {
      expect(card.grid_options, card.entity as string).toEqual({ columns: 12, rows: 'auto' });
    }
  });

  it('room-scoped sections have no heading navigation', () => {
    const ctx = makeContext({ snapshot, entities });
    const section = climateSection(ctx, { areaId: 'living' });
    expect(section?.cards[0]).toEqual({
      type: 'heading',
      heading: 'Climate',
    });
  });

  it('returns null when the home has no climate devices', () => {
    expect(climateSection(makeContext({}))).toBeNull();
    expect(climateCards(makeContext({}))).toEqual([]);
  });
});

/**
 * Routing between the dial card and the plain tile is decided by what the
 * entity reports, not by its domain or its name — probed against the live
 * masks on the Tung Chung instance.
 */
describe('climateCards routing to the dial', () => {
  const dialSnapshot = {
    areas: [mockArea('bedroom', 'Bedroom')],
    devices: [],
    entities: [
      mockRegEntity('climate.steven_bedroom', { area_id: 'bedroom' }),
      mockRegEntity('climate.exhaust', { area_id: 'bedroom' }),
      mockRegEntity('humidifier.dehumidifier', { area_id: 'bedroom' }),
    ],
  };
  /** 937 with a reported setpoint; 384 = turn on/off only; a humidifier. */
  const dialEntities = [
    makeEntity('climate.steven_bedroom', 'cool', {
      supported_features: 937,
      temperature: 23,
      min_temp: 17,
      max_temp: 30,
      target_temp_step: 1,
    }),
    makeEntity('climate.exhaust', 'fan_only', { supported_features: 384 }),
    makeEntity('humidifier.dehumidifier', 'on', { supported_features: 1, humidity: 50 }),
  ];

  it('gives a climate entity with a setpoint the dial card', () => {
    const ctx = makeContext({ snapshot: dialSnapshot, entities: dialEntities });
    const card = climateCards(ctx).find((c) => c.entity === 'climate.steven_bedroom');
    expect(card).toMatchObject({ type: 'custom:quiet-luxe-climate-dial-card', form: 'compact' });
  });

  it('keeps the plain tile for a climate entity with no setpoint', () => {
    const ctx = makeContext({ snapshot: dialSnapshot, entities: dialEntities });
    expect(climateCards(ctx).find((c) => c.entity === 'climate.exhaust')).toEqual({
      type: 'custom:quiet-luxe-climate-card',
      entity: 'climate.exhaust',
    });
  });

  it('keeps the plain tile for a humidifier, which has no temperature to dial', () => {
    const ctx = makeContext({ snapshot: dialSnapshot, entities: dialEntities });
    expect(climateCards(ctx).find((c) => c.entity === 'humidifier.dehumidifier')).toEqual({
      type: 'custom:quiet-luxe-climate-card',
      entity: 'humidifier.dehumidifier',
    });
  });

  it('takes its form from the caller, not from whether an area was given', () => {
    // All Climates groups by area too, so it passes an areaId AND asks for the
    // full card — the form must follow the request, not the scoping.
    const ctx = makeContext({ snapshot: dialSnapshot, entities: dialEntities });
    const dialOf = (cards: ReturnType<typeof climateCards>): unknown =>
      cards.find((card) => card.entity === 'climate.steven_bedroom');
    expect(dialOf(climateCards(ctx, 'bedroom'))).toMatchObject({ form: 'compact' });
    expect(dialOf(climateCards(ctx, 'bedroom', undefined, 'full'))).toMatchObject({ form: 'full' });
    expect(dialOf(climateCards(ctx))).toMatchObject({ form: 'compact' });
  });

  it('does not dial a device that has not reported a setpoint yet', () => {
    const pending = [
      makeEntity('climate.steven_bedroom', 'cool', { supported_features: 937, temperature: null }),
    ];
    const ctx = makeContext({
      snapshot: { ...dialSnapshot, entities: dialSnapshot.entities.slice(0, 1) },
      entities: pending,
    });
    expect(climateCards(ctx)[0]).toMatchObject({ type: 'custom:quiet-luxe-climate-card' });
  });
});

/**
 * The dial card's header glyph resolves its weather entity the same way the
 * home header does (`views/home.ts`): `registry.all('weather')[0]`.
 */
describe('climateCards weather_entity on the dial card', () => {
  const dialEntity = mockRegEntity('climate.steven_bedroom', { area_id: 'bedroom' });
  const dialState = makeEntity('climate.steven_bedroom', 'cool', {
    supported_features: 937,
    temperature: 23,
    min_temp: 17,
    max_temp: 30,
    target_temp_step: 1,
  });
  const areas = [mockArea('bedroom', 'Bedroom')];

  it('passes the resolved weather entity through to the dial card', () => {
    const ctx = makeContext({
      snapshot: { areas, devices: [], entities: [dialEntity, mockRegEntity('weather.home')] },
      entities: [dialState, makeEntity('weather.home', 'sunny')],
    });
    const card = climateCards(ctx).find((c) => c.entity === 'climate.steven_bedroom');
    expect(card).toMatchObject({ weather_entity: 'weather.home' });
  });

  it('omits weather_entity entirely rather than sending it empty or null when none exists', () => {
    const ctx = makeContext({
      snapshot: { areas, devices: [], entities: [dialEntity] },
      entities: [dialState],
    });
    const card = climateCards(ctx).find((c) => c.entity === 'climate.steven_bedroom');
    expect(card).not.toHaveProperty('weather_entity');
  });

  it('picks alphabetically first among several weather entities, deterministically', () => {
    const ctx = makeContext({
      snapshot: {
        areas,
        devices: [],
        entities: [dialEntity, mockRegEntity('weather.home'), mockRegEntity('weather.zzz_backup')],
      },
      entities: [dialState, makeEntity('weather.home', 'sunny'), makeEntity('weather.zzz_backup', 'cloudy')],
    });
    const card = climateCards(ctx).find((c) => c.entity === 'climate.steven_bedroom');
    expect(card).toMatchObject({ weather_entity: 'weather.home' });
  });

  it('prefers a ql-favorite-labelled weather entity over alphabetical order', () => {
    const ctx = makeContext({
      snapshot: {
        areas,
        devices: [],
        labels: [mockLabel('ql-favorite')],
        entities: [
          dialEntity,
          mockRegEntity('weather.home'),
          mockRegEntity('weather.aaa_backup', { labels: [labelId('ql-favorite')] }),
        ],
      },
      entities: [dialState, makeEntity('weather.home', 'sunny'), makeEntity('weather.aaa_backup', 'cloudy')],
    });
    const card = climateCards(ctx).find((c) => c.entity === 'climate.steven_bedroom');
    expect(card).toMatchObject({ weather_entity: 'weather.aaa_backup' });
  });

  it('never sets weather_entity on the plain climate tile', () => {
    const ctx = makeContext({
      snapshot: {
        areas,
        devices: [],
        entities: [mockRegEntity('climate.exhaust', { area_id: 'bedroom' }), mockRegEntity('weather.home')],
      },
      entities: [
        makeEntity('climate.exhaust', 'fan_only', { supported_features: 384 }),
        makeEntity('weather.home', 'sunny'),
      ],
    });
    expect(climateCards(ctx)).toEqual([
      { type: 'custom:quiet-luxe-climate-card', entity: 'climate.exhaust' },
    ]);
  });
});

/**
 * Both the dial card's eyebrow and the plain tile's label drop the room name
 * only where the room is already established by context — the room view's
 * own title (`roomScopedArea` threaded from `views/room.ts`). Home and All
 * Climates mix rooms on one screen and never pass it, so they keep the
 * entity's full name untouched. The plain tile gets the same treatment as
 * the dial because both draw their label through the same shared `nameOf`
 * chain (`ql-base-card.ts`) — the room already stripped for the room view's
 * light/cover/switch cards via `roomScopedLabels`.
 */
describe('climateCards room-scoped climate name', () => {
  const area = mockArea('steven_bedroom', 'Steven Bedroom');
  const dialAttrs = {
    supported_features: 937,
    temperature: 23,
    min_temp: 17,
    max_temp: 30,
    target_temp_step: 1,
  } as const;

  function ctxFor(friendlyName: string): StrategyContext {
    return makeContext({
      snapshot: {
        areas: [area],
        devices: [],
        entities: [mockRegEntity('climate.dial', { area_id: 'steven_bedroom' })],
      },
      entities: [makeEntity('climate.dial', 'cool', { ...dialAttrs, friendly_name: friendlyName })],
    });
  }

  it('strips the room name in a room-scoped call', () => {
    const ctx = ctxFor('Sensibo AC Steven Bedroom');
    const card = climateCards(ctx, 'steven_bedroom', undefined, 'compact', area).find(
      (c) => c.entity === 'climate.dial',
    );
    expect(card).toMatchObject({ name: 'Sensibo AC' });
  });

  it('keeps the full name when no roomScopedArea is given (Home, All Climates)', () => {
    const ctx = ctxFor('Sensibo AC Steven Bedroom');
    const card = climateCards(ctx, 'steven_bedroom').find((c) => c.entity === 'climate.dial');
    expect(card).not.toHaveProperty('name');
  });

  it('leaves a name untouched when it does not actually contain the area', () => {
    const ctx = ctxFor('Living Room Sensibo');
    const card = climateCards(ctx, 'steven_bedroom', undefined, 'compact', area).find(
      (c) => c.entity === 'climate.dial',
    );
    expect(card).toMatchObject({ name: 'Living Room Sensibo' });
  });

  it('keeps the original name when stripping would leave nothing at all', () => {
    // Friendly name IS the room name — the device (Sensibo skyv2) is literally
    // named after its room, verified on climate.steven_bedroom, Tung Chung,
    // dev/live-snapshot.json.
    const ctx = ctxFor('Steven Bedroom');
    const card = climateCards(ctx, 'steven_bedroom', undefined, 'compact', area).find(
      (c) => c.entity === 'climate.dial',
    );
    expect(card).toMatchObject({ name: 'Steven Bedroom' });
  });

  it('keeps the original name when stripping would leave an initialism ("AC")', () => {
    const ctx = ctxFor('AC Steven Bedroom');
    const card = climateCards(ctx, 'steven_bedroom', undefined, 'compact', area).find(
      (c) => c.entity === 'climate.dial',
    );
    expect(card).toMatchObject({ name: 'AC Steven Bedroom' });
  });

  function exhaustCtx(friendlyName: string): StrategyContext {
    return makeContext({
      snapshot: {
        areas: [area],
        devices: [],
        entities: [mockRegEntity('climate.exhaust', { area_id: 'steven_bedroom' })],
      },
      entities: [
        makeEntity('climate.exhaust', 'fan_only', { supported_features: 384, friendly_name: friendlyName }),
      ],
    });
  }

  it('strips the room name on the plain (non-dial) climate tile too, room-scoped', () => {
    const ctx = exhaustCtx('Exhaust Steven Bedroom');
    const card = climateCards(ctx, 'steven_bedroom', undefined, 'compact', area).find(
      (c) => c.entity === 'climate.exhaust',
    );
    expect(card).toEqual({
      type: 'custom:quiet-luxe-climate-card',
      entity: 'climate.exhaust',
      name: 'Exhaust',
    });
  });

  it('keeps the plain tile untouched on Home/All Climates (no roomScopedArea)', () => {
    const ctx = exhaustCtx('Exhaust Steven Bedroom');
    const card = climateCards(ctx, 'steven_bedroom').find((c) => c.entity === 'climate.exhaust');
    expect(card).toEqual({ type: 'custom:quiet-luxe-climate-card', entity: 'climate.exhaust' });
  });

  it('keeps the original name on the plain tile too, when stripping would leave it too short', () => {
    const ctx = exhaustCtx('AC Steven Bedroom');
    const card = climateCards(ctx, 'steven_bedroom', undefined, 'compact', area).find(
      (c) => c.entity === 'climate.exhaust',
    );
    expect(card).toEqual({
      type: 'custom:quiet-luxe-climate-card',
      entity: 'climate.exhaust',
      name: 'AC Steven Bedroom',
    });
  });
});
