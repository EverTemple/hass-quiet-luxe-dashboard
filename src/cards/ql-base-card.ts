import { css, LitElement, type CSSResult } from 'lit';
import type { HassEntity, HomeAssistant } from '../types/home-assistant';

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
  static override properties = {
    hass: { attribute: false },
  };

  declare hass?: HomeAssistant;

  /** Public wrapper so tests and the strategy can query availability. */
  availabilityOf(entityId: string): EntityAvailability {
    return this.availability(entityId);
  }

  protected entity(entityId: string): HassEntity | undefined {
    return this.hass?.states[entityId];
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

  static override styles: CSSResult = QlBaseCard.qlCardStyles;
}
