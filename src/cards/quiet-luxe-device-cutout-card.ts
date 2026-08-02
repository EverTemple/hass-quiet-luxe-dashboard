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
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      img.cutout {
        display: block;
        width: 100%;
        max-height: 96px;
        object-fit: contain;
        margin: var(--ql-space-m, 12px) 0;
      }
      .status {
        display: inline-flex;
        align-items: center;
        gap: var(--ql-space-s, 8px);
        margin: var(--ql-space-s, 8px) 0 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
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
        <p class="eyebrow ql-clamp-2">${name}</p>
        ${showImage
          ? html`<img class="cutout" src=${config.image} alt="" @error=${this.onImageError} />`
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
