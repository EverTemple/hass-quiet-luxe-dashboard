import { html, type TemplateResult } from 'lit';
import { describe, expect, it } from 'vitest';
import { DARK_MODE_ATTRIBUTE } from '../theme/inject-theme';
import type { HomeAssistant } from '../types/home-assistant';
import { QlBaseCard } from './ql-base-card';

class QlTestCard extends QlBaseCard {
  protected override render(): TemplateResult {
    const cls = this.availability('light.desk') === 'available' ? 'ql-card' : 'ql-card ql-unavailable';
    return html`<div class="${cls}">test</div>`;
  }
}
customElements.define('ql-test-card', QlTestCard);

function makeHass(states: HomeAssistant['states']): HomeAssistant {
  return {
    states,
    language: 'en',
    locale: { language: 'en' },
    callService: () => Promise.resolve(undefined),
  };
}

function stubEntity(entityId: string, state: string): HomeAssistant['states'][string] {
  return {
    entity_id: entityId,
    state,
    attributes: {},
    last_changed: '',
    last_updated: '',
    context: { id: '', user_id: null, parent_id: null },
  };
}

describe('QlBaseCard availability', () => {
  it('reports available for a normal entity state', () => {
    const card = new QlTestCard();
    card.hass = makeHass({ 'light.desk': stubEntity('light.desk', 'on') });
    expect(card.availabilityOf('light.desk')).toBe('available');
  });

  it('reports unavailable for unavailable/unknown states (muted, never an error)', () => {
    const card = new QlTestCard();
    card.hass = makeHass({
      'light.desk': stubEntity('light.desk', 'unavailable'),
      'light.hall': stubEntity('light.hall', 'unknown'),
    });
    expect(card.availabilityOf('light.desk')).toBe('unavailable');
    expect(card.availabilityOf('light.hall')).toBe('unavailable');
  });

  it('reports missing when the entity is absent or hass is unset', () => {
    const card = new QlTestCard();
    expect(card.availabilityOf('light.desk')).toBe('missing');
    card.hass = makeHass({});
    expect(card.availabilityOf('light.desk')).toBe('missing');
  });

  it('applies the muted unavailable class when rendered', async () => {
    const card = new QlTestCard();
    card.hass = makeHass({ 'light.desk': stubEntity('light.desk', 'unavailable') });
    document.body.append(card);
    await card.updateComplete;
    const div = card.shadowRoot?.querySelector('div');
    expect(div?.classList.contains('ql-unavailable')).toBe(true);
    card.remove();
  });
});

describe('QlBaseCard dark mode', () => {
  async function renderWith(hass: HomeAssistant): Promise<void> {
    const card = new QlTestCard();
    card.hass = hass;
    document.body.append(card);
    await card.updateComplete;
    card.remove();
  }

  it('republishes HA dark mode onto the document before the first paint', async () => {
    await renderWith({ ...makeHass({}), themes: { darkMode: true } });
    expect(document.documentElement.getAttribute(DARK_MODE_ATTRIBUTE)).toBe('true');
    await renderWith({ ...makeHass({}), themes: { darkMode: false } });
    expect(document.documentElement.getAttribute(DARK_MODE_ATTRIBUTE)).toBe('false');
  });

  it('leaves the system preference in charge when HA reports no theme state', async () => {
    await renderWith({ ...makeHass({}), themes: { darkMode: true } });
    await renderWith(makeHass({}));
    expect(document.documentElement.hasAttribute(DARK_MODE_ATTRIBUTE)).toBe(false);
  });
});

describe('QlBaseCard locale', () => {
  it('resolves the hass locale through resolveLocale (zh-TW → zh-Hant)', () => {
    const card = new QlTestCard();
    card.hass = { ...makeHass({}), language: 'en', locale: { language: 'zh-TW' } };
    expect(card.locale()).toBe('zh-Hant');
  });

  it('falls back to hass.language, then en', () => {
    const card = new QlTestCard();
    card.hass = { ...makeHass({}), language: 'ms', locale: undefined };
    expect(card.locale()).toBe('ms');
    card.hass = undefined;
    expect(card.locale()).toBe('en');
  });
});
