import { afterEach, describe, expect, it } from 'vitest';
import { QlSweepDial } from './ql-sweep-dial';
import { QlTimerDial } from './ql-timer-dial';

afterEach(() => {
  document.body.innerHTML = '';
});

async function mountSweep(angle = { low: 135, high: 225, span: 90 }): Promise<QlSweepDial> {
  const el = document.createElement('ql-sweep-dial') as QlSweepDial;
  el.angle = angle;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

function handles(el: QlSweepDial): HTMLButtonElement[] {
  return [...(el.shadowRoot?.querySelectorAll<HTMLButtonElement>('.handle') ?? [])];
}

function press(button: HTMLButtonElement, key: string, shiftKey = false): void {
  button.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }));
}

describe('ql-sweep-dial', () => {
  it('is registered', () => {
    expect(customElements.get('ql-sweep-dial')).toBe(QlSweepDial);
  });

  it('renders two independent handles as sliders', async () => {
    const el = await mountSweep();
    const [low, high] = handles(el);
    expect(handles(el)).toHaveLength(2);
    expect(low?.getAttribute('role')).toBe('slider');
    expect(high?.getAttribute('role')).toBe('slider');
    expect(low?.dataset.handle).toBe('low');
    expect(high?.dataset.handle).toBe('high');
  });

  it('publishes each handle’s position against the hardware range', async () => {
    const el = await mountSweep();
    const [low, high] = handles(el);
    expect(low?.getAttribute('aria-valuemin')).toBe('5');
    expect(low?.getAttribute('aria-valuemax')).toBe('355');
    expect(low?.getAttribute('aria-valuenow')).toBe('135');
    expect(high?.getAttribute('aria-valuenow')).toBe('225');
  });

  /** Users read the sweep relative to the front of the fan, not as a bearing. */
  it('announces each handle as degrees either side of the front', async () => {
    const el = await mountSweep();
    const [low, high] = handles(el);
    expect(low?.getAttribute('aria-valuetext')).toBe('-45°');
    expect(high?.getAttribute('aria-valuetext')).toBe('+45°');
  });

  it('places the handles on the track: front is straight up', async () => {
    const el = await mountSweep({ low: 180, high: 185, span: 5 });
    const low = handles(el)[0];
    // 180 is the device front -> centre x (186/372) and top of the track.
    expect(low?.style.left).toBe('50%');
    expect(low?.style.top).toBe(`${((162 - 120) / 284) * 100}%`);
  });

  it('arrow keys move a handle by five degrees', async () => {
    const el = await mountSweep();
    const changes: Array<{ low: number; high: number }> = [];
    el.addEventListener('ql-change', (e) =>
      changes.push((e as CustomEvent<{ angle: { low: number; high: number } }>).detail.angle),
    );
    const low = handles(el)[0];
    if (low === undefined) throw new Error('no handle');
    press(low, 'ArrowLeft');
    await el.updateComplete;
    expect(el.angle).toEqual({ low: 130, high: 225, span: 95 });
    expect(changes).toEqual([{ low: 130, high: 225, span: 95 }]);
  });

  it('shift refines the arrow step to one degree', async () => {
    const el = await mountSweep();
    const high = handles(el)[1];
    if (high === undefined) throw new Error('no handle');
    press(high, 'ArrowRight', true);
    await el.updateComplete;
    expect(el.angle).toEqual({ low: 135, high: 226, span: 91 });
  });

  it('moves each handle independently of the other', async () => {
    const el = await mountSweep();
    const [low, high] = handles(el);
    if (low === undefined || high === undefined) throw new Error('no handles');
    press(low, 'ArrowLeft');
    await el.updateComplete;
    press(high, 'ArrowRight');
    await el.updateComplete;
    expect(el.angle).toEqual({ low: 130, high: 230, span: 100 });
  });

  it('stops at the hardware limits instead of wrapping around', async () => {
    const el = await mountSweep({ low: 5, high: 355, span: 350 });
    const [low, high] = handles(el);
    if (low === undefined || high === undefined) throw new Error('no handles');
    press(low, 'ArrowLeft');
    press(high, 'ArrowRight');
    await el.updateComplete;
    expect(el.angle).toEqual({ low: 5, high: 355, span: 350 });
  });

  it('emits nothing when a nudge is already at its limit', async () => {
    const el = await mountSweep({ low: 5, high: 355, span: 350 });
    const events: unknown[] = [];
    el.addEventListener('ql-change', (e) => events.push(e));
    const low = handles(el)[0];
    if (low === undefined) throw new Error('no handle');
    press(low, 'ArrowLeft');
    expect(events).toEqual([]);
  });

  it('ignores keys that are not arrows', async () => {
    const el = await mountSweep();
    const low = handles(el)[0];
    if (low === undefined) throw new Error('no handle');
    press(low, 'Enter');
    await el.updateComplete;
    expect(el.angle).toEqual({ low: 135, high: 225, span: 90 });
  });

  it('draws the wedge, the band and the track from tokens', () => {
    const cssText = QlSweepDial.styles.toString();
    expect(cssText).toContain('var(--ql-accent-champagne, #b08d57)');
    expect(cssText).toContain('var(--ql-touch-min, 56px)');
    expect(cssText).toContain('touch-action: none');
  });

  it('renders the swept sector as three nested wedges plus a band', async () => {
    const el = await mountSweep();
    expect(el.shadowRoot?.querySelectorAll('.wedge')).toHaveLength(3);
    expect(el.shadowRoot?.querySelector('.band')?.getAttribute('d')).toContain('A 118 118');
  });

  it('uses the large-arc flag once the sweep passes a half turn', async () => {
    const narrow = await mountSweep({ low: 135, high: 225, span: 90 });
    expect(narrow.shadowRoot?.querySelector('.band')?.getAttribute('d')).toContain(' 0 1 ');
    const wide = await mountSweep({ low: 5, high: 355, span: 350 });
    expect(wide.shadowRoot?.querySelector('.band')?.getAttribute('d')).toContain(' 1 1 ');
  });
});

