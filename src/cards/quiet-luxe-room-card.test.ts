import { afterEach, describe, expect, it, vi } from 'vitest';
import { lightEntity, makeEntity, makeMockHass, sensorEntity } from '../testing/mock-hass';
import type { HomeAssistant } from '../types/home-assistant';
import {
  AREA_UPDATE_COMMAND,
  bloomOrigin,
  glowOrigin,
  QuietLuxeRoomCard,
  type RoomCardConfig,
} from './quiet-luxe-room-card';

const BASE_CONFIG: RoomCardConfig = {
  type: 'custom:quiet-luxe-room-card',
  name: 'Living Room',
  image: '/local/quiet-luxe/rooms/living.jpg',
};

const ADMIN: HomeAssistant['user'] = { id: 'u1', name: 'Steven', is_admin: true };
const MEMBER: HomeAssistant['user'] = { id: 'u2', name: 'Mei', is_admin: false };

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

function styleText(): string {
  return (QuietLuxeRoomCard.styles as unknown as ReadonlyArray<{ toString(): string }>)
    .map((sheet) => sheet.toString())
    .join('\n');
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

  it('renders the photo, room name, and doubled Figma scrim layers (M default)', async () => {
    const card = await mount();
    const root = card.shadowRoot?.querySelector<HTMLElement>('.room');
    expect(root?.dataset.size).toBe('m');
    expect(card.shadowRoot?.querySelector<HTMLImageElement>('img.photo')?.getAttribute('src')).toBe(
      '/local/quiet-luxe/rooms/living.jpg',
    );
    expect(card.shadowRoot?.querySelector('.header .name')?.textContent).toBe('Living Room');
    const css = styleText();
    expect(css).toContain('rgba(8, 6, 4, 0.62)');
    expect(css).toContain('rgba(8, 6, 4, 0.82)');
    /* The v2 legibility fix: each scrim is painted twice, so white text holds
       over a bright photo. */
    expect(css.match(/rgba\(8, 6, 4, 0\.62\)/g)).toHaveLength(2);
    expect(css.match(/rgba\(8, 6, 4, 0\.82\)/g)).toHaveLength(2);
  });

  it('scrims stretch with the card instead of sitting at fixed offsets', () => {
    const css = styleText();
    expect(css).toMatch(/\.scrim-top,\s*\n\s*\.scrim-bottom \{\s*\n\s*position: absolute;/);
    expect(css).toContain('left: 0;');
    expect(css).toContain('right: 0;');
  });

  it('S density: name only, no top scrim, no chips', async () => {
    const card = await mount({
      size: 's',
      chips: [{ entity: 'light.pendant', label: 'Lights' }],
    });
    expect(card.shadowRoot?.querySelector('.scrim-top')).toBeNull();
    expect(card.shadowRoot?.querySelector('.header .name')?.textContent).toBe('Living Room');
    expect(card.shadowRoot?.querySelector('ql-chip')).toBeNull();
  });

  it('stats line joins temperature, humidity and AQI, omitting unavailable entities', async () => {
    const hass = makeMockHass([
      sensorEntity('sensor.living_temp', '24.5'),
      sensorEntity('sensor.living_humidity', '61'),
      sensorEntity('sensor.living_aqi', 'unavailable'),
    ]);
    const card = await mount(
      {
        temperature_entity: 'sensor.living_temp',
        humidity_entity: 'sensor.living_humidity',
        aqi_entity: 'sensor.living_aqi',
      },
      hass,
    );
    expect(card.shadowRoot?.querySelector('.stats')?.textContent?.trim()).toBe('24.5° · 61%');
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

  it('L sets the room name in the display face', () => {
    expect(styleText()).toContain("[data-size='l'] .name");
    expect(styleText()).toContain('var(--ql-font-display, Marcellus, serif)');
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
    card.shadowRoot?.querySelector('ql-chip')?.dispatchEvent(new Event('click', { bubbles: true }));
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

  it('draws the designed fallback — warm wash plus an offset bloom — with no photo', async () => {
    const card = await mount({ image: undefined });
    const room = card.shadowRoot?.querySelector<HTMLElement>('.room');
    expect(card.showsFallback()).toBe(true);
    expect(room?.classList.contains('fallback')).toBe(true);
    expect(room?.style.getPropertyValue('--glow-x')).toMatch(/^\d+%$/);
    expect(room?.style.getPropertyValue('--bloom-x')).toMatch(/^\d+%$/);
    expect(card.shadowRoot?.querySelector('img.photo')).toBeNull();
    expect(card.shadowRoot?.querySelector('.header .name')?.textContent).toBe('Living Room');
    const css = styleText();
    expect(css).toContain('var(--ql-bg-glow-center, #fffdf4)');
    expect(css).toContain('rgba(176, 141, 87, 0.22)');
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

  it('lights each room from its own corner, deterministically, wash and bloom apart', () => {
    expect(glowOrigin('Living Room')).toEqual(glowOrigin('Living Room'));
    expect(glowOrigin('Living Room')).not.toEqual(glowOrigin('Parking'));
    expect(bloomOrigin('Living Room')).not.toEqual(glowOrigin('Living Room'));
  });

  it('clamps a long room name instead of letting it escape the card', async () => {
    const card = await mount({ name: 'Extremely Long Room Name That Would Otherwise Overflow' });
    expect(card.shadowRoot?.querySelector('.header .name')?.classList.contains('ql-clamp-2')).toBe(
      true,
    );
  });
});

describe('quiet-luxe-room-card background picker', () => {
  it('offers the affordance only to an admin, on M/L, with an area to write to', async () => {
    const admin = await mount({ area_id: 'living' }, makeMockHass([], { user: ADMIN }));
    expect(admin.canEditImage()).toBe(true);
    expect(admin.shadowRoot?.querySelector('button.edit')).not.toBeNull();

    const member = await mount({ area_id: 'living' }, makeMockHass([], { user: MEMBER }));
    expect(member.canEditImage()).toBe(false);
    expect(member.shadowRoot?.querySelector('button.edit')).toBeNull();

    const small = await mount({ area_id: 'living', size: 's' }, makeMockHass([], { user: ADMIN }));
    expect(small.canEditImage()).toBe(false);

    const pinned = await mount({}, makeMockHass([], { user: ADMIN }));
    expect(pinned.canEditImage()).toBe(false);
  });

  /* Hidden-until-hover is the Figma treatment, but a control nobody can find
     is not an easy one to use. It rests dimmed and comes up on hover/focus. */
  it('rests visible so it can be found, and comes to full strength on hover', () => {
    const css = styleText();
    expect(css).toMatch(/\.edit \{[\s\S]*?opacity: 0\.55;/);
    expect(css).toMatch(/\.room:hover \.edit,\s*\n\s*\.edit:focus-visible \{\s*\n\s*opacity: 1;/);
    expect(css).toMatch(/@media \(hover: none\) \{\s*\n\s*\.edit \{\s*\n\s*opacity: 1;/);
  });

  it('the glyph sits in a 56px touch target at the top right', () => {
    const css = styleText();
    expect(css).toContain('width: var(--ql-touch-min, 56px)');
    expect(css).toContain('height: var(--ql-touch-min, 56px)');
    expect(css).toMatch(/\.edit \{[\s\S]*?top: 4px;[\s\S]*?right: 4px;/);
    expect(css).toMatch(/\.edit \.disc \{[\s\S]*?width: 32px;/);
  });

  it('the affordance opens the sheet without navigating away', async () => {
    vi.spyOn(history, 'pushState').mockImplementation(() => undefined);
    const card = await mount(
      { area_id: 'living', navigation_path: '/quiet-luxe/living' },
      makeMockHass([], { user: ADMIN }),
    );
    card.shadowRoot?.querySelector<HTMLButtonElement>('button.edit')?.click();
    await card.updateComplete;
    expect(card.sheetOpen).toBe(true);
    expect(history.pushState).not.toHaveBeenCalled();
    expect(card.shadowRoot?.querySelector('ql-sheet')?.getAttribute('heading')).toBe(
      'Room background',
    );
  });

  /* The choice is written to the AREA, so every HA surface picks it up — not
     just this dashboard. */
  it('saving writes the area picture and shows it immediately', async () => {
    const hass = makeMockHass([], {
      user: ADMIN,
      wsResponses: { [AREA_UPDATE_COMMAND]: { area_id: 'living' } },
    });
    const card = await mount({ area_id: 'living' }, hass);
    await card.saveImage('/local/rooms/living.jpg');
    await card.updateComplete;
    expect(hass.wsCalls).toEqual([
      { type: 'config/area_registry/update', area_id: 'living', picture: '/local/rooms/living.jpg' },
    ]);
    expect(card.photoUrl()).toBe('/local/rooms/living.jpg');
    expect(card.sheetOpen).toBe(false);
  });

  it('removing clears the area picture and returns the card to the fallback', async () => {
    const hass = makeMockHass([], {
      user: ADMIN,
      wsResponses: { [AREA_UPDATE_COMMAND]: { area_id: 'living' } },
    });
    const card = await mount({ area_id: 'living' }, hass);
    await card.saveImage(null);
    await card.updateComplete;
    expect(hass.wsCalls[0]).toMatchObject({ picture: null });
    expect(card.photoUrl()).toBeUndefined();
    expect(card.showsFallback()).toBe(true);
  });

  /* A rejected write must be visible, not swallowed: HA refuses the area
     registry update for non-admin sessions and for unknown areas. */
  it('a failed write keeps the sheet open and says so', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const hass = makeMockHass([], { user: ADMIN });
    const card = await mount({ area_id: 'living' }, hass);
    card.sheetOpen = true;
    await card.saveImage('/local/rooms/living.jpg');
    await card.updateComplete;
    expect(card.saveFailed).toBe(true);
    expect(card.sheetOpen).toBe(true);
    expect(card.photoUrl()).toBe('/local/quiet-luxe/rooms/living.jpg');
    expect(card.shadowRoot?.querySelector('.error')?.textContent).toBe(
      'Could not save the background',
    );
    expect(console.error).toHaveBeenCalled();
  });

  it('a space typed into the picker never navigates the dashboard', async () => {
    vi.spyOn(history, 'pushState').mockImplementation(() => undefined);
    const card = await mount(
      { area_id: 'living', navigation_path: '/quiet-luxe/living' },
      makeMockHass([], { user: ADMIN }),
    );
    card.sheetOpen = true;
    await card.updateComplete;
    const field = card.shadowRoot?.querySelector<HTMLInputElement>('#room-image');
    field?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true }));
    expect(history.pushState).not.toHaveBeenCalled();
  });
});
