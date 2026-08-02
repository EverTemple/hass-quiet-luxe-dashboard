import { html, type TemplateResult } from 'lit';
import '../elements/ql-segmented';
import '../elements/ql-slider';
import '../elements/ql-stepper';
import '../elements/ql-toggle';
import type { QlSegmentOption } from '../elements/ql-segmented';
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

  if (control.kind === 'stepper') {
    return html`
      <div class="ql-control ql-control-inline">
        <span class="ql-control-label">${label}</span>
        <ql-stepper
          .value=${control.target.value}
          .min=${control.target.min}
          .max=${control.target.max}
          .step=${control.target.step}
          .unit=${control.unit}
          .label=${label}
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
      <div class="ql-control ql-control-inline">
        <span class="ql-control-label">${label}</span>
        <ql-toggle
          .checked=${control.on}
          .label=${label}
          ?disabled=${disabled}
          @ql-change=${(event: CustomEvent<{ checked: boolean }>): void =>
            emit(control.id, event.detail.checked)}
        ></ql-toggle>
      </div>
    `;
  }

  if (control.kind === 'slider') {
    return html`
      <div class="ql-control">
        ${labelRow(label, `${Math.round(control.target.value)}${control.unit}`)}
        <ql-slider
          .value=${control.target.value}
          .min=${control.target.min}
          .max=${control.target.max}
          .step=${control.target.step}
          .label=${label}
          ?disabled=${disabled}
          @ql-change=${(event: CustomEvent<{ value: number }>): void =>
            emit(control.id, event.detail.value)}
        ></ql-slider>
      </div>
    `;
  }

  if (control.kind === 'span') {
    return html`
      <div class="ql-control">
        ${labelRow(label)}
        <ql-segmented
          size="touch"
          .options=${control.spans.map((span) => ({ value: String(span), label: `${span}°` }))}
          .value=${control.value === undefined ? '' : String(control.value)}
          .label=${label}
          @ql-change=${(event: CustomEvent<{ value: string }>): void =>
            emit(control.id, Number(event.detail.value))}
        ></ql-segmented>
      </div>
    `;
  }

  return html`
    <div class="ql-control">
      ${labelRow(label)}
      <ql-segmented
        size="touch"
        .options=${segments(locale, control.id, control.options)}
        .value=${control.value}
        .label=${label}
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
