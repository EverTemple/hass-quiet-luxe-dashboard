import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import '../elements/ql-chip';
import '../elements/ql-sheet';
import '../elements/ql-sheet-button';
import { pictureGlyph } from '../elements/ql-glyphs';
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
  /**
   * HA area this card stands for. Present enables the background picker, which
   * writes the area's own `picture`. The strategy omits it when the home YAML
   * pins `rooms.<id>.photo`, because that override would win over anything the
   * picker wrote and the control would be a lie.
   */
  readonly area_id?: string;
  readonly temperature_entity?: string;
  readonly humidity_entity?: string;
  readonly aqi_entity?: string;
  readonly lights_entity?: string;
  readonly chips?: ReadonlyArray<RoomCardChipConfig>;
}

const ROWS_BY_SIZE: Readonly<Record<RoomCardSize, number>> = { s: 2, m: 3, l: 4 };

type PhotoState = 'none' | 'pending' | 'loaded' | 'failed';

/**
 * HA area registry write (`homeassistant/components/config/area_registry.py`,
 * verified against HA 2026.7). `picture: null` clears it. Admin only — HA
 * rejects the command for non-admin users, which is why the affordance is not
 * rendered for them.
 */
export const AREA_UPDATE_COMMAND = 'config/area_registry/update';

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
 * Second light on the fallback (Figma `bloom/room-offset`): a champagne bloom
 * set diagonally away from the wash, so the two never stack into one flat
 * gradient. Deliberately allowed past the card edge — the design crops it.
 */
export function bloomOrigin(name: string): { readonly x: number; readonly y: number } {
  const glow = glowOrigin(name);
  return { x: glow.x + 42, y: glow.y + 44 };
}

/**
 * Photo room card (Figma `card/room-v2`, 52:4544). Top + bottom gradient
 * scrims baked in for legibility on any photo, both doubled per the v2
 * legibility fix; S/M/L density; lights-on glow dot; device chips on the
 * bottom scrim; tap-to-navigate drill-in.
 *
 * The image slot is explicit and editable: on M and L an `affordance/edit-image`
 * control opens a sheet that writes the HA **area picture**, so the choice
 * follows the room everywhere in Home Assistant rather than living only in this
 * dashboard's YAML.
 *
 * Scrim rgba values are Figma-locked and mode-independent by design.
 */
