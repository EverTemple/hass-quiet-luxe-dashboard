import { describe, expect, it } from 'vitest';
import { makeMockHass, type MockHass } from '../testing/mock-hass';
import {
  LANGUAGE_TILES,
  QuietLuxeLanguageCard,
  type LanguageCardConfig,
} from './quiet-luxe-language-card';

async function mount(
  config: Omit<LanguageCardConfig, 'type'>,
  hass: MockHass,
): Promise<QuietLuxeLanguageCard> {
  const card = document.createElement('quiet-luxe-language-card') as QuietLuxeLanguageCard;
  card.setConfig({ type: 'custom:quiet-luxe-language-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

describe('quiet-luxe-language-card', () => {
  it('is registered and exposes all five tiles by default', async () => {
    expect(customElements.get('quiet-luxe-language-card')).toBe(QuietLuxeLanguageCard);
    expect(LANGUAGE_TILES.map((tile) => tile.code)).toEqual([
      'en',
      'zh-Hant',
      'zh-Hans',
      'ms',
      'id',
    ]);
    const card = await mount({}, makeMockHass());
    const buttons = [...(card.shadowRoot?.querySelectorAll('button') ?? [])];
    expect(buttons).toHaveLength(5);
    expect(buttons[1]?.textContent).toContain('繁體中文');
    expect(buttons[1]?.textContent).toContain('Traditional Chinese');
    card.remove();
  });

  it('validates a languages subset and renders only it', async () => {
    const card = new QuietLuxeLanguageCard();
    expect(() =>
      card.setConfig({ type: 'x', languages: ['fr' as unknown as 'en'] }),
    ).toThrow('unsupported language');
    const subset = await mount({ languages: ['en', 'ms'] }, makeMockHass());
    expect(subset.shadowRoot?.querySelectorAll('button')).toHaveLength(2);
    subset.remove();
  });

  it('marks the tile matching the current hass locale as selected', async () => {
    const card = await mount({}, makeMockHass([], 'zh-Hant'));
    const buttons = [...(card.shadowRoot?.querySelectorAll('button') ?? [])];
    expect(buttons.map((b) => b.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
      'false',
      'false',
    ]);
    card.remove();
  });

  it('dispatches hass-language-select with the bare language code on tap', async () => {
    const card = await mount({}, makeMockHass());
    const received: string[] = [];
    window.addEventListener('hass-language-select', (event) =>
      received.push((event as CustomEvent<string>).detail),
    );
    const buttons = [...(card.shadowRoot?.querySelectorAll('button') ?? [])];
    buttons[3]?.click();
    expect(received).toEqual(['ms']);
    card.remove();
  });

  /** Mutually-exclusive tiles carry radiogroup semantics, not toggle-button
   * ones — a screen reader should hear "radio button, 2 of 5", not five
   * independent pressed/unpressed toggles. */
  it('exposes radiogroup/radio semantics with a roving tabindex', async () => {
    const card = await mount({}, makeMockHass([], 'zh-Hant'));
    expect(card.shadowRoot?.querySelector('.grid')?.getAttribute('role')).toBe('radiogroup');
    const buttons = [...(card.shadowRoot?.querySelectorAll('button') ?? [])];
    expect(buttons.every((b) => b.getAttribute('role') === 'radio')).toBe(true);
    expect(buttons.every((b) => b.getAttribute('type') === 'button')).toBe(true);
    expect(buttons.map((b) => b.getAttribute('tabindex'))).toEqual(['-1', '0', '-1', '-1', '-1']);
    card.remove();
  });

  /** A button may only contain phrasing content — <p> is invalid inside one. */
  it('renders the native and gloss lines as spans, not paragraphs', async () => {
    const card = await mount({}, makeMockHass());
    const button = card.shadowRoot?.querySelector('button');
    expect(button?.querySelector('p')).toBeNull();
    expect(button?.querySelector('span.native')?.textContent).toBe('English');
    expect(button?.querySelector('span.gloss')?.textContent).toBe('English');
    card.remove();
  });

  it('arrow keys move focus and select the next tile', async () => {
    const card = await mount({}, makeMockHass([], 'en'));
    const received: string[] = [];
    window.addEventListener('hass-language-select', (event) =>
      received.push((event as CustomEvent<string>).detail),
    );
    const buttons = [...(card.shadowRoot?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    buttons[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(received).toEqual(['zh-Hant']);
    expect(card.shadowRoot?.activeElement).toBe(buttons[1]);
    card.remove();
  });
});
