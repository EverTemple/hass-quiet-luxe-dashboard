import { describe, expect, it } from 'vitest';
import { makeContext } from '../../testing/mock-registry';
import { carCard, carSection } from './car';

const carHome = {
  car: 'bmw',
  car_entities: { battery_entity: 'sensor.bmw_battery', range_entity: 'sensor.bmw_range' },
};

describe('carCard / carSection', () => {
  it('spreads car_entities into the card config', () => {
    expect(carCard(makeContext({ home: carHome }))).toEqual({
      type: 'custom:quiet-luxe-car-card',
      brand: 'bmw',
      battery_entity: 'sensor.bmw_battery',
      fuel_entity: undefined,
      range_entity: 'sensor.bmw_range',
      lock_entity: undefined,
      precondition_entity: undefined,
      location_entity: undefined,
    });
  });

  it('returns null when car: none', () => {
    expect(carCard(makeContext({}))).toBeNull();
    expect(carSection(makeContext({}))).toBeNull();
  });

  it('is admin-only on the home glance (spec §5)', () => {
    expect(carSection(makeContext({ home: carHome, tier: 'family' }))).toBeNull();
    expect(carSection(makeContext({ home: carHome, tier: 'guest' }))).toBeNull();
    const section = carSection(makeContext({ home: carHome, tier: 'admin' }));
    expect(section?.cards[0]).toMatchObject({
      tap_action: { action: 'navigate', navigation_path: '/quiet-luxe/car' },
    });
  });
});
