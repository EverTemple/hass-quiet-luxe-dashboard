import { describe, expect, it } from 'vitest';
import { QlStatusDot } from './ql-status-dot';

describe('ql-status-dot', () => {
  it('is registered and defaults to neutral', () => {
    expect(customElements.get('ql-status-dot')).toBe(QlStatusDot);
    const el = document.createElement('ql-status-dot') as QlStatusDot;
    expect(el.status).toBe('neutral');
  });

  it('reflects status to an attribute for CSS variant selection', async () => {
    const el = document.createElement('ql-status-dot') as QlStatusDot;
    document.body.append(el);
    el.status = 'warn';
    await el.updateComplete;
    expect(el.getAttribute('status')).toBe('warn');
    el.remove();
  });

  it('binds each status to its --ql-status-* variable', () => {
    const cssText = QlStatusDot.styles.toString();
    expect(cssText).toContain("var(--ql-status-good, #7e8b6f)");
    expect(cssText).toContain("var(--ql-status-warn, #c08552)");
    expect(cssText).toContain("var(--ql-status-alert, #a85b4e)");
    expect(cssText).toContain("var(--ql-ink-muted, #8c8578)");
  });
});
