import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  QUICK_ADJUST_REPEAT_DELAY_MS,
  QUICK_ADJUST_REPEAT_INTERVAL_MS,
} from '../cards/quick-adjust';
import { QlQuickAdjust } from './ql-quick-adjust';

async function mount(props: Partial<QlQuickAdjust> = {}): Promise<QlQuickAdjust> {
  const el = document.createElement('ql-quick-adjust') as QlQuickAdjust;
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

function button(el: QlQuickAdjust): HTMLButtonElement {
  const found = el.shadowRoot?.querySelector('button');
  if (found === null || found === undefined) {
    throw new Error('quick-adjust rendered no button');
  }
  return found;
}

function directions(el: QlQuickAdjust): number[] {
  const seen: number[] = [];
  el.addEventListener('ql-adjust', (event) => {
    seen.push((event as CustomEvent<{ direction: number }>).detail.direction);
  });
  return seen;
}

function press(el: QlQuickAdjust): void {
  button(el).dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
}

function release(el: QlQuickAdjust): void {
  button(el).dispatchEvent(new Event('pointerup', { bubbles: true }));
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('ql-quick-adjust', () => {
  it('registers as a custom element', () => {
    expect(customElements.get('ql-quick-adjust')).toBe(QlQuickAdjust);
  });

  it('draws one bar for minus and two for plus', async () => {
    const minus = await mount({ dir: 'minus' });
    expect(minus.shadowRoot?.querySelectorAll('.bar')).toHaveLength(1);
    const plus = await mount({ dir: 'plus' });
    expect(plus.shadowRoot?.querySelectorAll('.bar')).toHaveLength(2);
  });

  it('carries the 56px touch minimum on the hit frame', async () => {
    const el = await mount();
    const styles = QlQuickAdjust.styles.toString();
    expect(styles).toContain('var(--ql-touch-min, 56px)');
    expect(button(el).disabled).toBe(false);
  });

  it('carries full ink/primary weight, not ink/muted — the dial’s primary action, not a shortcut', () => {
    const styles = QlQuickAdjust.styles.toString();
    const barBlock = /\.bar\s*\{[^}]*\}/.exec(styles)?.[0] ?? '';
    expect(barBlock).toContain('var(--ql-ink-primary, #2b2620)');
    expect(barBlock).not.toContain('var(--ql-ink-muted');
  });

  it('has no chrome at rest — the halo appears only while pressed', async () => {
    const el = await mount();
    expect(el.shadowRoot?.querySelector('.halo')).toBeNull();
    press(el);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.halo')).not.toBeNull();
    release(el);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.halo')).toBeNull();
  });

  it('emits the direction it was given', async () => {
    const el = await mount({ dir: 'plus' });
    const seen = directions(el);
    press(el);
    release(el);
    expect(seen).toEqual([1]);
  });

  it('emits minus for the minus glyph', async () => {
    const el = await mount({ dir: 'minus' });
    const seen = directions(el);
    press(el);
    release(el);
    expect(seen).toEqual([-1]);
  });

  it('repeats while held, after a deliberate pause', async () => {
    vi.useFakeTimers();
    const el = await mount({ dir: 'plus' });
    const seen = directions(el);
    press(el);
    expect(seen).toHaveLength(1);
    vi.advanceTimersByTime(QUICK_ADJUST_REPEAT_DELAY_MS - 1);
    expect(seen).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(seen).toHaveLength(2);
    vi.advanceTimersByTime(QUICK_ADJUST_REPEAT_INTERVAL_MS * 3);
    expect(seen).toHaveLength(5);
  });

  it('stops repeating the moment the press is released', async () => {
    vi.useFakeTimers();
    const el = await mount();
    const seen = directions(el);
    press(el);
    vi.advanceTimersByTime(QUICK_ADJUST_REPEAT_DELAY_MS);
    release(el);
    vi.advanceTimersByTime(QUICK_ADJUST_REPEAT_INTERVAL_MS * 10);
    expect(seen).toHaveLength(2);
  });

  it('stops repeating when the pointer leaves the glyph', async () => {
    vi.useFakeTimers();
    const el = await mount();
    const seen = directions(el);
    press(el);
    vi.advanceTimersByTime(QUICK_ADJUST_REPEAT_DELAY_MS);
    button(el).dispatchEvent(new Event('pointerleave', { bubbles: true }));
    vi.advanceTimersByTime(QUICK_ADJUST_REPEAT_INTERVAL_MS * 10);
    expect(seen).toHaveLength(2);
  });

  it('stops repeating when the setpoint reaches its limit mid-hold', async () => {
    vi.useFakeTimers();
    const el = await mount();
    const seen = directions(el);
    press(el);
    el.disabled = true;
    vi.advanceTimersByTime(QUICK_ADJUST_REPEAT_DELAY_MS * 5);
    expect(seen).toHaveLength(1);
  });

  it('emits nothing at all when disabled', async () => {
    const el = await mount({ disabled: true });
    const seen = directions(el);
    press(el);
    release(el);
    expect(seen).toEqual([]);
    expect(button(el).disabled).toBe(true);
  });

  it('emits once for a keyboard activation', async () => {
    const el = await mount({ dir: 'plus' });
    const seen = directions(el);
    button(el).dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(seen).toEqual([1]);
  });

  it('does not double-count the click that follows a pointer press', async () => {
    const el = await mount();
    const seen = directions(el);
    press(el);
    release(el);
    button(el).dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(seen).toHaveLength(1);
  });

  it('names itself for assistive technology', async () => {
    const el = await mount({ label: 'Increase' });
    expect(button(el).getAttribute('aria-label')).toBe('Increase');
  });

  it('stops its repeat timer when it leaves the document', async () => {
    vi.useFakeTimers();
    const el = await mount();
    const seen = directions(el);
    press(el);
    el.remove();
    vi.advanceTimersByTime(QUICK_ADJUST_REPEAT_DELAY_MS * 5);
    expect(seen).toHaveLength(1);
  });
});
