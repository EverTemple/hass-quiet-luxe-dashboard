import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';
import '../elements/ql-preset-row';
import '../elements/ql-ring-dial';
import '../elements/ql-status-dot';
import type { QlRingDialHandle, QlRingDialSize } from '../elements/ql-ring-dial';
import { t } from '../i18n/translate';
import type { TranslationKey } from '../i18n/locales/en';
import type { Locale } from '../i18n/types';
import {
  ambientTemperature,
  cardHvacModes,
  climateScale,
  dialMode,
  dialSetpoints,
  setTemperatureCall,
  type DialMode,
  type DialSetpoints,
} from './climate-dial';
import { climateSheetCall, climateSheetGroups, type ClimateControlId } from './climate-sheet';
import { contentGrid, COLUMNS_FULL, COLUMNS_HALF, type QlGridOptions } from './grid-options';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';
import { climateSheetStyles, renderClimateSheet } from './render-climate-sheet';
import { optionLabel } from './device-controls';
import { selectableOptions } from './supported-features';

export interface ClimateDialCardConfig {
  readonly type: string;
  readonly entity: string;
  readonly name?: string;
  /** `compact` is the room-view dial: smaller ring, no ticks, no mode row. */
  readonly form?: QlRingDialSize;
}

/** The eyebrow above the numeral, which names what the device is doing. */
const MODE_LABELS: Readonly<Record<DialMode, TranslationKey>> = {
  heat: 'climate.heating',
  cool: 'climate.cooling',
  heat_cool: 'hvac.auto',
  off: 'hvac.off',
  other: 'state.active',
};

/**
 * Climate dial card (Figma `card/climate-dial`, 55:4707).
 *
 * The dial is the card: a draggable ring over the entity's own temperature
 * band, the hvac mode row beneath it, and everything else — fan, swing, preset,
 * humidity — one tap away behind "More controls". Nothing here is hard-coded to
 * a device: the band, the step and every control in the sheet come from what
 * the entity itself reports.
 */
export class QuietLuxeClimateDialCard extends QlBaseCard {
  static override properties = {
    config: { attribute: false },
    sheetOpen: { state: true },
    /** The setpoint the user is dragging, shown before the device confirms it. */
    draft: { state: true },
  };

  declare config?: ClimateDialCardConfig;
  declare sheetOpen: boolean;
  declare draft?: DialSetpoints;

  constructor() {
    super();
    this.sheetOpen = false;
  }

