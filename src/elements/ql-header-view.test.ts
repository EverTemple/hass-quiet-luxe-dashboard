import { describe, expect, it } from 'vitest';
import './ql-header-view';
import type { QlHeaderView } from './ql-header-view';
import type { QlHeaderVariant } from './ql-header-home';

interface HeaderOptions {
  readonly heading?: string;
  readonly subtitle?: string;
  readonly backLabel?: string;
  readonly actionLabel?: string;
  readonly variant?: QlHeaderVariant;
  readonly locale?: 'en' | 'zh-Hant';
}

async function makeHeader(options: HeaderOptions = {}): Promise<QlHeaderView> {
  const element = document.createElement('ql-header-view') as QlHeaderView;
  element.heading = options.heading ?? 'All Climates';
  element.subtitle = options.subtitle ?? '';
  element.backLabel = options.backLabel ?? 'Home';
  element.actionLabel = options.actionLabel ?? '';
  element.variant = options.variant ?? 'mobile';
  element.locale = options.locale ?? 'en';
  document.body.append(element);
  await element.updateComplete;
  return element;
}

const query = (element: QlHeaderView, selector: string): HTMLElement | null =>
  element.shadowRoot?.querySelector(selector) ?? null;

describe('ql-header-view', () => {
  it('leads with a labelled back pill, not a bare glyph', async () => {
    const header = await makeHeader();
    const back = query(header, 'button.back');
    expect(back?.textContent?.trim()).toBe('Home');
    expect(back?.querySelector('svg')).not.toBeNull();
    expect(back?.getAttribute('aria-label')).toBe('Back');
  });

  it('falls back to the localised Home label when none is given', async () => {
    const header = await makeHeader({ backLabel: '', locale: 'zh-Hant' });
    expect(query(header, 'button.back')?.textContent?.trim()).not.toBe('');
  });

  it('emits ql-back so the card owns the navigation', async () => {
    const header = await makeHeader();
    let fired = 0;
    header.addEventListener('ql-back', () => (fired += 1));
    query(header, 'button.back')?.click();
    expect(fired).toBe(1);
  });

  it('renders the title in the display face and the subtitle only when set', async () => {
    const plain = await makeHeader();
    expect(query(plain, 'h1')?.textContent).toBe('All Climates');
    expect(query(plain, '.subtitle')).toBeNull();
    const captioned = await makeHeader({ subtitle: '9 devices · 5 running' });
    expect(query(captioned, '.subtitle')?.textContent).toBe('9 devices · 5 running');
  });

  it('shows the action slot only when it has a label, and emits ql-action', async () => {
    expect(query(await makeHeader(), 'button.action')).toBeNull();
    const header = await makeHeader({ actionLabel: 'All climates' });
    let fired = 0;
    header.addEventListener('ql-action', () => (fired += 1));
    const action = query(header, 'button.action');
    expect(action?.textContent?.trim()).toContain('All climates');
    action?.click();
    expect(fired).toBe(1);
  });

  /*
   * Mobile stacks pill-over-title; iPad and desktop put them in one row. The
   * pill survives on iPad on purpose: nav/pills moves sideways between tabs and
   * has no "you are in a drill-down" state, so it cannot double as the way out.
   */
  it('stacks on mobile and goes inline from iPad up, keeping the back pill', async () => {
    const mobile = await makeHeader({ variant: 'mobile', actionLabel: 'All climates' });
    expect(query(mobile, '.top-row')?.contains(query(mobile, '.titles'))).toBe(false);
    expect(query(mobile, '.top-row')?.contains(query(mobile, 'button.action'))).toBe(true);

    for (const variant of ['ipad', 'desktop'] as const) {
      const wide = await makeHeader({ variant, actionLabel: 'All climates' });
      expect(query(wide, 'button.back')).not.toBeNull();
      expect(query(wide, '.top-row')?.contains(query(wide, '.titles'))).toBe(true);
      expect(wide.getAttribute('variant')).toBe(variant);
    }
  });
});
