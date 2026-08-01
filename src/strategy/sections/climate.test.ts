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
      grid_options: { columns: 4 },
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
