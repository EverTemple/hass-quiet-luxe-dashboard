import { css, html, type CSSResultGroup, type TemplateResult } from 'lit';
import { t } from '../i18n/translate';
import {
  climateActivity,
  detectClimateDeviceType,
  type ClimateDeviceType,
} from './climate-device-type';
import { controlServiceCall, deviceControls, type ControlId } from './device-controls';
import { contentGrid, COLUMNS_HALF, type QlGridOptions } from './grid-options';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';
import { renderControls } from './render-controls';

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
  };

  declare config?: ClimateCardConfig;
  declare armed: boolean;
  private disarmTimer?: number;

  constructor() {
    super();
    this.armed = false;
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
   * One inline control moved. The payload is built from the entity's own
   * state, so a control the device cannot actually take is never sent.
   */
  private onControl(id: ControlId, value: string | number | boolean): void {
    const entityId = this.config?.entity;
    if (entityId === undefined || this.hass === undefined) {
      return;
    }
    const call = controlServiceCall(entityId, id, value, this.entity(entityId));
    if (call === undefined) {
      return;
    }
    void this.hass.callService(call.domain, call.service, call.data);
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
        ${renderControls(
          deviceControls(this.entity(entityId)),
          locale,
          availability !== 'available',
          (id, value) => this.onControl(id, value),
        )}
      </div>
    `;
  }
}

registerCard('quiet-luxe-climate-card', QuietLuxeClimateCard, {
  name: 'Quiet Luxe Climate Card',
  description: 'AC, purifier, dehumidifier, fan, and exhaust card with confirm-optional power.',
});
