import { css, html, type CSSResultGroup, type TemplateResult } from 'lit';
import '../elements/ql-slider';
import { t } from '../i18n/translate';
import { contentGrid, COLUMNS_HALF, type QlGridOptions } from './grid-options';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';

export interface LightCardConfig {
  readonly type: string;
  readonly entity: string;
  readonly name?: string;
}

/**
 * Light card (Figma `card/light`): name head (tap = toggle), brightness
 * numeral + slider, amber glow bulb when on — the glow treatment is reserved
 * exclusively for lights that are on (spec §4).
 */
export class QuietLuxeLightCard extends QlBaseCard {
  static override properties = {
    config: { attribute: false },
  };

  declare config?: LightCardConfig;

  setConfig(config: LightCardConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('quiet-luxe-light-card: "entity" is required');
    }
    this.config = config;
  }

  getCardSize(): number {
    return 2;
  }

  getGridOptions(): QlGridOptions {
    return contentGrid(COLUMNS_HALF);
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .head {
        display: flex;
        align-items: center;
        gap: var(--ql-space-s, 8px);
        border: 0;
        background: transparent;
        padding: 0;
        cursor: pointer;
        color: inherit;
      }
      .eyebrow {
        color: var(--ql-ink-muted, #8c8578);
        font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .bulb {
        width: 14px;
        height: 14px;
        border-radius: var(--ql-radius-chip, 999px);
        background: var(--ql-surface-border, #e4dccb);
        transition:
          background 200ms ease,
          box-shadow 200ms ease;
      }
      .bulb.on {
        background: radial-gradient(
          circle,
          var(--ql-glow-lamp-inner, #ffd98a),
          var(--ql-glow-lamp-outer, #e0b263)
        );
        box-shadow: 0 0 18px rgba(224, 178, 99, 0.45);
      }
      .value {
        margin: var(--ql-space-s, 8px) 0;
        font: 300 26px/30px var(--ql-font-body, Outfit, sans-serif);
      }
      .ql-unavailable .value {
        font-size: 14px;
        line-height: 20px;
      }
    `,
  ];

  private brightnessPct(): number {
    const entityId = this.config?.entity ?? '';
    const entity = this.entity(entityId);
    if (entity?.state !== 'on') {
      return 0;
    }
    const brightness = Number(entity.attributes.brightness);
    if (!Number.isFinite(brightness)) {
      return 100;
    }
    return Math.round((brightness / 255) * 100);
  }

  private onToggle(): void {
    const entityId = this.config?.entity;
    if (entityId === undefined || this.availability(entityId) !== 'available') {
      return;
    }
    void this.hass?.callService('light', 'toggle', { entity_id: entityId });
  }

  private onSlider(event: CustomEvent<{ value: number }>): void {
    const entityId = this.config?.entity;
    if (entityId === undefined || this.hass === undefined) {
      return;
    }
    if (event.detail.value === 0) {
      void this.hass.callService('light', 'turn_off', { entity_id: entityId });
      return;
    }
    void this.hass.callService('light', 'turn_on', {
      entity_id: entityId,
      brightness_pct: event.detail.value,
    });
  }

  protected override render(): TemplateResult {
    if (this.config === undefined) {
      return html``;
    }
    const entityId = this.config.entity;
    const availability = this.availability(entityId);
    const available = availability === 'available';
    const on = available && this.entity(entityId)?.state === 'on';
    const label = this.nameOf(entityId, this.config.name);
    const pct = this.brightnessPct();
    return html`
      <div class="ql-card ${available ? '' : 'ql-unavailable'}">
        <button class="head" aria-pressed=${String(on)} @click=${this.onToggle}>
          <span class="bulb ${on ? 'on' : ''}"></span>
          <span class="eyebrow ql-clamp-2">${label}</span>
        </button>
        <p class="value">${available ? `${pct}%` : t(this.locale(), 'common.unavailable')}</p>
        <ql-slider
          .value=${pct}
          .label=${t(this.locale(), 'light.brightness')}
          ?disabled=${!available}
          @ql-change=${this.onSlider}
        ></ql-slider>
      </div>
    `;
  }
}

registerCard('quiet-luxe-light-card', QuietLuxeLightCard, {
  name: 'Quiet Luxe Light Card',
  description: 'Light card with brightness slider and amber on-glow.',
});
