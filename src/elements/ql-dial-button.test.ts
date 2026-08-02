import { describe, expect, it } from 'vitest';
import { QlDialButton } from './ql-dial-button';
import { DYSON_ICON_NAMES, dysonIcon } from './dyson-icons';

async function mount(props: Partial<QlDialButton> = {}): Promise<QlDialButton> {
  const el = document.createElement('ql-dial-button') as QlDialButton;
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe('ql-dial-button', () => {
  it('is registered and defaults to the off state', () => {
    expect(customElements.get('ql-dial-button')).toBe(QlDialButton);
    const el = document.createElement('ql-dial-button') as QlDialButton;
    expect(el.state).toBe('off');
    expect(el.disabled).toBe(false);
  });

  it('renders a real button carrying the label as its accessible name', async () => {
    const el = await mount({ label: 'Oscillation', stateWord: '90°', icon: 'oscillation' });
    const button = el.shadowRoot?.querySelector('button');
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.getAttribute('aria-label')).toBe('Oscillation');
    el.remove();
  });

  /** The state word is decorative: "90° Oscillation" would be read out twice. */
  it('keeps the state word out of the accessible name but shows it in the dial', async () => {
    const el = await mount({ label: 'Oscillation', stateWord: '90°' });
    expect(el.shadowRoot?.querySelector('.word')?.textContent?.trim()).toBe('90°');
    expect(el.shadowRoot?.querySelector('button')?.getAttribute('aria-label')).toBe('Oscillation');
    el.remove();
  });

  it('omits the state word entirely when there is none', async () => {
    const el = await mount({ label: 'More', icon: 'more' });
    expect(el.shadowRoot?.querySelector('.word')).toBeNull();
    el.remove();
  });

  it('reports on and auto as pressed, off as not pressed', async () => {
    for (const [state, pressed] of [
      ['off', 'false'],
      ['on', 'true'],
      ['auto', 'true'],
    ] as const) {
      const el = await mount({ state, label: 'Auto' });
      expect(el.shadowRoot?.querySelector('button')?.getAttribute('aria-pressed')).toBe(pressed);
      el.remove();
    }
  });

  it('reflects state to the host so the dial can be styled per state', async () => {
    const el = await mount({ state: 'auto' });
    expect(el.getAttribute('state')).toBe('auto');
    el.remove();
  });

  it('emits ql-change carrying the state it was in when pressed', async () => {
    const el = await mount({ state: 'on' });
    const events: Array<{ state: string }> = [];
    el.addEventListener('ql-change', (e) =>
      events.push((e as CustomEvent<{ state: string }>).detail),
    );
    el.shadowRoot?.querySelector('button')?.click();
    expect(events).toEqual([{ state: 'on' }]);
    el.remove();
  });

  it('does nothing when disabled', async () => {
    const el = await mount({ disabled: true });
    const events: unknown[] = [];
    el.addEventListener('ql-change', (e) => events.push(e));
    el.shadowRoot?.querySelector('button')?.click();
    expect(events).toEqual([]);
    el.remove();
  });

  it('renders the requested glyph inline so it inherits currentColor', async () => {
    const el = await mount({ icon: 'night' });
    const path = el.shadowRoot?.querySelector('svg path');
    expect(path?.getAttribute('stroke')).toBe('currentColor');
    expect(el.shadowRoot?.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 24 24');
    el.remove();
  });

  it('meets the touch minimum with a 64px dial', () => {
    const cssText = QlDialButton.styles.toString();
    expect(cssText).toContain('width: 64px');
    expect(cssText).toContain('height: 64px');
  });

  it('draws every state from --ql-* tokens', () => {
    const cssText = QlDialButton.styles.toString();
    expect(cssText).toContain('var(--ql-surface-card, #fdfbf6)');
    expect(cssText).toContain('var(--ql-surface-border, #e4dccb)');
    expect(cssText).toContain('var(--ql-accent-champagne, #b08d57)');
    expect(cssText).toContain('var(--ql-ink-muted, #8c8578)');
  });
});

describe('dyson-icons', () => {
  it('ships the thirteen glyphs the Figma set defines', () => {
    expect(DYSON_ICON_NAMES).toHaveLength(13);
    expect(DYSON_ICON_NAMES).toContain('arrow-front');
    expect(DYSON_ICON_NAMES).toContain('arrow-back');
  });

  it('renders every glyph with stroke geometry and no hard-coded colour', () => {
    for (const name of DYSON_ICON_NAMES) {
      const host = document.createElement('div');
      document.body.append(host);
      const { strings, values } = dysonIcon(name) as unknown as {
        strings: ReadonlyArray<string>;
        values: ReadonlyArray<unknown>;
      };
      const markup = strings.join(' ') + JSON.stringify(values);
      expect(markup).not.toMatch(/#8[cC]8578/);
      host.remove();
    }
  });

  it('scales the box without changing the viewBox', async () => {
    const el = document.createElement('ql-dial-button') as QlDialButton;
    document.body.append(el);
    await el.updateComplete;
    const svg = el.shadowRoot?.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('24');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    el.remove();
  });
});
