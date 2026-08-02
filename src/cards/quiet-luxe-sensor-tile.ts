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
      .top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ql-space-s, 8px);
      }
      .eyebrow {
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .value {
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
    const label = this.config.name ?? t(this.locale(), METRIC_LABEL_KEY[metric]);
    return html`
      <div class="ql-card ${available ? '' : 'ql-unavailable'}">
        <div class="top">
          <p class="eyebrow ql-clamp-1">${label}</p>
          <ql-status-dot .status=${sensorStatus(metric, state)}></ql-status-dot>
        </div>
        <p class="value">${formatSensorValue(metric, state)}</p>
      </div>
    `;
  }
}

registerCard('quiet-luxe-sensor-tile', QuietLuxeSensorTile, {
  name: 'Quiet Luxe Sensor Tile',
  description: 'AQI, temperature, humidity, UV, and rain tile with status thresholds.',
});
