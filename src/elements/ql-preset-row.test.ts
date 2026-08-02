import { describe, expect, it } from 'vitest';
import { QlPresetRow, type QlPresetOption } from './ql-preset-row';

const SWEEPS: ReadonlyArray<QlPresetOption> = [
  { value: 'off', label: 'Off' },
  { value: '45', label: '45°' },
  { value: '90', label: '90°' },
  { value: '180', label: '180°' },
  { value: '350', label: '350°' },
];

const TIMERS: ReadonlyArray<QlPresetOption> = [
  { value: '0', label: 'Off' },
  { value: '15', label: '15m' },
  { value: '30', label: '30m' },
  { value: '60', label: '1h' },
  { value: '120', label: '2h' },
  { value: '240', label: '4h' },
  { value: '480', label: '8h' },
];

async function mount(
  options: ReadonlyArray<QlPresetOption> = SWEEPS,
  value = '90',
): Promise<QlPresetRow> {
  const el = document.createElement('ql-preset-row') as QlPresetRow;
  el.options = options;
  el.value = value;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

function buttons(el: QlPresetRow): HTMLButtonElement[] {
  return [...(el.shadowRoot?.querySelectorAll('button') ?? [])];
}

describe('ql-preset-row', () => {
  it('is registered', () => {
    expect(customElements.get('ql-preset-row')).toBe(QlPresetRow);
  });

  it('renders five oscillation presets as radios in a radiogroup', async () => {
    const el = await mount();
    expect(el.shadowRoot?.querySelector("[role='radiogroup']")).not.toBeNull();
    expect(buttons(el).map((b) => b.textContent?.trim())).toEqual([
      'Off',
      '45°',
      '90°',
      '180°',
      '350°',
    ]);
    el.remove();
  });

  it('renders seven timer presets', async () => {
    const el = await mount(TIMERS, '120');
    expect(buttons(el)).toHaveLength(7);
    expect(buttons(el).map((b) => b.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'false',
      'false',
      'true',
      'false',
      'false',
    ]);
    el.remove();
  });

  it('marks the selection with aria-checked and roving tabindex', async () => {
    const el = await mount();
    expect(buttons(el).map((b) => b.tabIndex)).toEqual([-1, -1, 0, -1, -1]);
    el.remove();
  });

  it('click selects and emits ql-change', async () => {
    const el = await mount();
    const events: string[] = [];
    el.addEventListener('ql-change', (e) =>
      events.push((e as CustomEvent<{ value: string }>).detail.value),
    );
    buttons(el)[4]?.click();
    expect(el.value).toBe('350');
    expect(events).toEqual(['350']);
    el.remove();
  });

  it('re-selecting the current value emits nothing', async () => {
    const el = await mount();
    const events: unknown[] = [];
    el.addEventListener('ql-change', (e) => events.push(e));
    buttons(el)[2]?.click();
    expect(events).toEqual([]);
    el.remove();
  });

  it('arrow keys move the selection and wrap at both ends', async () => {
    const el = await mount(SWEEPS, '350');
    const group = el.shadowRoot?.querySelector("[role='radiogroup']");
    group?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(el.value).toBe('off');
    group?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await el.updateComplete;
    expect(el.value).toBe('350');
    el.remove();
  });

  it('matches the segmented control’s selected treatment', () => {
    const cssText = QlPresetRow.styles.toString();
    expect(cssText).toContain('background: var(--ql-ink-primary, #2b2620)');
    expect(cssText).toContain('color: var(--ql-bg-base, #f4f0e8)');
  });

  it('keeps a seven-segment row inside its container', () => {
    const cssText = QlPresetRow.styles.toString();
    expect(cssText).toContain('flex: 1 1 0');
    expect(cssText).toContain('min-width: 0');
    expect(cssText).toContain('text-overflow: ellipsis');
  });
});
