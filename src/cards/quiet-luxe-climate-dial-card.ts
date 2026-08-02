import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';
import '../elements/ql-preset-row';
import '../elements/ql-status-dot';
import type { QlRingDialHandle } from '../elements/ql-ring-dial';
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
import { contentGrid, COLUMNS_FULL, type QlGridOptions } from './grid-options';
import { QlBaseCard } from './ql-base-card';
import {
  adjustSetpoints,
  QUICK_ADJUST_COMMIT_DELAY_MS,
  type AdjustDirection,
} from './quick-adjust';
import { registerCard } from './register';
import { climateDialStyles, renderClimateDial } from './render-climate-dial';
import { climateSheetStyles, renderClimateSheet } from './render-climate-sheet';
import { optionLabel, titleCase } from './device-controls';
import { CLIMATE_FEATURE, selectableOptions } from './supported-features';
import { fireMoreInfo } from './more-info';

/** The card's own two sizes. The sheet's dial is a third, owned by the sheet. */
export type ClimateDialForm = 'full' | 'compact';

export interface ClimateDialCardConfig {
  readonly type: string;
  readonly entity: string;
  readonly name?: string;
  /** `compact` is the room-view dial: a smaller ring, and no ticks on it. */
  readonly form?: ClimateDialForm;
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
 * Climate dial card (Figma `card/climate-dial-v2`, 114:2885).
 *
 * The dial is the card: a draggable ring over the entity's own temperature
 * band, a minus and a plus flanking it for the single steps a drag is clumsy
 * at, then the hvac mode row and the fan row beneath. Everything else — swing,
 * preset, humidity — is one tap away behind "More controls", which opens the
 * same sheet the dial itself lives in.
 *
 * Both sizes carry the whole set. The earlier compact card dropped the mode
 * row, the fan row and the sheet, which made a room-view thermostat a
 * read-mostly tile; the only difference now is the ring's diameter.
 *
 * Nothing here is hard-coded to a device: the band, the step, the modes, the
 * fan speeds and every control in the sheet come from what the entity reports.
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
  /** Collapses a burst of quick-adjust taps into one service call. */
  private commitTimer?: number;

