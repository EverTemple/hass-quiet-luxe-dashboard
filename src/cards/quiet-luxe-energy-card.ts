import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import { t } from '../i18n/translate';
import { formatEnergy, formatPower, ringDasharray } from './energy-format';
import { contentGrid, COLUMNS_FULL, COLUMNS_THIRD, type QlGridOptions } from './grid-options';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';

export type EnergyCardForm = 'strip' | 'ring';

export const DEFAULT_RING_MAX_W = 4600;
export const RING_RADIUS = 20;

export interface EnergyCardConfig {
  readonly type: string;
  readonly form?: EnergyCardForm;
  /** Power sensor in W. */
  readonly power_entity: string;
  /** Today's energy sensor in kWh (strip form). */
  readonly today_entity?: string;
  /** Ring label, e.g. the phase name ("L1"). */
  readonly name?: string;
  /** Full-scale W for the ring donut. */
  readonly max_power?: number;
}

/**
 * Energy card (Figma `card/energy`): form=strip (live power + today kWh) |
 * ring (per-phase SVG donut). History charts are deliberately NOT implemented
 * here — plan decision D1 delegates them to apexcharts-card via the strategy.
 */
export class QuietLuxeEnergyCard extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
  };

  declare config?: EnergyCardConfig;

  setConfig(config: EnergyCardConfig): void {
    if (typeof config.power_entity !== 'string' || config.power_entity === '') {
      throw new Error('quiet-luxe-energy-card: "power_entity" is required');
    }
    const form = config.form ?? 'strip';
    if (form !== 'strip' && form !== 'ring') {
      throw new Error(
        'quiet-luxe-energy-card: form must be "strip" or "ring" — history charts are delegated to apexcharts-card (plan D1)',
      );
    }
    this.config = config;
  }

  form(): EnergyCardForm {
    return this.config?.form ?? 'strip';
  }

  getCardSize(): number {
    return this.form() === 'ring' ? 2 : 1;
  }

  getGridOptions(): QlGridOptions {
    return contentGrid(this.form() === 'ring' ? COLUMNS_THIRD : COLUMNS_FULL);
  }

  private powerWatts(): number | undefined {
    const entityId = this.config?.power_entity ?? '';
    if (this.availability(entityId) !== 'available') {
      return undefined;
    }
    const value = Number(this.entity(entityId)?.state);
    return Number.isFinite(value) ? value : undefined;
  }

  private todayKwh(): number | undefined {
    const entityId = this.config?.today_entity;
    if (entityId === undefined || this.availability(entityId) !== 'available') {
      return undefined;
    }
    const value = Number(this.entity(entityId)?.state);
    return Number.isFinite(value) ? value : undefined;
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .strip {
        display: flex;
        align-items: baseline;
        gap: var(--ql-space-m, 12px);
      }
      .bolt {
        color: var(--ql-accent-champagne, #b08d57);
        font-size: 16px;
      }
      /* Both forms hang the more-info tap off the live power reading: the ring
         separates its label from its numeral with the donut, and the strip has
         no label at all. An explicit auto width keeps the pill inside the
         flex line rather than stretching it across the card. */
      .ql-info {
        width: auto;
      }
      .value {
        display: block;
        margin: 0;
        font: 300 26px/30px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.01em;
      }
      .caption {
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .ring {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--ql-space-s, 8px);
      }
      svg {
        width: 72px;
        height: 72px;
      }
      circle.track {
        fill: none;
        stroke: var(--ql-surface-border, #e4dccb);
        stroke-width: 4;
      }
      circle.progress {
        fill: none;
        stroke: var(--ql-accent-champagne, #b08d57);
        stroke-width: 4;
        stroke-linecap: round;
      }
      .eyebrow {
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
    `,
  ];

  protected override render(): TemplateResult {
    const config = this.config;
    if (config === undefined) {
      return html``;
    }
    const locale = this.locale();
    const watts = this.powerWatts();
    const unavailable = this.availability(config.power_entity) !== 'available';
    const cardClass = unavailable ? 'ql-card ql-unavailable' : 'ql-card';
    const infoLabel = `${this.nameOf(config.power_entity, config.name)} — ${t(locale, 'common.show_details')}`;
    if (this.form() === 'ring') {
      return html`
        <div class="${cardClass} ring">
          ${config.name === undefined ? nothing : html`<p class="eyebrow ql-clamp-1">${config.name}</p>`}
          <svg viewBox="0 0 48 48" role="img" aria-label=${config.name ?? config.power_entity}>
            <circle class="track" cx="24" cy="24" r=${RING_RADIUS}></circle>
            <circle
              class="progress"
              cx="24"
              cy="24"
              r=${RING_RADIUS}
              stroke-dasharray=${ringDasharray(
                watts ?? 0,
                config.max_power ?? DEFAULT_RING_MAX_W,
                RING_RADIUS,
              )}
              transform="rotate(-90 24 24)"
            ></circle>
          </svg>
          <button
            class="ql-info"
            type="button"
            data-ql-info=${config.power_entity}
            aria-label=${infoLabel}
            @click=${this.onMoreInfo}
          >
            <span class="value">${formatPower(watts)}</span>
          </button>
        </div>
      `;
    }
    const today = this.todayKwh();
    return html`
      <div class="${cardClass} strip">
        <span class="bolt" aria-hidden="true">⚡</span>
        <button
          class="ql-info"
          type="button"
          data-ql-info=${config.power_entity}
          aria-label=${infoLabel}
          @click=${this.onMoreInfo}
        >
          <span class="value">${formatPower(watts)}</span>
        </button>
        ${config.today_entity === undefined
          ? nothing
          : html`<p class="caption">${formatEnergy(today)} · ${t(locale, 'energy.today')}</p>`}
      </div>
    `;
  }
}

registerCard('quiet-luxe-energy-card', QuietLuxeEnergyCard, {
  name: 'Quiet Luxe Energy Card',
  description: 'Live power strip or per-phase ring. History charts via apexcharts-card.',
});