describe('ql-timer-dial', () => {
  async function mountTimer(minutes = 120): Promise<QlTimerDial> {
    const el = document.createElement('ql-timer-dial') as QlTimerDial;
    el.minutes = minutes;
    el.max = 480;
    el.step = 15;
    document.body.append(el);
    await el.updateComplete;
    return el;
  }

  function grip(el: QlTimerDial): HTMLButtonElement {
    const found = el.shadowRoot?.querySelector<HTMLButtonElement>('.grip');
    if (found === null || found === undefined) throw new Error('no grip');
    return found;
  }

  it('is registered', () => {
    expect(customElements.get('ql-timer-dial')).toBe(QlTimerDial);
  });

  it('exposes one grip as a slider over the full duration range', async () => {
    const el = await mountTimer();
    expect(grip(el).getAttribute('role')).toBe('slider');
    expect(grip(el).getAttribute('aria-valuemin')).toBe('0');
    expect(grip(el).getAttribute('aria-valuemax')).toBe('480');
    expect(grip(el).getAttribute('aria-valuenow')).toBe('120');
  });

  it('arrow keys step by the configured increment', async () => {
    const el = await mountTimer();
    const changes: number[] = [];
    el.addEventListener('ql-change', (e) =>
      changes.push((e as CustomEvent<{ minutes: number }>).detail.minutes),
    );
    grip(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(el.minutes).toBe(135);
    expect(changes).toEqual([135]);
  });

  it('clamps at zero and at the maximum', async () => {
    const low = await mountTimer(0);
    low.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    grip(low).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await low.updateComplete;
    expect(low.minutes).toBe(0);

    const high = await mountTimer(480);
    grip(high).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await high.updateComplete;
    expect(high.minutes).toBe(480);
  });

  it('draws no progress arc for a cleared timer', async () => {
    const el = await mountTimer(0);
    expect(el.shadowRoot?.querySelector('.progress')).toBeNull();
  });

  it('sweeps the ring clockwise from twelve o’clock', async () => {
    const el = await mountTimer(120);
    // 120 of 480 is a quarter turn: the arc ends at the right of the ring.
    expect(el.shadowRoot?.querySelector('.progress')?.getAttribute('d')).toContain('A 100 100');
    expect(grip(el).style.left).toBe(`${((186 + 100) / 372) * 100}%`);
  });

  it('shows the reading and caption inside the ring', async () => {
    const el = await mountTimer();
    el.reading = '2';
    el.caption = 'hours';
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.reading')?.textContent?.trim()).toBe('2');
    expect(el.shadowRoot?.querySelector('.caption')?.textContent?.trim()).toBe('hours');
  });
});
