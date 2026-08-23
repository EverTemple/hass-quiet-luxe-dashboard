import { render } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import type { QlPresetRow } from '../elements/ql-preset-row';
import type { QlStepper } from '../elements/ql-stepper';
import type { QlToggle } from '../elements/ql-toggle';
import type { ClimateSheetGroup } from './climate-sheet';
import { renderClimateSheet, type ClimateSheetOptions } from './render-climate-sheet';

function mount(options: Partial<ClimateSheetOptions> & { groups: ReadonlyArray<ClimateSheetGroup> }): HTMLDivElement {
  const container = document.createElement('div');
  render(
    renderClimateSheet({
      open: true,
      heading: 'Controls',
      locale: 'en',
      disabled: false,
      emit: () => undefined,
      onClose: () => undefined,
      ...options,
    }),
    container,
  );
  document.body.append(container);
  return container;
}

afterEach(() => {
  document.body.innerHTML = '';
});

/**
 * `needsOwnName` only draws the `.ql-sheet-name` span when the control isn't
 * already fully named by its group's own `<h3>` (a group with exactly one
 * control that shares the group's own titleKey skips it). `.label` used to be
 * handed to ql-toggle/ql-stepper unconditionally, which duplicated that span
 * whenever it *was* drawn — the same bug render-controls.ts had. Where there
 * is no span, `.label` is the control's only name and must stay.
 */
describe('render-climate-sheet control label duplication', () => {
  it('toggle: names the row once when the sibling span is drawn', () => {
    const groups: ReadonlyArray<ClimateSheetGroup> = [
      {
        titleKey: 'control.mode',
        controls: [
          { id: 'swing_mode', labelKey: 'control.oscillate', kind: 'toggle', on: true, onValue: 'vertical', offValue: 'off' },
        ],
      },
    ];
    const container = mount({ groups });
    expect(container.querySelector('.ql-sheet-name')?.textContent).toBe('Oscillate');
    const row = container.querySelector('.ql-sheet-row');
    expect(row?.getAttribute('role')).toBe('group');
    expect(row?.getAttribute('aria-label')).toBe('Oscillate');
    expect(container.querySelector<QlToggle>('ql-toggle')?.label).toBe('');
  });

  it('toggle: leaves .label alone when there is no sibling span to duplicate it', () => {
    const groups: ReadonlyArray<ClimateSheetGroup> = [
      {
        titleKey: 'control.oscillate',
        controls: [
          { id: 'swing_mode', labelKey: 'control.oscillate', kind: 'toggle', on: true, onValue: 'vertical', offValue: 'off' },
        ],
      },
    ];
    const container = mount({ groups });
    expect(container.querySelector('.ql-sheet-name')).toBeNull();
    const row = container.querySelector('.ql-sheet-row');
    expect(row?.getAttribute('role')).toBeNull();
    expect(row?.hasAttribute('aria-label')).toBe(false);
    expect(container.querySelector<QlToggle>('ql-toggle')?.label).toBe('Oscillate');
  });

  it('stepper: names the row once when the sibling span is drawn', () => {
    const groups: ReadonlyArray<ClimateSheetGroup> = [
      {
        titleKey: 'control.mode',
        controls: [
          {
            id: 'target_humidity',
            labelKey: 'control.humidity',
            kind: 'stepper',
            target: { value: 45, min: 30, max: 70, step: 5 },
            unit: '%',
          },
        ],
      },
    ];
    const container = mount({ groups });
    expect(container.querySelector('.ql-sheet-name')?.textContent).toBe('Target humidity');
    const row = container.querySelector('.ql-sheet-row');
    expect(row?.getAttribute('role')).toBe('group');
    expect(row?.getAttribute('aria-label')).toBe('Target humidity');
    expect(container.querySelector<QlStepper>('ql-stepper')?.label).toBe('');
  });

  it('stepper: leaves .label alone when there is no sibling span to duplicate it', () => {
    const groups: ReadonlyArray<ClimateSheetGroup> = [
      {
        titleKey: 'control.humidity',
        controls: [
          {
            id: 'target_humidity',
            labelKey: 'control.humidity',
            kind: 'stepper',
            target: { value: 45, min: 30, max: 70, step: 5 },
            unit: '%',
          },
        ],
      },
    ];
    const container = mount({ groups });
    expect(container.querySelector('.ql-sheet-name')).toBeNull();
    const row = container.querySelector('.ql-sheet-row');
    expect(row?.getAttribute('role')).toBeNull();
    expect(row?.hasAttribute('aria-label')).toBe(false);
    expect(container.querySelector<QlStepper>('ql-stepper')?.label).toBe('Target humidity');
  });

  it('select: ql-preset-row keeps .label — it never gets a sibling span', () => {
    const groups: ReadonlyArray<ClimateSheetGroup> = [
      {
        titleKey: 'control.mode',
        controls: [{ id: 'hvac_mode', labelKey: 'control.hvac_mode', kind: 'select', options: ['cool', 'heat'], value: 'cool' }],
      },
    ];
    const container = mount({ groups });
    expect(container.querySelector('.ql-sheet-name')).toBeNull();
    expect(container.querySelector<QlPresetRow>('ql-preset-row')?.label).toBe('HVAC mode');
  });

  /* h3 group titles (P3 fix) are covered indirectly here too: one real
     heading per group, not a styled span. */
  it('renders one <h3> per group', () => {
    const groups: ReadonlyArray<ClimateSheetGroup> = [
      { titleKey: 'control.mode', controls: [] },
      { titleKey: 'control.fan', controls: [] },
    ];
    const container = mount({ groups });
    const titles = [...container.querySelectorAll('h3.ql-sheet-title')].map((el) => el.textContent);
    expect(titles).toEqual(['Mode', 'Fan']);
  });
});
