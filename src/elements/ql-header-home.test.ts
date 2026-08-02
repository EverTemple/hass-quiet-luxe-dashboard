import { describe, expect, it } from 'vitest';
import { metaParts, QlHeaderHome } from './ql-header-home';

async function mount(props: Partial<QlHeaderHome>): Promise<QlHeaderHome> {
  const el = document.createElement('ql-header-home') as QlHeaderHome;
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const HOUSEHOLD = [
  { name: 'Steven', home: true },
  { name: 'Mei', home: true },
  { name: 'Sam', home: false },
];

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
        people: HOUSEHOLD,
      });
      const text = el.shadowRoot?.textContent ?? '';
      expect(el.shadowRoot?.querySelector('h1')?.textContent?.trim()).toBe('Good morning');
      expect(text).not.toContain('Good morning, Steven');
      el.remove();
    }
  });

  /* v2 leads with presence: avatars, who is home, then the home name as an
     eyebrow — all above the greeting, on every breakpoint. */
  it('puts the presence cluster first, before the greeting', async () => {
    for (const variant of ['mobile', 'ipad', 'desktop'] as const) {
      const el = await mount({ variant, homeName: 'Subang Jaya', people: HOUSEHOLD, hour: 19 });
      const root = el.shadowRoot;
      const cluster = root?.querySelector('.presence-cluster');
      const greeting = root?.querySelector('h1');
      expect(cluster).not.toBeNull();
      expect(greeting).not.toBeNull();
      /* DOCUMENT_POSITION_FOLLOWING: the greeting comes after the cluster. */
      expect(
        (cluster?.compareDocumentPosition(greeting as Node) ?? 0) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(root?.querySelector('.presence')?.textContent).toBe('Steven, Mei home');
      expect(root?.querySelector('.home-name')?.textContent).toBe('Subang Jaya');
      expect(root?.querySelectorAll('.avatar')).toHaveLength(3);
      el.remove();
    }
  });

  it('marks away people apart from the ones at home', async () => {
    const el = await mount({ variant: 'mobile', homeName: 'Home', people: HOUSEHOLD });
    const away = [...(el.shadowRoot?.querySelectorAll('.avatar') ?? [])].map((node) =>
      node.classList.contains('away'),
    );
    expect(away).toEqual([false, false, true]);
    el.remove();
  });

  it('says nobody is home, and drops the cluster when the home has no people', async () => {
    const empty = await mount({ variant: 'mobile', homeName: 'Home', people: [] });
    expect(empty.presenceLabel()).toBe('');
    expect(empty.shadowRoot?.querySelector('.presence')).toBeNull();
    empty.remove();

    const away = await mount({
      variant: 'mobile',
      homeName: 'Home',
      people: [{ name: 'Mei', home: false }],
    });
    expect(away.presenceLabel()).toBe('Nobody home');
    expect(away.shadowRoot?.querySelector('.presence')?.textContent).toBe('Nobody home');
    away.remove();
  });

  it('uses a person’s picture when there is one', async () => {
    const el = await mount({
      variant: 'mobile',
      people: [{ name: 'Steven', home: true, picture: '/api/image/steven.png' }],
    });
    expect(el.shadowRoot?.querySelector<HTMLImageElement>('img.avatar')?.getAttribute('src')).toBe(
      '/api/image/steven.png',
    );
    el.remove();
  });

  it('renders meta and a chip slot on ipad/desktop', async () => {
    const el = await mount({
      variant: 'ipad',
      homeName: 'Xiamen',
      meta: 'Fri 1 Aug · 29° · AQI 42',
      people: HOUSEHOLD,
    });
    expect(el.shadowRoot?.querySelector('.meta')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Fri 1 Aug · 29° · AQI 42',
    );
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

  it('keeps the greeting on one line in the row variant', async () => {
    const el = await mount({ variant: 'ipad', homeName: 'Tung Chung', meta: '26°' });
    const css = QlHeaderHome.styles.toString();
    expect(css).toContain('header.row .display');
    expect(css).toContain('white-space: nowrap');
    expect(el.shadowRoot?.querySelector('header.row')).not.toBeNull();
  });
});
