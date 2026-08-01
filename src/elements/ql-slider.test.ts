import { describe, expect, it } from 'vitest';
import { QlSlider } from './ql-slider';

async function mount(props: Partial<QlSlider> = {}): Promise<QlSlider> {
  const el = document.createElement('ql-slider') as QlSlider;
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

function innerInput(el: QlSlider): HTMLInputElement {
  const input = el.shadowRoot?.querySelector('input');
  if (input === null || input === undefined) {
    throw new Error('slider input missing');
  }
  return input;
}

describe('ql-slider', () => {
  it('is registered with 0..100 step 1 defaults', () => {
    expect(customElements.get('ql-slider')).toBe(QlSlider);
    const el = document.createElement('ql-slider') as QlSlider;
    expect(el.value).toBe(0);
    expect(el.min).toBe(0);
    expect(el.max).toBe(100);
    expect(el.step).toBe(1);
  });

  it('renders a native range input (arrow keys for free) with the aria label', async () => {
    const el = await mount({ value: 30, label: 'Brightness' });
    const input = innerInput(el);
    expect(input.type).toBe('range');
    expect(input.getAttribute('aria-label')).toBe('Brightness');
    expect(input.value).toBe('30');
    el.remove();
  });

  it('re-emits input as ql-input and change as ql-change with numeric detail', async () => {
    const el = await mount({ value: 30 });
    const inputs: number[] = [];
    const changes: number[] = [];
    el.addEventListener('ql-input', (e) => inputs.push((e as CustomEvent<{ value: number }>).detail.value));
    el.addEventListener('ql-change', (e) => changes.push((e as CustomEvent<{ value: number }>).detail.value));
    const input = innerInput(el);
    input.value = '45';
    input.dispatchEvent(new Event('input'));
    input.value = '60';
    input.dispatchEvent(new Event('change'));
    expect(inputs).toEqual([45]);
    expect(changes).toEqual([60]);
    expect(el.value).toBe(60);
    el.remove();
  });

  it('exposes the fill percentage as --ql-slider-fill for track painting', async () => {
    const el = await mount({ value: 60, min: 0, max: 100 });
    expect(el.style.getPropertyValue('--ql-slider-fill')).toBe('60%');
    el.value = 25;
    await el.updateComplete;
    expect(el.style.getPropertyValue('--ql-slider-fill')).toBe('25%');
    el.remove();
  });

  it('disables the inner input when disabled', async () => {
    const el = await mount({ disabled: true });
    expect(innerInput(el).disabled).toBe(true);
    el.remove();
  });

  it('paints track and thumb from --ql-* variables', () => {
    const cssText = QlSlider.styles.toString();
    expect(cssText).toContain('var(--ql-accent-champagne, #b08d57)');
    expect(cssText).toContain('var(--ql-surface-border, #e4dccb)');
    expect(cssText).toContain('var(--ql-surface-card, #fdfbf6)');
  });
});
