import { html, type TemplateResult } from 'lit';
import { describe, expect, it } from 'vitest';
import { makeEntity, makeMockHass } from '../testing/mock-hass';
import { DARK_MODE_ATTRIBUTE } from '../theme/inject-theme';
import type { HassEntity, HomeAssistant } from '../types/home-assistant';
import { QlBaseCard } from './ql-base-card';
import { QuietLuxeLightCard } from './quiet-luxe-light-card';

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

/**
 * Render gating. HA reassigns `hass` on every state_changed in the house, so
 * these tests build each successive hass the way HA does — by spreading the
 * previous one — rather than with a fresh makeMockHass, which would look like
 * "every field changed" and legitimately force a render.
 */
class QlCountingCard extends QlBaseCard {
  renders = 0;

  protected override render(): TemplateResult {
    this.renders += 1;
    return html`<div>${this.entity('light.desk')?.state ?? ''}</div>`;
  }
}
customElements.define('ql-counting-card', QlCountingCard);

/** Draws no entity state at all: it has no watch set to reason about. */
class QlStaticCard extends QlBaseCard {
  renders = 0;

  protected override render(): TemplateResult {
    this.renders += 1;
    return html`<div>static</div>`;
  }
}
customElements.define('ql-static-card', QlStaticCard);

function withStates(hass: HomeAssistant, ...entities: ReadonlyArray<HassEntity>): HomeAssistant {
  return {
    ...hass,
    states: {
      ...hass.states,
      ...Object.fromEntries(entities.map((entity) => [entity.entity_id, entity])),
    },
  };
}

