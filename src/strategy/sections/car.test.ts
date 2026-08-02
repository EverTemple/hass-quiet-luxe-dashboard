import { describe, expect, it } from 'vitest';
import { makeEntity, sensorEntity } from '../../testing/mock-hass';
import { makeContext } from '../../testing/mock-registry';
import { carCard, carSection } from './car';

const carHome = {
  car: 'bmw',
  car_entities: { battery_entity: 'sensor.bmw_battery', range_entity: 'sensor.bmw_range' },
};

const carEntities = [sensorEntity('sensor.bmw_battery', '76'), sensorEntity('sensor.bmw_range', '412')];

describe('carCard / carSection', () => {
  it('spreads car_entities into the card config', () => {
    expect(carCard(makeContext({ home: carHome, entities: carEntities }))).toEqual({
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

  /* Tung Chung carries car: audi with placeholder ids and has no Audi
     integration; the card used to render a shell of em-dashes (spec §8). */
  it('omits the car when the configured entities do not exist', () => {
    const ctx = makeContext({ home: carHome, tier: 'admin' });
    expect(carCard(ctx)).toBeNull();
    expect(carSection(ctx)).toBeNull();
  });

  it('renders once any configured car entity exists, even unavailable', () => {
    const ctx = makeContext({
      home: carHome,
      tier: 'admin',
      entities: [makeEntity('sensor.bmw_battery', 'unavailable')],
    });
    expect(carCard(ctx)).not.toBeNull();
  });

  it('is admin-only on the home glance (spec §5)', () => {
    const home = { home: carHome, entities: carEntities };
    expect(carSection(makeContext({ ...home, tier: 'family' }))).toBeNull();
    expect(carSection(makeContext({ ...home, tier: 'guest' }))).toBeNull();
    const section = carSection(makeContext({ ...home, tier: 'admin' }));
    expect(section?.cards[0]).toMatchObject({
      tap_action: { action: 'navigate', navigation_path: '/quiet-luxe/car' },
    });
  });
});
