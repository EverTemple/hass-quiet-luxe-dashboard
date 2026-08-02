import { describe, expect, it } from 'vitest';
import { makeEntity } from '../../testing/mock-hass';
import { makeContext, mockArea, mockRegEntity } from '../../testing/mock-registry';
import { sensorsSection, sensorTiles } from './sensors';

const snapshot = {
  areas: [mockArea('living', 'Living Room')],
  devices: [],
  entities: [
    mockRegEntity('sensor.living_temp', { area_id: 'living' }),
    mockRegEntity('sensor.living_humidity', { area_id: 'living' }),
    mockRegEntity('sensor.living_aqi', { area_id: 'living' }),
    mockRegEntity('binary_sensor.living_door', { area_id: 'living' }),
  ],
};
const entities = [
  makeEntity('sensor.living_temp', '24.5', { device_class: 'temperature' }),
  makeEntity('sensor.living_humidity', '61', { device_class: 'humidity' }),
  makeEntity('sensor.living_aqi', '18', { device_class: 'aqi' }),
  makeEntity('binary_sensor.living_door', 'off', { device_class: 'door' }),
];

describe('sensorTiles / sensorsSection', () => {
  it('maps device classes to sensor-tile metrics in fixed order', () => {
    const ctx = makeContext({ snapshot, entities });
    expect(sensorTiles(ctx, 'living')).toEqual([
      {
        type: 'custom:quiet-luxe-sensor-tile',
        entity: 'sensor.living_temp',
        metric: 'temp',
      },
      {
        type: 'custom:quiet-luxe-sensor-tile',
        entity: 'sensor.living_humidity',
        metric: 'humidity',
      },
      {
        type: 'custom:quiet-luxe-sensor-tile',
        entity: 'sensor.living_aqi',
        metric: 'aqi',
      },
    ]);
  });

  it('appends door/motion rows and titles the section "Air & sensors"', () => {
    const ctx = makeContext({ snapshot, entities });
    const section = sensorsSection(ctx, 'living');
    expect(section?.cards[0]).toEqual({ type: 'heading', heading: 'Air & sensors' });
    expect(section?.cards).toHaveLength(5); // heading + 3 tiles + 1 door row
  });

  it('returns null for an area with neither sensors nor door/motion', () => {
    expect(sensorsSection(makeContext({ snapshot, entities }), 'nowhere')).toBeNull();
  });
});
