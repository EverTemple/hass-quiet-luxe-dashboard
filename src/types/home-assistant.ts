import type { HassEntity } from 'home-assistant-js-websocket';

/**
 * Minimal typed view of the hass object HA passes to custom cards.
 * Deliberately narrow: extend here (never inline `any`) as Plans 3–4 need more.
 * custom-card-helpers was rejected (unmaintained since ~2022).
 */
export interface HomeAssistant {
  readonly states: Readonly<Record<string, HassEntity>>;
  readonly language: string;
  readonly locale?: { readonly language: string };
  callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
  ): Promise<unknown>;
}

export type { HassEntity };
