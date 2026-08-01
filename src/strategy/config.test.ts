import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DASHBOARD_PATH,
  QuietLuxeConfigError,
  validateHomeConfig,
  viewUrl,
} from './config';

describe('validateHomeConfig', () => {
  it('applies defaults to a minimal config', () => {
    const home = validateHomeConfig({ name: 'Test Home' });
    expect(home).toEqual({
      name: 'Test Home',
      dashboard_path: undefined,
      energy: false,
      car: 'none',
      car_entities: undefined,
      calendar: 'none',
      vacuum: false,
      media_rich: false,
      camera_engine: 'snapshot',
      broadlink: false,
      room_order: undefined,
      rooms: undefined,
      photo_base: undefined,
      admin_flows: undefined,
      kiosk: undefined,
      users: undefined,
    });
  });

  it('rejects non-object config loudly', () => {
    expect(() => validateHomeConfig(undefined)).toThrowError(QuietLuxeConfigError);
    expect(() => validateHomeConfig('subang')).toThrowError(/must be an object/);
  });

  it('rejects a missing or empty name', () => {
    expect(() => validateHomeConfig({})).toThrowError(/"name" is required/);
    expect(() => validateHomeConfig({ name: '' })).toThrowError(/"name" must be a non-empty string/);
  });

  it('rejects unknown keys by name (typo safety)', () => {
    expect(() => validateHomeConfig({ name: 'X', engery: false })).toThrowError(
      /unknown home config key\(s\): engery/,
    );
  });

  it('rejects bare energy: true with a pointer to the entity shape', () => {
    expect(() => validateHomeConfig({ name: 'X', energy: true })).toThrowError(/power_entity/);
  });

  it('accepts a full energy object', () => {
    const home = validateHomeConfig({
      name: 'X',
      energy: {
        power_entity: 'sensor.p',
        today_entity: 'sensor.t',
        phase_entities: ['sensor.a'],
        tariff: 0.5,
      },
    });
    expect(home.energy).toEqual({
      power_entity: 'sensor.p',
      today_entity: 'sensor.t',
      phase_entities: ['sensor.a'],
      tariff: 0.5,
    });
  });

  it('rejects an invalid car flag', () => {
    expect(() => validateHomeConfig({ name: 'X', car: 'tesla' })).toThrowError(
      /"car" must be one of bmw\|audi\|liauto\|none/,
    );
  });

  it('rejects car_entities without a car brand', () => {
    expect(() =>
      validateHomeConfig({ name: 'X', car_entities: { battery_entity: 'sensor.b' } }),
    ).toThrowError(/requires "car"/);
  });

  it('parses room overrides and rejects malformed ones', () => {
    const home = validateHomeConfig({
      name: 'X',
      rooms: { living: { photo: '/local/l.jpg', hidden: true } },
    });
    expect(home.rooms).toEqual({
      living: { name: undefined, photo: '/local/l.jpg', hidden: true },
    });
    expect(() => validateHomeConfig({ name: 'X', rooms: { living: { pic: 'x' } } })).toThrowError(
      /unknown "rooms.living" key\(s\): pic/,
    );
  });

  it('parses admin flows and requires their entity', () => {
    const home = validateHomeConfig({
      name: 'X',
      admin_flows: [{ entity: 'switch.f', name: 'Flow' }],
    });
    expect(home.admin_flows).toEqual([
      { entity: 'switch.f', name: 'Flow', description: undefined },
    ]);
    expect(() =>
      validateHomeConfig({ name: 'X', admin_flows: [{ name: 'no entity' }] }),
    ).toThrowError(/"admin_flows\[0\].entity" is required/);
  });

  it('parses kiosk and users blocks', () => {
    const home = validateHomeConfig({
      name: 'X',
      kiosk: { language: 'zh-Hant' },
      users: { family: ['mei'], guests: ['kiosk'] },
    });
    expect(home.kiosk).toEqual({ language: 'zh-Hant' });
    expect(home.users).toEqual({ family: ['mei'], guests: ['kiosk'] });
  });
});

describe('viewUrl', () => {
  it('builds absolute paths from the default dashboard path', () => {
    expect(viewUrl(validateHomeConfig({ name: 'X' }), 'home')).toBe(
      `/${DEFAULT_DASHBOARD_PATH}/home`,
    );
  });

  it('honours dashboard_path overrides', () => {
    expect(viewUrl(validateHomeConfig({ name: 'X', dashboard_path: 'ql' }), 'media')).toBe(
      '/ql/media',
    );
  });
});
