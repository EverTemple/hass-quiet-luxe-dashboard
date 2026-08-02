import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import '../elements/ql-status-dot';
import { t } from '../i18n/translate';
import { contentGrid, COLUMNS_FULL, COLUMNS_HALF, type QlGridOptions } from './grid-options';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';

export type CameraCardForm = 'glance' | 'full';

export const DEFAULT_CAMERA_REFRESH_S = 10;

export interface CameraCardConfig {
  readonly type: string;
  readonly entity: string;
  readonly form?: CameraCardForm;
  readonly name?: string;
  /** Snapshot refresh interval in seconds. */
  readonly refresh_interval?: number;
}

/**
 * Camera card (Figma `card/camera`): form=glance (16:9 thumb + status line) |
 * full (frame + name + LIVE badge). Snapshot strategy per plan D3: render the
 * entity's own signed entity_picture (/api/camera_proxy/… with token) plus a
 * `time` cache-buster (documented REST param), refreshed on an interval.
 * A failed or absent snapshot renders a muted labeled frame — never a broken
 * <img> icon (spec §8).
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
    this.config = config;
    this.startTimer();
  }

  form(): CameraCardForm {
    return this.config?.form ?? 'glance';
  }

  getCardSize(): number {
    return this.form() === 'full' ? 3 : 2;
  }

  getGridOptions(): QlGridOptions {
    return contentGrid(this.form() === 'full' ? COLUMNS_FULL : COLUMNS_HALF);
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

  private snapshotUrl(): string | undefined {
    const picture = this.entity(this.config?.entity ?? '')?.attributes.entity_picture as
      | string
      | undefined;
    if (picture === undefined) {
      return undefined;
    }
    const separator = picture.includes('?') ? '&' : '?';
    return `${picture}${separator}time=${Date.now()}`;
  }

  private onSnapshotError(): void {
    this.snapshotFailed = true;
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .ql-card {
        padding: var(--ql-space-s, 8px);
      }
      .frame {
        position: relative;
        aspect-ratio: 16 / 9;
        border-radius: var(--ql-radius-thumb, 12px);
        overflow: hidden;
        background: var(--ql-surface-border, #e4dccb);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .frame img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .fallback {
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ql-space-s, 8px);
        margin-top: var(--ql-space-s, 8px);
        padding: 0 var(--ql-space-xs, 4px);
      }
      .name {
        margin: 0;
        min-width: 0;
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .live {
        display: inline-flex;
        align-items: center;
        gap: var(--ql-space-xs, 4px);
        color: var(--ql-status-alert, #a85b4e);
        font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.14em;
      }
    `,
  ];

  protected override render(): TemplateResult {
    const config = this.config;
    if (config === undefined) {
      return html``;
    }
    const locale = this.locale();
    const availability = this.availability(config.entity);
    const url = availability === 'available' ? this.snapshotUrl() : undefined;
    const showImage = url !== undefined && !this.snapshotFailed;
    const name = this.nameOf(config.entity, config.name);
    const fallbackText =
      availability === 'available'
        ? t(locale, 'camera.snapshot_unavailable')
        : t(locale, 'common.unavailable');
    return html`
      <div class="ql-card ${showImage ? '' : 'ql-unavailable'}">
        <div class="frame">
          ${showImage
            ? html`<img src=${url} alt=${name} @error=${this.onSnapshotError} />`
            : html`<p class="fallback">${fallbackText}</p>`}
        </div>
        <div class="meta">
          <p class="name ql-clamp-2">${name}</p>
          ${this.form() === 'full' && showImage
            ? html`<span class="live"
                ><ql-status-dot status="alert"></ql-status-dot>${t(locale, 'camera.live')}</span
              >`
            : nothing}
        </div>
      </div>
    `;
  }
}

registerCard('quiet-luxe-camera-card', QuietLuxeCameraCard, {
  name: 'Quiet Luxe Camera Card',
  description: 'Camera snapshot card (glance or full) with interval refresh and LIVE badge.',
});
