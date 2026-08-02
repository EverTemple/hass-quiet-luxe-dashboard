import { describe, expect, it } from 'vitest';
import { metaParts, QlHeaderHome } from './ql-header-home';

async function mount(props: Partial<QlHeaderHome>): Promise<QlHeaderHome> {
  const el = document.createElement('ql-header-home') as QlHeaderHome;
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe('ql-header-home', () => {
  it('mobile variant renders a localized time-of-day greeting with the user name', async () => {
    const el = await mount({
      variant: 'mobile',
      homeName: 'Subang Jaya',
      userName: 'Steven',
      hour: 9,
    });
    expect(el.shadowRoot?.querySelector('h1')?.textContent?.trim()).toBe('Good morning, Steven');
    el.remove();
  });

  it('greeting follows hour boundaries: <12 morning, <18 afternoon, else evening', async () => {
    const el = await mount({ variant: 'mobile', userName: 'Mei', hour: 11 });
    expect(el.shadowRoot?.querySelector('h1')?.textContent?.trim()).toBe('Good morning, Mei');
    el.hour = 12;
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('h1')?.textContent?.trim()).toBe('Good afternoon, Mei');
    el.hour = 18;
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('h1')?.textContent?.trim()).toBe('Good evening, Mei');
    el.remove();
  });

  it('greeting is localized via t()', async () => {
    const el = await mount({ variant: 'mobile', userName: 'Steven', hour: 9, locale: 'zh-Hant' });
    expect(el.shadowRoot?.querySelector('h1')?.textContent?.trim()).toBe('早安, Steven');
    el.remove();
  });

  it('ipad and desktop variants NEVER greet a person, even with userName set', async () => {
    for (const variant of ['ipad', 'desktop'] as const) {
      const el = await mount({
        variant,
        homeName: 'Tung Chung',
        userName: 'Steven',
        hour: 9,
        presence: 'Steven & Mei home',
      });
      const text = el.shadowRoot?.textContent ?? '';
      expect(el.shadowRoot?.querySelector('h1')?.textContent?.trim()).toBe('Tung Chung');
      expect(text).not.toContain('Good morning');
      expect(text).not.toContain('Steven,');
      el.remove();
    }
  });

  it('renders meta and champagne presence, and a chip slot on ipad/desktop', async () => {
    const el = await mount({
      variant: 'ipad',
      homeName: 'Xiamen',
      meta: 'Fri 1 Aug · 29° · AQI 42',
      presence: 'Steven home',
    });
    expect(el.shadowRoot?.querySelector('.meta')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Fri 1 Aug · 29° · AQI 42',
    );
    expect(el.shadowRoot?.querySelector('.presence')?.textContent).toBe('Steven home');
    expect(el.shadowRoot?.querySelector("slot[name='chip']")).not.toBeNull();
    el.remove();
  });

  it('uses the display font for the headline', () => {
    expect(QlHeaderHome.styles.toString()).toContain('var(--ql-font-display, Marcellus, serif)');
  });

  /* "26° · AQI 0.5" broke as "26° · AQI" / "0.5" once the header ran out of
     width; each value is now its own unbreakable atom. */
  it('splits the meta line into unbreakable values', async () => {
    const el = await mount({ variant: 'ipad', homeName: 'Tung Chung', meta: '26° · AQI 0.5' });
    const atoms = [...(el.shadowRoot?.querySelectorAll('.meta .atom') ?? [])].map(
      (node) => node.textContent,
    );
    expect(atoms).toEqual(['26°', 'AQI 0.5']);
    expect(metaParts('')).toEqual([]);
  });

  it('keeps the home name on one line in the row variant', async () => {
    const el = await mount({ variant: 'ipad', homeName: 'Tung Chung', meta: '26°' });
    const css = QlHeaderHome.styles.toString();
    expect(css).toContain('header.row .display');
    expect(css).toContain('white-space: nowrap');
    expect(el.shadowRoot?.querySelector('header.row')).not.toBeNull();
  });
});
