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
import { fireMoreInfo, moreInfoTargetOf } from './more-info';

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

  /**
   * Opens Home Assistant's own more-info dialog. Every entity-bearing card
   * routes here from its identity region (the name and the primary value), so
   * whatever a device supports that these cards do not draw is still one tap
   * away. Bind with `data-ql-info=${entityId}` rather than a closure so the
   * listener identity survives re-renders and repeated rows share one handler.
   */
  protected readonly onMoreInfo = (event: Event): void => {
    const entityId = moreInfoTargetOf(event);
    if (entityId === undefined) {
      return;
    }
    // Controls inside the region (a toggle, a slider) own their own gesture.
    event.stopPropagation();
    fireMoreInfo(this, entityId);
  };

  /** Enter and Space activate the identity region, matching its button role. */
  protected readonly onMoreInfoKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    this.onMoreInfo(event);
  };

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
      /* Nothing may escape the rounded rect: device names, track titles and
         task text are arbitrary length and arrive from the user's devices. */
      overflow: hidden;
      min-width: 0;
    }
    .ql-unavailable {
      color: var(--ql-ink-muted, #8c8578);
      opacity: 0.7;
    }
    /* The identity region: tapping a card's name or reading opens HA's
       more-info dialog. Kept deliberately quiet — a champagne hairline on
       hover is the only hint, and the focus ring is the same one every other
       control uses, so the card still reads as a surface, not a button. */
    .ql-info {
      display: block;
      margin: calc(-1 * var(--ql-space-xs, 4px)) calc(-1 * var(--ql-space-s, 8px));
      padding: var(--ql-space-xs, 4px) var(--ql-space-s, 8px);
      border: 0;
      border-radius: var(--ql-radius-thumb, 12px);
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: inherit;
      width: calc(100% + 2 * var(--ql-space-s, 8px));
      cursor: pointer;
      transition: background 200ms ease;
    }
    .ql-info:hover {
      background: color-mix(in srgb, var(--ql-accent-champagne, #b08d57) 8%, transparent);
    }
    .ql-info:focus-visible {
      outline: 2px solid var(--ql-accent-champagne, #b08d57);
      outline-offset: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
      .ql-info {
        transition: none;
      }
    }
    /* The inline control stack. Separated from the card's reading by a single
       hairline, then measured out on one rhythm so a card carrying five
       controls still reads as one calm column. */
    .ql-controls {
      display: flex;
      flex-direction: column;
      gap: var(--ql-space-m, 12px);
      margin-top: var(--ql-space-m, 12px);
      padding-top: var(--ql-space-m, 12px);
      border-top: 1px solid var(--ql-surface-border, #e4dccb);
    }
    .ql-control {
      display: flex;
      flex-direction: column;
      gap: var(--ql-space-xs, 4px);
      min-width: 0;
    }
    /* A control narrow enough to sit beside its label does — and drops onto
       its own line rather than being clipped when the card is too narrow for
       both. Stepper and toggle have fixed-size touch targets, so they must
       never be shrunk below themselves; the label is what gives way. */
    .ql-control-inline {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--ql-space-s, 8px);
    }
    /* Shrink, but never grow: a label that grows would push the control onto
       its own line even on a card with room for both. */
    .ql-control-inline > .ql-control-label {
      flex: 0 1 auto;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .ql-control-inline > ql-stepper {
      flex: 0 1 auto;
    }
    .ql-control-inline > ql-toggle {
      flex: 0 0 auto;
    }
    .ql-control-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--ql-space-s, 8px);
    }
    .ql-control-label {
      color: var(--ql-ink-muted, #8c8578);
      font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .ql-control-value {
      color: var(--ql-ink-primary, #2b2620);
      font: 400 13px/16px var(--ql-font-body, Outfit, sans-serif);
      font-variant-numeric: tabular-nums;
    }
    /* Clamp helpers for any text a device or integration can make long. */
    .ql-clamp-1,
    .ql-clamp-2,
    .ql-clamp-3 {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      overflow: hidden;
      overflow-wrap: anywhere;
      min-width: 0;
    }
    .ql-clamp-1 {
      -webkit-line-clamp: 1;
      line-clamp: 1;
    }
    .ql-clamp-2 {
      -webkit-line-clamp: 2;
      line-clamp: 2;
    }
    .ql-clamp-3 {
      -webkit-line-clamp: 3;
      line-clamp: 3;
    }
  `;

  static override styles: CSSResultGroup = QlBaseCard.qlCardStyles;
}
