import {
  css,
  html,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import { t } from '../i18n/translate';
import type { HassEntity } from '../types/home-assistant';
import { QlBaseCard } from './ql-base-card';

export interface PresenceRowConfig {
  readonly type: string;
  /** person.* entity ids. */
  readonly entities: ReadonlyArray<string>;
}

/**
 * Presence row (Figma `row/presence`): avatar circles + names, home in
 * accent, away muted. Avatars use entity_picture with an initial fallback.
 * Registered define-only (plan D6).
 */
export class QlRowPresence extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
  };

  declare config?: PresenceRowConfig;

  setConfig(config: PresenceRowConfig): void {
    if (!Array.isArray(config.entities) || config.entities.length === 0) {
      throw new Error('ql-row-presence: "entities" is required');
    }
    this.config = config;
  }

  getCardSize(): number {
    return 1;
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .ql-card {
        display: flex;
        align-items: center;
        gap: var(--ql-space-l, 16px);
        padding: var(--ql-space-m, 12px) var(--ql-space-l, 16px);
      }
      .person {
        display: inline-flex;
        align-items: center;
        gap: var(--ql-space-s, 8px);
      }
      .avatar,
      .initial {
        width: 18px;
        height: 18px;
        border-radius: var(--ql-radius-chip, 999px);
        object-fit: cover;
      }
      .initial {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--ql-surface-border, #e4dccb);
        color: var(--ql-ink-primary, #2b2620);
        font: 500 10px/1 var(--ql-font-body, Outfit, sans-serif);
      }
      .name {
        color: var(--ql-accent-champagne, #b08d57);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .state {
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .person.away .name {
        color: var(--ql-ink-muted, #8c8578);
      }
    `,
  ];

  private personName(entityId: string, entity: HassEntity | undefined): string {
    return (
      (entity?.attributes.friendly_name as string | undefined) ??
      entityId.split('.')[1] ??
      entityId
    );
  }

  protected override render(): TemplateResult {
    const config = this.config;
    if (config === undefined) {
      return html``;
    }
    const locale = this.locale();
    return html`
      <div class="ql-card">
        ${config.entities.map((entityId) => {
          const entity = this.entity(entityId);
          const availability = this.availability(entityId);
          const home = availability === 'available' && entity?.state === 'home';
          const stateText =
            availability !== 'available'
              ? t(locale, 'common.offline')
              : t(locale, home ? 'presence.home' : 'presence.away');
          const name = this.personName(entityId, entity);
          const picture = entity?.attributes.entity_picture as string | undefined;
          return html`
            <span class="person ${home ? '' : 'away'}">
              ${picture !== undefined
                ? html`<img class="avatar" src=${picture} alt=${name} />`
                : html`<span class="initial" aria-hidden="true"
                    >${name.charAt(0).toUpperCase()}</span
                  >`}
              <span class="name">${name}</span>
              <span class="state">${stateText}</span>
            </span>
          `;
        })}
      </div>
    `;
  }
}

customElements.define('ql-row-presence', QlRowPresence);
