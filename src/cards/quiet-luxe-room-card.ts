import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';
import '../elements/ql-badge';
import '../elements/ql-chip';
import { t } from '../i18n/translate';
import { navigate } from './navigate';
import { contentGrid, COLUMNS_HALF_OF_WIDE_SECTION, type QlGridOptions } from './grid-options';
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
  /** Omitted when the home has no photo for the room — the card falls back. */
  readonly image?: string;
  readonly size?: RoomCardSize;
  readonly navigation_path?: string;
  readonly temperature_entity?: string;
  readonly aqi_entity?: string;
  readonly lights_entity?: string;
  readonly chips?: ReadonlyArray<RoomCardChipConfig>;
}

const ROWS_BY_SIZE: Readonly<Record<RoomCardSize, number>> = { s: 2, m: 3, l: 4 };

type PhotoState = 'none' | 'pending' | 'loaded' | 'failed';

/**
 * Where the light falls on a photo-less card. Derived from the room name so a
 * wall of fallbacks reads as several rooms lit from their own windows rather
 * than one tile repeated — the only variation the fallback allows itself.
 */
export function glowOrigin(name: string): { readonly x: number; readonly y: number } {
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % 9973;
  }
  return { x: 20 + (hash % 60), y: 14 + (Math.floor(hash / 7) % 34) };
}

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
    photoState: { state: true },
  };

  declare config?: RoomCardConfig;
  declare photoState: PhotoState;

  constructor() {
    super();
    this.photoState = 'none';
  }

  setConfig(config: RoomCardConfig): void {
    if (typeof config.name !== 'string' || config.name === '') {
      throw new Error('quiet-luxe-room-card: "name" is required');
    }
    this.config = config;
    this.photoState = this.photoUrl() === undefined ? 'none' : 'pending';
  }

  /** Undefined when no photo is configured; empty strings count as none. */
  photoUrl(): string | undefined {
    const image = this.config?.image;
    return typeof image === 'string' && image !== '' ? image : undefined;
  }

  /** True when the card must draw itself instead of a photo. */
  showsFallback(): boolean {
    return this.photoState !== 'loaded';
  }

  getCardSize(): number {
    return ROWS_BY_SIZE[this.config?.size ?? 'm'];
  }

  getGridOptions(): QlGridOptions {
    return contentGrid(COLUMNS_HALF_OF_WIDE_SECTION);
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
        background-color: var(--ql-bg-base, #f4f0e8);
        cursor: pointer;
      }
      .photo {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
        transition: opacity 320ms ease;
      }
      .photo.loaded {
        opacity: 1;
      }
      /* No photo: a warm wash lit from the room's own corner, never a void. */
      .room.fallback {
        border: 1px solid var(--ql-surface-border, #e4dccb);
        background-image:
          radial-gradient(
            120% 95% at var(--glow-x, 40%) var(--glow-y, 24%),
            var(--ql-bg-glow-center, #fffdf4) 0%,
            transparent 64%
          ),
          linear-gradient(158deg, rgba(176, 141, 87, 0.18) 0%, rgba(176, 141, 87, 0) 58%);
      }
      .room.fallback .scrim-top,
      .room.fallback .scrim-bottom {
        background: none;
      }
      .room.fallback .name,
      .room.fallback .name-s {
        color: var(--ql-ink-primary, #2b2620);
      }
      .room.fallback .stats {
        color: var(--ql-ink-muted, #8c8578);
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
        position: relative;
        background: linear-gradient(180deg, rgba(8, 6, 4, 0.62) 0%, transparent 45%);
        padding: var(--ql-space-m, 12px);
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .scrim-bottom {
        position: relative;
        background: linear-gradient(0deg, rgba(8, 6, 4, 0.82) 0%, transparent 50%);
        padding: var(--ql-space-m, 12px);
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--ql-space-s, 8px);
        min-width: 0;
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
        min-width: 0;
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
              >${this.nameOf(chip.entity, chip.label)}</ql-chip
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

  private renderPhoto(): TemplateResult | typeof nothing {
    const url = this.photoUrl();
    if (url === undefined) {
      return nothing;
    }
    return html`
      <img
        class="photo ${this.photoState === 'loaded' ? 'loaded' : ''}"
        src=${url}
        alt=""
        aria-hidden="true"
        @load=${(): void => {
          this.photoState = 'loaded';
        }}
        @error=${(): void => {
          this.photoState = 'failed';
        }}
      />
    `;
  }

  protected override render(): TemplateResult {
    if (this.config === undefined) {
      return html``;
    }
    const size = this.config.size ?? 'm';
    const fallback = this.showsFallback();
    const glow = glowOrigin(this.config.name);
    return html`
      <div
        class="room ${fallback ? 'fallback' : ''}"
        data-size=${size}
        role="button"
        tabindex="0"
        aria-label=${this.config.name}
        style="--glow-x:${glow.x}%;--glow-y:${glow.y}%"
        @click=${this.onTap}
        @keydown=${this.onKeydown}
      >
        ${this.renderPhoto()}
        ${size === 's'
          ? nothing
          : html`
              <div class="scrim-top">
                <span class="name ql-clamp-2">${this.config.name}</span>
                <span class="stats ql-clamp-1">${this.statsLine()}</span>
              </div>
            `}
        ${size === 'l' ? this.renderAqiPill() : nothing}
        <div class="scrim-bottom">
          ${size === 's' ? html`<span class="name-s ql-clamp-2">${this.config.name}</span>` : nothing}
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
