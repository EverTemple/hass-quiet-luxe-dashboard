import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import '../elements/ql-chip';
import { formatInteger } from '../i18n/format-number';
import type { TranslationKey } from '../i18n/locales/en';
import { t } from '../i18n/translate';
import { contentGrid, COLUMNS_FULL, type QlGridOptions } from './grid-options';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';
import { TYPE } from '../tokens/type';

export const DEFAULT_ROOM_COMMAND = 'app_segment_clean';

export interface VacuumRoomConfig {
  readonly name: string;
  /** vacuum.send_command command; defaults to app_segment_clean. */
  readonly command?: string;
  /** Vendor-specific payload, passed through verbatim (config-driven). */
  readonly params?: unknown;
}

export interface VacuumCardConfig {
  readonly type: string;
  readonly entity: string;
  readonly name?: string;
  readonly rooms?: ReadonlyArray<VacuumRoomConfig>;
}

const STATE_KEYS: Readonly<Record<string, TranslationKey>> = {
  docked: 'vacuum.docked',
  cleaning: 'vacuum.cleaning',
  returning: 'vacuum.returning',
  paused: 'vacuum.paused',
  error: 'vacuum.error',
  idle: 'state.idle',
};

/**
 * Vacuum card (Figma `card/vacuum`, state=docked|cleaning|returning):
 * localized state line, battery, and config-driven room-clean chips that
 * call vacuum.send_command with per-room command/params payloads.
 */
export class QuietLuxeVacuumCard extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
  };

  declare config?: VacuumCardConfig;

  setConfig(config: VacuumCardConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('quiet-luxe-vacuum-card: "entity" is required');
    }
    this.config = config;
  }

  getCardSize(): number {
    return 2;
  }

  getGridOptions(): QlGridOptions {
    return contentGrid(COLUMNS_FULL);
  }

  private onRoomTap(room: VacuumRoomConfig): void {
    const entityId = this.config?.entity;
    if (entityId === undefined || this.hass === undefined) {
      return;
    }
    const data: Record<string, unknown> = {
      entity_id: entityId,
      command: room.command ?? DEFAULT_ROOM_COMMAND,
    };
    if (room.params !== undefined) {
      data.params = room.params;
    }
    void this.hass.callService('vacuum', 'send_command', data);
  }

  private statusLine(): { text: string; cls: string } {
    const locale = this.locale();
    const entityId = this.config?.entity ?? '';
    if (this.availability(entityId) !== 'available') {
      return { text: t(locale, 'common.unavailable'), cls: 'muted' };
    }
    const state = this.entity(entityId)?.state ?? '';
    const key = STATE_KEYS[state];
    if (key === undefined) {
      return { text: '—', cls: 'muted' };
    }
    if (state === 'cleaning' || state === 'returning') {
      return { text: t(locale, key), cls: 'accent' };
    }
    if (state === 'error') {
      return { text: t(locale, key), cls: 'warn' };
    }
    return { text: t(locale, key), cls: 'muted' };
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
      .row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--ql-space-s, 8px);
        margin-top: var(--ql-space-s, 8px);
      }
      .status {
        display: block;
        margin: 0;
        ${TYPE.body}
      }
      .status.accent {
        color: var(--ql-accent-champagne-text, #846a41);
      }
      .status.muted {
        color: var(--ql-ink-muted, #736d63);
      }
      .status.warn {
        color: var(--ql-status-warn-text, #91643e);
      }
      .battery {
        display: block;
        margin: 0;
        color: var(--ql-ink-muted, #736d63);
        ${TYPE.caption}
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ql-space-s, 8px);
        margin-top: var(--ql-space-m, 12px);
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
    const entity = this.entity(config.entity);
    const name = this.nameOf(config.entity, config.name);
    const status = this.statusLine();
    const battery = Number(entity?.attributes.battery_level);
    const rooms = config.rooms ?? [];
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
          <span class="row">
            <span class="status ${status.cls}">${status.text}</span>
            ${Number.isFinite(battery)
              ? html`<span class="battery">
                  ${formatInteger(battery, locale)}% · ${t(locale, 'common.battery')}
                </span>`
              : nothing}
          </span>
        </button>
        ${rooms.length > 0 && availability === 'available'
          ? html`
              <div class="chips" role="group" aria-label=${t(locale, 'vacuum.rooms')}>
                ${rooms.map(
                  (room) => html`
                    <ql-chip
                      variant="scene"
                      emphasis="secondary"
                      @click=${(): void => this.onRoomTap(room)}
                      >${room.name}</ql-chip
                    >
                  `,
                )}
              </div>
            `
          : nothing}
      </div>
    `;
  }
}

registerCard('quiet-luxe-vacuum-card', QuietLuxeVacuumCard, {
  name: 'Quiet Luxe Vacuum Card',
  description: 'Vacuum state, battery, and config-driven room cleaning chips.',
});
