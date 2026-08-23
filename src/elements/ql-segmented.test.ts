import { describe, expect, it } from 'vitest';
import { QlSegmented, type QlSegmentOption } from './ql-segmented';

const OPTIONS: ReadonlyArray<QlSegmentOption> = [
  { value: 'agenda', label: 'Agenda' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
];

async function mount(value = 'agenda'): Promise<QlSegmented> {
  const el = document.createElement('ql-segmented') as QlSegmented;
  el.options = OPTIONS;
  el.value = value;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

function buttons(el: QlSegmented): HTMLButtonElement[] {
  return [...(el.shadowRoot?.querySelectorAll('button') ?? [])];
}

describe('ql-segmented', () => {
  it('renders one radio button per option inside a radiogroup', async () => {
    const el = await mount();
    expect(el.shadowRoot?.querySelector("[role='radiogroup']")).not.toBeNull();
    const all = buttons(el);
    expect(all.map((b) => b.textContent?.trim())).toEqual(['Agenda', 'Day', 'Week']);
    expect(all.map((b) => b.getAttribute('role'))).toEqual(['radio', 'radio', 'radio']);
    el.remove();
  });

  it('marks the selected option with aria-checked and roving tabindex', async () => {
    const el = await mount('day');
    const all = buttons(el);
    expect(all.map((b) => b.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(all.map((b) => b.tabIndex)).toEqual([-1, 0, -1]);
    el.remove();
  });

  it('renders every button as type="button" so it never submits a form', async () => {
    const el = await mount();
    expect(buttons(el).every((b) => b.getAttribute('type') === 'button')).toBe(true);
    el.remove();
  });

  /* A bound value that matches none of the options must never leave the
     whole radiogroup untabbable. */
  it('keeps exactly one button tabbable when the bound value matches nothing', async () => {
    const el = await mount('not-a-real-value');
    expect(buttons(el).map((b) => b.tabIndex)).toEqual([0, -1, -1]);
    el.remove();
  });

  it('click selects and emits ql-change with the option value', async () => {
    const el = await mount();
    const events: string[] = [];
    el.addEventListener('ql-change', (e) => events.push((e as CustomEvent<{ value: string }>).detail.value));
    buttons(el)[2]?.click();
    expect(el.value).toBe('week');
    expect(events).toEqual(['week']);
    el.remove();
  });

  it('clicking the already-selected option emits nothing', async () => {
    const el = await mount();
    const events: unknown[] = [];
    el.addEventListener('ql-change', (e) => events.push(e));
    buttons(el)[0]?.click();
    expect(events).toEqual([]);
    el.remove();
  });

  it('extends each option’s hit area to the touch minimum without growing the painted pill or reaching a neighbour', () => {
    const cssText = QlSegmented.styles.toString();
    const buttonRule = /button \{([^}]*)\}/.exec(cssText)?.[1] ?? '';
    // The painted pill keeps its 4px vertical padding — unchanged.
    expect(buttonRule).toContain('padding: 4px');
    expect(buttonRule).toContain('position: relative');
    const hitAreaRule = /button::before \{([^}]*)\}/.exec(cssText)?.[1] ?? '';
    expect(hitAreaRule).toContain('height: var(--ql-touch-min, 56px)');
    expect(hitAreaRule).toContain('position: absolute');
    // Width stays at the button's own 100% — never the group's — so the
    // overlay can't cross the 2px gap into an adjacent segment.
    expect(hitAreaRule).toContain('width: 100%');
  });

  it('ArrowRight/ArrowLeft move selection and wrap', async () => {
    const el = await mount('week');
    const group = el.shadowRoot?.querySelector("[role='radiogroup']");
    group?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(el.value).toBe('agenda');
    group?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await el.updateComplete;
    expect(el.value).toBe('week');
    el.remove();
  });
});

describe('ql-segmented disabled options', () => {
  const MIXED: ReadonlyArray<QlSegmentOption> = [
    { value: 'agenda', label: 'Agenda' },
    { value: 'day', label: 'Day', disabled: true },
    { value: 'week', label: 'Week' },
  ];

  async function mountMixed(value = 'agenda'): Promise<QlSegmented> {
    const el = document.createElement('ql-segmented') as QlSegmented;
    el.options = MIXED;
    el.value = value;
    document.body.append(el);
    await el.updateComplete;
    return el;
  }

  it('renders disabled options with the native disabled attribute', async () => {
    const el = await mountMixed();
    const day = buttons(el)[1];
    expect(day?.disabled).toBe(true);
    el.remove();
  });

  it('never selects a disabled option, even programmatically via keyboard focus path', async () => {
    const el = await mountMixed();
    const events: unknown[] = [];
    el.addEventListener('ql-change', (e) => events.push(e));
    buttons(el)[1]?.click();
    await el.updateComplete;
    expect(el.value).toBe('agenda');
    expect(events).toEqual([]);
    el.remove();
  });

  /* A bound value matching nothing falls back to the first option — but the
     leading option here is disabled, so landing tabindex 0 on it would strand
     keyboard users on an inert segment. The fallback must skip past it. */
  it('falls back the tabbable index past a disabled leading option', async () => {
    const leadDisabled: ReadonlyArray<QlSegmentOption> = [
      { value: 'agenda', label: 'Agenda', disabled: true },
      { value: 'day', label: 'Day' },
      { value: 'week', label: 'Week' },
    ];
    const el = document.createElement('ql-segmented') as QlSegmented;
    el.options = leadDisabled;
    el.value = 'not-a-real-value';
    document.body.append(el);
    await el.updateComplete;
    expect(buttons(el).map((b) => b.tabIndex)).toEqual([-1, 0, -1]);
    el.remove();
  });

  it('arrow keys skip disabled options and wrap', async () => {
    const el = await mountMixed();
    const group = el.shadowRoot?.querySelector("[role='radiogroup']");
    group?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(el.value).toBe('week');
    group?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(el.value).toBe('agenda');
    el.remove();
  });
});
