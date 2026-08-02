import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import '../elements/ql-status-dot';
import { cameraGlyph } from '../elements/ql-glyphs';
import { t } from '../i18n/translate';
import { contentGrid, COLUMNS_HALF_OF_WIDE_SECTION, type QlGridOptions } from './grid-options';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';

export type CameraCardSize = 'm' | 'l';
export type CameraCardState = 'live' | 'motion' | 'unavailable';

export const DEFAULT_CAMERA_REFRESH_S = 10;

export interface CameraCardConfig {
  readonly type: string;
  readonly entity: string;
  /** m = 330×190, l = 420×260 — the room-card footprints (Figma 49:4469). */
  readonly size?: CameraCardSize;
  readonly name?: string;
  /** binary_sensor.* motion companion; `on` promotes the card to state=motion. */
  readonly motion_entity?: string;
  /** Snapshot refresh interval in seconds. */
  readonly refresh_interval?: number;
}

/**
 * Camera card (Figma `card/camera-v2`, 49:4469). Supersedes the v1 glance
 * form, whose 60×34 thumbnail showed nothing: the image now fills a card the
 * size of a room card (M 330×190, L 420×260), clipped to `radius/card`.
 *
 * Three states, all deliberate surfaces:
 * - `live` — 16:9 frame, doubled bottom scrim, white name bottom-left, LIVE
 *   badge top-right on dark glass. The scrim is doubled because one pass was
 *   not enough to hold the name over a bright frame (the same fix the room
 *   card needed).
 * - `motion` — live plus a 2px champagne inside stroke and a Motion chip.
 * - `unavailable` — a muted card carrying a camera glyph and a caption. It is
 *   drawn, not omitted: an empty grey box is what a broken card looks like.
 *
 * Snapshot strategy per plan D3: render the entity's own signed entity_picture
 * (/api/camera_proxy/… with token) plus a `time` cache-buster (documented REST
 * param), refreshed on an interval.
 */
