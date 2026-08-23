import { render } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import type { QlSegmented } from '../elements/ql-segmented';
import type { QlSlider } from '../elements/ql-slider';
import type { QlStepper } from '../elements/ql-stepper';
import type { QlToggle } from '../elements/ql-toggle';
import type {
  SelectControl,
  SliderControl,
  SpanControl,
  StepperControl,
  ToggleControl,
} from './device-controls';
import { renderControl } from './render-controls';

function mount(template: ReturnType<typeof renderControl>): HTMLDivElement {
  const container = document.createElement('div');
  render(template, container);
  document.body.append(container);
  return container;
}

afterEach(() => {
  document.body.innerHTML = '';
});

const STEPPER: StepperControl = {
  id: 'temperature',
  labelKey: 'control.target',
  kind: 'stepper',
  target: { value: 22, min: 16, max: 30, step: 0.5 },
  unit: '°',
};

const TOGGLE: ToggleControl = {
  id: 'oscillate',
  labelKey: 'control.oscillate',
  kind: 'toggle',
  on: true,
};

const SLIDER: SliderControl = {
  id: 'tilt',
  labelKey: 'control.tilt',
  kind: 'slider',
  target: { value: 40, min: 0, max: 100, step: 1 },
  unit: '%',
};

const SPAN: SpanControl = {
  id: 'angle',
  labelKey: 'control.angle',
  kind: 'span',
  spans: [45, 90, 180],
  value: 90,
};

const SELECT: SelectControl = {
  id: 'hvac_mode',
  labelKey: 'control.mode',
  kind: 'select',
  options: ['cool', 'heat'],
  value: 'cool',
};

/**
 * `.label` used to be passed straight through to ql-stepper / ql-toggle /
 * ql-slider, each of which turns it into its own `aria-label` — the exact
 * string the visible `.ql-control-label` span beside it already carries, so
 * a screen reader announced the name twice. The fix moves the one
 * accessible name onto the wrapping `.ql-control`/`.ql-control-inline` div
 * (role="group" + aria-label) and stops handing the same string to the
 * inner control.
 */
describe('renderControl label duplication', () => {
  it('stepper: names the group once, not the inner control too', () => {
    const root = mount(renderControl(STEPPER, 'en', false, () => undefined));
    const group = root.querySelector('.ql-control');
    expect(group?.getAttribute('role')).toBe('group');
    expect(group?.getAttribute('aria-label')).toBe('Target');
    expect(root.querySelector('.ql-control-label')?.textContent).toBe('Target');
    // `.label` is a Lit property, not a reflected attribute — check the
    // property itself. Left at its own default ('') rather than the group's
    // text, so ql-stepper's internal aria-label has nothing to announce.
    expect(root.querySelector<QlStepper>('ql-stepper')?.label).toBe('');
  });

  it('toggle: names the group once, not the inner control too', () => {
    const root = mount(renderControl(TOGGLE, 'en', false, () => undefined));
    const group = root.querySelector('.ql-control');
    expect(group?.getAttribute('role')).toBe('group');
    expect(group?.getAttribute('aria-label')).toBe('Oscillate');
    expect(root.querySelector<QlToggle>('ql-toggle')?.label).toBe('');
  });

  it('slider: names the group once, not the inner control too', () => {
    const root = mount(renderControl(SLIDER, 'en', false, () => undefined));
    const group = root.querySelector('.ql-control');
    expect(group?.getAttribute('role')).toBe('group');
    expect(group?.getAttribute('aria-label')).toBe('Tilt');
    expect(root.querySelector<QlSlider>('ql-slider')?.label).toBe('');
  });

  it('span: names the group once, not the inner ql-segmented too', () => {
    const root = mount(renderControl(SPAN, 'en', false, () => undefined));
    const group = root.querySelector('.ql-control');
    expect(group?.getAttribute('role')).toBe('group');
    expect(group?.getAttribute('aria-label')).toBe('Rotation');
    expect(root.querySelector('.ql-control-label')?.textContent).toBe('Rotation');
    expect(root.querySelector<QlSegmented>('ql-segmented')?.label).toBe('');
  });

  it('default (select): names the group once, not the inner ql-segmented too', () => {
    const root = mount(renderControl(SELECT, 'en', false, () => undefined));
    const group = root.querySelector('.ql-control');
    expect(group?.getAttribute('role')).toBe('group');
    expect(group?.getAttribute('aria-label')).toBe('Mode');
    expect(root.querySelector('.ql-control-label')?.textContent).toBe('Mode');
    expect(root.querySelector<QlSegmented>('ql-segmented')?.label).toBe('');
  });
});

describe('renderControl interaction', () => {
  it('still emits on a stepper change once .label is no longer passed through', () => {
    const seen: Array<{ id: string; value: string | number | boolean }> = [];
    const root = mount(
      renderControl(STEPPER, 'en', false, (id, value) => seen.push({ id, value })),
    );
    root
      .querySelector('ql-stepper')
      ?.dispatchEvent(new CustomEvent('ql-change', { detail: { value: 23 }, bubbles: true }));
    expect(seen).toEqual([{ id: 'temperature', value: 23 }]);
  });
});
