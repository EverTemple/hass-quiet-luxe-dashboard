import { css, html, nothing, type CSSResult, type TemplateResult } from 'lit';
import '../elements/ql-preset-row';
import '../elements/ql-sheet';
import '../elements/ql-sheet-button';
import '../elements/ql-stepper';
import '../elements/ql-toggle';
import { t } from '../i18n/translate';
import type { Locale } from '../i18n/types';
import type {
  ClimateControlId,
  ClimateSheetControl,
  ClimateSheetGroup,
} from './climate-sheet';
import { optionLabel, titleCase } from './device-controls';

/**
 * The body of `modal/climate-controls` (Figma 56:4698), rendered into the
 * shared `ql-sheet` shell.
 *
 * A template function rather than an element, matching `render-controls.ts`:
 * the groups are already gated by `climateSheetGroups`, and the card — the only
 * layer that may touch hass — turns one interaction back into a service call.
 */

export type ClimateSheetEmit = (id: ClimateControlId, value: string | number | boolean) => void;

export const climateSheetStyles: CSSResult = css`
  .ql-sheet-body {
    display: flex;
    flex-direction: column;
    gap: var(--ql-space-xl, 24px);
    min-width: 0;
  }
  .ql-sheet-group {
    display: flex;
    flex-direction: column;
    gap: var(--ql-space-m, 12px);
    min-width: 0;
  }
  .ql-sheet-title {
    color: var(--ql-ink-muted, #8c8578);
    font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  /* A control that needs a name of its own sits beside it; the name is what
     gives way when the sheet is narrow, never the control. */
  .ql-sheet-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ql-space-m, 12px);
    min-width: 0;
  }
  .ql-sheet-row > .ql-sheet-name {
    flex: 0 1 auto;
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--ql-ink-primary, #2b2620);
    font: 400 15px/20px var(--ql-font-body, Outfit, sans-serif);
  }
  .ql-sheet-row > ql-stepper,
  .ql-sheet-row > ql-toggle {
    flex: 0 1 auto;
  }
`;

/** A control whose only name is its group's does not repeat it. */
function needsOwnName(group: ClimateSheetGroup, control: ClimateSheetControl): boolean {
  return !(group.controls.length === 1 && control.labelKey === group.titleKey);
}

function optionText(locale: Locale, id: ClimateControlId, raw: string): string {
  // hvac modes have a known vocabulary; everything else is a vendor's own word
  // ("Clothes Drying", "rangefull") and is shown as the device names it.
  return id === 'hvac_mode' ? optionLabel(locale, 'hvac_mode', raw) : titleCase(raw);
}

function renderControl(
  group: ClimateSheetGroup,
  control: ClimateSheetControl,
  locale: Locale,
  disabled: boolean,
  emit: ClimateSheetEmit,
): TemplateResult {
  const label = t(locale, control.labelKey);
  const name = needsOwnName(group, control)
    ? html`<span class="ql-sheet-name">${label}</span>`
    : nothing;

  if (control.kind === 'select') {
    return html`
      <ql-preset-row
        .options=${control.options.map((option) => ({
          value: option,
          label: optionText(locale, control.id, option),
        }))}
        .value=${control.value}
        .label=${label}
        @ql-change=${(event: CustomEvent<{ value: string }>): void =>
          emit(control.id, event.detail.value)}
      ></ql-preset-row>
    `;
  }

  if (control.kind === 'toggle') {
    return html`
      <div class="ql-sheet-row">
        ${name}
        <ql-toggle
          .checked=${control.on}
          .label=${label}
          ?disabled=${disabled}
          @ql-change=${(event: CustomEvent<{ checked: boolean }>): void =>
            emit(control.id, event.detail.checked ? control.onValue : control.offValue)}
        ></ql-toggle>
      </div>
    `;
  }

  return html`
    <div class="ql-sheet-row">
      ${name}
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

export interface ClimateSheetOptions {
  readonly open: boolean;
  readonly heading: string;
  readonly groups: ReadonlyArray<ClimateSheetGroup>;
  readonly locale: Locale;
  readonly disabled: boolean;
  readonly emit: ClimateSheetEmit;
  readonly onClose: () => void;
  /**
   * The dial block, when the entity has a setpoint to point at. Passed in
   * rather than built here so the card keeps sole ownership of the service
   * calls; a device with nothing to aim (a mode-only purifier, a dehumidifier)
   * simply omits it and the sheet opens on its groups.
   */
  readonly dial?: TemplateResult;
  /** Opens HA's own more-info dialog, if the card offers that route. */
  readonly onDetails?: () => void;
}

/**
 * Everything the device can be told, in one sheet (Figma `modal/climate-dial`,
 * 106:8971): the dial with its quick-adjust glyphs, then the mode row, the
 * setpoint steppers, fan, swing, humidity and presets — each present only if
 * the device reports it.
 *
 * This is deliberately one surface rather than two. The card used to send you
 * to a controls modal that had no dial in it, so setting a temperature and
 * changing a fan speed were different places; here they are the same place.
 *
 * Each change applies straight away, so the footer carries a single "Done" that
 * dismisses rather than a Cancel/Confirm pair that would imply staged edits.
 */
export function renderClimateSheet(options: ClimateSheetOptions): TemplateResult {
  const { locale } = options;
  return html`
    <ql-sheet
      ?open=${options.open}
      heading=${options.heading}
      close-label=${t(locale, 'common.close')}
      @ql-sheet-close=${options.onClose}
    >
      <div class="ql-sheet-body">
        ${options.dial ?? nothing}
        ${options.groups.map(
          (group) => html`
            <div class="ql-sheet-group">
              <span class="ql-sheet-title">${t(locale, group.titleKey)}</span>
              ${group.controls.map((control) =>
                renderControl(group, control, locale, options.disabled, options.emit),
              )}
            </div>
          `,
        )}
      </div>
      ${options.onDetails === undefined
        ? nothing
        : html`
            <ql-sheet-button slot="footer" emphasis="secondary" @click=${options.onDetails}>
              ${t(locale, 'common.show_details')}
            </ql-sheet-button>
          `}
      <ql-sheet-button slot="footer" emphasis="primary" @click=${options.onClose}>
        ${t(locale, 'common.done')}
      </ql-sheet-button>
    </ql-sheet>
  `;
}
