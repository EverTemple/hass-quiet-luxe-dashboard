import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import '../elements/ql-status-dot';
import type { QlStatus } from '../elements/ql-status-dot';
import { t } from '../i18n/translate';
import { contentGrid, COLUMNS_HALF, type QlGridOptions } from './grid-options';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';
import { TYPE } from '../tokens/type';

export interface DeviceCutoutCardConfig {
  readonly type: string;
  readonly entity: string;
  readonly name?: string;
  /** Cutout image URL (image slot per Figma `card/device-cutout`). */
  readonly image?: string;
}

/**
 * Generic device cutout card (Figma `card/device-cutout`): eyebrow name,
 * optional cutout image, localized on/off/unavailable status line. Used for
 * Sonos/Dyson/TV/dehumidifier-style products.
 */
export class QuietLuxeDeviceCutoutCard extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
    imageFailed: { state: true },
  };

  declare config?: DeviceCutoutCardConfig;
  declare imageFailed: boolean;

  constructor() {
    super();
    this.imageFailed = false;
  }

  setConfig(config: DeviceCutoutCardConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('quiet-luxe-device-cutout-card: "entity" is required');
    }
    this.config = config;
    this.imageFailed = false;
  }

  getCardSize(): number {
    return 2;
  }

  getGridOptions(): QlGridOptions {
    return contentGrid(COLUMNS_HALF);
  }

  private onImageError(): void {
    this.imageFailed = true;
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .eyebrow {
        display: block;
        margin: 0;
        color: var(--ql-ink-muted, #736d63);
        ${TYPE.eyebrow}
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      /* Measured 157x22: an invisible layer over the header button reaches
         the 56px minimum. Nothing below it is independently interactive
         (the cutout image and status line are both read-only), so growing
         past the button's own footprint carries no risk of stealing a tap
         meant for something else. */
      .ql-info {
        position: relative;
      }
      .ql-info::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: var(--ql-touch-min, 56px);
        transform: translateY(-50%);
      }
      /* A fixed height (not max-height) reserves the box before the browser
         knows the image's intrinsic size, so the card doesn't shift on load.
         object-fit: contain keeps arbitrary device-photo aspect ratios
         undistorted inside it. */
      img.cutout {
        display: block;
        width: 100%;
        height: 96px;
        object-fit: contain;
        margin: var(--ql-space-m, 12px) 0;
      }
      .status {
        display: inline-flex;
        align-items: center;
        gap: var(--ql-space-s, 8px);
        margin: var(--ql-space-s, 8px) 0 0;
        color: var(--ql-ink-muted, #736d63);
        ${TYPE.caption}
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
    const name = this.nameOf(config.entity, config.name);
    const on = availability === 'available' && this.entity(config.entity)?.state === 'on';
    const statusText =
      availability !== 'available'
        ? t(locale, 'common.unavailable')
        : t(locale, on ? 'common.on' : 'common.off');
    const dot: QlStatus = availability !== 'available' ? 'neutral' : on ? 'good' : 'neutral';
    const showImage = config.image !== undefined && !this.imageFailed;
    return html`
      <div class="ql-card ${availability === 'available' ? '' : 'ql-unavailable'}">
        <button
          class="ql-info"
          type="button"
          data-ql-info=${config.entity}
          aria-label=${`${name} — ${t(locale, 'common.show_details')}`}
          @click=${this.onMoreInfo}
        >
          <span class="eyebrow ql-clamp-2">${name}</span>
        </button>
        ${showImage
          ? html`<img
              class="cutout"
              src=${config.image}
              alt=""
              loading="lazy"
              @error=${this.onImageError}
            />`
          : nothing}
        <p class="status"><ql-status-dot status=${dot}></ql-status-dot>${statusText}</p>
      </div>
    `;
  }
}

registerCard('quiet-luxe-device-cutout-card', QuietLuxeDeviceCutoutCard, {
  name: 'Quiet Luxe Device Cutout Card',
  description: 'Generic device card with a cutout image slot and status line.',
});