export class QuietLuxeCameraCard extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
    tick: { state: true },
    snapshotFailed: { state: true },
  };

  declare config?: CameraCardConfig;
  declare tick: number;
  declare snapshotFailed: boolean;
  private refreshTimer?: number;

  constructor() {
    super();
    this.tick = 0;
    this.snapshotFailed = false;
  }

  setConfig(config: CameraCardConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('quiet-luxe-camera-card: "entity" is required');
    }
    if (config.size !== undefined && config.size !== 'm' && config.size !== 'l') {
      throw new Error('quiet-luxe-camera-card: "size" must be "m" or "l"');
    }
    this.config = config;
    this.startTimer();
  }

  size(): CameraCardSize {
    return this.config?.size ?? 'm';
  }

  /** live | motion | unavailable — the Figma state axis, derived from hass. */
  cameraState(): CameraCardState {
    const config = this.config;
    if (config === undefined) {
      return 'unavailable';
    }
    if (this.availability(config.entity) !== 'available') {
      return 'unavailable';
    }
    if (this.snapshotFailed || !this.hasSnapshot()) {
      return 'unavailable';
    }
    return this.motionDetected() ? 'motion' : 'live';
  }

  getCardSize(): number {
    return this.size() === 'l' ? 4 : 3;
  }

  /* Same footprint as a room card: one full view column, which is half of the
     two-column camera section and full width once the view collapses. */
  getGridOptions(): QlGridOptions {
    return contentGrid(COLUMNS_HALF_OF_WIDE_SECTION);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.startTimer();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.refreshTimer);
    this.refreshTimer = undefined;
  }

  private startTimer(): void {
    window.clearInterval(this.refreshTimer);
    this.refreshTimer = undefined;
    if (!this.isConnected || this.config === undefined) {
      return;
    }
    const seconds = this.config.refresh_interval ?? DEFAULT_CAMERA_REFRESH_S;
    this.refreshTimer = window.setInterval(() => {
      this.tick += 1;
      this.snapshotFailed = false;
    }, seconds * 1000);
  }

  private motionDetected(): boolean {
    const motionId = this.config?.motion_entity;
    return (
      motionId !== undefined &&
      this.availability(motionId) === 'available' &&
      this.entity(motionId)?.state === 'on'
    );
  }

  private picture(): string | undefined {
    return this.entity(this.config?.entity ?? '')?.attributes.entity_picture as string | undefined;
  }

  private hasSnapshot(): boolean {
    return this.picture() !== undefined;
  }

  /** Cache-busted once per render; `tick` is what makes the interval refresh. */
  private snapshotUrl(): string | undefined {
    const picture = this.picture();
    if (picture === undefined) {
      return undefined;
    }
    const separator = picture.includes('?') ? '&' : '?';
    return `${picture}${separator}time=${Date.now()}`;
  }

  private readonly onSnapshotError = (): void => {
    this.snapshotFailed = true;
  };

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .camera {
        position: relative;
        display: block;
        width: 100%;
        box-sizing: border-box;
        border: 0;
        padding: 0;
        border-radius: var(--ql-radius-card, 18px);
        /* Documented exemption, same family as the scrims: a fixed near-black
           behind the frame in both modes. Without it the card is a bright empty
           rectangle for as long as the snapshot takes to arrive, and the white
           name and LIVE badge sit on nothing. */
        background: #161310;
        /* The image is clipped to the card, so nothing squares off a corner. */
        overflow: hidden;
        text-align: left;
        color: inherit;
        font: inherit;
        cursor: pointer;
      }
      .camera[data-size='m'] {
        min-height: 190px;
      }
      .camera[data-size='l'] {
        min-height: 260px;
      }
      .camera:focus-visible {
        outline: 2px solid var(--ql-accent-champagne, #b08d57);
        outline-offset: 2px;
      }
      .frame {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      /* Doubled scrim (Figma scrim/bottom + scrim/bottom-boost): one pass left
         the white name unreadable over a bright frame. Two identical gradient
         layers composite to the same result as the two stacked rectangles in
         the design, without a second element. Stretches with the card. */
      .scrim {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        background-image:
          linear-gradient(0deg, rgba(8, 6, 4, 0.82) 0%, rgba(8, 6, 4, 0) 50%),
          linear-gradient(0deg, rgba(8, 6, 4, 0.82) 0%, rgba(8, 6, 4, 0) 50%);
      }
      .camera[data-size='m'] .scrim {
        height: 72px;
      }
      .camera[data-size='l'] .scrim {
        height: 88px;
      }
      /* Documented exemption: white on the scrim in both modes — the scrim is
         a fixed near-black, so the name never inherits the page's ink. */
      .name {
        position: absolute;
        left: var(--ql-space-m, 12px);
        right: var(--ql-space-m, 12px);
        bottom: var(--ql-space-m, 12px);
        margin: 0;
        color: #ffffff;
        font: 500 16px/22px var(--ql-font-body, Outfit, sans-serif);
      }
      .camera[data-size='l'] .name {
        left: var(--ql-space-l, 16px);
        right: var(--ql-space-l, 16px);
        bottom: var(--ql-space-l, 16px);
      }
      .pill {
        position: absolute;
        top: var(--ql-space-m, 12px);
        display: inline-flex;
        align-items: center;
        gap: var(--ql-space-xs, 4px);
        padding: 6px 10px;
        border-radius: var(--ql-radius-chip, 999px);
        /* Dark glass, fixed in both modes so the badge reads over any frame. */
        background: rgba(22, 19, 16, 0.55);
        font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .camera[data-size='l'] .pill {
        top: var(--ql-space-l, 16px);
      }
      .live {
        right: var(--ql-space-m, 12px);
        color: #ffffff;
      }
      .camera[data-size='l'] .live {
        right: var(--ql-space-l, 16px);
      }
      .motion {
        left: var(--ql-space-m, 12px);
        color: var(--ql-accent-champagne, #b08d57);
      }
      .camera[data-size='l'] .motion {
        left: var(--ql-space-l, 16px);
      }
      .motion-dot {
        width: 8px;
        height: 8px;
        border-radius: var(--ql-radius-chip, 999px);
        background: var(--ql-accent-champagne, #b08d57);
      }
      /* Motion draws inside the card so it never changes the layout box and
         never crops the image the way a real border would. */
      .camera.motion {
        outline: 2px solid var(--ql-accent-champagne, #b08d57);
        outline-offset: -2px;
      }
      /* The deliberate no-signal card: a mark, a name and a reason. */
      .camera.unavailable {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--ql-space-s, 8px);
        padding: var(--ql-space-l, 16px);
        background: var(--ql-surface-card, #fdfbf6);
        border: 1px solid var(--ql-surface-border, #e4dccb);
        text-align: center;
      }
      .glyph-wrap {
        display: flex;
        color: var(--ql-ink-muted, #8c8578);
        opacity: 0.7;
      }
      .offline-name {
        margin: 0;
        color: var(--ql-ink-primary, #2b2620);
        font: 500 16px/22px var(--ql-font-body, Outfit, sans-serif);
      }
      .offline-reason {
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.02em;
      }
    `,
  ];

  private renderUnavailable(name: string): TemplateResult {
    const locale = this.locale();
    const reason =
      this.availability(this.config?.entity ?? '') === 'available'
        ? t(locale, 'camera.snapshot_unavailable')
        : t(locale, 'common.unavailable');
    return html`
      <span class="glyph-wrap">${cameraGlyph(this.size() === 'l' ? 54 : 36)}</span>
      <p class="offline-name ql-clamp-2">${name}</p>
      <p class="offline-reason ql-clamp-2">${reason}</p>
    `;
  }

  private renderLive(name: string, url: string): TemplateResult {
    const locale = this.locale();
    return html`
      <img class="frame" src=${url} alt=${name} @error=${this.onSnapshotError} />
      <span class="scrim"></span>
      <p class="name ql-clamp-2">${name}</p>
      <span class="pill live">
        <ql-status-dot status="alert"></ql-status-dot>${t(locale, 'camera.live')}
      </span>
      ${this.motionDetected()
        ? html`
            <span class="pill motion">
              <span class="motion-dot" aria-hidden="true"></span>${t(locale, 'motion.detected')}
            </span>
          `
        : nothing}
    `;
  }

  protected override render(): TemplateResult {
    const config = this.config;
    if (config === undefined) {
      return html``;
    }
    const state = this.cameraState();
    const name = this.nameOf(config.entity, config.name);
    const url = state === 'unavailable' ? undefined : this.snapshotUrl();
    return html`
      <div
        class="camera ${state} ${state === 'unavailable' ? 'ql-unavailable' : ''}"
        data-size=${this.size()}
        role="button"
        tabindex="0"
        data-ql-info=${config.entity}
        aria-label=${`${name} — ${t(this.locale(), 'common.show_details')}`}
        @click=${this.onMoreInfo}
        @keydown=${this.onMoreInfoKey}
      >
        ${url === undefined ? this.renderUnavailable(name) : this.renderLive(name, url)}
      </div>
    `;
  }
}

registerCard('quiet-luxe-camera-card', QuietLuxeCameraCard, {
  name: 'Quiet Luxe Camera Card',
  description: 'Room-sized camera card with LIVE badge, motion state and a drawn offline state.',
});
