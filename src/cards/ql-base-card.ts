import {
  css,
  LitElement,
  type CSSResult,
  type CSSResultGroup,
  type PropertyDeclarations,
  type PropertyValues,
} from 'lit';
import type { HassEntity, HomeAssistant } from '../types/home-assistant';
import { resolveLocale } from '../i18n/resolve';
import type { Locale } from '../i18n/types';
import { syncDarkMode } from '../theme/inject-theme';
import { displayName } from './display-name';

export type EntityAvailability = 'available' | 'unavailable' | 'missing';

/**
 * Base class for all Quiet Luxe cards.
 * - `hass` reactive property (no decorators; static properties pattern).
 * - Graceful degradation per spec §8: unavailable/unknown/missing entities are
 *   presented muted ("offline"), never as an error box.
 * - Shared styles read --ql-* variables from the quiet-luxe theme, with
 *   light-mode literals as fallbacks so cards degrade sanely without the theme.
 */
export abstract class QlBaseCard extends LitElement {
  static override properties: PropertyDeclarations = {
    hass: { attribute: false },
  };

  declare hass?: HomeAssistant;

  /** Public wrapper so tests and the strategy can query availability. */
  availabilityOf(entityId: string): EntityAvailability {
    return this.availability(entityId);
  }

  /**
   * Publishes HA's dark-mode flag to the document so the injected base
   * stylesheet follows HA instead of the OS preference. Cards are the only
   * place the bundle sees `hass`, and the attribute is document-wide, so the
   * first card to update settles the mode for every card.
   */
  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('hass')) {
      syncDarkMode(this.ownerDocument, this.hass?.themes?.darkMode);
    }
  }

  /** Session locale per spec §10: HA user profile language → hass.language → en. */
  locale(): Locale {
    return resolveLocale([this.hass?.locale?.language, this.hass?.language]);
  }

  protected entity(entityId: string): HassEntity | undefined {
    return this.hass?.states[entityId];
  }

  /**
   * Human-readable label for an entity, never a bare entity id.
   * See display-name.ts for the precedence rules.
   */
  protected nameOf(entityId: string, configName?: string): string {
    return displayName(this.hass, entityId, configName);
  }

  protected availability(entityId: string): EntityAvailability {
    const state = this.entity(entityId)?.state;
    if (state === undefined) {
      return 'missing';
    }
    if (state === 'unavailable' || state === 'unknown') {
      return 'unavailable';
    }
    return 'available';
  }

  static qlCardStyles: CSSResult = css`
    :host {
      display: block;
      color: var(--ql-ink-primary, #2b2620);
      font-family: var(--ql-font-body, Outfit, 'Noto Sans TC', 'Noto Sans SC', sans-serif);
    }
    .ql-card {
      background: var(--ql-surface-card, #fdfbf6);
      border: 1px solid var(--ql-surface-border, #e4dccb);
      border-radius: var(--ql-radius-card, 18px);
      padding: var(--ql-space-l, 16px);
    }
    .ql-unavailable {
      color: var(--ql-ink-muted, #8c8578);
      opacity: 0.7;
    }
  `;

  static override styles: CSSResultGroup = QlBaseCard.qlCardStyles;
}
