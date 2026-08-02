import { afterEach, describe, expect, it } from 'vitest';
import { coverEntity, makeEntity, makeMockHass } from '../testing/mock-hass';
import type { QlSlider } from '../elements/ql-slider';
import {
  QuietLuxeCoverCard,
  detectCoverType,
  type CoverCardConfig,
} from './quiet-luxe-cover-card';

async function mount(
  config: Partial<CoverCardConfig> & { entity: string },
  hass = makeMockHass(),
): Promise<QuietLuxeCoverCard> {
  const card = document.createElement('quiet-luxe-cover-card') as QuietLuxeCoverCard;
  card.setConfig({ type: 'custom:quiet-luxe-cover-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('detectCoverType', () => {
  it('maps device_class shade/blind to shade, everything else to curtain', () => {
    expect(detectCoverType(coverEntity('cover.a', 50, { device_class: 'shade' }))).toBe('shade');
    expect(detectCoverType(coverEntity('cover.a', 50, { device_class: 'blind' }))).toBe('shade');
    expect(detectCoverType(coverEntity('cover.a', 50, { device_class: 'curtain' }))).toBe(
      'curtain',
    );
    expect(detectCoverType(coverEntity('cover.a', 50))).toBe('curtain');
    expect(detectCoverType(undefined)).toBe('curtain');
  });
});

describe('quiet-luxe-cover-card', () => {
  it('registers element + picker entry, requires entity, sizes 2x4', () => {
    expect(customElements.get('quiet-luxe-cover-card')).toBe(QuietLuxeCoverCard);
    expect((window.customCards ?? []).map((e) => e.type)).toContain('quiet-luxe-cover-card');
    const card = new QuietLuxeCoverCard();
    expect(() =>
      card.setConfig({ type: 'custom:quiet-luxe-cover-card', entity: '' }),
    ).toThrow(/entity/);
    card.setConfig({ type: 'custom:quiet-luxe-cover-card', entity: 'cover.a' });
    expect(card.getCardSize()).toBe(2);
    expect(card.getGridOptions()).toEqual({ rows: 'auto', columns: 6 });
  });

  it('shows the position % and reflects cover type (config override wins)', async () => {
    const card = await mount(
      { entity: 'cover.living' },
      makeMockHass([coverEntity('cover.living', 65, { device_class: 'curtain' })]),
    );
    expect(card.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('65%');
    expect(card.shadowRoot?.querySelector<HTMLElement>('.ql-card')?.dataset.coverType).toBe(
      'curtain',
    );
    const forced = await mount(
      { entity: 'cover.living', cover_type: 'shade' },
      makeMockHass([coverEntity('cover.living', 65, { device_class: 'curtain' })]),
    );
    expect(forced.shadowRoot?.querySelector<HTMLElement>('.ql-card')?.dataset.coverType).toBe(
      'shade',
    );
  });

  it('slider commit calls cover.set_cover_position', async () => {
    const hass = makeMockHass([coverEntity('cover.living', 65)]);
    const card = await mount({ entity: 'cover.living' }, hass);
    card.shadowRoot?.querySelector<QlSlider>('ql-slider')?.dispatchEvent(
      new CustomEvent('ql-change', { detail: { value: 30 }, bubbles: true, composed: true }),
    );
    expect(hass.calls).toEqual([
      {
        domain: 'cover',
        service: 'set_cover_position',
        data: { entity_id: 'cover.living', position: 30 },
      },
    ]);
  });

  it('open/stop/close buttons are localized and call the matching services', async () => {
    const hass = makeMockHass([coverEntity('cover.living', 65)], 'zh-Hant');
    const card = await mount({ entity: 'cover.living' }, hass);
    const buttons = [...(card.shadowRoot?.querySelectorAll<HTMLButtonElement>('.ops button') ?? [])];
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['開啟', '停止', '關閉']);
    for (const button of buttons) {
      button.click();
    }
    expect(hass.calls).toEqual([
      { domain: 'cover', service: 'open_cover', data: { entity_id: 'cover.living' } },
      { domain: 'cover', service: 'stop_cover', data: { entity_id: 'cover.living' } },
      { domain: 'cover', service: 'close_cover', data: { entity_id: 'cover.living' } },
    ]);
  });

  it('unavailable: muted, controls disabled; missing: placeholder value', async () => {
    const card = await mount(
      { entity: 'cover.living' },
      makeMockHass([makeEntity('cover.living', 'unavailable')]),
    );
    expect(card.shadowRoot?.querySelector('.ql-card')?.classList.contains('ql-unavailable')).toBe(
      true,
    );
    expect(card.shadowRoot?.querySelector<QlSlider>('ql-slider')?.disabled).toBe(true);
    expect(
      [...(card.shadowRoot?.querySelectorAll<HTMLButtonElement>('.ops button') ?? [])].every(
        (b) => b.disabled,
      ),
    ).toBe(true);
    const missing = await mount({ entity: 'cover.ghost' }, makeMockHass());
    expect(missing.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('—');
  });
});
