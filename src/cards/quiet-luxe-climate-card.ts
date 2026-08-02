import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';
import { t } from '../i18n/translate';
import type { Locale } from '../i18n/types';
import {
  climateActivity,
  detectClimateDeviceType,
  type ClimateDeviceType,
} from './climate-device-type';
import { climateSheetCall, climateSheetGroups, type ClimateControlId } from './climate-sheet';
import { contentGrid, COLUMNS_HALF, type QlGridOptions } from './grid-options';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';
import { climateSheetStyles, renderClimateSheet } from './render-climate-sheet';

export interface ClimateCardConfig {
  readonly type: string;
  readonly entity: string;
  readonly name?: string;
  readonly device_type?: ClimateDeviceType;
  readonly value_entity?: string;
  readonly confirm?: boolean;
}

export const CONFIRM_TIMEOUT_MS = 3000;

/**
 * Climate card (Figma `card/climate`): ac|purifier|dehumidifier|fan|exhaust ×
 * active|idle|off. Device type auto-detected from the entity domain with an
 * explicit `device_type` override; optional confirm-on-tap arms for 3s before
 * the power toggle fires (spec §9 confirm rule for consequential actions).
 */
export class QuietLuxeClimateCard extends QlBaseCard {
  static override properties = {
    config: { attribute: false },
    armed: { state: true },
    sheetOpen: { state: true },
  };

  declare config?: ClimateCardConfig;
  declare armed: boolean;
  declare sheetOpen: boolean;
  private disarmTimer?: number;

  constructor() {
    super();
    this.armed = false;
    this.sheetOpen = false;
  }

