import { css, html, type CSSResultGroup, type TemplateResult } from 'lit';
import '../elements/ql-slider';
import { t } from '../i18n/translate';
import type { HassEntity } from '../types/home-assistant';
import { controlServiceCall, deviceControls, type ControlId } from './device-controls';
import { contentGrid, COLUMNS_HALF, type QlGridOptions } from './grid-options';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';
import { renderControls } from './render-controls';
import { COVER_FEATURE, supportsFeature } from './supported-features';

export type CoverType = 'curtain' | 'shade';

export interface CoverCardConfig {
  readonly type: string;
  readonly entity: string;
  readonly name?: string;
  readonly cover_type?: CoverType;
}

/** device_class shade/blind → shade; curtain/awning/anything else → curtain. */
export function detectCoverType(entity: HassEntity | undefined): CoverType {
  const deviceClass = entity?.attributes.device_class;
  return deviceClass === 'shade' || deviceClass === 'blind' ? 'shade' : 'curtain';
}

/**
 * Cover card (Figma `card/cover`): curtain|shade, position numeral + slider
 * (cover.set_cover_position) and localized open/stop/close row with generous
 * touch targets.
 */
export class QuietLuxeCoverCard extends QlBaseCard {
  static override properties = {
    config: { attribute: false },
  };

  declare config?: CoverCardConfig;

  setConfig(config: CoverCardConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('quiet-luxe-cover-card: "entity" is required');
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
        margin: var(--ql-space-s, 8px) 0;
        font: 300 26px/30px var(--ql-font-body, Outfit, sans-serif);
      }
      .ops {
        display: flex;
        /* Three 56px thumb targets plus gaps need 184px; a half-width card on a
           phone gives ~148px, and without wrapping the third button was cut off
           at the card edge ("Clos"). Wrapping keeps the targets full size. */
        flex-wrap: wrap;
        gap: var(--ql-space-s, 8px);
        margin-top: var(--ql-space-m, 12px);
      }
      .ops button {
        flex: 1 1 var(--ql-touch-min, 56px);
        min-height: var(--ql-touch-min, 56px);
        min-width: var(--ql-touch-min, 56px);
        border-radius: var(--ql-radius-thumb, 12px);
        border: 1px solid var(--ql-surface-border, #e4dccb);
        background: var(--ql-surface-card, #fdfbf6);
        color: var(--ql-ink-primary, #2b2620);
        font: 400 13px/16px var(--ql-font-body, Outfit, sans-serif);
        cursor: pointer;
      }
      .ops button:disabled {
        opacity: 0.5;
        cursor: default;
      }
    `,
  ];

  private coverType(): CoverType {
    return this.config?.cover_type ?? detectCoverType(this.entity(this.config?.entity ?? ''));
  }

  private position(): number | undefined {
    const entityId = this.config?.entity ?? '';
    if (this.availability(entityId) !== 'available') {
      return undefined;
    }
    const entity = this.entity(entityId);
    const position = Number(entity?.attributes.current_position);
    if (Number.isFinite(position)) {
      return Math.round(position);
    }
    return entity?.state === 'open' ? 100 : 0;
  }

  private call(service: 'open_cover' | 'stop_cover' | 'close_cover'): void {
    const entityId = this.config?.entity;
    if (entityId === undefined) {
      return;
    }
    void this.hass?.callService('cover', service, { entity_id: entityId });
  }

  private onSlider(event: CustomEvent<{ value: number }>): void {
    const entityId = this.config?.entity;
    if (entityId === undefined) {
      return;
    }
    void this.hass?.callService('cover', 'set_cover_position', {
      entity_id: entityId,
      position: event.detail.value,
    });
  }

  /** Tilt, for the covers that have slats. Absent on curtains and rollers. */
  private onControl(id: ControlId, value: string | number | boolean): void {
    const entityId = this.config?.entity;
    if (entityId === undefined || this.hass === undefined) {
      return;
    }
    const call = controlServiceCall(entityId, id, value, this.entity(entityId));
    if (call === undefined) {
      return;
    }
    void this.hass.callService(call.domain, call.service, call.data);
  }

  private callTilt(service: 'open_cover_tilt' | 'close_cover_tilt'): void {
    const entityId = this.config?.entity;
    if (entityId === undefined) {
      return;
    }
    void this.hass?.callService('cover', service, { entity_id: entityId });
  }

  /** Only offered when the cover reports it can swing its slats fully. */
  private hasTiltOps(): boolean {
    const entity = this.entity(this.config?.entity ?? '');
    return (
      supportsFeature(entity, COVER_FEATURE.OPEN_TILT) &&
      supportsFeature(entity, COVER_FEATURE.CLOSE_TILT)
    );
  }

  protected override render(): TemplateResult {
    if (this.config === undefined) {
      return html``;
    }
    const entityId = this.config.entity;
    const available = this.availability(entityId) === 'available';
    const locale = this.locale();
    const label = this.nameOf(entityId, this.config.name);
    const position = this.position();
    return html`
      <div
        class="ql-card ${available ? '' : 'ql-unavailable'}"
        data-cover-type=${this.coverType()}
      >
        <button
          class="ql-info"
          type="button"
          data-ql-info=${entityId}
          aria-label=${`${label} — ${t(locale, 'common.show_details')}`}
          @click=${this.onMoreInfo}
        >
          <span class="eyebrow ql-clamp-2">${label}</span>
          <span class="value">${position === undefined ? '—' : `${position}%`}</span>
        </button>
        <ql-slider
          .value=${position ?? 0}
          .label=${label}
          ?disabled=${!available}
          @ql-change=${this.onSlider}
        ></ql-slider>
        <div class="ops">
          <button ?disabled=${!available} @click=${(): void => this.call('open_cover')}>
            ${t(locale, 'cover.open')}
          </button>
          <button ?disabled=${!available} @click=${(): void => this.call('stop_cover')}>
            ${t(locale, 'cover.stop')}
          </button>
          <button ?disabled=${!available} @click=${(): void => this.call('close_cover')}>
            ${t(locale, 'cover.close')}
          </button>
        </div>
        ${renderControls(deviceControls(this.entity(entityId)), locale, !available, (id, value) =>
          this.onControl(id, value),
        )}
        ${this.hasTiltOps()
          ? html`
              <div class="ops">
                <button
                  ?disabled=${!available}
                  @click=${(): void => this.callTilt('open_cover_tilt')}
                >
                  ${t(locale, 'control.tilt')} ${t(locale, 'cover.open')}
                </button>
                <button
                  ?disabled=${!available}
                  @click=${(): void => this.callTilt('close_cover_tilt')}
                >
                  ${t(locale, 'control.tilt')} ${t(locale, 'cover.close')}
                </button>
              </div>
            `
          : html``}
      </div>
    `;
  }
}

registerCard('quiet-luxe-cover-card', QuietLuxeCoverCard, {
  name: 'Quiet Luxe Cover Card',
  description: 'Curtain and shade card with position slider and open/stop/close.',
});