export class QuietLuxeRoomCard extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
    photoState: { state: true },
    sheetOpen: { state: true },
    draftImage: { state: true },
    savedImage: { state: true },
    saveFailed: { state: true },
  };

  declare config?: RoomCardConfig;
  declare photoState: PhotoState;
  declare sheetOpen: boolean;
  declare draftImage: string;
  /** Set once the picker has written; `null` means "cleared", so it beats config.image. */
  declare savedImage: string | null | undefined;
  declare saveFailed: boolean;

  constructor() {
    super();
    this.photoState = 'none';
    this.sheetOpen = false;
    this.draftImage = '';
    this.savedImage = undefined;
    this.saveFailed = false;
  }

  setConfig(config: RoomCardConfig): void {
    if (typeof config.name !== 'string' || config.name === '') {
      throw new Error('quiet-luxe-room-card: "name" is required');
    }
    this.config = config;
    this.savedImage = undefined;
    this.photoState = this.photoUrl() === undefined ? 'none' : 'pending';
  }

  /** Undefined when no photo is configured; empty strings count as none. */
  photoUrl(): string | undefined {
    const image = this.savedImage === undefined ? this.config?.image : this.savedImage;
    return typeof image === 'string' && image !== '' ? image : undefined;
  }

  /** True when the card must draw itself instead of a photo. */
  showsFallback(): boolean {
    return this.photoState !== 'loaded';
  }

  /**
   * The picker is offered only when it can actually persist: an area to write
   * to, a card big enough to hold the control, and an admin session — HA's
   * area registry rejects writes from everyone else.
   */
  canEditImage(): boolean {
    return (
      this.config?.area_id !== undefined &&
      (this.config?.size ?? 'm') !== 's' &&
      this.hass?.user?.is_admin === true
    );
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
        border-radius: var(--ql-radius-card, 18px);
        background-color: var(--ql-bg-base, #f4f0e8);
        cursor: pointer;
      }
      .room:focus-visible {
        outline: 2px solid var(--ql-accent-champagne, #b08d57);
        outline-offset: 2px;
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
      /* No photo: a warm wash lit from the room's own corner plus a champagne
         bloom set away from it — the designed state, never a void. */
      .room.fallback {
        border: 1px solid var(--ql-surface-border, #e4dccb);
        background-image:
          radial-gradient(
            120% 95% at var(--glow-x, 40%) var(--glow-y, 24%),
            var(--ql-bg-glow-center, #fffdf4) 0%,
            transparent 64%
          ),
          radial-gradient(
            72% 72% at var(--bloom-x, 82%) var(--bloom-y, 68%),
            rgba(176, 141, 87, 0.22) 0%,
            rgba(176, 141, 87, 0) 70%
          );
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
      /* Doubled scrims (Figma scrim/*-boost): one pass was not enough to hold
         white text over a bright photo. Both stretch with the card. */
      .scrim-top,
      .scrim-bottom {
        position: absolute;
        left: 0;
        right: 0;
        pointer-events: none;
      }
      .scrim-top {
        top: 0;
        height: 125%;
        background-image:
          linear-gradient(180deg, rgba(8, 6, 4, 0.62) 0%, rgba(8, 6, 4, 0) 45%),
          linear-gradient(180deg, rgba(8, 6, 4, 0.62) 0%, rgba(8, 6, 4, 0) 45%);
      }
      .scrim-bottom {
        bottom: 0;
        background-image:
          linear-gradient(0deg, rgba(8, 6, 4, 0.82) 0%, rgba(8, 6, 4, 0) 50%),
          linear-gradient(0deg, rgba(8, 6, 4, 0.82) 0%, rgba(8, 6, 4, 0) 50%);
      }
      .room[data-size='s'] .scrim-bottom {
        height: 56px;
      }
      .room[data-size='m'] .scrim-bottom {
        height: 60px;
      }
      .room[data-size='l'] .scrim-bottom {
        height: 64px;
      }
      .header {
        position: absolute;
        left: var(--ql-space-l, 16px);
        top: 14px;
        right: var(--ql-space-l, 16px);
        display: flex;
        flex-direction: column;
        gap: var(--ql-space-xs, 4px);
        min-width: 0;
      }
      /* The affordance owns the top-right corner; the name stops short of it. */
      .room.editable .header {
        right: 64px;
      }
      .room[data-size='s'] .header {
        top: auto;
        bottom: var(--ql-space-m, 12px);
        left: var(--ql-space-m, 12px);
        right: var(--ql-space-m, 12px);
      }
      .name-row {
        display: flex;
        align-items: center;
        gap: var(--ql-space-s, 8px);
        min-width: 0;
      }
      /* Documented exemption: white over the scrim in both modes. */
      .name {
        color: #ffffff;
        font: 500 16px/22px var(--ql-font-body, Outfit, sans-serif);
      }
      .room[data-size='l'] .name {
        font: 400 24px/30px var(--ql-font-display, Marcellus, serif);
        letter-spacing: 0.04em;
      }
      .room[data-size='s'] .name {
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.02em;
      }
      .stats {
        color: rgba(255, 255, 255, 0.78);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.02em;
      }
      .room.fallback .name {
        color: var(--ql-ink-primary, #2b2620);
      }
      .room.fallback .stats {
        color: var(--ql-ink-muted, #8c8578);
      }
      .chips {
        position: absolute;
        left: var(--ql-space-l, 16px);
        right: var(--ql-space-l, 16px);
        bottom: var(--ql-space-l, 16px);
        display: flex;
        flex-wrap: wrap;
        gap: var(--ql-space-s, 8px);
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
      /* 32px glyph inside a 56px target (Figma affordance/edit-image). The
         design hides it until hover; it is dimmed rather than hidden here,
         because a background control nobody can find is not an easy one to
         use — which was the whole point of adding it. Hover and focus bring it
         to full strength. */
      .edit {
        position: absolute;
        top: 4px;
        right: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: var(--ql-touch-min, 56px);
        height: var(--ql-touch-min, 56px);
        padding: 0;
        border: 0;
        background: transparent;
        color: #ffffff;
        cursor: pointer;
        opacity: 0.55;
        transition: opacity 200ms ease;
      }
      .edit .disc {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: var(--ql-radius-chip, 999px);
        background: rgba(22, 19, 16, 0.55);
      }
      .room.fallback .edit {
        color: var(--ql-ink-muted, #8c8578);
      }
      .room.fallback .edit .disc {
        background: var(--ql-surface-card, #fdfbf6);
        border: 1px solid var(--ql-surface-border, #e4dccb);
      }
      .room:hover .edit,
      .edit:focus-visible {
        opacity: 1;
      }
      .edit:focus-visible {
        outline: 2px solid var(--ql-accent-champagne, #b08d57);
        outline-offset: -6px;
      }
      /* No hover to reveal it, so it never dims. */
      @media (hover: none) {
        .edit {
          opacity: 1;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .photo,
        .edit {
          transition: none;
        }
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--ql-space-s, 8px);
      }
      .field label {
        color: var(--ql-ink-muted, #8c8578);
        font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .field input {
        box-sizing: border-box;
        width: 100%;
        min-height: var(--ql-touch-min, 56px);
        padding: 0 var(--ql-space-l, 16px);
        border: 1px solid var(--ql-surface-border, #e4dccb);
        border-radius: var(--ql-radius-thumb, 12px);
        background: var(--ql-bg-base, #f4f0e8);
        color: var(--ql-ink-primary, #2b2620);
        font: 400 14px/20px var(--ql-font-body, Outfit, sans-serif);
      }
      .field input:focus-visible {
        outline: 2px solid var(--ql-accent-champagne, #b08d57);
        outline-offset: 2px;
      }
      .hint {
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.02em;
      }
      .error {
        margin: 0;
        color: var(--ql-status-alert, #a85b4e);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .preview {
        width: 100%;
        aspect-ratio: 16 / 9;
        object-fit: cover;
        border-radius: var(--ql-radius-thumb, 12px);
        border: 1px solid var(--ql-surface-border, #e4dccb);
      }
    `,
  ];

  private statsLine(): string {
    const parts: string[] = [];
    const numeric = (entityId: string | undefined, format: (value: number) => string): void => {
      if (entityId === undefined || this.availability(entityId) !== 'available') {
        return;
      }
      const value = Number(this.entity(entityId)?.state);
      if (Number.isFinite(value)) {
        parts.push(format(value));
      }
    };
    numeric(this.config?.temperature_entity, (value) => `${value.toFixed(1)}°`);
    numeric(this.config?.humidity_entity, (value) => `${Math.round(value)}%`);
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
    /* The picker's text field is a descendant, so a space typed into it would
       otherwise bubble up here and navigate away mid-edit. */
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onTap();
    }
  }

  private onChipTap(event: Event, entityId: string): void {
    event.stopPropagation();
    void this.hass?.callService('homeassistant', 'toggle', { entity_id: entityId });
  }

  private readonly onEditTap = (event: Event): void => {
    event.stopPropagation();
    this.draftImage = this.photoUrl() ?? '';
    this.saveFailed = false;
    this.sheetOpen = true;
  };

  private readonly onSheetClose = (): void => {
    this.sheetOpen = false;
  };

  private readonly onDraftInput = (event: Event): void => {
    this.draftImage = (event.target as HTMLInputElement).value;
  };

  /**
   * Writes the area's own picture, so every HA surface that shows the area
   * picks the image up — not just this dashboard. `null` clears it.
   */
  async saveImage(picture: string | null): Promise<void> {
    const areaId = this.config?.area_id;
    const callWS = this.hass?.callWS;
    if (areaId === undefined || callWS === undefined) {
      return;
    }
    try {
      await callWS({ type: AREA_UPDATE_COMMAND, area_id: areaId, picture });
    } catch (error) {
      this.saveFailed = true;
      console.error('quiet-luxe-room-card: area picture update failed', error);
      return;
    }
    this.savedImage = picture;
    this.photoState = picture === null ? 'none' : 'pending';
    this.saveFailed = false;
    this.sheetOpen = false;
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

  private renderSheet(): TemplateResult {
    const locale = this.locale();
    const draft = this.draftImage.trim();
    return html`
      <ql-sheet
        .open=${this.sheetOpen}
        heading=${t(locale, 'room.background')}
        close-label=${t(locale, 'common.close')}
        @ql-sheet-close=${this.onSheetClose}
        @click=${(event: Event): void => event.stopPropagation()}
      >
        <div class="field">
          <label for="room-image">${t(locale, 'room.image_url')}</label>
          <input
            id="room-image"
            type="text"
            inputmode="url"
            .value=${this.draftImage}
            placeholder="/local/rooms/living.jpg"
            @input=${this.onDraftInput}
          />
          <p class="hint">${t(locale, 'room.image_hint')}</p>
          ${this.saveFailed ? html`<p class="error">${t(locale, 'room.save_failed')}</p>` : nothing}
        </div>
        ${draft === ''
          ? nothing
          : html`<img class="preview" src=${draft} alt="" aria-hidden="true" />`}
        <ql-sheet-button
          slot="footer"
          @click=${(): void => {
            void this.saveImage(null);
          }}
          >${t(locale, 'room.remove_photo')}</ql-sheet-button
        >
        <ql-sheet-button
          slot="footer"
          emphasis="primary"
          ?disabled=${draft === ''}
          @click=${(): void => {
            void this.saveImage(draft);
          }}
          >${t(locale, 'common.save')}</ql-sheet-button
        >
      </ql-sheet>
    `;
  }

  protected override render(): TemplateResult {
    const config = this.config;
    if (config === undefined) {
      return html``;
    }
    const size = config.size ?? 'm';
    const fallback = this.showsFallback();
    const editable = this.canEditImage();
    const glow = glowOrigin(config.name);
    const bloom = bloomOrigin(config.name);
    const stats = this.statsLine();
    return html`
      <div
        class="room ${fallback ? 'fallback' : ''} ${editable ? 'editable' : ''}"
        data-size=${size}
        role="button"
        tabindex="0"
        aria-label=${config.name}
        style="--glow-x:${glow.x}%;--glow-y:${glow.y}%;--bloom-x:${bloom.x}%;--bloom-y:${bloom.y}%"
        @click=${this.onTap}
        @keydown=${this.onKeydown}
      >
        ${this.renderPhoto()}
        ${fallback || size === 's' ? nothing : html`<span class="scrim-top"></span>`}
        ${fallback ? nothing : html`<span class="scrim-bottom"></span>`}
        <div class="header">
          <span class="name-row">
            ${this.lightsOn()
              ? html`
                  <span
                    class="glow-dot"
                    role="img"
                    aria-label=${t(this.locale(), 'room.lights_on')}
                  ></span>
                `
              : nothing}
            <span class="name ql-clamp-2">${config.name}</span>
          </span>
          ${size === 's' || stats === ''
            ? nothing
            : html`<span class="stats ql-clamp-1">${stats}</span>`}
        </div>
        ${size === 's' ? nothing : this.renderChips()}
        ${editable
          ? html`
              <button
                class="edit"
                type="button"
                aria-label=${t(this.locale(), 'room.edit_background')}
                @click=${this.onEditTap}
              >
                <span class="disc">${pictureGlyph(32)}</span>
              </button>
              ${this.renderSheet()}
            `
          : nothing}
      </div>
    `;
  }
}

registerCard('quiet-luxe-room-card', QuietLuxeRoomCard, {
  name: 'Quiet Luxe Room Card',
  description: 'Photo room card with an editable background, device chips and drill-in navigation.',
});
