import { describe, expect, it } from 'vitest';
import { QlBadge } from './ql-badge';

describe('ql-badge', () => {
  it('is registered and renders slotted content', async () => {
    expect(customElements.get('ql-badge')).toBe(QlBadge);
    const el = document.createElement('ql-badge');
    el.textContent = 'AQI 42';
    document.body.append(el);
    await (el as QlBadge).updateComplete;
    expect(el.shadowRoot?.querySelector('slot')).not.toBeNull();
    expect(el.textContent).toBe('AQI 42');
    el.remove();
  });

  it('styles the pill from --ql-* variables only', () => {
    const cssText = QlBadge.styles.toString();
    expect(cssText).toContain('var(--ql-radius-chip, 999px)');
    expect(cssText).toContain('var(--ql-surface-card, #fdfbf6)');
    expect(cssText).toContain('var(--ql-surface-border, #e4dccb)');
    expect(cssText).toContain('var(--ql-ink-primary, #2b2620)');
  });
});