  constructor() {
    super();
    this.sheetOpen = false;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.commitTimer);
  }

  setConfig(config: ClimateDialCardConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('quiet-luxe-climate-dial-card: "entity" is required');
    }
    this.config = config;
  }

  getCardSize(): number {
    return this.form() === 'compact' ? 4 : 5;
  }

  /**
   * Both sizes take a whole view column.
   *
   * The compact card is 292px at its narrowest — 56 for the minus, 136 for the
   * ring, 56 for the plus, plus the gaps and the card's own padding — and none
   * of those can give: two of them are thumb targets and the third is the
   * control. Half a view column is about 171px at four columns, so the card
   * used to be asked to draw itself in a box it could not fit. It now asks for
   * the column, and the two forms differ in height rather than width.
   */
  getGridOptions(): QlGridOptions {
    return contentGrid(COLUMNS_FULL);
  }

  form(): ClimateDialForm {
    return this.config?.form === 'compact' ? 'compact' : 'full';
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    climateDialStyles,
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
      /* A named row: the eyebrow says what the segments are for, because "Auto
         / Low / Mid / High" on its own could be a fan or a mode. */
      .group {
        display: flex;
        flex-direction: column;
        gap: var(--ql-space-s, 8px);
        min-width: 0;
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

  /**
   * One quick-adjust press.
   *
   * The numeral moves at once and the call is deferred, because the two have
   * different audiences: the screen answers to the thumb, the thermostat
   * answers to a settled intention. A hold that fires ten presses is one
   * `climate.set_temperature` for the value it landed on, not ten for the
   * values it passed through.
   */
  private readonly onQuickAdjust = (direction: AdjustDirection): void => {
    const scale = climateScale(this.entity(this.entityId()));
    const next = adjustSetpoints(scale, this.setpoints(), direction);
    if (next === undefined) {
      return;
    }
    this.draft = next;
    window.clearTimeout(this.commitTimer);
    this.commitTimer = window.setTimeout(this.commitDraft, QUICK_ADJUST_COMMIT_DELAY_MS);
  };

  private readonly commitDraft = (): void => {
    const draft = this.draft;
    if (draft === undefined) {
      return;
    }
    const call =
      draft.kind === 'range'
        ? setTemperatureCall(this.entityId(), { targetLow: draft.low, targetHigh: draft.high })
        : setTemperatureCall(this.entityId(), { temperature: draft.value });
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

  private readonly onFanMode = (event: CustomEvent<{ value: string }>): void => {
    this.onSheetControl('fan_mode', event.detail.value);
  };

  private readonly openSheet = (): void => {
    this.sheetOpen = true;
  };

  private readonly closeSheet = (): void => {
    this.sheetOpen = false;
  };

  /** HA's own dialog, still one tap away from inside the sheet. */
  private readonly openDetails = (): void => {
    this.sheetOpen = false;
    fireMoreInfo(this, this.entityId());
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
    if (disabled) {
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

  /**
   * The fan row the design has always drawn and the card never showed.
   *
   * Gated on the entity's own `FAN_MODE` bit and its own `fan_modes` list, so
   * the live Sensibo gets its six speeds, a thermostat with no fan control gets
   * no row at all, and neither is a special case in this code.
   */
  private renderFanRow(locale: Locale, disabled: boolean): TemplateResult | typeof nothing {
    if (disabled) {
      return nothing;
    }
    const entity = this.entity(this.entityId());
    const modes = selectableOptions(entity, 'fan_modes', CLIMATE_FEATURE.FAN_MODE);
    if (modes.length === 0) {
      return nothing;
    }
    return html`
      <div class="group">
        <span class="eyebrow">${t(locale, 'control.fan')}</span>
        <ql-preset-row
          .options=${modes.map((mode) => ({ value: mode, label: titleCase(mode) }))}
          .value=${String(entity?.attributes.fan_mode ?? '')}
          .label=${t(locale, 'control.fan')}
          @ql-change=${this.onFanMode}
        ></ql-preset-row>
      </div>
    `;
  }

  private renderMore(locale: Locale, disabled: boolean): TemplateResult | typeof nothing {
    if (climateSheetGroups(this.entity(this.entityId())).length === 0) {
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
    const dial = (size: 'full' | 'compact' | 'sheet'): TemplateResult =>
      renderClimateDial({
        size,
        scale,
        setpoints,
        mode,
        locale,
        disabled: offline,
        modeLabel: t(locale, MODE_LABELS[mode]),
        ambientText: this.captionOf(locale, mode),
        heroText: this.heroOf(mode),
        onAdjust: this.onQuickAdjust,
        onInput: this.onDialInput,
        onChange: this.onDialChange,
      });
    return html`
      <div class="ql-card ${offline ? 'ql-unavailable' : ''}">
        <div class="head">
          <button
            class="ql-info"
            type="button"
            aria-label=${`${label} — ${t(locale, 'control.more')}`}
            @click=${this.openSheet}
          >
            <span class="eyebrow ql-clamp-2">${label}</span>
          </button>
          <ql-status-dot status=${mode === 'off' ? 'neutral' : 'good'}></ql-status-dot>
        </div>
        ${dial(this.form())} ${this.renderModeRow(locale, offline)}
        ${this.renderFanRow(locale, offline)} ${this.renderMore(locale, offline)}
        ${this.sheetOpen
          ? renderClimateSheet({
              open: this.sheetOpen,
              heading: label,
              groups: climateSheetGroups(entity),
              locale,
              disabled: offline,
              emit: this.onSheetControl,
              onClose: this.closeSheet,
              dial: setpoints.kind === 'none' ? undefined : dial('sheet'),
              onDetails: this.openDetails,
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
