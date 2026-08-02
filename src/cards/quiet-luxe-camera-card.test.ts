import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeEntity, makeMockHass, type MockHass } from '../testing/mock-hass';
import {
  DEFAULT_CAMERA_REFRESH_S,
  QuietLuxeCameraCard,
  type CameraCardConfig,
} from './quiet-luxe-camera-card';

function cameraEntity(state = 'streaming'): ReturnType<typeof makeEntity> {
  return makeEntity('camera.front_door', state, {
    friendly_name: 'Front Door',
    entity_picture: '/api/camera_proxy/camera.front_door?token=abc',
  });
}

async function mount(
  config: Omit<CameraCardConfig, 'type'>,
  hass: MockHass,
): Promise<QuietLuxeCameraCard> {
  const card = document.createElement('quiet-luxe-camera-card') as QuietLuxeCameraCard;
  card.setConfig({ type: 'custom:quiet-luxe-camera-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

describe('quiet-luxe-camera-card', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is registered, defaults to size m and a 10s refresh', () => {
    expect(customElements.get('quiet-luxe-camera-card')).toBe(QuietLuxeCameraCard);
    expect(DEFAULT_CAMERA_REFRESH_S).toBe(10);
    const entry = (window.customCards ?? []).find((c) => c.type === 'quiet-luxe-camera-card');
    expect(entry?.name).toBe('Quiet Luxe Camera Card');
    const card = new QuietLuxeCameraCard();
    card.setConfig({ type: 'x', entity: 'camera.front_door' });
    expect(card.size()).toBe('m');
  });

  it('rejects a size outside the design axis', () => {
    const card = new QuietLuxeCameraCard();
    expect(() =>
      card.setConfig({ type: 'x', entity: 'camera.front_door', size: 'xl' as 'm' }),
    ).toThrow(/"size"/);
  });

  /* The complaint the v2 card answers: a 60×34 thumbnail showed nothing.
     Both sizes are room-card footprints and claim a room card's grid slot. */
  it('is sized like a room card at both sizes', async () => {
    const hass = makeMockHass([cameraEntity()]);
    const medium = await mount({ entity: 'camera.front_door' }, hass);
    const large = await mount({ entity: 'camera.front_door', size: 'l' }, hass);
    expect(medium.getGridOptions()).toEqual({ columns: 12, rows: 'auto' });
    expect(large.getGridOptions()).toEqual({ columns: 12, rows: 'auto' });
    expect(medium.getCardSize()).toBe(3);
    expect(large.getCardSize()).toBe(4);
    const css = QuietLuxeCameraCard.styles.toString();
    expect(css).toMatch(/\[data-size='m'\]\s*\{\s*min-height: 190px;/);
    expect(css).toMatch(/\[data-size='l'\]\s*\{\s*min-height: 260px;/);
    medium.remove();
    large.remove();
  });

  /* A camera card that is bright and empty while the snapshot is in flight
     reads as broken, and the white name and LIVE badge sit on nothing. */
  it('sits on a near-black backdrop so a loading frame is never a white box', () => {
    expect(QuietLuxeCameraCard.styles.toString()).toMatch(/\.camera \{[\s\S]*?background: #161310;/);
  });

  it('renders the proxied snapshot with a time cache-buster, filling the card', async () => {
    const card = await mount({ entity: 'camera.front_door' }, makeMockHass([cameraEntity()]));
    const image = card.shadowRoot?.querySelector('img');
    const src = image?.getAttribute('src') ?? '';
    expect(src.startsWith('/api/camera_proxy/camera.front_door?token=abc&time=')).toBe(true);
    expect(image?.classList.contains('frame')).toBe(true);
    card.remove();
  });

  it('shows the LIVE badge on every live card, not only the large one', async () => {
    const hass = makeMockHass([cameraEntity()]);
    for (const size of ['m', 'l'] as const) {
      const card = await mount({ entity: 'camera.front_door', size }, hass);
      expect(card.cameraState()).toBe('live');
      expect(card.shadowRoot?.textContent).toContain('LIVE');
      card.remove();
    }
  });

  it('promotes to state=motion with an inside outline and a Motion chip', async () => {
    const hass = makeMockHass([cameraEntity(), makeEntity('binary_sensor.front_motion', 'on')]);
    const card = await mount(
      { entity: 'camera.front_door', motion_entity: 'binary_sensor.front_motion' },
      hass,
    );
    expect(card.cameraState()).toBe('motion');
    expect(card.shadowRoot?.querySelector('.camera.motion')).not.toBeNull();
    expect(card.shadowRoot?.querySelector('.pill.motion')?.textContent?.trim()).toBe('Motion');
    expect(QuietLuxeCameraCard.styles.toString()).toContain('outline-offset: -2px');
    card.remove();
  });

  it('stays live when the motion companion is clear', async () => {
    const hass = makeMockHass([cameraEntity(), makeEntity('binary_sensor.front_motion', 'off')]);
    const card = await mount(
      { entity: 'camera.front_door', motion_entity: 'binary_sensor.front_motion' },
      hass,
    );
    expect(card.cameraState()).toBe('live');
    expect(card.shadowRoot?.querySelector('.pill.motion')).toBeNull();
    card.remove();
  });

  /* Never an empty grey box: the offline card carries a glyph, the camera's
     name and the reason. */
  it('draws a labelled offline card when the snapshot fails', async () => {
    const card = await mount(
      { entity: 'camera.front_door', size: 'l' },
      makeMockHass([cameraEntity()]),
    );
    card.shadowRoot?.querySelector('img')?.dispatchEvent(new Event('error'));
    await card.updateComplete;
    expect(card.cameraState()).toBe('unavailable');
    expect(card.shadowRoot?.querySelector('img')).toBeNull();
    expect(card.shadowRoot?.querySelector('svg.glyph')).not.toBeNull();
    expect(card.shadowRoot?.querySelector('.offline-name')?.textContent?.trim()).toBe('Front Door');
    expect(card.shadowRoot?.textContent).toContain('Snapshot unavailable');
    expect(card.shadowRoot?.textContent).not.toContain('LIVE');
    card.remove();
  });

  it('retries after the refresh interval by clearing the error and re-rendering', async () => {
    const card = await mount(
      { entity: 'camera.front_door', refresh_interval: 5 },
      makeMockHass([cameraEntity()]),
    );
    card.shadowRoot?.querySelector('img')?.dispatchEvent(new Event('error'));
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector('img')).toBeNull();
    vi.advanceTimersByTime(5000);
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector('img')).not.toBeNull();
    card.remove();
  });

  it('an unavailable camera says Unavailable, a pictureless one says Snapshot unavailable', async () => {
    const offline = await mount(
      { entity: 'camera.front_door', size: 'l' },
      makeMockHass([
        makeEntity('camera.front_door', 'unavailable', { friendly_name: 'Front Door' }),
      ]),
    );
    expect(offline.cameraState()).toBe('unavailable');
    expect(offline.shadowRoot?.querySelector('.ql-unavailable')).not.toBeNull();
    expect(offline.shadowRoot?.textContent).toContain('Unavailable');
    offline.remove();

    const pictureless = await mount(
      { entity: 'camera.front_door' },
      makeMockHass([makeEntity('camera.front_door', 'idle', { friendly_name: 'Front Door' })]),
    );
    expect(pictureless.shadowRoot?.textContent).toContain('Snapshot unavailable');
    pictureless.remove();
  });

  it('the card itself opens HA’s more-info dialog for the camera', async () => {
    const card = await mount(
      { entity: 'camera.front_door', size: 'l' },
      makeMockHass([cameraEntity()]),
    );
    const seen: Array<CustomEvent<{ entityId: string }>> = [];
    const record = (event: Event): void => {
      seen.push(event as CustomEvent<{ entityId: string }>);
    };
    document.body.addEventListener('hass-more-info', record);
    card.shadowRoot?.querySelector<HTMLElement>('.camera')?.click();
    document.body.removeEventListener('hass-more-info', record);
    expect(seen.map((event) => event.detail.entityId)).toEqual(['camera.front_door']);
    expect(seen[0]?.bubbles).toBe(true);
    expect(seen[0]?.composed).toBe(true);
    card.remove();
  });

  it('clears its timer on disconnect', async () => {
    const card = await mount({ entity: 'camera.front_door' }, makeMockHass([cameraEntity()]));
    card.remove();
    expect(vi.getTimerCount()).toBe(0);
  });
});