  setConfig(config: ClimateDialCardConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('quiet-luxe-climate-dial-card: "entity" is required');
    }
    this.config = config;
  }

  getCardSize(): number {
    return this.form() === 'compact' ? 3 : 5;
  }

  /**
   * The full dial takes the whole view column. Half a column is about 230px,
   * which is four mode pills at 26px of label each — every one of them
   * ellipsised. The compact dial carries no mode row and still shares.
   */
  getGridOptions(): QlGridOptions {
    return contentGrid(this.form() === 'compact' ? COLUMNS_HALF : COLUMNS_FULL);
  }

  form(): QlRingDialSize {
    return this.config?.form === 'compact' ? 'compact' : 'full';
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    climateSheetStyles,
    css`
      .ql-card {
        display: flex;
        flex-direction: column;
        gap: var(--ql-space-l, 16px);
      }
      .head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--ql-space-s, 8px);
      }
      .eyebrow {
        display: block;
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      /* The dot is a reading, not a control, so it never takes a tap. */
      ql-status-dot {
        flex: 0 0 auto;
        margin-top: 3px;
      }
      .more {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--ql-space-s, 8px);
        box-sizing: border-box;
        width: 100%;
        min-height: var(--ql-touch-min, 56px);
        padding: var(--ql-space-m, 12px) var(--ql-space-l, 16px);
        border: 1px solid var(--ql-surface-border, #e4dccb);
        border-radius: var(--ql-radius-chip, 999px);
        background: transparent;
        color: var(--ql-ink-primary, #2b2620);
        font: 400 14px/18px var(--ql-font-body, Outfit, sans-serif);
        cursor: pointer;
        transition: border-color 200ms ease;
      }
      .more:hover {
        border-color: var(--ql-accent-champagne, #b08d57);
      }
      .more:focus-visible {
        outline: 2px solid var(--ql-accent-champagne, #b08d57);
        outline-offset: 2px;
      }
      .more .chevron {
        flex: 0 0 auto;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      @media (prefers-reduced-motion: reduce) {
        .more {
          transition: none;
        }
      }
    `,
  ];

  private entityId(): string {
    return this.config?.entity ?? '';
  }

  private call(domain: string, service: string, data: Record<string, unknown>): void {
    void this.hass?.callService(domain, service, data);
  }

  /** The setpoints on screen: the user's uncommitted drag, else the device's. */
  private setpoints(): DialSetpoints {
    return this.draft ?? dialSetpoints(this.entity(this.entityId()));
  }

  private readonly onDialInput = (event: CustomEvent<{ value: number; low: number; high: number }>): void => {
    const committed = dialSetpoints(this.entity(this.entityId()));
    this.draft =
      committed.kind === 'range'
        ? { kind: 'range', low: event.detail.low, high: event.detail.high }
        : { kind: 'single', value: event.detail.value };
  };

  /**
   * A released drag is the intent to set. The draft is held until the entity
   * comes back with the new value, so the numeral does not snap back to the old
   * one while a slow device thinks about it.
   */
  private readonly onDialChange = (
    event: CustomEvent<{ handle: QlRingDialHandle; value: number; low: number; high: number }>,
  ): void => {
    this.onDialInput(event);
    const entityId = this.entityId();
    const committed = dialSetpoints(this.entity(entityId));
    const call =
      committed.kind === 'range'
        ? setTemperatureCall(entityId, {
            targetLow: event.detail.low,
            targetHigh: event.detail.high,
          })
        : setTemperatureCall(entityId, { temperature: event.detail.value });
    if (call !== undefined) {
      this.call(call.domain, call.service, call.data);
    }
  };

  protected override updated(changed: Map<string, unknown>): void {
    if (!changed.has('hass') || this.draft === undefined) {
      return;
    }
    // The device answered with what the drag asked for: stop overriding it.
    const live = dialSetpoints(this.entity(this.entityId()));
    const settled =
      live.kind === this.draft.kind &&
      live.value === this.draft.value &&
      live.low === this.draft.low &&
      live.high === this.draft.high;
    if (settled) {
      this.draft = undefined;
    }
  }

  private readonly onSheetControl = (id: ClimateControlId, value: string | number | boolean): void => {
    const entityId = this.entityId();
    const call = climateSheetCall(entityId, id, value, this.entity(entityId));
    if (call === undefined) {
      return;
    }
    this.call(call.domain, call.service, call.data);
  };

  private readonly onHvacMode = (event: CustomEvent<{ value: string }>): void => {
    this.draft = undefined;
    this.onSheetControl('hvac_mode', event.detail.value);
  };

  private readonly openSheet = (): void => {
    this.sheetOpen = true;
  };

  private readonly closeSheet = (): void => {
    this.sheetOpen = false;
  };

  /** "Now 22.6°" under the setpoint, or the standing setpoint when off. */
  private captionOf(locale: Locale, mode: DialMode): string {
    const entity = this.entity(this.entityId());
    if (mode === 'off') {
      const setpoints = this.setpoints();
      const target = setpoints.kind === 'single' ? setpoints.value : setpoints.high;
      return target === undefined ? '' : `${t(locale, 'climate.set_to')} ${String(target)}°`;
    }
    const ambient = ambientTemperature(entity);
    return ambient === undefined ? '' : `${t(locale, 'climate.now')} ${ambient.toFixed(1)}°`;
  }

  /** Off promotes the room's own reading to the hero numeral. */
  private heroOf(mode: DialMode): string {
    if (mode !== 'off') {
      return '';
    }
    const ambient = ambientTemperature(this.entity(this.entityId()));
    return ambient === undefined ? '—' : `${ambient.toFixed(1)}°`;
  }

  /**
   * `ql-preset-row` has no disabled state — a row that cannot be honoured is
   * not drawn at all, rather than drawn as a control that silently does nothing.
   */
  private renderModeRow(locale: Locale, disabled: boolean): TemplateResult | typeof nothing {
    if (this.form() === 'compact' || disabled) {
      return nothing;
    }
    const entity = this.entity(this.entityId());
    const modes = cardHvacModes(selectableOptions(entity, 'hvac_modes'), entity?.state ?? '');
    if (modes.length === 0) {
      return nothing;
    }
    return html`
      <ql-preset-row
        .options=${modes.map((mode) => ({ value: mode, label: optionLabel(locale, 'hvac_mode', mode) }))}
        .value=${entity?.state ?? ''}
        .label=${t(locale, 'control.hvac_mode')}
        @ql-change=${this.onHvacMode}
      ></ql-preset-row>
    `;
  }

  private renderMore(locale: Locale, disabled: boolean): TemplateResult | typeof nothing {
    if (this.form() === 'compact' || climateSheetGroups(this.entity(this.entityId())).length === 0) {
      return nothing;
    }
    return html`
      <button class="more" type="button" ?disabled=${disabled} @click=${this.openSheet}>
        ${t(locale, 'control.more')}
        <svg class="chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 3.5 10.5 8 6 12.5" />
        </svg>
      </button>
    `;
  }

  protected override render(): TemplateResult {
    if (this.config === undefined) {
      return html``;
    }
    const entityId = this.config.entity;
    const entity = this.entity(entityId);
    const availability = this.availability(entityId);
    const offline = availability !== 'available';
    const locale = this.locale();
    const label = this.nameOf(entityId, this.config.name);
    const mode = offline ? 'off' : dialMode(entity);
    const scale = climateScale(entity);
    const setpoints = this.setpoints();
    return html`
      <div class="ql-card ${offline ? 'ql-unavailable' : ''}">
        <div class="head">
          <button
            class="ql-info"
            type="button"
            data-ql-info=${entityId}
            aria-label=${`${label} — ${t(locale, 'common.show_details')}`}
            @click=${this.onMoreInfo}
          >
            <span class="eyebrow ql-clamp-2">${label}</span>
          </button>
          <ql-status-dot status=${mode === 'off' ? 'neutral' : 'good'}></ql-status-dot>
        </div>
        <ql-ring-dial
          size=${this.form()}
          mode=${mode}
          kind=${setpoints.kind}
          .min=${scale.min}
          .max=${scale.max}
          .step=${scale.step}
          .value=${setpoints.value ?? scale.min}
          .low=${setpoints.low ?? scale.min}
          .high=${setpoints.high ?? scale.max}
          mode-label=${t(locale, MODE_LABELS[mode])}
          ambient-text=${this.captionOf(locale, mode)}
          hero-text=${this.heroOf(mode)}
          value-label=${t(locale, 'control.target')}
          low-label=${t(locale, 'control.heat_to')}
          high-label=${t(locale, 'control.cool_to')}
          ?disabled=${offline}
          @ql-input=${this.onDialInput}
          @ql-change=${this.onDialChange}
        ></ql-ring-dial>
        ${this.renderModeRow(locale, offline)} ${this.renderMore(locale, offline)}
        ${this.sheetOpen
          ? renderClimateSheet({
              open: this.sheetOpen,
              heading: label,
              groups: climateSheetGroups(entity),
              locale,
              disabled: offline,
              emit: this.onSheetControl,
              onClose: this.closeSheet,
            })
          : nothing}
      </div>
    `;
  }
}

registerCard('quiet-luxe-climate-dial-card', QuietLuxeClimateDialCard, {
  name: 'Quiet Luxe Climate Dial Card',
  description: 'Thermostat dial with drag, keyboard and a capability-gated control sheet.',
});
