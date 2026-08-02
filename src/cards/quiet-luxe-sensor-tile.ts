import { css, html, type CSSResultGroup, type TemplateResult } from 'lit';
import '../elements/ql-status-dot';
import type { TranslationKey } from '../i18n/locales/en';
import { t } from '../i18n/translate';
import { contentGrid, COLUMNS_THIRD, type QlGridOptions } from './grid-options';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';
import {
  formatSensorValue,
  SENSOR_METRICS,
  sensorStatus,
  type SensorMetric,
} from './sensor-format';

export interface SensorTileConfig {
  readonly type: string;
  readonly entity: string;
  readonly metric: SensorMetric;
  readonly name?: string;
}

const METRIC_LABEL_KEY: Readonly<Record<SensorMetric, TranslationKey>> = {
  aqi: 'sensor.aqi',
  temp: 'sensor.temp',
  humidity: 'sensor.humidity',
  uv: 'sensor.uv',
  rain: 'sensor.rain',
};

/**
 * Sensor tile (Figma `tile/sensor`): metric eyebrow + numeral + threshold
 * status dot. `metric` is explicit config (no hidden device_class guessing) —
 * the strategy passes it from its own bucketing.
 */
export class QuietLuxeSensorTile extends QlBaseCard {
  static override properties = {
    config: { attribute: false },
  };

  declare config?: SensorTileConfig;

  setConfig(config: SensorTileConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('quiet-luxe-sensor-tile: "entity" is required');
    }
    if (!SENSOR_METRICS.includes(config.metric)) {
      throw new Error(
        `quiet-luxe-sensor-tile: "metric" must be one of ${SENSOR_METRICS.join('|')}`,
      );
    }
    this.config = config;
  }

  getCardSize(): number {
    return 1;
  }

  getGridOptions(): QlGridOptions {
    return contentGrid(COLUMNS_THIRD);
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .ql-card {
        display: flex;
        flex-direction: column;
        gap: var(--ql-space-xs, 4px);
        padding: var(--ql-space-m, 12px);
      }
      /* The tile is nothing but its identity region, so the info button takes
         over the card's own column rhythm rather than nesting a second one. */
      .ql-info {
        display: flex;
        flex-direction: column;
        gap: var(--ql-space-xs, 4px);
      }
      .top {
        display: flex;
        align-items: center;
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
      .value {
        display: block;
        margin: 0;
        font: 300 26px/30px var(--ql-font-body, Outfit, sans-serif);
      }
    `,
  ];

  protected override render(): TemplateResult {
    if (this.config === undefined) {
      return html``;
    }
    const { entity: entityId, metric } = this.config;
    const available = this.availability(entityId) === 'available';
    const state = available ? this.entity(entityId)?.state : undefined;
    const locale = this.locale();
    const label = this.config.name ?? t(locale, METRIC_LABEL_KEY[metric]);
    return html`
      <div class="ql-card ${available ? '' : 'ql-unavailable'}">
        <button
          class="ql-info"
          type="button"
          data-ql-info=${entityId}
          aria-label=${`${label} — ${t(locale, 'common.show_details')}`}
          @click=${this.onMoreInfo}
        >
          <span class="top">
            <span class="eyebrow ql-clamp-1">${label}</span>
            <ql-status-dot .status=${sensorStatus(metric, state)}></ql-status-dot>
          </span>
          <span class="value">${formatSensorValue(metric, state)}</span>
        </button>
      </div>
    `;
  }
}

registerCard('quiet-luxe-sensor-tile', QuietLuxeSensorTile, {
  name: 'Quiet Luxe Sensor Tile',
  description: 'AQI, temperature, humidity, UV, and rain tile with status thresholds.',
});
