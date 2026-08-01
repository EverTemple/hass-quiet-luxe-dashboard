import { html, type TemplateResult } from 'lit';
import { describe, expect, it } from 'vitest';
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
