import { describe, expect, it } from 'vitest';
import { QlToggle } from './ql-toggle';

async function mount(props: Partial<QlToggle> = {}): Promise<QlToggle> {
  const el = document.createElement('ql-toggle') as QlToggle;
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe('ql-toggle', () => {
  it('is registered, unchecked and enabled by default', () => {
    expect(customElements.get('ql-toggle')).toBe(QlToggle);
    const el = document.createElement('ql-toggle') as QlToggle;
    expect(el.checked).toBe(false);
    expect(el.disabled).toBe(false);
  });

  it('renders a native button with role=switch and aria-checked', async () => {
    const el = await mount({ checked: true, label: 'Motion detection' });
    const button = el.shadowRoot?.querySelector('button');
    expect(button?.getAttribute('role')).toBe('switch');
    expect(button?.getAttribute('aria-checked')).toBe('true');
    expect(button?.getAttribute('aria-label')).toBe('Motion detection');
    el.remove();
  });

  it('click flips checked and emits ql-change with the new value', async () => {
    const el = await mount();
    const events: Array<{ checked: boolean }> = [];
    el.addEventListener('ql-change', (e) =>
      events.push((e as CustomEvent<{ checked: boolean }>).detail),
    );
    el.shadowRoot?.querySelector('button')?.click();
    expect(el.checked).toBe(true);
    el.shadowRoot?.querySelector('button')?.click();
    expect(el.checked).toBe(false);
    expect(events).toEqual([{ checked: true }, { checked: false }]);
    el.remove();
  });

  it('does nothing when disabled', async () => {
    const el = await mount({ disabled: true });
    const events: unknown[] = [];
    el.addEventListener('ql-change', (e) => events.push(e));
    el.shadowRoot?.querySelector('button')?.click();
    expect(el.checked).toBe(false);
    expect(events).toEqual([]);
    el.remove();
  });

  it('binds track/thumb colors to --ql-* variables', () => {
    const cssText = QlToggle.styles.toString();
    expect(cssText).toContain('var(--ql-accent-champagne, #b08d57)');
    expect(cssText).toContain('var(--ql-surface-card, #fdfbf6)');
    expect(cssText).toContain('var(--ql-surface-border, #e4dccb)');
  });

  /**
   * --ql-surface-card is rgba(255,250,240,0.055) in dark mode. Filling the
   * checked thumb with it made the knob all but invisible against the
   * champagne track on every toggle in the product.
   */
  it('fills the checked thumb with an opaque token, never surface-card', () => {
    const checkedThumb = /:host\(\[checked\]\) button::after \{([^}]*)\}/.exec(
      QlToggle.styles.toString(),
    )?.[1];
    expect(checkedThumb).toBeDefined();
    expect(checkedThumb).toContain('var(--ql-bg-base, #f4f0e8)');
    expect(checkedThumb).not.toContain('--ql-surface-card');
  });
});
