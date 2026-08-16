import { css, html, type CSSResult, type TemplateResult } from 'lit';
import '../elements/ql-quick-adjust';
import '../elements/ql-ring-dial';
import type { QlRingDialHandle, QlRingDialSize } from '../elements/ql-ring-dial';
import { t } from '../i18n/translate';
import type { Locale } from '../i18n/types';
import type { DialMode, DialScale, DialSetpoints } from './climate-dial';
import { canAdjust, type AdjustDirection } from './quick-adjust';

/**
 * The dial and the two glyphs that flank it — `card/climate-dial-v2`'s
 * `dial-wrap` (Figma 103:2480) and `modal/climate-dial`'s `dial block`
 * (106:9046), which are the same arrangement at two scales.
 *
 * A template function rather than an element, matching the other `render-*`
 * modules: the card owns the entity and the service calls, this owns only the
 * arrangement. Rendered by both climate cards and by the sheet, so the ± sit in
 * the same place on the card and in the modal.
 */

export type ClimateDialAdjust = (direction: AdjustDirection) => void;

export interface ClimateDialOptions {
  readonly size: QlRingDialSize;
  readonly scale: DialScale;
  readonly setpoints: DialSetpoints;
  readonly mode: DialMode;
  readonly locale: Locale;
  readonly disabled: boolean;
  readonly modeLabel: string;
  /** "77%", pre-formatted by the card — omitted (or '') skips the row. */
  readonly humidityText?: string;
  readonly ambientText: string;
  readonly heroText: string;
  readonly onAdjust: ClimateDialAdjust;
  readonly onInput: (event: CustomEvent<{ value: number; low: number; high: number }>) => void;
  readonly onChange: (
    event: CustomEvent<{ handle: QlRingDialHandle; value: number; low: number; high: number }>,
  ) => void;
}

export const climateDialStyles: CSSResult = css`
  /* 56 + 8 + dial + 8 + 56. The glyphs never shrink — they are thumb targets —
     so the dial is what gives way, down to its own minimum, and below that the
     card has run out of room rather than the control having got smaller. */
  .ql-dial-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--ql-space-s, 8px);
    width: 100%;
    min-width: 0;
  }
  .ql-dial-wrap ql-ring-dial {
    flex: 1 1 auto;
    min-width: 0;
  }
`;

/**
 * The dial flanked by its quick-adjust glyphs.
 *
 * Each glyph disables itself when the setpoint it would move is already on its
 * band's edge, so the pair state exactly what the device will accept.
 */
export function renderClimateDial(options: ClimateDialOptions): TemplateResult {
  const { locale, scale, setpoints, disabled } = options;
  const glyph = (dir: 'minus' | 'plus', direction: AdjustDirection): TemplateResult => html`
    <ql-quick-adjust
      dir=${dir}
      .label=${t(locale, direction === 1 ? 'control.increase' : 'control.decrease')}
      ?disabled=${disabled || !canAdjust(scale, setpoints, direction)}
      @ql-adjust=${(event: CustomEvent<{ direction: AdjustDirection }>): void =>
        options.onAdjust(event.detail.direction)}
    ></ql-quick-adjust>
  `;
  return html`
    <div class="ql-dial-wrap">
      ${glyph('minus', -1)}
      <ql-ring-dial
        size=${options.size}
        mode=${options.mode}
        kind=${setpoints.kind}
        .min=${scale.min}
        .max=${scale.max}
        .step=${scale.step}
        .value=${setpoints.value ?? scale.min}
        .low=${setpoints.low ?? scale.min}
        .high=${setpoints.high ?? scale.max}
        mode-label=${options.modeLabel}
        humidity-text=${options.humidityText ?? ''}
        ambient-text=${options.ambientText}
        hero-text=${options.heroText}
        value-label=${t(locale, 'control.target')}
        low-label=${t(locale, 'control.heat_to')}
        high-label=${t(locale, 'control.cool_to')}
        ?disabled=${disabled}
        @ql-input=${options.onInput}
        @ql-change=${options.onChange}
      ></ql-ring-dial>
      ${glyph('plus', 1)}
    </div>
  `;
}
