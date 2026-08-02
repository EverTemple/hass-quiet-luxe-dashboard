import { describe, expect, it } from 'vitest';
import { makeEntity } from '../../testing/mock-hass';
import { makeContext, mockArea, mockRegEntity } from '../../testing/mock-registry';
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
    expect(section?.cards[1]).toEqual({
      type: 'custom:quiet-luxe-climate-card',
      entity: 'climate.bedroom_ac',
    });
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
