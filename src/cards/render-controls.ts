import { html, type TemplateResult } from 'lit';
import '../elements/ql-segmented';
import '../elements/ql-slider';
import '../elements/ql-stepper';
import '../elements/ql-toggle';
import type { QlSegmentOption } from '../elements/ql-segmented';
import { formatInteger } from '../i18n/format-number';
import { t } from '../i18n/translate';
import type { Locale } from '../i18n/types';
import { optionLabel, type ControlId, type DeviceControl } from './device-controls';

/**
 * Renders one inline control. Shared by every card that drives a device, so
 * a target temperature on a climate card and a target humidity on a
 * dehumidifier card are the same object with the same gestures.
 *
 * Layout rule: a control that fits beside its label sits beside it; a control
 * that wants the card's full width gets its own line under the label. Styles
 * live in `QlBaseCard.qlCardStyles` so every card inherits them.
 */
export type ControlEmit = (id: ControlId, value: string | number | boolean) => void;

function segments(
  locale: Locale,
  id: ControlId,
  options: ReadonlyArray<string>,
): ReadonlyArray<QlSegmentOption> {
  return options.map((option) => ({ value: option, label: optionLabel(locale, id, option) }));
}

function labelRow(text: string, trailing?: string): TemplateResult {
  return html`
    <div class="ql-control-head">
      <span class="ql-control-label">${text}</span>
      ${trailing === undefined ? '' : html`<span class="ql-control-value">${trailing}</span>`}
    </div>
  `;
}

export function renderControl(
  control: DeviceControl,
  locale: Locale,
  disabled: boolean,
  emit: ControlEmit,
): TemplateResult {
  const label = t(locale, control.labelKey);

  /* Stepper, toggle, slider and segmented each ship their own `.label` prop,
     which becomes an `aria-label` inside their own shadow root — the exact
     same string as the visible `.ql-control-label` span beside them, so a
     screen reader read it twice. None of the four exposes an
     `aria-labelledby` hook back out to this span, so the fix runs the other
     way: every branch's wrapper carries the one accessible name (role="group"
     + aria-label), and `.label` is left unset on the control itself. Each
     element defaults it to '', and an empty aria-label is dropped by the
     accessible-name computation either way: ql-toggle and ql-slider skip
     rendering the attribute at all for '', while ql-stepper and ql-segmented
     render `aria-label=""` — which browsers treat the same way, as absent,
     not a blank name — so nothing names the inner control twice. */
  if (control.kind === 'stepper') {
    return html`
      <div class="ql-control ql-control-inline" role="group" aria-label=${label}>
        <span class="ql-control-label">${label}</span>
        <ql-stepper
          .value=${control.target.value}
          .min=${control.target.min}
          .max=${control.target.max}
          .step=${control.target.step}
          .unit=${control.unit}
          .locale=${locale}
          decrease-label=${t(locale, 'control.decrease')}
          increase-label=${t(locale, 'control.increase')}
          ?disabled=${disabled}
          @ql-change=${(event: CustomEvent<{ value: number }>): void =>
            emit(control.id, event.detail.value)}
        ></ql-stepper>
      </div>
    `;
  }

  if (control.kind === 'toggle') {
    return html`
      <div class="ql-control ql-control-inline" role="group" aria-label=${label}>
        <span class="ql-control-label">${label}</span>
        <ql-toggle
          .checked=${control.on}
          ?disabled=${disabled}
          @ql-change=${(event: CustomEvent<{ checked: boolean }>): void =>
            emit(control.id, event.detail.checked)}
        ></ql-toggle>
      </div>
    `;
  }

  if (control.kind === 'slider') {
    return html`
      <div class="ql-control" role="group" aria-label=${label}>
        ${labelRow(label, `${formatInteger(control.target.value, locale)}${control.unit}`)}
        <ql-slider
          .value=${control.target.value}
          .min=${control.target.min}
          .max=${control.target.max}
          .step=${control.target.step}
          ?disabled=${disabled}
          @ql-change=${(event: CustomEvent<{ value: number }>): void =>
            emit(control.id, event.detail.value)}
        ></ql-slider>
      </div>
    `;
  }

  if (control.kind === 'span') {
    return html`
      <div class="ql-control" role="group" aria-label=${label}>
        ${labelRow(label)}
        <ql-segmented
          size="touch"
          .options=${control.spans.map((span) => ({ value: String(span), label: `${span}°` }))}
          .value=${control.value === undefined ? '' : String(control.value)}
          @ql-change=${(event: CustomEvent<{ value: string }>): void =>
            emit(control.id, Number(event.detail.value))}
        ></ql-segmented>
      </div>
    `;
  }

  return html`
    <div class="ql-control" role="group" aria-label=${label}>
      ${labelRow(label)}
      <ql-segmented
        size="touch"
        .options=${segments(locale, control.id, control.options)}
        .value=${control.value}
        @ql-change=${(event: CustomEvent<{ value: string }>): void =>
          emit(control.id, event.detail.value)}
      ></ql-segmented>
    </div>
  `;
}

/**
 * The whole control stack. A device that supports none renders an empty
 * template, so the card keeps its original compact shape rather than growing
 * an empty divider.
 */
export function renderControls(
  controls: ReadonlyArray<DeviceControl>,
  locale: Locale,
  disabled: boolean,
  emit: ControlEmit,
): TemplateResult {
  if (controls.length === 0) {
    return html``;
  }
  return html`
    <div class="ql-controls">
      ${controls.map((control) => renderControl(control, locale, disabled, emit))}
    </div>
  `;
}
