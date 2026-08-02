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

/* Live Dooya M1 curtain motor from the Tung Chung instance (HA 2026.7.1). */
const DOOYA = makeEntity('cover.dooya_m1_fe9b_curtain', 'open', {
  current_position: 83,
  device_class: 'curtain',
  friendly_name: '窗帘 Curtain',
  supported_features: 15,
});

/* A venetian blind: the same four features plus the four tilt features. */
const BLIND = makeEntity('cover.blind', 'open', {
  current_position: 100,
  current_cover_tilt_position: 40,
  device_class: 'blind',
  supported_features: 255,
});

describe('quiet-luxe-cover-card more-info', () => {
  it('opens HA’s dialog from the identity region, escaping the shadow root', async () => {
    const card = await mount({ entity: 'cover.dooya_m1_fe9b_curtain' }, makeMockHass([DOOYA]));
    const seen: string[] = [];
    document.body.addEventListener('hass-more-info', (event) => {
      seen.push((event as CustomEvent<{ entityId: string }>).detail.entityId);
    });

    card.shadowRoot?.querySelector<HTMLButtonElement>('.ql-info')?.click();

    expect(seen).toEqual(['cover.dooya_m1_fe9b_curtain']);
  });

  it('does not move the cover when the identity region is tapped', async () => {
    const hass = makeMockHass([DOOYA]);
    const card = await mount({ entity: 'cover.dooya_m1_fe9b_curtain' }, hass);

    card.shadowRoot?.querySelector<HTMLButtonElement>('.ql-info')?.click();

    expect(hass.calls).toEqual([]);
  });
});

describe('quiet-luxe-cover-card position', () => {
  it('drives the live Dooya to a position', async () => {
    const hass = makeMockHass([DOOYA]);
    const card = await mount({ entity: 'cover.dooya_m1_fe9b_curtain' }, hass);

    expect(card.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('83%');
    card.shadowRoot
      ?.querySelector<QlSlider>('ql-slider')
      ?.dispatchEvent(
        new CustomEvent('ql-change', { detail: { value: 50 }, bubbles: true, composed: true }),
      );

    expect(hass.calls).toEqual([
      {
        domain: 'cover',
        service: 'set_cover_position',
        data: { entity_id: 'cover.dooya_m1_fe9b_curtain', position: 50 },
      },
    ]);
  });
});

describe('quiet-luxe-cover-card tilt', () => {
  it('adds no tilt control to the live Dooya curtains, which do not tilt', async () => {
    const card = await mount({ entity: 'cover.dooya_m1_fe9b_curtain' }, makeMockHass([DOOYA]));
    expect(card.shadowRoot?.querySelector('.ql-controls')).toBeNull();
    expect(card.shadowRoot?.querySelectorAll('.ops')).toHaveLength(1);
  });

  it('adds a tilt slider for a cover that reports a tilt position', async () => {
    const hass = makeMockHass([BLIND]);
    const card = await mount({ entity: 'cover.blind' }, hass);

    expect(
      [...(card.shadowRoot?.querySelectorAll('.ql-control-label') ?? [])].map((n) =>
        n.textContent?.trim(),
      ),
    ).toEqual(['Tilt']);

    const tilt = [...(card.shadowRoot?.querySelectorAll<QlSlider>('ql-slider') ?? [])][1];
    expect(tilt?.value).toBe(40);
    tilt?.dispatchEvent(
      new CustomEvent('ql-change', { detail: { value: 70 }, bubbles: true, composed: true }),
    );

    expect(hass.calls).toEqual([
      {
        domain: 'cover',
        service: 'set_cover_tilt_position',
        data: { entity_id: 'cover.blind', tilt_position: 70 },
      },
    ]);
  });

  it('adds a tilt open/close row for a cover that can swing its slats', async () => {
    const hass = makeMockHass([BLIND]);
    const card = await mount({ entity: 'cover.blind' }, hass);
    const rows = card.shadowRoot?.querySelectorAll('.ops');

    expect(rows).toHaveLength(2);
    const tiltButtons = [...(rows?.[1]?.querySelectorAll('button') ?? [])];
    expect(tiltButtons.map((b) => b.textContent?.trim().replace(/\s+/g, ' '))).toEqual([
      'Tilt Open',
      'Tilt Close',
    ]);

    tiltButtons[0]?.click();
    tiltButtons[1]?.click();

    expect(hass.calls).toEqual([
      { domain: 'cover', service: 'open_cover_tilt', data: { entity_id: 'cover.blind' } },
      { domain: 'cover', service: 'close_cover_tilt', data: { entity_id: 'cover.blind' } },
    ]);
  });

  it('omits the tilt open/close row for a cover that can only set a tilt value', async () => {
    const valueOnly = makeEntity('cover.a', 'open', {
      current_cover_tilt_position: 20,
      supported_features: 15 | 128,
    });
    const card = await mount({ entity: 'cover.a' }, makeMockHass([valueOnly]));

    expect(card.shadowRoot?.querySelectorAll('.ops')).toHaveLength(1);
    expect(card.shadowRoot?.querySelector('.ql-controls')).not.toBeNull();
  });

  it('draws no tilt control for a cover that is not answering', async () => {
    const offline = makeEntity('cover.blind', 'unavailable', BLIND.attributes);
    const card = await mount({ entity: 'cover.blind' }, makeMockHass([offline]));
    expect(card.shadowRoot?.querySelector('.ql-controls')).toBeNull();
  });
});

describe('quiet-luxe-cover-card layout', () => {
  /* Live at 390 the Open/Stop/Close row overflowed a half-width card and the
     third button was clipped mid-word. Thumb targets do not shrink, so the row
     has to wrap. */
  it('wraps the operation row instead of clipping a button', () => {
    const cssText = QuietLuxeCoverCard.styles.toString().replace(/\s+/g, ' ');
    expect(cssText).toContain('flex-wrap: wrap');
    expect(cssText).toContain('flex: 1 1 var(--ql-touch-min, 56px)');
  });
});
