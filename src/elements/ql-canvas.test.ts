import { describe, expect, it } from 'vitest';
import { QlCanvas } from './ql-canvas';

describe('ql-canvas', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('ql-canvas')).toBe(QlCanvas);
  });

  it('renders base, glow, and vignette layers in order', async () => {
    const el = document.createElement('ql-canvas') as QlCanvas;
    document.body.append(el);
    await el.updateComplete;
    const layers = [...(el.shadowRoot?.querySelectorAll('div') ?? [])].map((d) => d.className);
    expect(layers).toEqual(['base', 'glow', 'vignette']);
    el.remove();
  });

  it('binds every layer to --ql-bg-* variables with locked fallbacks', () => {
    const cssText = QlCanvas.styles.toString();
    expect(cssText).toContain('var(--ql-bg-base, #f4f0e8)');
    expect(cssText).toContain('var(--ql-bg-glow-center, #fffdf4)');
    expect(cssText).toContain('var(--ql-bg-vignette, rgba(26, 18, 9, 0.08))');
    expect(cssText).toContain('at 50% 15%');
    expect(cssText).toContain('130%');
  });
});
