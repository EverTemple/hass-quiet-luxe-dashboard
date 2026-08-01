export interface CustomCardEntry {
  readonly type: string;
  readonly name: string;
  readonly description: string;
}

declare global {
  interface Window {
    customCards?: CustomCardEntry[];
  }
}

/**
 * Defines a dashboard card element and lists it in HA's card picker.
 * Descriptions are English-only by design: window.customCards is read once at
 * bundle load, before any user locale is known (picker metadata, not UI).
 */
export function registerCard(
  tag: string,
  ctor: CustomElementConstructor,
  entry: Omit<CustomCardEntry, 'type'>,
): void {
  customElements.define(tag, ctor);
  window.customCards = window.customCards ?? [];
  window.customCards.push({ type: tag, ...entry });
}
