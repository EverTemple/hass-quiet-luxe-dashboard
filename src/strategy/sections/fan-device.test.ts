import { describe, expect, it } from 'vitest';
import { climatePartnerOf, fanCardConfig, isFanDevice } from './fan-device';
import { climateCards } from './climate';
import { makeEntity, sensorEntity } from '../../testing/mock-hass';
import { makeContext, mockArea, mockDevice, mockRegEntity } from '../../testing/mock-registry';
import type { StrategyContext } from '../types';

const AREA = 'bedroom';
const DYSON_DEVICE = 'device-tp09';

/** The live Tung Chung TP09 as HA reports it, including its config entities. */
function dysonContext(overrides: { readonly fanAttributes?: Record<string, unknown> } = {}): StrategyContext {
  return makeContext({
    snapshot: {
      areas: [mockArea(AREA, 'Bedroom')],
      devices: [mockDevice(DYSON_DEVICE, AREA)],
      entities: [
        mockRegEntity('fan.tp09', { device_id: DYSON_DEVICE, platform: 'dyson_local' }),
        mockRegEntity('climate.tp09', { device_id: DYSON_DEVICE, platform: 'dyson_local' }),
        mockRegEntity('sensor.tp09_temperature', { device_id: DYSON_DEVICE }),
        mockRegEntity('sensor.tp09_pm_2_5', { device_id: DYSON_DEVICE }),
        mockRegEntity('switch.tp09_night_mode', {
          device_id: DYSON_DEVICE,
          entity_category: 'config',
        }),
        mockRegEntity('sensor.tp09_filter_life', {
          device_id: DYSON_DEVICE,
          entity_category: 'diagnostic',
        }),
      ],
    },
    entities: [
      makeEntity('fan.tp09', 'on', {
        supported_features: 63,
        oscillating: true,
        angle_low: 135,
        angle_high: 225,
        ...overrides.fanAttributes,
      }),
      makeEntity('climate.tp09', 'cool', { hvac_modes: ['off', 'cool', 'heat'] }),
      sensorEntity('sensor.tp09_temperature', '21.9', { device_class: 'temperature' }),
      sensorEntity('sensor.tp09_pm_2_5', '12', { device_class: 'pm25' }),
      makeEntity('switch.tp09_night_mode', 'off'),
      sensorEntity('sensor.tp09_filter_life', '68'),
    ],
  });
}

describe('isFanDevice', () => {
  it('claims a fan that can oscillate', () => {
    const ctx = dysonContext();
    expect(isFanDevice(ctx, 'fan.tp09')).toBe(true);
  });

  it('claims a fan that can reverse its airflow', () => {
    const ctx = makeContext({
      snapshot: {
        areas: [mockArea(AREA, 'Bedroom')],
        devices: [mockDevice('d', AREA)],
        entities: [mockRegEntity('fan.reversible', { device_id: 'd' })],
      },
      entities: [makeEntity('fan.reversible', 'on', { supported_features: 4 })],
    });
    expect(isFanDevice(ctx, 'fan.reversible')).toBe(true);
  });

  it('claims a fan paired with a climate entity on the same device', () => {
    const ctx = makeContext({
      snapshot: {
        areas: [mockArea(AREA, 'Bedroom')],
        devices: [mockDevice('d', AREA)],
        entities: [
          mockRegEntity('fan.heater', { device_id: 'd' }),
          mockRegEntity('climate.heater', { device_id: 'd' }),
        ],
      },
      entities: [
        makeEntity('fan.heater', 'on', { supported_features: 49 }),
        makeEntity('climate.heater', 'heat', { hvac_modes: ['off', 'heat'] }),
      ],
    });
    expect(isFanDevice(ctx, 'fan.heater')).toBe(true);
  });

  /** Detection is capability-based; a plain speed-only fan keeps the climate card. */
  it('leaves a plain speed-only fan alone', () => {
    const ctx = makeContext({
      snapshot: {
        areas: [mockArea(AREA, 'Bedroom')],
        devices: [mockDevice('d', AREA)],
        entities: [mockRegEntity('fan.ceiling', { device_id: 'd' })],
      },
      entities: [makeEntity('fan.ceiling', 'on', { supported_features: 49 })],
    });
    expect(isFanDevice(ctx, 'fan.ceiling')).toBe(false);
  });

  it('never claims a non-fan entity', () => {
    const ctx = dysonContext();
    expect(isFanDevice(ctx, 'climate.tp09')).toBe(false);
    expect(isFanDevice(ctx, 'sensor.tp09_temperature')).toBe(false);
  });
});