  setConfig(config: ClimateCardConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('quiet-luxe-climate-card: "entity" is required');
    }
    this.config = config;
  }

  getCardSize(): number {
    return 2;
  }

  getGridOptions(): QlGridOptions {
    return contentGrid(COLUMNS_HALF);
  }

  deviceType(): ClimateDeviceType {
    return this.config?.device_type ?? detectClimateDeviceType(this.config?.entity ?? '');
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.disarmTimer);
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    climateSheetStyles,
    css`
      .eyebrow {
        display: block;
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .value {
        display: block;
        margin: var(--ql-space-s, 8px) 0 0;
        font: 300 26px/30px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.01em;
      }
      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: var(--ql-space-s, 8px);
      }
      .status {
        margin: 0;
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .status.accent {
        color: var(--ql-accent-champagne, #b08d57);
      }
      .status.muted {
        color: var(--ql-ink-muted, #8c8578);
      }
      .status.warn {
        color: var(--ql-status-warn, #c08552);
      }
      .power {
        width: 36px;
        height: 36px;
        border-radius: var(--ql-radius-chip, 999px);
        border: 1px solid var(--ql-surface-border, #e4dccb);
        background: var(--ql-surface-card, #fdfbf6);
        color: var(--ql-ink-primary, #2b2620);
        cursor: pointer;
        font: 400 14px/1 var(--ql-font-body, Outfit, sans-serif);
      }
      .power:disabled {
        opacity: 0.5;
        cursor: default;
      }
      /* Same affordance as the dial card's, so "there is more here" reads the
         same on a thermostat and on a dehumidifier. */
      .more {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--ql-space-s, 8px);
        box-sizing: border-box;
        width: 100%;
        min-height: var(--ql-touch-min, 56px);
        margin-top: var(--ql-space-m, 12px);
        padding: var(--ql-space-m, 12px) var(--ql-space-l, 16px);
        border: 1px solid var(--ql-surface-border, #e4dccb);
        border-radius: var(--ql-radius-chip, 999px);
        background: transparent;
        color: var(--ql-ink-primary, #2b2620);
        font: 400 14px/18px var(--ql-font-body, Outfit, sans-serif);
        cursor: pointer;
        transition: border-color 200ms ease;
      }
      .more:hover:not(:disabled) {
        border-color: var(--ql-accent-champagne, #b08d57);
      }
      .more:focus-visible {
        outline: 2px solid var(--ql-accent-champagne, #b08d57);
        outline-offset: 2px;
      }
      .more:disabled {
        opacity: 0.5;
        cursor: default;
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

  private onPowerTap(): void {
    if (this.config?.confirm === true && !this.armed) {
      this.armed = true;
      this.disarmTimer = window.setTimeout(() => {
        this.armed = false;
      }, CONFIRM_TIMEOUT_MS);
      return;
    }
    window.clearTimeout(this.disarmTimer);
    this.armed = false;
    this.callToggle();
  }

  /**
   * One sheet control moved. The payload is built from the entity's own state,
   * so a control the device cannot actually take is never sent.
   */
  private readonly onControl = (id: ClimateControlId, value: string | number | boolean): void => {
    const entityId = this.config?.entity;
    if (entityId === undefined || this.hass === undefined) {
      return;
    }
    const call = climateSheetCall(entityId, id, value, this.entity(entityId));
    if (call === undefined) {
      return;
    }
    void this.hass.callService(call.domain, call.service, call.data);
  };

  private readonly openSheet = (): void => {
    this.sheetOpen = true;
  };

  private readonly closeSheet = (): void => {
    this.sheetOpen = false;
  };

  /**
   * The whole control surface lives behind one button. A dehumidifier's four
   * vendor modes and a 40–70 humidity band do not fit a half-column card
   * legibly, and the sheet gives every device the same full-width room.
   */
  private renderMore(locale: Locale, disabled: boolean): TemplateResult | typeof nothing {
    if (climateSheetGroups(this.entity(this.config?.entity ?? '')).length === 0) {
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

  private callToggle(): void {
    const entityId = this.config?.entity;
    if (entityId === undefined || this.hass === undefined) {
      return;
    }
    const domain = entityId.split('.')[0] ?? '';
    if (domain === 'climate') {
      const service = this.entity(entityId)?.state === 'off' ? 'turn_on' : 'turn_off';
      void this.hass.callService('climate', service, { entity_id: entityId });
      return;
    }
    void this.hass.callService(domain, 'toggle', { entity_id: entityId });
  }

  private valueText(): string {
    const config = this.config;
    if (config === undefined) {
      return '—';
    }
    const valueId = config.value_entity ?? config.entity;
    if (this.availability(valueId) !== 'available') {
      return '—';
    }
    const entity = this.entity(valueId);
    if (config.value_entity === undefined && valueId.startsWith('climate.')) {
      const temp = Number(entity?.attributes.current_temperature);
      return Number.isFinite(temp) ? `${temp.toFixed(1)}°` : '—';
    }
    const numeric = Number(entity?.state);
    if (Number.isFinite(numeric)) {
      return String(Math.round(numeric));
    }
    if (entity?.state === 'on') {
      return t(this.locale(), 'common.on');
    }
    if (entity?.state === 'off') {
      return t(this.locale(), 'common.off');
    }
    return '—';
  }

  private statusLine(): { text: string; cls: string } {
    const locale = this.locale();
    const entityId = this.config?.entity ?? '';
    if (this.availability(entityId) !== 'available') {
      return { text: t(locale, 'common.unavailable'), cls: 'muted' };
    }
    if (this.armed) {
      return { text: t(locale, 'common.tap_confirm'), cls: 'warn' };
    }
    const entity = this.entity(entityId);
    const activity = entity === undefined ? 'off' : climateActivity(entity);
    if (activity === 'active') {
      return { text: t(locale, 'state.active'), cls: 'accent' };
    }
    if (activity === 'idle') {
      return { text: t(locale, 'state.idle'), cls: 'muted' };
    }
    return { text: t(locale, 'common.off'), cls: 'muted' };
  }

  protected override render(): TemplateResult {
    if (this.config === undefined) {
      return html``;
    }
    const entityId = this.config.entity;
    const availability = this.availability(entityId);
    const locale = this.locale();
    const label = this.nameOf(entityId, this.config.name);
    const status = this.statusLine();
    return html`
      <div
        class="ql-card ${availability === 'available' ? '' : 'ql-unavailable'}"
        data-device=${this.deviceType()}
      >
        <button
          class="ql-info"
          type="button"
          data-ql-info=${entityId}
          aria-label=${`${label} — ${t(locale, 'common.show_details')}`}
          @click=${this.onMoreInfo}
        >
          <span class="eyebrow ql-clamp-2">${label}</span>
          <span class="value">${this.valueText()}</span>
        </button>
        <div class="row">
          <p class="status ${status.cls}">${status.text}</p>
          <button
            class="power"
            aria-label=${t(locale, 'common.power')}
            ?disabled=${availability !== 'available'}
            @click=${this.onPowerTap}
          >
            ⏻
          </button>
        </div>
        ${this.renderMore(locale, availability !== 'available')}
        ${this.sheetOpen
          ? renderClimateSheet({
              open: this.sheetOpen,
              heading: label,
              groups: climateSheetGroups(this.entity(entityId)),
              locale,
              disabled: availability !== 'available',
              emit: this.onControl,
              onClose: this.closeSheet,
            })
          : nothing}
      </div>
    `;
  }
}

registerCard('quiet-luxe-climate-card', QuietLuxeClimateCard, {
  name: 'Quiet Luxe Climate Card',
  description: 'AC, purifier, dehumidifier, fan, and exhaust card with confirm-optional power.',
});
