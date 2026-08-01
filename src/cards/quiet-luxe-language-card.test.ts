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
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual([
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
});
