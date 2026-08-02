import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  lightEntity,
  makeEntity,
  makeMockHass,
  sensorEntity,
} from '../testing/mock-hass';
import { glowOrigin, QuietLuxeRoomCard, type RoomCardConfig } from './quiet-luxe-room-card';

const BASE_CONFIG: RoomCardConfig = {
  type: 'custom:quiet-luxe-room-card',
  name: 'Living Room',
  image: '/local/quiet-luxe/rooms/living.jpg',
};

async function mount(
  config: Partial<RoomCardConfig> = {},
  hass = makeMockHass(),
): Promise<QuietLuxeRoomCard> {
  const card = document.createElement('quiet-luxe-room-card') as QuietLuxeRoomCard;
  card.setConfig({ ...BASE_CONFIG, ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('quiet-luxe-room-card', () => {
  it('registers the element and a window.customCards entry', () => {
    expect(customElements.get('quiet-luxe-room-card')).toBe(QuietLuxeRoomCard);
    expect((window.customCards ?? []).map((e) => e.type)).toContain('quiet-luxe-room-card');
  });

  it('setConfig rejects a missing name and accepts a missing image', () => {
    const card = new QuietLuxeRoomCard();
    expect(() => card.setConfig({ ...BASE_CONFIG, name: '' })).toThrow(/name/);
    expect(() => card.setConfig({ ...BASE_CONFIG, image: '' })).not.toThrow();
    expect(card.photoUrl()).toBeUndefined();
    expect(card.showsFallback()).toBe(true);
  });

  it('renders the photo, room name, and Figma scrim layers (M default)', async () => {
    const card = await mount();
    const root = card.shadowRoot?.querySelector<HTMLElement>('.room');
    expect(root?.dataset.size).toBe('m');
    expect(card.shadowRoot?.querySelector<HTMLImageElement>('img.photo')?.getAttribute('src')).toBe(
      '/local/quiet-luxe/rooms/living.jpg',
    );
    expect(card.shadowRoot?.querySelector('.scrim-top .name')?.textContent).toBe('Living Room');
    expect(card.shadowRoot?.querySelector('.scrim-bottom')).not.toBeNull();
    const cssText = (QuietLuxeRoomCard.styles as unknown as ReadonlyArray<{ toString(): string }>)
      .map((s) => s.toString())
      .join('\n');
    expect(cssText).toContain('rgba(8, 6, 4, 0.62)');
    expect(cssText).toContain('rgba(8, 6, 4, 0.82)');
  });

  it('S density: bottom-scrim name only, no top scrim, no chips', async () => {
    const card = await mount({
      size: 's',
      chips: [{ entity: 'light.pendant', label: 'Lights' }],
    });
    expect(card.shadowRoot?.querySelector('.scrim-top')).toBeNull();
    expect(card.shadowRoot?.querySelector('.scrim-bottom .name-s')?.textContent).toBe(
      'Living Room',
    );
    expect(card.shadowRoot?.querySelector('ql-chip')).toBeNull();
  });

  it('stats line joins temperature and AQI, omitting unavailable entities', async () => {
    const hass = makeMockHass([
      sensorEntity('sensor.living_temp', '24.5'),
      sensorEntity('sensor.living_aqi', 'unavailable'),
    ]);
    const card = await mount(
      { temperature_entity: 'sensor.living_temp', aqi_entity: 'sensor.living_aqi' },
      hass,
    );
    expect(card.shadowRoot?.querySelector('.stats')?.textContent?.trim()).toBe('24.5°');
  });

  it('shows the lights-on glow dot only when the lights entity is on', async () => {
    const on = await mount(
      { lights_entity: 'light.living_group' },
      makeMockHass([makeEntity('light.living_group', 'on')]),
    );
    const dot = on.shadowRoot?.querySelector('.glow-dot');
    expect(dot?.getAttribute('aria-label')).toBe('Lights on');
    const off = await mount(
      { lights_entity: 'light.living_group' },
      makeMockHass([makeEntity('light.living_group', 'off')]),
    );
    expect(off.shadowRoot?.querySelector('.glow-dot')).toBeNull();
  });

  it('L density adds the AQI badge pill', async () => {
    const card = await mount(
      { size: 'l', aqi_entity: 'sensor.living_aqi' },
      makeMockHass([sensorEntity('sensor.living_aqi', '18')]),
    );
    expect(card.shadowRoot?.querySelector('ql-badge.aqi')?.textContent?.trim()).toBe('AQI 18');
  });

  it('tap and Enter navigate to navigation_path', async () => {
    vi.spyOn(history, 'pushState').mockImplementation(() => undefined);
    const card = await mount({ navigation_path: '/quiet-luxe/living' });
    const root = card.shadowRoot?.querySelector<HTMLElement>('.room');
    expect(root?.getAttribute('role')).toBe('button');
    expect(root?.getAttribute('tabindex')).toBe('0');
    root?.click();
    root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(history.pushState).toHaveBeenCalledTimes(2);
    expect(history.pushState).toHaveBeenCalledWith(null, '', '/quiet-luxe/living');
  });

  it('chip tap toggles the chip entity without navigating', async () => {
    vi.spyOn(history, 'pushState').mockImplementation(() => undefined);
    const hass = makeMockHass([lightEntity('light.pendant', 'on')]);
    const card = await mount(
      {
        navigation_path: '/quiet-luxe/living',
        chips: [{ entity: 'light.pendant', label: 'Lights' }],
      },
      hass,
    );
    card.shadowRoot
      ?.querySelector('ql-chip')
      ?.dispatchEvent(new Event('click', { bubbles: true }));
    expect(hass.calls).toEqual([
      { domain: 'homeassistant', service: 'toggle', data: { entity_id: 'light.pendant' } },
    ]);
    expect(history.pushState).not.toHaveBeenCalled();
  });

  it('chip labels use friendly_name, never the raw entity id', async () => {
    const hass = makeMockHass([
      makeEntity('cover.dooya_m1_fe9b_curtain', 'open', { friendly_name: '窗帘 Curatain' }),
      makeEntity('climate.steven_bedroom', 'cool', { friendly_name: 'Steven Bedroom' }),
      makeEntity('light.steven_room_ceiling_top', 'on'),
    ]);
    const card = await mount(
      {
        chips: [
          { entity: 'cover.dooya_m1_fe9b_curtain' },
          { entity: 'climate.steven_bedroom', label: 'Aircon' },
          { entity: 'light.steven_room_ceiling_top' },
        ],
      },
      hass,
    );
    const labels = [...(card.shadowRoot?.querySelectorAll('ql-chip') ?? [])].map((chip) =>
      chip.textContent?.trim(),
    );
    // friendly_name, explicit label wins, humanized id when nothing else exists
    expect(labels).toEqual(['窗帘 Curatain', 'Aircon', 'Steven Room Ceiling Top']);
    expect(labels.join(' ')).not.toContain('.');
  });

  it('never pins a row count: height is content-driven at every density', async () => {
    const card = await mount({ size: 's' });
    expect(card.getCardSize()).toBe(2);
    expect(card.getGridOptions()).toEqual({ rows: 'auto', columns: 12 });
    card.setConfig({ ...BASE_CONFIG, size: 'l' });
    expect(card.getCardSize()).toBe(4);
    expect(card.getGridOptions()).toEqual({ rows: 'auto', columns: 12 });
  });

  it('draws a warm fallback when no photo is configured', async () => {
    const card = await mount({ image: undefined });
    const room = card.shadowRoot?.querySelector<HTMLElement>('.room');
    expect(card.showsFallback()).toBe(true);
    expect(room?.classList.contains('fallback')).toBe(true);
    expect(room?.style.getPropertyValue('--glow-x')).toMatch(/^\d+%$/);
    expect(card.shadowRoot?.querySelector('img.photo')).toBeNull();
    expect(card.shadowRoot?.querySelector('.scrim-top .name')?.textContent).toBe('Living Room');
  });

  it('falls back when the configured photo fails to load', async () => {
    const card = await mount();
    expect(card.showsFallback()).toBe(true); // pending until the image loads
    const image = card.shadowRoot?.querySelector<HTMLImageElement>('img.photo');
    image?.dispatchEvent(new Event('error'));
    await card.updateComplete;
    expect(card.showsFallback()).toBe(true);
    expect(card.shadowRoot?.querySelector('.room')?.classList.contains('fallback')).toBe(true);
    image?.dispatchEvent(new Event('load'));
    await card.updateComplete;
    expect(card.showsFallback()).toBe(false);
  });

  it('lights each room from its own corner, deterministically', () => {
    expect(glowOrigin('Living Room')).toEqual(glowOrigin('Living Room'));
    expect(glowOrigin('Living Room')).not.toEqual(glowOrigin('Parking'));
  });

  it('clamps a long room name instead of letting it escape the card', async () => {
    const card = await mount({ name: 'Extremely Long Room Name That Would Otherwise Overflow' });
    expect(
      card.shadowRoot?.querySelector('.scrim-top .name')?.classList.contains('ql-clamp-2'),
    ).toBe(true);
  });
});
