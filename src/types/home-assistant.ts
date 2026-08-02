import type { HassEntity } from 'home-assistant-js-websocket';

/**
 * Minimal typed view of the hass object HA passes to custom cards.
 * Deliberately narrow: extend here (never inline `any`) as Plans 3–4 need more.
 * custom-card-helpers was rejected (unmaintained since ~2022).
 */
export interface HomeAssistant {
  readonly states: Readonly<Record<string, HassEntity>>;
  /**
   * Entity registry display entries, keyed by entity id (HA frontend
   * `hass.entities`, verified 2026-08-01). Only `name` is consumed, as a
   * display-name fallback behind the state's friendly_name. Optional because
   * narrow mocks and pre-2023.4 cores omit it.
   */
  readonly entities?: Readonly<Record<string, { readonly name?: string | null }>>;
  readonly language: string;
  readonly locale?: { readonly language: string };
  /**
   * HA's resolved theme state. `darkMode` is the flag the frontend itself uses
   * for light/dark and is what drives the injected base stylesheet
   * (src/theme/inject-theme.ts). Optional because narrow mocks omit it.
   */
  readonly themes?: { readonly darkMode?: boolean };
  /** Current user; absent in narrow mocks. is_admin drives the RBAC admin tier. */
  readonly user?: {
    readonly id: string;
    readonly name: string;
    readonly is_admin: boolean;
  };
  callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
  ): Promise<unknown>;
  /**
   * REST helper; path WITHOUT the /api/ prefix, e.g. `calendars/calendar.x?start=…`
   * (HA REST API, verified 2026-08-01). Optional because narrow mocks may omit
   * it — callers guard and degrade gracefully (console error + muted UI).
   * HA implements this as a closure, so it is safe to call unbound.
   */
  callApi?<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string): Promise<T>;
  /**
   * WebSocket command helper, e.g. `{ type: 'todo/item/list', entity_id }`
   * (HA frontend data/todo.ts, verified 2026-08-01). Optional as above.
   */
  callWS?<T>(message: { readonly type: string } & Record<string, unknown>): Promise<T>;
}

export type { HassEntity };
