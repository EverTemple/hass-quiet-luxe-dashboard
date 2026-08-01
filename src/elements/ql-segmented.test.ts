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
    { value: 'day', label: 'Day', disabled: true, hint: 'Coming soon' },
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

  it('renders disabled options with the native disabled attribute and hint title', async () => {
    const el = await mountMixed();
    const day = buttons(el)[1];
    expect(day?.disabled).toBe(true);
    expect(day?.getAttribute('title')).toBe('Coming soon');
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