async function mount<T extends QlBaseCard>(card: T, hass?: HomeAssistant): Promise<T> {
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

describe('QlBaseCard render gating', () => {
  const base = (): HomeAssistant =>
    makeMockHass([makeEntity('light.desk', 'on'), makeEntity('light.hall', 'on')]);

  it('does not re-render when an entity the card never read changes', async () => {
    const hass = base();
    const card = await mount(new QlCountingCard(), hass);
    expect(card.renders).toBe(1);

    card.hass = withStates(hass, makeEntity('light.hall', 'off'));
    await card.updateComplete;

    expect(card.renders).toBe(1);
    card.remove();
  });

  it('re-renders when a watched entity changes, and shows the new state', async () => {
    const hass = base();
    const card = await mount(new QlCountingCard(), hass);

    card.hass = withStates(hass, makeEntity('light.desk', 'off'));
    await card.updateComplete;

    expect(card.renders).toBe(2);
    expect(card.shadowRoot?.textContent).toContain('off');
    card.remove();
  });

  it('always renders the first hass assignment, whatever the watch set says', async () => {
    // Mounted without hass, so the first frame records light.desk while every
    // read misses. The assignment that follows must not be gated on that.
    const card = await mount(new QlCountingCard());
    expect(card.renders).toBe(1);

    card.hass = base();
    await card.updateComplete;

    expect(card.renders).toBe(2);
    expect(card.shadowRoot?.textContent).toContain('on');
    card.remove();
  });

  it('still propagates a dark-mode flip when no watched entity moved', async () => {
    const hass: HomeAssistant = { ...base(), themes: { darkMode: false } };
    const card = await mount(new QlCountingCard(), hass);
    expect(document.documentElement.getAttribute(DARK_MODE_ATTRIBUTE)).toBe('false');

    card.hass = { ...hass, themes: { darkMode: true } };
    await card.updateComplete;

    expect(card.renders).toBe(2);
    expect(document.documentElement.getAttribute(DARK_MODE_ATTRIBUTE)).toBe('true');
    card.remove();
    document.documentElement.removeAttribute(DARK_MODE_ATTRIBUTE);
  });

  it('re-renders when the session locale or language changes', async () => {
    const hass = base();
    const card = await mount(new QlCountingCard(), hass);

    card.hass = { ...hass, language: 'ms', locale: { language: 'ms' } };
    await card.updateComplete;

    expect(card.renders).toBe(2);
    card.remove();
  });

  it('re-renders when the signed-in user changes', async () => {
    const hass = base();
    const card = await mount(new QlCountingCard(), hass);

    card.hass = { ...hass, user: { id: 'u1', name: 'Ever', is_admin: true } };
    await card.updateComplete;

    expect(card.renders).toBe(2);
    card.remove();
  });

  it('always renders a card that reads no entities', async () => {
    const hass = base();
    const card = await mount(new QlStaticCard(), hass);
    expect(card.renders).toBe(1);

    card.hass = withStates(hass, makeEntity('light.hall', 'off'));
    await card.updateComplete;

    expect(card.renders).toBe(2);
    card.remove();
  });

  it('re-renders when a property other than hass changes', async () => {
    const hass = base();
    const card = await mount(new QlCountingCard(), hass);

    card.requestUpdate();
    await card.updateComplete;

    expect(card.renders).toBe(2);
    card.remove();
  });
});

/**
 * The gate is only worth anything if a real card's watch set comes out right,
 * so prove the derivation end-to-end on one: the light card reads exactly its
 * configured entity, and nothing else in the house may wake it.
 */
class CountingLightCard extends QuietLuxeLightCard {
  renders = 0;

  protected override render(): TemplateResult {
    this.renders += 1;
    return super.render();
  }
}
customElements.define('ql-counting-light-card', CountingLightCard);

describe('QlBaseCard render gating on a real subclass', () => {
  it('wakes the light card for its own entity only', async () => {
    const hass = makeMockHass([
      makeEntity('light.desk', 'on', { brightness: 128 }),
      makeEntity('light.hall', 'on', { brightness: 255 }),
    ]);
    const card = new CountingLightCard();
    card.setConfig({ type: 'custom:quiet-luxe-light-card', entity: 'light.desk' });
    await mount(card, hass);
    expect(card.renders).toBe(1);

    card.hass = withStates(hass, makeEntity('light.hall', 'off'));
    await card.updateComplete;
    expect(card.renders).toBe(1);

    card.hass = withStates(hass, makeEntity('light.desk', 'off'));
    await card.updateComplete;
    expect(card.renders).toBe(2);

    card.remove();
  });
});

/**
 * The shared identity button's hit area. Nothing in happy-dom lays out, so
 * these assert the rule itself; the geometry was verified in Chromium at
 * 390px across every generated view (see the report for the numbers).
 */
function ruleBlock(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} rule not found`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
}

describe('QlBaseCard .ql-info touch target', () => {
  const css = QlBaseCard.qlCardStyles.toString();

  it('floors the tap height at the shared touch minimum with an invisible overlay', () => {
    expect(ruleBlock(css, '.ql-info')).toContain('position: relative');
    const overlay = ruleBlock(css, '.ql-info::after');
    expect(overlay).toContain("content: ''");
    expect(overlay).toContain('position: absolute');
    expect(overlay).toContain('height: var(--ql-touch-min, 56px)');
    // Centred rather than edge-anchored: half the reach into either neighbour
    // for the same total height.
    expect(overlay).toContain('top: 50%');
    expect(overlay).toContain('transform: translateY(-50%)');
    // As wide as the button it sits on, and no wider.
    expect(overlay).toContain('left: 0');
    expect(overlay).toContain('right: 0');
    // Additive, so an instance already taller than the minimum keeps its own
    // hit area; nothing here may cap it.
    expect(overlay).not.toContain('max-height');
  });

  it('paints nothing new and moves nothing: no fill, no size, no layout', () => {
    const overlay = ruleBlock(css, '.ql-info::after');
    expect(overlay).not.toContain('background');
    expect(overlay).not.toContain('border');
    const button = ruleBlock(css, '.ql-info');
    // The older half of the trick — padding turned into hit area by an equal
    // negative margin — has to survive intact for the two to compose.
    expect(button).toContain(
      'margin: calc(-1 * var(--ql-space-xs, 4px)) calc(-1 * var(--ql-space-s, 8px))',
    );
    expect(button).toContain('padding: var(--ql-space-xs, 4px) var(--ql-space-s, 8px)');
    // Growing the button itself would move every neighbour it sits above.
    expect(button).not.toContain('min-height');
    expect(button).not.toContain('height:');
  });
});
