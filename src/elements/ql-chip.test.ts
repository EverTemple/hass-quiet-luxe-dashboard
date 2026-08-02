import { describe, expect, it } from 'vitest';
import { QlChip } from './ql-chip';

async function mount(props: Partial<QlChip> = {}): Promise<QlChip> {
  const el = document.createElement('ql-chip') as QlChip;
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe('ql-chip', () => {
  it('is registered with device/secondary/inactive defaults', () => {
    expect(customElements.get('ql-chip')).toBe(QlChip);
    const el = document.createElement('ql-chip') as QlChip;
    expect(el.variant).toBe('device');
    expect(el.emphasis).toBe('secondary');
    expect(el.active).toBe(false);
    expect(el.touch).toBe(false);
  });

  it('renders a native button (keyboard semantics for free)', async () => {
    const el = await mount();
    expect(el.shadowRoot?.querySelector('button')).not.toBeNull();
    el.remove();
  });

  it('exposes device on/off state via aria-pressed', async () => {
    const el = await mount({ variant: 'device', active: true });
    expect(el.shadowRoot?.querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
    el.active = false;
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('button')?.getAttribute('aria-pressed')).toBe('false');
    el.remove();
  });

  it('omits aria-pressed for scene chips (momentary action)', async () => {
    const el = await mount({ variant: 'scene', emphasis: 'primary' });
    expect(el.shadowRoot?.querySelector('button')?.hasAttribute('aria-pressed')).toBe(false);
    el.remove();
  });

  it('reflects variant/emphasis/active/touch attributes for CSS variants', async () => {
    const el = await mount({ variant: 'scene', emphasis: 'primary', touch: true });
    expect(el.getAttribute('variant')).toBe('scene');
    expect(el.getAttribute('emphasis')).toBe('primary');
    expect(el.hasAttribute('touch')).toBe(true);
    el.remove();
  });

  it('styles active device chips with the champagne accent and touch size from touch/min', () => {
    const cssText = QlChip.styles.toString();
    expect(cssText).toContain('var(--ql-accent-champagne, #b08d57)');
    expect(cssText).toContain('var(--ql-touch-min, 56px)');
    expect(cssText).toContain('var(--ql-radius-chip, 999px)');
  });
  it('reads an active device chip against the base, not the card surface', () => {
    /* --ql-surface-card is a near-transparent white in dark mode: as a text
       colour it made the active chip label invisible on the champagne fill. */
    const css = QlChip.styles.toString();
    expect(css).toContain("variant='device'][active]");
    expect(css).not.toContain('color: var(--ql-surface-card');
  });
});