describe('fanCardConfig companions', () => {
  it('resolves every companion entity the card cannot look up itself', () => {
    expect(fanCardConfig(dysonContext(), 'fan.tp09', 'compact')).toEqual({
      type: 'custom:quiet-luxe-fan-card',
      entity: 'fan.tp09',
      form: 'compact',
      platform: 'dyson_local',
      climate_entity: 'climate.tp09',
      night_mode_entity: 'switch.tp09_night_mode',
      temperature_entity: 'sensor.tp09_temperature',
      aqi_entity: 'sensor.tp09_pm_2_5',
    });
  });

  /**
   * A device's night-mode switch is an `entity_category: config` entity, which
   * registry.siblings deliberately hides from listings.
   */
  it('finds the night-mode switch despite it being a config entity', () => {
    expect(climatePartnerOf(dysonContext(), 'fan.tp09')).toBe('climate.tp09');
    const config = fanCardConfig(dysonContext(), 'fan.tp09', 'full');
    expect(config.night_mode_entity).toBe('switch.tp09_night_mode');
  });

  it('omits companions a device does not have rather than emitting empty keys', () => {
    const ctx = makeContext({
      snapshot: {
        areas: [mockArea(AREA, 'Bedroom')],
        devices: [mockDevice('d', AREA)],
        entities: [mockRegEntity('fan.bare', { device_id: 'd', platform: 'esphome' })],
      },
      entities: [makeEntity('fan.bare', 'on', { supported_features: 51 })],
    });
    expect(fanCardConfig(ctx, 'fan.bare', 'compact')).toEqual({
      type: 'custom:quiet-luxe-fan-card',
      entity: 'fan.bare',
      form: 'compact',
      platform: 'esphome',
    });
  });
});

describe('climateCards routing', () => {
  it('routes a Dyson-like device to the fan card', () => {
    const cards = climateCards(dysonContext(), AREA);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      type: 'custom:quiet-luxe-fan-card',
      entity: 'fan.tp09',
      form: 'compact',
    });
  });

  /** The fan and its climate entity are one appliance, not two cards. */
  it('collapses the paired climate entity into the one fan card', () => {
    const cards = climateCards(dysonContext(), AREA);
    expect(cards.map((c) => c.entity)).toEqual(['fan.tp09']);
    expect(cards.some((c) => c.type === 'custom:quiet-luxe-climate-card')).toBe(false);
  });

  it('draws the whole grid on the All-Climates view and the compact card elsewhere', () => {
    expect(climateCards(dysonContext(), AREA, undefined, 'full')[0]).toMatchObject({
      form: 'full',
    });
    expect(climateCards(dysonContext(), AREA)[0]).toMatchObject({ form: 'compact' });
  });

  it('leaves ordinary climate devices on the climate card', () => {
    const ctx = makeContext({
      snapshot: {
        areas: [mockArea(AREA, 'Bedroom')],
        devices: [mockDevice('d', AREA)],
        entities: [mockRegEntity('climate.wall_ac', { device_id: 'd' })],
      },
      entities: [makeEntity('climate.wall_ac', 'cool', { hvac_modes: ['off', 'cool'] })],
    });
    expect(climateCards(ctx, AREA)).toEqual([
      { type: 'custom:quiet-luxe-climate-card', entity: 'climate.wall_ac' },
    ]);
  });

  it('keeps an unpaired climate entity when a different fan is a fan device', () => {
    const ctx = makeContext({
      snapshot: {
        areas: [mockArea(AREA, 'Bedroom')],
        devices: [mockDevice('d1', AREA), mockDevice('d2', AREA)],
        entities: [
          mockRegEntity('fan.purifier', { device_id: 'd1' }),
          mockRegEntity('climate.wall_ac', { device_id: 'd2' }),
        ],
      },
      entities: [
        makeEntity('fan.purifier', 'on', { supported_features: 51, oscillating: false }),
        makeEntity('climate.wall_ac', 'cool', { hvac_modes: ['off', 'cool'] }),
      ],
    });
    const types = climateCards(ctx, AREA).map((c) => c.type);
    expect(types).toContain('custom:quiet-luxe-fan-card');
    expect(types).toContain('custom:quiet-luxe-climate-card');
  });
});
