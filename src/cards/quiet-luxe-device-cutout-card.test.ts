import { describe, expect, it } from 'vitest';
import { makeEntity, makeMockHass, type MockHass } from '../testing/mock-hass';
import {
  QuietLuxeDeviceCutoutCard,
  type DeviceCutoutCardConfig,
} from './quiet-luxe-device-cutout-card';

async function mount(
  config: Omit<DeviceCutoutCardConfig, 'type'>,
  hass: MockHass,
): Promise<QuietLuxeDeviceCutoutCard> {
  const card = document.createElement('quiet-luxe-device-cutout-card') as QuietLuxeDeviceCutoutCard;
  card.setConfig({ type: 'custom:quiet-luxe-device-cutout-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

describe('quiet-luxe-device-cutout-card', () => {
  it('is registered in window.customCards and requires an entity', () => {
    expect(customElements.get('quiet-luxe-device-cutout-card')).toBe(QuietLuxeDeviceCutoutCard);
    const entry = (window.customCards ?? []).find(
      (c) => c.type === 'quiet-luxe-device-cutout-card',
    );
    expect(entry?.name).toBe('Quiet Luxe Device Cutout Card');
    const card = new QuietLuxeDeviceCutoutCard();
    expect(() => card.setConfig({ type: 'x', entity: '' })).toThrow('"entity" is required');
  });

  it('renders name, cutout image and localized on/off status', async () => {
    const hass = makeMockHass([
      makeEntity('media_player.tv', 'on', { friendly_name: 'Living TV' }),
    ]);
    const card = await mount(
      { entity: 'media_player.tv', image: '/local/quiet-luxe/tv.png' },
      hass,
    );
    expect(card.shadowRoot?.textContent).toContain('Living TV');
    expect(card.shadowRoot?.textContent).toContain('On');
    expect(card.shadowRoot?.querySelector('img.cutout')?.getAttribute('src')).toBe(
      '/local/quiet-luxe/tv.png',
    );
    card.remove();
  });

  it('hides a failed image and keeps the status line', async () => {
    const hass = makeMockHass([makeEntity('media_player.tv', 'off')]);
    const card = await mount(
      { entity: 'media_player.tv', name: 'TV', image: '/local/broken.png' },
      hass,
    );
    card.shadowRoot?.querySelector('img.cutout')?.dispatchEvent(new Event('error'));
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector('img.cutout')).toBeNull();
    expect(card.shadowRoot?.textContent).toContain('Off');
    card.remove();
  });

  it('renders muted unavailable state without an image requirement', async () => {
    const hass = makeMockHass([makeEntity('media_player.tv', 'unavailable')], 'zh-Hans');
    const card = await mount({ entity: 'media_player.tv', name: 'TV' }, hass);
    expect(card.shadowRoot?.querySelector('.ql-unavailable')).not.toBeNull();
    expect(card.shadowRoot?.textContent).toContain('不可用');
    card.remove();
  });

  it('the device name opens HA’s more-info dialog for the entity', async () => {
    const hass = makeMockHass([makeEntity('media_player.tv', 'on', { friendly_name: 'Living TV' })]);
    const card = await mount({ entity: 'media_player.tv' }, hass);
    const seen: Array<CustomEvent<{ entityId: string }>> = [];
    const record = (event: Event): void => {
      seen.push(event as CustomEvent<{ entityId: string }>);
    };
    document.body.addEventListener('hass-more-info', record);
    card.shadowRoot?.querySelector<HTMLButtonElement>('.ql-info')?.click();
    document.body.removeEventListener('hass-more-info', record);
    expect(seen.map((event) => event.detail.entityId)).toEqual(['media_player.tv']);
    expect(seen[0]?.bubbles).toBe(true);
    expect(seen[0]?.composed).toBe(true);
    card.remove();
  });
});
