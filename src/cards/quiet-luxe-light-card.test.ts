import { afterEach, describe, expect, it } from 'vitest';
import { lightEntity, makeMockHass } from '../testing/mock-hass';
import type { QlSlider } from '../elements/ql-slider';
import { QuietLuxeLightCard, type LightCardConfig } from './quiet-luxe-light-card';

async function mount(
  config: Partial<LightCardConfig> & { entity: string },
  hass = makeMockHass(),
): Promise<QuietLuxeLightCard> {
  const card = document.createElement('quiet-luxe-light-card') as QuietLuxeLightCard;
  card.setConfig({ type: 'custom:quiet-luxe-light-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

function slider(card: QuietLuxeLightCard): QlSlider {
  const el = card.shadowRoot?.querySelector<QlSlider>('ql-slider');
  if (el === null || el === undefined) {
    throw new Error('slider missing');
  }
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('quiet-luxe-light-card', () => {
  it('registers element + picker entry and requires entity', () => {
    expect(customElements.get('quiet-luxe-light-card')).toBe(QuietLuxeLightCard);
    expect((window.customCards ?? []).map((e) => e.type)).toContain('quiet-luxe-light-card');
    const card = new QuietLuxeLightCard();
    expect(() =>
      card.setConfig({ type: 'custom:quiet-luxe-light-card', entity: '' }),
    ).toThrow(/entity/);
  });

  it('shows brightness % from the 0-255 attribute and glows when on', async () => {
    const card = await mount(
      { entity: 'light.pendant' },
      makeMockHass([lightEntity('light.pendant', 'on', 128)]),
    );
    expect(card.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('50%');
    expect(slider(card).value).toBe(50);
    expect(card.shadowRoot?.querySelector('.bulb')?.classList.contains('on')).toBe(true);
    const cssText = (QuietLuxeLightCard.styles as unknown as ReadonlyArray<{ toString(): string }>)
      .map((s) => s.toString())
      .join('\n');
    expect(cssText).toContain('var(--ql-glow-lamp-inner, #ffd98a)');
    expect(cssText).toContain('0 0 18px rgba(224, 178, 99, 0.45)');
  });

  it('off state: 0%, no glow', async () => {
    const card = await mount(
      { entity: 'light.pendant' },
      makeMockHass([lightEntity('light.pendant', 'off')]),
    );
    expect(card.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('0%');
    expect(card.shadowRoot?.querySelector('.bulb')?.classList.contains('on')).toBe(false);
  });

  it('slider commit calls light.turn_on with brightness_pct, 0 calls light.turn_off', async () => {
    const hass = makeMockHass([lightEntity('light.pendant', 'on', 128)]);
    const card = await mount({ entity: 'light.pendant' }, hass);
    slider(card).dispatchEvent(
      new CustomEvent('ql-change', { detail: { value: 60 }, bubbles: true, composed: true }),
    );
    slider(card).dispatchEvent(
      new CustomEvent('ql-change', { detail: { value: 0 }, bubbles: true, composed: true }),
    );
    expect(hass.calls).toEqual([
      {
        domain: 'light',
        service: 'turn_on',
        data: { entity_id: 'light.pendant', brightness_pct: 60 },
      },
      { domain: 'light', service: 'turn_off', data: { entity_id: 'light.pendant' } },
    ]);
  });

  it('head tap toggles the light', async () => {
    const hass = makeMockHass([lightEntity('light.pendant', 'on', 128)]);
    const card = await mount({ entity: 'light.pendant' }, hass);
    card.shadowRoot?.querySelector<HTMLButtonElement>('.head')?.click();
    expect(hass.calls).toEqual([
      { domain: 'light', service: 'toggle', data: { entity_id: 'light.pendant' } },
    ]);
  });

  it('slider aria-label is localized via light.brightness', async () => {
    const card = await mount(
      { entity: 'light.pendant' },
      makeMockHass([lightEntity('light.pendant', 'on', 128)], 'zh-Hans'),
    );
    expect(slider(card).label).toBe('亮度');
  });

  it('unavailable: muted, slider disabled, no service calls; missing: placeholder', async () => {
    const hass = makeMockHass([lightEntity('light.pendant', 'unavailable')]);
    const card = await mount({ entity: 'light.pendant' }, hass);
    expect(card.shadowRoot?.querySelector('.ql-card')?.classList.contains('ql-unavailable')).toBe(
      true,
    );
    expect(slider(card).disabled).toBe(true);
    expect(card.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('Unavailable');
    const missing = await mount({ entity: 'light.ghost' }, makeMockHass());
    expect(missing.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('Unavailable');
    expect(missing.getCardSize()).toBe(2);
    expect(missing.getGridOptions()).toEqual({ rows: 2, columns: 4 });
  });
});
