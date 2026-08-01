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

  it('is registered, defaults to glance form and a 10s refresh', () => {
    expect(customElements.get('quiet-luxe-camera-card')).toBe(QuietLuxeCameraCard);
    expect(DEFAULT_CAMERA_REFRESH_S).toBe(10);
    const entry = (window.customCards ?? []).find((c) => c.type === 'quiet-luxe-camera-card');
    expect(entry?.name).toBe('Quiet Luxe Camera Card');
  });

  it('renders the proxied snapshot with a time cache-buster', async () => {
    const card = await mount({ entity: 'camera.front_door' }, makeMockHass([cameraEntity()]));
    const src = card.shadowRoot?.querySelector('img')?.getAttribute('src') ?? '';
    expect(src.startsWith('/api/camera_proxy/camera.front_door?token=abc&time=')).toBe(true);
    card.remove();
  });

  it('shows the LIVE badge only on the full form', async () => {
    const hass = makeMockHass([cameraEntity()]);
    const glance = await mount({ entity: 'camera.front_door' }, hass);
    expect(glance.shadowRoot?.textContent).not.toContain('LIVE');
    glance.remove();
    const full = await mount({ entity: 'camera.front_door', form: 'full' }, hass);
    expect(full.shadowRoot?.textContent).toContain('LIVE');
    full.remove();
  });

  it('replaces a failed snapshot with a muted label, never a broken img', async () => {
    const card = await mount(
      { entity: 'camera.front_door', form: 'full' },
      makeMockHass([cameraEntity()]),
    );
    card.shadowRoot?.querySelector('img')?.dispatchEvent(new Event('error'));
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector('img')).toBeNull();
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

  it('unavailable or pictureless cameras render the muted unavailable frame', async () => {
    const card = await mount(
      { entity: 'camera.front_door', form: 'full' },
      makeMockHass([makeEntity('camera.front_door', 'unavailable')]),
    );
    expect(card.shadowRoot?.querySelector('img')).toBeNull();
    expect(card.shadowRoot?.querySelector('.ql-unavailable')).not.toBeNull();
    expect(card.shadowRoot?.textContent).toContain('Unavailable');
    card.remove();
  });

  it('clears its timer on disconnect', async () => {
    const card = await mount({ entity: 'camera.front_door' }, makeMockHass([cameraEntity()]));
    card.remove();
    expect(vi.getTimerCount()).toBe(0);
  });
});
