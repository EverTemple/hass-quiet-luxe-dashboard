import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  QlStepper,
  STEPPER_COMMIT_MS,
  STEPPER_GLYPH_BOX,
  STEPPER_GLYPH_OFFSET,
  STEPPER_GLYPH_THICKNESS,
} from './ql-stepper';

interface StepperProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  label?: string;
  disabled?: boolean;
}

async function mount(props: StepperProps = {}): Promise<QlStepper> {
  const el = document.createElement('ql-stepper') as QlStepper;
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

/** The stepper renders exactly two buttons: decrease, then increase. */
function minus(el: QlStepper): HTMLButtonElement | null {
  return el.shadowRoot?.querySelectorAll('button')[0] ?? null;
}

function plus(el: QlStepper): HTMLButtonElement | null {
  return el.shadowRoot?.querySelectorAll('button')[1] ?? null;
}

function readout(el: QlStepper): string {
  return el.shadowRoot?.querySelector('.readout')?.textContent?.trim() ?? '';
}

function changes(el: QlStepper): number[] {
  const seen: number[] = [];
  el.addEventListener('ql-change', (event) => {
    seen.push((event as CustomEvent<{ value: number }>).detail.value);
  });
  return seen;
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('ql-stepper', () => {
  it('registers as a custom element', () => {
    expect(customElements.get('ql-stepper')).toBe(QlStepper);
  });

  it('shows the device value with its unit', async () => {
    const el = await mount({ value: 23, unit: '°' });
    expect(readout(el)).toBe('23°');
  });

  it('shows a fractional setpoint to one decimal', async () => {
    const el = await mount({ value: 21.5, step: 0.5, unit: '°' });
    expect(readout(el)).toBe('21.5°');
  });

  it('updates the numeral immediately on press, before any commit', async () => {
    vi.useFakeTimers();
    const el = await mount({ value: 23, min: 17, max: 30, step: 1, unit: '°' });
    const seen = changes(el);

    plus(el)?.click();
    await el.updateComplete;

    expect(readout(el)).toBe('24°');
    expect(seen).toEqual([]);
  });

  it('marks the numeral pending until the device confirms', async () => {
    vi.useFakeTimers();
    const el = await mount({ value: 23, min: 17, max: 30, step: 1 });

    plus(el)?.click();
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.readout')?.classList.contains('pending')).toBe(true);

    vi.advanceTimersByTime(STEPPER_COMMIT_MS);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.readout')?.classList.contains('pending')).toBe(false);
  });

  it('collapses a burst of presses into a single change', async () => {
    vi.useFakeTimers();
    const el = await mount({ value: 23, min: 17, max: 30, step: 1 });
    const seen = changes(el);

    plus(el)?.click();
    plus(el)?.click();
    plus(el)?.click();
    vi.advanceTimersByTime(STEPPER_COMMIT_MS);

    expect(seen).toEqual([26]);
  });

  it('emits again for a second burst after the first settled', async () => {
    vi.useFakeTimers();
    const el = await mount({ value: 23, min: 17, max: 30, step: 1 });
    const seen = changes(el);

    plus(el)?.click();
    vi.advanceTimersByTime(STEPPER_COMMIT_MS);
    el.value = 24;
    await el.updateComplete;
    minus(el)?.click();
    vi.advanceTimersByTime(STEPPER_COMMIT_MS);

    expect(seen).toEqual([24, 23]);
  });

  it('steps down by the entity’s own step', async () => {
    vi.useFakeTimers();
    const el = await mount({ value: 60, min: 40, max: 70, step: 1 });
    const seen = changes(el);

    minus(el)?.click();
    vi.advanceTimersByTime(STEPPER_COMMIT_MS);

    expect(seen).toEqual([59]);
  });

  it('uses a fractional step without float noise', async () => {
    vi.useFakeTimers();
    const el = await mount({ value: 27, min: 1, max: 37, step: 0.5 });
    const seen = changes(el);

    plus(el)?.click();
    vi.advanceTimersByTime(STEPPER_COMMIT_MS);

    expect(seen).toEqual([27.5]);
  });

  it('disables the end a value has already reached', async () => {
    const atMax = await mount({ value: 70, min: 40, max: 70, step: 1 });
    expect(plus(atMax)?.disabled).toBe(true);
    expect(minus(atMax)?.disabled).toBe(false);

    const atMin = await mount({ value: 40, min: 40, max: 70, step: 1 });
    expect(minus(atMin)?.disabled).toBe(true);
  });

  it('never emits past the entity’s bounds', async () => {
    vi.useFakeTimers();
    const el = await mount({ value: 29, min: 17, max: 30, step: 1 });
    const seen = changes(el);

    plus(el)?.click();
    plus(el)?.click();
    plus(el)?.click();
    vi.advanceTimersByTime(STEPPER_COMMIT_MS);

    expect(seen).toEqual([30]);
  });

  it('is inert when disabled', async () => {
    vi.useFakeTimers();
    const el = await mount({ value: 23, min: 17, max: 30, step: 1, disabled: true });
    const seen = changes(el);

    for (const button of [minus(el), plus(el)]) {
      expect(button?.disabled).toBe(true);
      button?.click();
    }
    vi.advanceTimersByTime(STEPPER_COMMIT_MS);

    expect(seen).toEqual([]);
    expect(readout(el)).toBe('23');
  });

  it('drops an uncommitted press when it leaves the DOM', async () => {
    vi.useFakeTimers();
    const el = await mount({ value: 23, min: 17, max: 30, step: 1 });
    const seen = changes(el);

    plus(el)?.click();
    el.remove();
    vi.advanceTimersByTime(STEPPER_COMMIT_MS);

    expect(seen).toEqual([]);
  });

  it('exposes group and button labels to assistive tech', async () => {
    const el = await mount({ value: 23, label: 'Target', min: 17, max: 30 });
    Object.assign(el, { decreaseLabel: 'Cooler', increaseLabel: 'Warmer' });
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector('.stepper')?.getAttribute('aria-label')).toBe('Target');
    expect(minus(el)?.getAttribute('aria-label')).toBe('Cooler');
    expect(plus(el)?.getAttribute('aria-label')).toBe('Warmer');
    expect(el.shadowRoot?.querySelector('.readout')?.getAttribute('role')).toBe('status');
  });

  it('is built from design tokens with light-mode fallbacks', () => {
    const styles = QlStepper.styles.toString();
    expect(styles).toContain('var(--ql-touch-min, 56px)');
    expect(styles).toContain('var(--ql-accent-champagne, #b08d57)');
    expect(styles).toContain('prefers-reduced-motion');
  });
});

/**
 * The reported defect was misalignment: typed "−"/"+" are placed by the font's
 * metrics, so they came out at different sizes and both painted below the
 * button's centre. These assert the geometry that makes that impossible.
 */
describe('ql-stepper glyphs', () => {
  function bars(button: HTMLButtonElement | null): SVGRectElement[] {
    return [...(button?.querySelectorAll('rect') ?? [])];
  }

  it('draws both marks as vectors, never as text', async () => {
    const el = await mount({ value: 23, min: 17, max: 30 });
    for (const button of [minus(el), plus(el)]) {
      expect(button?.querySelector('svg')).not.toBeNull();
      expect(button?.textContent?.trim()).toBe('');
    }
  });

  it('draws minus as one bar and plus as that bar plus its mirror', async () => {
    const el = await mount({ value: 23, min: 17, max: 30 });
    expect(bars(minus(el))).toHaveLength(1);
    expect(bars(plus(el))).toHaveLength(2);
  });

  it('centres every bar in the 20x20 box', async () => {
    const el = await mount({ value: 23, min: 17, max: 30 });
    const box = STEPPER_GLYPH_BOX;
    for (const rect of [...bars(minus(el)), ...bars(plus(el))]) {
      const x = Number(rect.getAttribute('x'));
      const y = Number(rect.getAttribute('y'));
      const w = Number(rect.getAttribute('width'));
      const h = Number(rect.getAttribute('height'));
      expect(x + w / 2).toBeCloseTo(box / 2, 10);
      expect(y + h / 2).toBeCloseTo(box / 2, 10);
    }
  });

  it('gives both marks the same 20px span, so the pair reads as one', async () => {
    const el = await mount({ value: 23, min: 17, max: 30 });
    const spans = [...bars(minus(el)), ...bars(plus(el))].map((rect) =>
      Math.max(Number(rect.getAttribute('width')), Number(rect.getAttribute('height'))),
    );
    expect(spans).toEqual([STEPPER_GLYPH_BOX, STEPPER_GLYPH_BOX, STEPPER_GLYPH_BOX]);
  });

  it('uses the Figma bar offset, thickness and corner radius', async () => {
    const el = await mount({ value: 23, min: 17, max: 30 });
    expect(STEPPER_GLYPH_OFFSET).toBe(9.25);
    expect(STEPPER_GLYPH_THICKNESS).toBe(1.5);
    const bar = bars(minus(el))[0];
    expect(bar?.getAttribute('y')).toBe('9.25');
    expect(bar?.getAttribute('height')).toBe('1.5');
    expect(bar?.getAttribute('rx')).toBe('0.75');
  });

  it('paints a reached end muted and strokeless rather than dimming the row', () => {
    const styles = QlStepper.styles.toString();
    expect(styles).toContain('button:disabled');
    expect(styles).toMatch(/button:disabled\s*\{[^}]*border-color:\s*transparent/);
    expect(styles).toMatch(/button:disabled\s*\{[^}]*var\(--ql-ink-muted/);
  });

  it('centres the value column between the two buttons', () => {
    const styles = QlStepper.styles.toString();
    expect(styles).toMatch(/\.readout\s*\{[^}]*flex:\s*1 1 auto/);
    expect(styles).toMatch(/\.readout\s*\{[^}]*text-align:\s*center/);
    expect(styles).toMatch(/\.stepper\s*\{[^}]*gap:\s*var\(--ql-space-m, 12px\)/);
  });

  it('holds a fractional grid to one decimal even at a whole number', async () => {
    const el = await mount({ value: 27, step: 0.5, unit: '°' });
    expect(readout(el)).toBe('27.0°');
  });
});
