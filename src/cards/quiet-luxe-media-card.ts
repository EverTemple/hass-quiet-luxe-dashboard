import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import '../elements/ql-slider';
import '../elements/ql-toggle';
import { formatInteger } from '../i18n/format-number';
import { t } from '../i18n/translate';
import { contentGrid, COLUMNS_FULL, type QlGridOptions } from './grid-options';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';
import { TYPE } from '../tokens/type';

export type MediaCardForm = 'bar' | 'player' | 'group-row';

export interface MediaCardConfig {
  readonly type: string;
  readonly entity: string;
  readonly form?: MediaCardForm;
  readonly name?: string;
  /** group-row only: the group coordinator this speaker joins or leaves. */
  readonly leader?: string;
}

/**
 * Media card (Figma `card/media`): form=bar (collapsed strip) | player (full
 * transport + volume) | group-row (join toggle + per-speaker volume).
 * Service contracts per plan D4 (verified 2026-08-01): join targets the
 * leader with group_members=[speaker]; unjoin targets the speaker;
 * volume_set takes volume_level 0..1. Membership reads the leader's
 * group_members attribute.
 */
export class QuietLuxeMediaCard extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
  };

  declare config?: MediaCardConfig;

  setConfig(config: MediaCardConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('quiet-luxe-media-card: "entity" is required');
    }
    if ((config.form ?? 'player') === 'group-row' && (config.leader ?? '') === '') {
      throw new Error('quiet-luxe-media-card: group-row requires "leader"');
    }
    this.config = config;
  }

  form(): MediaCardForm {
    return this.config?.form ?? 'player';
  }

  getCardSize(): number {
    return this.form() === 'player' ? 4 : 1;
  }

  getGridOptions(): QlGridOptions {
    return contentGrid(COLUMNS_FULL);
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .row {
        display: flex;
        align-items: center;
        gap: var(--ql-space-m, 12px);
      }
      .art {
        border-radius: var(--ql-radius-thumb, 12px);
        object-fit: cover;
        background: var(--ql-surface-border, #e4dccb);
        flex: none;
      }
      .art.bar {
        width: 28px;
        height: 28px;
      }
      .art.player {
        width: 64px;
        height: 64px;
      }
      .lines {
        flex: 1;
        min-width: 0;
      }
      .eyebrow {
        display: block;
        margin: 0;
        color: var(--ql-ink-muted, #736d63);
        ${TYPE.eyebrow}
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .title {
        display: block;
        margin: 2px 0 0;
        ${TYPE.title}
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .caption {
        display: block;
        margin: 2px 0 0;
        ${TYPE.caption}
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .muted {
        color: var(--ql-ink-muted, #736d63);
      }
      /* The group row has no reading of its own, so its name carries the
         more-info tap; an explicit auto width keeps the base pill from
         claiming the whole row and squeezing the volume slider. */
      .name {
        ${TYPE.body}
        flex: 1 1 auto;
        min-width: 0;
        width: auto;
      }
      .transport-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--ql-space-l, 16px);
        margin-top: var(--ql-space-m, 12px);
      }
      button.transport {
        position: relative;
        border-radius: var(--ql-radius-chip, 999px);
        border: 1px solid var(--ql-surface-border, #e4dccb);
        background: var(--ql-surface-inset, #fdfbf6);
        color: var(--ql-ink-primary, #2b2620);
        cursor: pointer;
        font: 400 13px/1 var(--ql-font-body, Outfit, sans-serif);
        width: 30px;
        height: 30px;
      }
      /* The disc stays the size Figma drew it; the hit area is an invisible
         layer floating over it, taller than the disc (up to the 56px minimum)
         and only as wide as the 16px row gap allows before it would start
         overlapping the next transport button's own hit area. */
      button.transport::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 46px;
        height: var(--ql-touch-min, 56px);
        transform: translate(-50%, -50%);
      }
      button.transport.play {
        width: 34px;
        height: 34px;
        background: var(--ql-ink-primary, #2b2620);
        color: var(--ql-bg-base, #f4f0e8);
        border-color: transparent;
      }
      button.transport.play::after {
        width: 50px;
      }
      button.transport:focus-visible {
        outline: 2px solid var(--ql-accent-champagne, #b08d57);
        outline-offset: 2px;
      }
      button.transport:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .volume-row {
        display: flex;
        align-items: center;
        gap: var(--ql-space-m, 12px);
        margin-top: var(--ql-space-m, 12px);
      }
      .volume-row ql-slider {
        flex: 1;
      }
      .row-volume {
        flex: 1;
      }
    `,
  ];

  private callMedia(service: string): void {
    const entityId = this.config?.entity;
    if (entityId === undefined || this.hass === undefined) {
      return;
    }
    void this.hass.callService('media_player', service, { entity_id: entityId });
  }

  private onPlayPause(): void {
    this.callMedia('media_play_pause');
  }

  private onNext(): void {
    this.callMedia('media_next_track');
  }

  private onPrevious(): void {
    this.callMedia('media_previous_track');
  }

  private onVolume(event: CustomEvent<{ value: number }>): void {
    const entityId = this.config?.entity;
    if (entityId === undefined || this.hass === undefined) {
      return;
    }
    void this.hass.callService('media_player', 'volume_set', {
      entity_id: entityId,
      volume_level: event.detail.value / 100,
    });
  }

  private onJoinToggle(event: CustomEvent<{ checked: boolean }>): void {
    const config = this.config;
    if (config?.leader === undefined || this.hass === undefined) {
      return;
    }
    if (event.detail.checked) {
      void this.hass.callService('media_player', 'join', {
        entity_id: config.leader,
        group_members: [config.entity],
      });
      return;
    }
    void this.hass.callService('media_player', 'unjoin', { entity_id: config.entity });
  }

  private isJoined(): boolean {
    const leader = this.config?.leader;
    if (leader === undefined) {
      return false;
    }
    const members = this.entity(leader)?.attributes.group_members as
      | ReadonlyArray<string>
      | undefined;
    return members?.includes(this.config?.entity ?? '') ?? false;
  }

  private volumePercent(): number {
    const level = Number(this.entity(this.config?.entity ?? '')?.attributes.volume_level);
    return Number.isFinite(level) ? Math.round(level * 100) : 0;
  }

  private artwork(size: 'bar' | 'player'): TemplateResult {
    const picture = this.entity(this.config?.entity ?? '')?.attributes.entity_picture as
      | string
      | undefined;
    if (picture === undefined) {
      return html`<div class="art ${size}"></div>`;
    }
    return html`<img class="art ${size}" src=${picture} alt="" loading="lazy" />`;
  }

  protected override render(): TemplateResult {
    const config = this.config;
    if (config === undefined) {
      return html``;
    }
    const locale = this.locale();
    const availability = this.availability(config.entity);
    const unavailable = availability !== 'available';
    const cardClass = unavailable ? 'ql-card ql-unavailable' : 'ql-card';
    const entity = this.entity(config.entity);
    const name = this.nameOf(config.entity, config.name);
    const infoLabel = `${name} — ${t(locale, 'common.show_details')}`;
    if (this.form() === 'group-row') {
      return html`
        <div class="${cardClass} row">
          <button
            class="ql-info name"
            type="button"
            data-ql-info=${config.entity}
            aria-label=${infoLabel}
            @click=${this.onMoreInfo}
          >
            <span class="ql-clamp-1">${name}</span>
          </button>
          <ql-slider
            class="row-volume"
            .value=${this.volumePercent()}
            label=${t(locale, 'media.volume')}
            ?disabled=${unavailable}
            @ql-change=${this.onVolume}
          ></ql-slider>
          <ql-toggle
            .checked=${this.isJoined()}
            label=${t(locale, 'media.join')}
            ?disabled=${unavailable}
            @ql-change=${this.onJoinToggle}
          ></ql-toggle>
        </div>
      `;
    }
    const playing = entity?.state === 'playing';
    const title = entity?.attributes.media_title as string | undefined;
    const trackText = unavailable
      ? t(locale, 'common.unavailable')
      : (title ?? t(locale, 'media.idle'));
    const trackMuted = unavailable || title === undefined;
    const source = entity?.attributes.source as string | undefined;
    const playButton = html`
      <button
        type="button"
        class="transport play"
        aria-label=${playing ? t(locale, 'media.pause') : t(locale, 'media.play')}
        ?disabled=${unavailable}
        @click=${this.onPlayPause}
      >
        ${playing ? '⏸' : '▶'}
      </button>
    `;
    if (this.form() === 'bar') {
      return html`
        <div class="${cardClass} row">
          ${this.artwork('bar')}
          <button
            class="ql-info lines"
            type="button"
            data-ql-info=${config.entity}
            aria-label=${infoLabel}
            @click=${this.onMoreInfo}
          >
            <span class="caption ${trackMuted ? 'muted' : ''}">${trackText}</span>
            ${source === undefined ? nothing : html`<span class="caption muted">${source}</span>`}
          </button>
          ${playButton}
        </div>
      `;
    }
    const artist = entity?.attributes.media_artist as string | undefined;
    const album = entity?.attributes.media_album_name as string | undefined;
    const artistLine =
      artist === undefined ? undefined : album === undefined ? artist : `${artist} — ${album}`;
    return html`
      <div class=${cardClass}>
        <div class="row">
          ${this.artwork('player')}
          <button
            class="ql-info lines"
            type="button"
            data-ql-info=${config.entity}
            aria-label=${infoLabel}
            @click=${this.onMoreInfo}
          >
            ${source === undefined ? nothing : html`<span class="eyebrow ql-clamp-1">${source}</span>`}
            <span class="title ${trackMuted ? 'muted' : ''}">${trackText}</span>
            ${artistLine === undefined
              ? nothing
              : html`<span class="caption muted">${artistLine}</span>`}
          </button>
        </div>
        <div class="transport-row">
          <button
            type="button"
            class="transport previous"
            aria-label=${t(locale, 'media.previous')}
            ?disabled=${unavailable}
            @click=${this.onPrevious}
          >
            ⏮
          </button>
          ${playButton}
          <button
            type="button"
            class="transport next"
            aria-label=${t(locale, 'media.next')}
            ?disabled=${unavailable}
            @click=${this.onNext}
          >
            ⏭
          </button>
        </div>
        <div class="volume-row">
          <ql-slider
            .value=${this.volumePercent()}
            label=${t(locale, 'media.volume')}
            ?disabled=${unavailable}
            @ql-change=${this.onVolume}
          ></ql-slider>
          <span class="caption muted">${formatInteger(this.volumePercent(), locale)}%</span>
        </div>
      </div>
    `;
  }
}

registerCard('quiet-luxe-media-card', QuietLuxeMediaCard, {
  name: 'Quiet Luxe Media Card',
  description: 'Media player as collapsed bar, full player, or speaker group row.',
});
