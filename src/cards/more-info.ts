/**
 * Opening Home Assistant's native more-info dialog from a custom card.
 *
 * Contract verified against home-assistant/frontend `20260624.4` (the build
 * pinned by HA Core 2026.7.1):
 *
 * - `src/state/more-info-mixin.ts` declares `HASSDomEvents["hass-more-info"]`
 *   and registers the listener on the `<home-assistant>` root element, so the
 *   event has to bubble all the way up and out of every shadow root a card
 *   sits inside.
 * - `src/dialogs/more-info/ha-more-info-dialog.ts` types the payload as
 *   `MoreInfoDialogParams { entityId: string | null; view?; large?; ... }`.
 *   `src/panels/lovelace/common/handle-action.ts` only ever passes `entityId`.
 * - `src/common/dom/fire_event.ts` defaults to `bubbles: true`,
 *   `composed: true`, `cancelable: false`. It builds a plain `Event` and
 *   assigns `.detail`; a `CustomEvent` is indistinguishable to listeners.
 *
 * Nothing else is required: any card rendered in a dashboard is a descendant
 * of `<home-assistant>`, so no registration and no `hass` reference is needed.
 */
export const MORE_INFO_EVENT = 'hass-more-info';

export interface MoreInfoEventDetail {
  readonly entityId: string;
}

/** Dispatches `hass-more-info` so HA opens the full control surface. */
export function fireMoreInfo(node: EventTarget, entityId: string): void {
  node.dispatchEvent(
    new CustomEvent<MoreInfoEventDetail>(MORE_INFO_EVENT, {
      detail: { entityId },
      bubbles: true,
      composed: true,
    }),
  );
}

/** Attribute name carrying the entity id on a more-info tap region. */
export const MORE_INFO_ATTRIBUTE = 'data-ql-info';

/**
 * Reads the entity id off the nearest more-info region. Cards stamp the id
 * into the DOM rather than closing over it so the handlers stay identity
 * stable across renders and work for repeated rows.
 */
export function moreInfoTargetOf(event: Event): string | undefined {
  const node = event.currentTarget;
  if (!(node instanceof HTMLElement)) {
    return undefined;
  }
  const entityId = node.getAttribute(MORE_INFO_ATTRIBUTE);
  return entityId === null || entityId === '' ? undefined : entityId;
}
