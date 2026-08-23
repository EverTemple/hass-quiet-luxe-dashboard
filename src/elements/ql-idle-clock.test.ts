import { describe, expect, it } from 'vitest';
import { DARK_COLORS } from '../tokens/palette';
import { QlIdleClock } from './ql-idle-clock';

async function mount(props: Partial<QlIdleClock> = {}): Promise<QlIdleClock> {
  const el = document.createElement('ql-idle-clock') as QlIdleClock;
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe('ql-idle-clock', () => {
  it('is registered and renders time, date and weather lines', async () => {
    expect(customElements.get('ql-idle-clock')).toBe(QlIdleClock);
    const el = await mount({
      time: '21:42',
      date: 'Friday, 1 August',
      weather: '29° · Rain 80% · AQI 42',
    });
    expect(el.shadowRoot?.querySelector('.time')?.textContent).toBe('21:42');
    expect(el.shadowRoot?.querySelector('.date')?.textContent).toBe('Friday, 1 August');
    expect(el.shadowRoot?.querySelector('.weather')?.textContent).toBe('29° · Rain 80% · AQI 42');
    el.remove();
  });

  it('omits the weather line when empty', async () => {
    const el = await mount({ time: '21:42', date: 'Friday' });
    expect(el.shadowRoot?.querySelector('.weather')).toBeNull();
    el.remove();
  });

  it('is dark-pinned by design (fixed night palette, no theme vars)', () => {
    const cssText = QlIdleClock.styles.toString();
    expect(cssText).toContain('#262019');
    expect(cssText).toContain('#100d0a');
    expect(cssText).not.toContain('var(--ql-bg-base');
    expect(cssText).not.toContain('var(--ql-ink-primary');
    expect(cssText).not.toContain('var(--ql-ink-muted');
  });

  /** The ink colors are drawn from the palette module, not a second
   * hard-coded copy, so a future palette change can't desync from this face. */
  it('sources its fixed ink colors from DARK_COLORS', () => {
    const cssText = QlIdleClock.styles.toString();
    expect(cssText).toContain(DARK_COLORS.inkPrimary);
    expect(cssText).toContain(DARK_COLORS.inkMuted);
  });
});
