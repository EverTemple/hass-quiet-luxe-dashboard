import { afterEach, describe, expect, it } from 'vitest';
import { angleForValue, DIAL_START_ANGLE, DIAL_SWEEP } from '../cards/climate-dial';
import { DIAL_GEOMETRY, QlRingDial } from './ql-ring-dial';

async function mount(props: Partial<QlRingDial> = {}): Promise<QlRingDial> {
  const el = document.createElement('ql-ring-dial') as QlRingDial;
  Object.assign(el, { min: 17, max: 30, step: 1, value: 23, mode: 'cool', kind: 'single' }, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

function grips(el: QlRingDial): HTMLButtonElement[] {
  return [...(el.shadowRoot?.querySelectorAll<HTMLButtonElement>('.grip') ?? [])];
}

function changes(el: QlRingDial): Array<{ handle: string; value: number; low: number; high: number }> {
  const seen: Array<{ handle: string; value: number; low: number; high: number }> = [];
  el.addEventListener('ql-change', (event) => {
    seen.push((event as CustomEvent).detail);
  });
  return seen;
}

function key(grip: HTMLButtonElement | undefined, init: KeyboardEventInit): void {
  grip?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ql-ring-dial', () => {
  it('registers as a custom element', () => {
    expect(customElements.get('ql-ring-dial')).toBe(QlRingDial);
  });

  it('draws the Figma geometry for both sizes', () => {
    expect(DIAL_GEOMETRY.full).toEqual({ size: 220, stroke: 14, radius: 103, grip: 18, ticks: true });
    expect(DIAL_GEOMETRY.compact).toEqual({ size: 136, stroke: 10, radius: 63, grip: 14, ticks: false });
  });

  it('draws the track over the full 270° sweep', async () => {
    const el = await mount();
    const track = el.shadowRoot?.querySelector('.track');
    expect(track?.getAttribute('stroke-width')).toBe('14');
    // 135° is lower-left of a 220 box: 110 + 103·cos135 = 37.168, and the
    // sweep ends mirrored at 405°, drawn the long way round.
    expect(track?.getAttribute('d')).toBe(
      'M 37.168 182.832 A 103.000 103.000 0 1 1 182.832 182.832',
    );
  });

  it('draws the arc from the band floor to the setpoint', async () => {
    const el = await mount({ value: 23 });
    const arc = el.shadowRoot?.querySelector('.arc');
    expect(arc).not.toBeNull();
    expect(arc?.getAttribute('stroke')).toContain('url(#ql-dial-ramp-220-cool)');
  });

  it('ticks the full dial and leaves the compact one clean', async () => {
    const full = await mount({ size: 'full' });
    expect(full.shadowRoot?.querySelectorAll('.tick').length).toBeGreaterThan(13);
    const compact = await mount({ size: 'compact' });
    expect(compact.shadowRoot?.querySelectorAll('.tick')).toHaveLength(0);
  });

  it('places the grip on the ring at the setpoint’s angle', async () => {
    const el = await mount({ value: 30 });
    // 30 is the top of a 17–30 band, so the grip sits at 405° = lower right.
    const expected = angleForValue({ min: 17, max: 30, step: 1 }, 30);
    expect(expected).toBeCloseTo(DIAL_START_ANGLE + DIAL_SWEEP, 6);
    // 182.832 / 220 = 83.105% on both axes: the lower-right end of the track.
    const style = grips(el)[0]?.getAttribute('style') ?? '';
    expect(style).toContain('left:83.105');
    expect(style).toContain('top:83.105');
  });

  it('exposes the grip as a slider over the entity’s own band', async () => {
    const el = await mount({ min: 1, max: 37, step: 0.5, value: 27 });
    const grip = grips(el)[0];
    expect(grip?.getAttribute('role')).toBe('slider');
    expect(grip?.getAttribute('aria-valuemin')).toBe('1');
    expect(grip?.getAttribute('aria-valuemax')).toBe('37');
    expect(grip?.getAttribute('aria-valuenow')).toBe('27');
  });

  it('moves by the entity’s step on an arrow key', async () => {
    const el = await mount({ value: 23 });
    const seen = changes(el);
    key(grips(el)[0], { key: 'ArrowUp' });
    expect(seen).toEqual([{ handle: 'value', value: 24, low: 21, high: 25 }]);
    key(grips(el)[0], { key: 'ArrowDown' });
    expect(seen[1]?.value).toBe(23);
  });

  it('moves further with shift held', async () => {
    const el = await mount({ value: 23 });
    const seen = changes(el);
    key(grips(el)[0], { key: 'ArrowUp', shiftKey: true });
    expect(seen[0]?.value).toBe(28);
  });

  it('never steps outside the entity’s band', async () => {
    const el = await mount({ value: 30 });
    const seen = changes(el);
    key(grips(el)[0], { key: 'ArrowUp' });
    expect(seen).toEqual([]);
  });

  it('ignores keys the dial does not own', async () => {
    const el = await mount({ value: 23 });
    const seen = changes(el);
    key(grips(el)[0], { key: 'Enter' });
    key(grips(el)[0], { key: 'a' });
    expect(seen).toEqual([]);
  });

  it('is inert when the entity is not answering', async () => {
    const el = await mount({ value: 23, disabled: true });
    const seen = changes(el);
    key(grips(el)[0], { key: 'ArrowUp' });
    expect(seen).toEqual([]);
  });

  it('draws two grips and two readings in heat_cool', async () => {
    const el = await mount({ kind: 'range', mode: 'heat_cool', low: 21, high: 25 });
    expect(grips(el)).toHaveLength(2);
    expect(grips(el)[0]?.dataset.handle).toBe('low');
    expect(grips(el)[1]?.dataset.handle).toBe('high');
    expect(el.shadowRoot?.querySelector('.numeral')?.classList.contains('pair')).toBe(true);
    expect(el.shadowRoot?.textContent).toContain('21');
    expect(el.shadowRoot?.textContent).toContain('25');
  });

  it('never lets the heat end cross the cool one', async () => {
    const el = await mount({ kind: 'range', mode: 'heat_cool', low: 23, high: 25 });
    const seen = changes(el);
    key(grips(el)[0], { key: 'ArrowUp' });
    expect(seen[0]).toMatchObject({ low: 24, high: 25 });
    // One more would put the two ends on the same degree; the band holds open.
    key(grips(el)[0], { key: 'ArrowUp' });
    expect(seen).toHaveLength(1);
    expect(el.low).toBe(24);
  });

  it('never lets the cool end cross the heat one', async () => {
    const el = await mount({ kind: 'range', mode: 'heat_cool', low: 23, high: 24 });
    const seen = changes(el);
    key(grips(el)[1], { key: 'ArrowDown' });
    expect(seen).toHaveLength(0);
    expect(el.high).toBe(24);
  });

  it('shows the room’s own reading as the hero when the device is off', async () => {
    const el = await mount({ mode: 'off', heroText: '22.6°', ambientText: 'Set to 23°' });
    expect(grips(el)).toHaveLength(0);
    expect(el.shadowRoot?.querySelector('.arc')).toBeNull();
    expect(el.shadowRoot?.querySelector('.numeral')?.textContent?.trim()).toBe('22.6°');
    expect(el.shadowRoot?.querySelector('.caption')?.textContent?.trim()).toBe('Set to 23°');
  });

  it('draws no grip for a device with no setpoint', async () => {
    const el = await mount({ kind: 'none', mode: 'cool' });
    expect(grips(el)).toHaveLength(0);
  });

  it('reads a whole-step device without a decimal and a half-step one with', async () => {
    const whole = await mount({ step: 1, value: 23 });
    expect(whole.shadowRoot?.querySelector('.numeral')?.textContent?.trim()).toBe('23°');
    const half = await mount({ min: 1, max: 37, step: 0.5, value: 27 });
    expect(half.shadowRoot?.querySelector('.numeral')?.textContent?.trim()).toBe('27.0°');
  });

  it('paints the grip opaquely, never with the bare card tint', () => {
    const styles = QlRingDial.styles.toString();
    // --ql-surface-card is 5.5% white in dark mode; alone it would let the arc
    // read straight through the bead.
    expect(styles).toMatch(/linear-gradient\(var\(--ql-surface-card[^)]*\)[^;]*var\(--ql-bg-base/);
  });

  it('is built from design tokens with light-mode fallbacks', () => {
    const styles = QlRingDial.styles.toString();
    expect(styles).toContain('var(--ql-touch-min, 56px)');
    expect(styles).toContain('var(--ql-accent-champagne, #b08d57)');
    expect(styles).toContain('var(--ql-status-good, #7e8b6f)');
    expect(styles).toContain('prefers-reduced-motion');
  });
});

describe('ql-ring-dial compact', () => {
  it('carries the mode and the reading only', async () => {
    const el = await mount({ size: 'compact', ambientText: 'Now 22.1°', modeLabel: 'Cooling' });
    expect(el.shadowRoot?.querySelector('.eyebrow')?.textContent?.trim()).toBe('Cooling');
    expect(el.shadowRoot?.querySelector('.numeral')?.textContent?.trim()).toBe('23°');
    expect(el.shadowRoot?.querySelector('.caption')).toBeNull();
    expect(el.shadowRoot?.querySelectorAll('.tick')).toHaveLength(0);
  });

  it('still shows the caption at full size', async () => {
    const el = await mount({ size: 'full', ambientText: 'Now 22.1°' });
    expect(el.shadowRoot?.querySelector('.caption')?.textContent?.trim()).toBe('Now 22.1°');
  });

  it('drops the caption when the device reports no ambient reading', async () => {
    const el = await mount({ size: 'full', ambientText: '' });
    expect(el.shadowRoot?.querySelector('.caption')).toBeNull();
  });
});
