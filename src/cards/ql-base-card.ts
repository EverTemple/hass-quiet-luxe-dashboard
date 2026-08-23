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
import { TYPE } from '../tokens/type';

export type EntityAvailability = 'available' | 'unavailable' | 'missing';

/**
 * Every field of `hass` except `states`, compared by identity.
 *
 * HA rebuilds `hass` by spreading (`{ ...hass, states }`), so every field it
 * did not touch keeps its reference across a `state_changed`. Comparing the
 * whole surface rather than a hand-listed few means a card reading
 * `hass.user`, `hass.entities`, `hass.services`, `hass.locale` — or a field
 * this base class has never heard of — still re-renders when it changes, with
 * no per-subclass declaration to keep in step.
 */
function contextChanged(previous: HomeAssistant, next: HomeAssistant): boolean {
  const before = previous as unknown as Record<string, unknown>;
  const after = next as unknown as Record<string, unknown>;
  const afterKeys = Object.keys(after);
  if (afterKeys.length !== Object.keys(before).length) {
    return true;
  }
  return afterKeys.some((key) => key !== 'states' && before[key] !== after[key]);
}

/**
 * Whether a new `hass` can change what this card draws. Deliberately biased
 * towards rendering: a skipped frame is a card showing stale state, which is
 * far worse than a wasted one.
 */
function hassAffectsRender(
  previous: HomeAssistant,
  next: HomeAssistant,
  watched: ReadonlySet<string> | undefined,
): boolean {
  // Dark mode is document-wide and published by whichever card updates first,
  // so a flip has to reach willUpdate even when no watched entity moved. HA
  // replaces `themes` wholesale, which contextChanged would also catch, but
  // the flag is load-bearing enough to compare by value rather than rely on it.
  if (previous.themes?.darkMode !== next.themes?.darkMode) {
    return true;
  }
  if (contextChanged(previous, next)) {
    return true;
  }
  // No frame recorded yet, or a card that draws no entity state at all: there
  // is no watch set to reason about, so it wakes for everything.
  if (watched === undefined || watched.size === 0) {
    return true;
  }
  if (previous.states === next.states) {
    return false;
  }
  for (const entityId of watched) {
    if (previous.states[entityId] !== next.states[entityId]) {
      return true;
    }
  }
  return false;
}

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

  /**
   * Entity ids read while building the last frame — the set this card may be
   * woken by. Derived rather than declared: all nineteen subclasses reach
   * state through entity()/availability()/nameOf(), so recording those reads
   * cannot drift out of step with what a card actually draws, the way a
   * hand-kept `static watches = [...]` would. `undefined` means "nothing
   * recorded yet", which reads as "wake for anything".
   */
  private watchedEntities?: ReadonlySet<string>;

  /** Open only between willUpdate and the end of update(), i.e. across render. */
  private entityRecorder?: Set<string>;

  /** Public wrapper so tests and the strategy can query availability. */
  availabilityOf(entityId: string): EntityAvailability {
    return this.availability(entityId);
  }

  /**
   * HA hands every card a NEW `hass` object on every `state_changed` event in
   * the house, so Lit's default identity check makes all nineteen card types
   * re-render for every entity rather than their own. Gate on what the last
   * frame actually read.
   */
  protected override shouldUpdate(changed: PropertyValues): boolean {
    if (changed.size !== 1 || !changed.has('hass')) {
      return true;
    }
    const previous = changed.get('hass') as HomeAssistant | undefined;
    const next = this.hass;
    // The first assignment, and any teardown to undefined, always render.
    if (previous === undefined || next === undefined) {
      return true;
    }
    return hassAffectsRender(previous, next, this.watchedEntities);
  }

  /**
   * Publishes HA's dark-mode flag to the document so the injected base
   * stylesheet follows HA instead of the OS preference. Cards are the only
   * place the bundle sees `hass`, and the attribute is document-wide, so the
   * first card to update settles the mode for every card. A dark-mode flip is
   * part of shouldUpdate's watch, so gating never starves this call.
   */
  protected override willUpdate(changed: PropertyValues): void {
    this.entityRecorder = new Set();
    if (changed.has('hass')) {
      syncDarkMode(this.ownerDocument, this.hass?.themes?.darkMode);
    }
  }

  /**
   * Renders with the read recorder open, so each frame declares the watch set
   * for the next one. A throw drops the set rather than keeping it half-filled:
   * an incomplete watch set would silently stop waking the card.
   */
  protected override update(changed: PropertyValues): void {
    const recorder = (this.entityRecorder ??= new Set());
    try {
      super.update(changed);
      this.watchedEntities = recorder;
    } catch (error) {
      this.watchedEntities = undefined;
      throw error;
    } finally {
      this.entityRecorder = undefined;
    }
  }

  /** Session locale per spec §10: HA user profile language → hass.language → en. */
  locale(): Locale {
    return resolveLocale([this.hass?.locale?.language, this.hass?.language]);
  }

  protected entity(entityId: string): HassEntity | undefined {
    this.entityRecorder?.add(entityId);
    return this.hass?.states[entityId];
  }

  /**
   * Human-readable label for an entity, never a bare entity id.
   * See display-name.ts for the precedence rules.
   */
  protected nameOf(entityId: string, configName?: string): string {
    this.entityRecorder?.add(entityId);
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
      color: var(--ql-ink-muted, #736d63);
      opacity: 0.7;
    }
    /* The identity region: tapping a card's name or reading opens HA's
       more-info dialog. Kept deliberately quiet — a champagne hairline on
       hover is the only hint, and the focus ring is the same one every other
       control uses, so the card still reads as a surface, not a button. */
    .ql-info {
      display: block;
      position: relative;
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
    /* Hit-area floor. The negative margin above is the older half of this: it
       turns the button's own padding into 8px of extra hit area without
       shifting the text. That is not enough on its own — the identity regions
       on the room, camera, media and door/motion cards are only as tall as
       their text, 26–32px against a 56px touch minimum — so an invisible
       overlay claims the rest, the same technique ql-toggle, ql-dial-button
       and the media card's transport discs use. The two compose rather than
       fight: the overlay is measured from the border box the padding already
       made, so those 8px sit inside it rather than adding to it.
       A floor, not a size. The overlay is additive, so the instances that
       already measure 50–68px keep every pixel of their own hit area.
       It cannot reach a neighbouring card: .ql-card is overflow:hidden, which
       clips the overlay — and with it the hit test — to the card's own
       box, so a card shorter than 56px (ql-row-door-motion is 52) takes the
       height it has rather than stealing taps from the row above. Centring it
       rather than anchoring it to an edge halves what it asks of either
       neighbour for the same total height. */
    .ql-info::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: var(--ql-touch-min, 56px);
      transform: translateY(-50%);
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
      color: var(--ql-ink-muted, #736d63);
      ${TYPE.eyebrow}
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
