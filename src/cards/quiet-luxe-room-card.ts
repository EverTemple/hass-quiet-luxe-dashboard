import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';
import '../elements/ql-badge';
import '../elements/ql-chip';
import { t } from '../i18n/translate';
import { navigate } from './navigate';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';

export type RoomCardSize = 's' | 'm' | 'l';

export interface RoomCardChipConfig {
  readonly entity: string;
  readonly label?: string;
}

export interface RoomCardConfig {
  readonly type: string;
  readonly name: string;
  readonly image: string;
  readonly size?: RoomCardSize;
  readonly navigation_path?: string;
  readonly temperature_entity?: string;
  readonly aqi_entity?: string;
  readonly lights_entity?: string;
  readonly chips?: ReadonlyArray<RoomCardChipConfig>;
}

const ROWS_BY_SIZE: Readonly<Record<RoomCardSize, number>> = { s: 2, m: 3, l: 4 };

/**
 * Photo room card (Figma `card/room`, spec §6): top + bottom gradient scrims
 * baked in for legibility on any photo (decision #12; scrim stops per the
 * Figma legibility fix), S/M/L density, lights-on glow dot, tappable device
 * chips on the bottom scrim, tap-to-navigate drill-in.
 * Scrim rgba values are Figma-locked and mode-independent by design.
 */
export class QuietLuxeRoomCard extends QlBaseCard {
  static override properties = {
    config: { attribute: false },
  };

  declare config?: RoomCardConfig;

  setConfig(config: RoomCardConfig): void {
    if (typeof config.name !== 'string' || config.name === '') {
      throw new Error('quiet-luxe-room-card: "name" is required');
    }
    if (typeof config.image !== 'string' || config.image === '') {
      throw new Error('quiet-luxe-room-card: "image" is required');
    }
    this.config = config;
  }

  getCardSize(): number {
    return ROWS_BY_SIZE[this.config?.size ?? 'm'];
  }

  getGridOptions(): { rows: number; columns: number } {
    return { rows: this.getCardSize(), columns: 6 };
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .room {
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        border-radius: var(--ql-radius-card, 18px);
        background-size: cover;
        background-position: center;
        cursor: pointer;
      }
      .room[data-size='s'] {
        min-height: 110px;
      }
      .room[data-size='m'] {
        min-height: 190px;
      }
      .room[data-size='l'] {
        min-height: 260px;
      }
      .scrim-top {
        background: linear-gradient(180deg, rgba(8, 6, 4, 0.62) 0%, transparent 45%);
        padding: var(--ql-space-m, 12px);
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .scrim-bottom {
        background: linear-gradient(0deg, rgba(8, 6, 4, 0.82) 0%, transparent 50%);
        padding: var(--ql-space-m, 12px);
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--ql-space-s, 8px);
      }
      .name {
        color: #ffffff;
        font: 500 16px/22px var(--ql-font-body, Outfit, sans-serif);
      }
      .name-s {
        color: #ffffff;
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .stats {
        color: rgba(255, 255, 255, 0.75);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ql-space-xs, 4px);
      }
      .glow-dot {
        flex: none;
        width: 10px;
        height: 10px;
        border-radius: var(--ql-radius-chip, 999px);
        background: radial-gradient(
          circle,
          var(--ql-glow-lamp-inner, #ffd98a),
          var(--ql-glow-lamp-outer, #e0b263)
        );
        box-shadow: 0 0 18px rgba(224, 178, 99, 0.45);
      }
      ql-badge.aqi {
        position: absolute;
        top: var(--ql-space-m, 12px);
        right: var(--ql-space-m, 12px);
      }
    `,
  ];

  private statsLine(): string {
    const parts: string[] = [];
    const tempId = this.config?.temperature_entity;
    if (tempId !== undefined && this.availability(tempId) === 'available') {
      const value = Number(this.entity(tempId)?.state);
      if (Number.isFinite(value)) {
        parts.push(`${value.toFixed(1)}°`);
      }
    }
    const aqi = this.aqiValue();
    if (aqi !== undefined) {
      parts.push(`AQI ${aqi}`);
    }
    return parts.join(' · ');
  }

  private aqiValue(): number | undefined {
    const aqiId = this.config?.aqi_entity;
    if (aqiId === undefined || this.availability(aqiId) !== 'available') {
      return undefined;
    }
    const value = Number(this.entity(aqiId)?.state);
    return Number.isFinite(value) ? Math.round(value) : undefined;
  }

  private lightsOn(): boolean {
    const lightsId = this.config?.lights_entity;
    return (
      lightsId !== undefined &&
      this.availability(lightsId) === 'available' &&
      this.entity(lightsId)?.state === 'on'
    );
  }

  private onTap(): void {
    const path = this.config?.navigation_path;
    if (path !== undefined) {
      navigate(path);
    }
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onTap();
    }
  }

  private onChipTap(event: Event, entityId: string): void {
    event.stopPropagation();
    void this.hass?.callService('homeassistant', 'toggle', { entity_id: entityId });
  }

  private renderChips(): TemplateResult | typeof nothing {
    const chips = this.config?.chips;
    if (chips === undefined || chips.length === 0) {
      return nothing;
    }
    return html`
      <span class="chips">
        ${chips.map((chip) => {
          const availability = this.availability(chip.entity);
          const on = availability === 'available' && this.entity(chip.entity)?.state === 'on';
          return html`
            <ql-chip
              variant="device"
              ?active=${on}
              class=${availability === 'available' ? '' : 'ql-unavailable'}
              @click=${(event: Event): void => this.onChipTap(event, chip.entity)}
              >${chip.label ?? chip.entity}</ql-chip
            >
          `;
        })}
      </span>
    `;
  }

  private renderAqiPill(): TemplateResult | typeof nothing {
    const aqi = this.aqiValue();
    return aqi === undefined ? nothing : html`<ql-badge class="aqi">AQI ${aqi}</ql-badge>`;
  }

  protected override render(): TemplateResult {
    if (this.config === undefined) {
      return html``;
    }
    const size = this.config.size ?? 'm';
    return html`
      <div
        class="room"
        data-size=${size}
        role="button"
        tabindex="0"
        aria-label=${this.config.name}
        style="background-image:url('${this.config.image}')"
        @click=${this.onTap}
        @keydown=${this.onKeydown}
      >
        ${size === 's'
          ? nothing
          : html`
              <div class="scrim-top">
                <span class="name">${this.config.name}</span>
                <span class="stats">${this.statsLine()}</span>
              </div>
            `}
        ${size === 'l' ? this.renderAqiPill() : nothing}
        <div class="scrim-bottom">
          ${size === 's' ? html`<span class="name-s">${this.config.name}</span>` : nothing}
          ${size === 's' ? nothing : this.renderChips()}
          ${this.lightsOn()
            ? html`
                <span
                  class="glow-dot"
                  role="img"
                  aria-label=${t(this.locale(), 'room.lights_on')}
                ></span>
              `
            : nothing}
        </div>
      </div>
    `;
  }
}

registerCard('quiet-luxe-room-card', QuietLuxeRoomCard, {
  name: 'Quiet Luxe Room Card',
  description: 'Photo room card with scrims, device chips, and drill-in navigation.',
});
