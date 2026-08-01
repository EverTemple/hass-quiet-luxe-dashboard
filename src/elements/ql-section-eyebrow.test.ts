import { describe, expect, it } from 'vitest';
import { QlSectionEyebrow } from './ql-section-eyebrow';

describe('ql-section-eyebrow', () => {
  it('renders the label text and a link slot', async () => {
    const el = document.createElement('ql-section-eyebrow') as QlSectionEyebrow;
    el.label = 'Rooms';
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.label')?.textContent).toBe('Rooms');
    expect(el.shadowRoot?.querySelector("slot[name='link']")).not.toBeNull();
    el.remove();
  });

  it('uppercases with 0.14em tracking and colors the link slot champagne', () => {
    const cssText = QlSectionEyebrow.styles.toString();
    expect(cssText).toContain('text-transform: uppercase');
    expect(cssText).toContain('letter-spacing: 0.14em');
    expect(cssText).toContain('var(--ql-ink-muted, #8c8578)');
    expect(cssText).toContain('var(--ql-accent-champagne, #b08d57)');
  });
});
