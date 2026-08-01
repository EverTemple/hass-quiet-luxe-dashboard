import { describe, expect, it } from 'vitest';
import { QlHeaderRoom } from './ql-header-room';

async function mount(props: Partial<QlHeaderRoom>): Promise<QlHeaderRoom> {
  const el = document.createElement('ql-header-room') as QlHeaderRoom;
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe('ql-header-room', () => {
  it('renders the room name in the display font and dot-joined micro-stats', async () => {
    const el = await mount({ name: 'Living Room', stats: ['24.5°', '62%', 'AQI 18'] });
    expect(el.shadowRoot?.querySelector('h1')?.textContent).toBe('Living Room');
    expect(el.shadowRoot?.querySelector('.stats')?.textContent).toBe('24.5° · 62% · AQI 18');
    expect(QlHeaderRoom.styles.toString()).toContain('var(--ql-font-display, Marcellus, serif)');
    el.remove();
  });

  it('omits the stats line when there are no stats', async () => {
    const el = await mount({ name: 'Storage' });
    expect(el.shadowRoot?.querySelector('.stats')).toBeNull();
    el.remove();
  });

  it('back button has a localized aria-label and emits ql-back', async () => {
    const el = await mount({ name: 'Living Room', locale: 'zh-Hant' });
    const back = el.shadowRoot?.querySelector<HTMLButtonElement>('.back');
    expect(back?.getAttribute('aria-label')).toBe('返回');
    let fired = 0;
    el.addEventListener('ql-back', () => {
      fired += 1;
    });
    back?.click();
    expect(fired).toBe(1);
    el.remove();
  });
});
