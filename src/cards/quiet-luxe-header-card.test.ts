import { describe, expect, it } from 'vitest';
import type { QlHeaderHome } from '../elements/ql-header-home';
import type { QlHeaderRoom } from '../elements/ql-header-room';
import { makeEntity, makeMockHass } from '../testing/mock-hass';
import { QuietLuxeHeaderCard, variantForWidth } from './quiet-luxe-header-card';

const HASS_ENTITIES = [
  makeEntity('weather.home', 'rainy', { temperature: 30.6 }),
  makeEntity('sensor.aqi', '42', { device_class: 'aqi' }),
  makeEntity('person.steven', 'home', { friendly_name: 'Steven' }),
  makeEntity('person.mei', 'not_home', { friendly_name: 'Mei' }),
  makeEntity('sensor.room_temp', '24.5', { device_class: 'temperature' }),
  makeEntity('sensor.room_humidity', '61', { device_class: 'humidity' }),
];

function makeCard(config: Record<string, unknown>, user?: { id: string; name: string; is_admin: boolean }): QuietLuxeHeaderCard {
  const card = document.createElement('quiet-luxe-header-card') as QuietLuxeHeaderCard;
  card.setConfig(config as never);
  card.hass = makeMockHass(HASS_ENTITIES, { user });
  document.body.append(card);
  return card;
}

describe('variantForWidth', () => {
  it('maps viewport width to the spec breakpoints', () => {
    expect(variantForWidth(390)).toBe('mobile');
    expect(variantForWidth(767)).toBe('mobile');
    expect(variantForWidth(768)).toBe('ipad');
    expect(variantForWidth(1399)).toBe('ipad');
    expect(variantForWidth(1400)).toBe('desktop');
    expect(variantForWidth(1680)).toBe('desktop');
  });
});

describe('quiet-luxe-header-card', () => {
  it('rejects malformed config loudly', () => {
    const card = document.createElement('quiet-luxe-header-card') as QuietLuxeHeaderCard;
    expect(() => card.setConfig({ type: 'x', form: 'nope', name: 'X' } as never)).toThrowError(
      /"form" must be "home" or "room"/,
    );
    expect(() => card.setConfig({ type: 'x', form: 'home', name: '' } as never)).toThrowError(
      /"name" is required/,
    );
  });

  it('home form: passes name, greeting user, meta, and presence to ql-header-home', async () => {
    const card = makeCard(
      {
        type: 'custom:quiet-luxe-header-card',
        form: 'home',
        name: 'Subang Jaya',
        weather_entity: 'weather.home',
        aqi_entity: 'sensor.aqi',
        presence_entities: ['person.steven', 'person.mei'],
      },
      { id: 'u1', name: 'Steven', is_admin: true },
    );
    await card.updateComplete;
    const header = card.shadowRoot?.querySelector('ql-header-home') as QlHeaderHome;
    expect(header.homeName).toBe('Subang Jaya');
    expect(header.userName).toBe('Steven');
    expect(header.meta).toBe('31° · AQI 42');
    expect(header.presence).toBe('Steven home');
  });

  it('suppresses the greeting when show_greeting is false (guest kiosk)', async () => {
    const card = makeCard(
      {
        type: 'custom:quiet-luxe-header-card',
        form: 'home',
        name: 'Subang Jaya',
        show_greeting: false,
      },
      { id: 'u2', name: 'kiosk', is_admin: false },
    );
    await card.updateComplete;
    const header = card.shadowRoot?.querySelector('ql-header-home') as QlHeaderHome;
    expect(header.userName).toBe('');
  });

  it('says nobody is home when presence entities exist but none are home', async () => {
    const card = makeCard({
      type: 'custom:quiet-luxe-header-card',
      form: 'home',
      name: 'X',
      presence_entities: ['person.mei'],
    });
    await card.updateComplete;
    const header = card.shadowRoot?.querySelector('ql-header-home') as QlHeaderHome;
    expect(header.presence).toBe('Nobody home');
  });

  it('room form: renders ql-header-room with formatted stats', async () => {
    const card = makeCard({
      type: 'custom:quiet-luxe-header-card',
      form: 'room',
      name: 'Living Room',
      temperature_entity: 'sensor.room_temp',
      humidity_entity: 'sensor.room_humidity',
      aqi_entity: 'sensor.aqi',
    });
    await card.updateComplete;
    const header = card.shadowRoot?.querySelector('ql-header-room') as QlHeaderRoom;
    expect(header.name).toBe('Living Room');
    expect(header.stats).toEqual(['24.5°', '61%', 'AQI 42']);
  });

  it('room form: ql-back navigates to back_path', async () => {
    const card = makeCard({
      type: 'custom:quiet-luxe-header-card',
      form: 'room',
      name: 'Living Room',
      back_path: '/quiet-luxe/home',
    });
    await card.updateComplete;
    card.shadowRoot
      ?.querySelector('ql-header-room')
      ?.dispatchEvent(new CustomEvent('ql-back', { bubbles: true, composed: true }));
    expect(window.location.pathname).toBe('/quiet-luxe/home');
  });
});
