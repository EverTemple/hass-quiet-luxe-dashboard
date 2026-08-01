import type { HassEntity, HomeAssistant } from '../types/home-assistant';

export interface RecordedServiceCall {
  readonly domain: string;
  readonly service: string;
  readonly data?: Record<string, unknown>;
}

export interface RecordedApiCall {
  readonly method: string;
  readonly path: string;
}

export interface MockHassOptions {
  readonly language?: string;
  /**
   * callApi stubs. Lookup: exact path first, then the first key that is a
   * prefix of the requested path (lets the dev harness stub
   * `calendars/calendar.family` without hardcoding query timestamps).
   */
  readonly apiResponses?: Readonly<Record<string, unknown>>;
  /** callWS stubs keyed by `message.type`. */
  readonly wsResponses?: Readonly<Record<string, unknown>>;
  /** hass.user double for RBAC/greeting tests. */
  readonly user?: HomeAssistant['user'];
}

/** HomeAssistant double with service/api/ws spies. Test/dev-harness use only. */
export interface MockHass extends HomeAssistant {
  readonly calls: ReadonlyArray<RecordedServiceCall>;
  readonly apiCalls: ReadonlyArray<RecordedApiCall>;
  readonly wsCalls: ReadonlyArray<Record<string, unknown>>;
}

const ENTITY_DEFAULTS = {
  last_changed: '2026-08-01T00:00:00+00:00',
  last_updated: '2026-08-01T00:00:00+00:00',
  context: { id: 'mock-context', user_id: null, parent_id: null },
} as const;

export function makeEntity(
  entityId: string,
  state: string,
  attributes: Record<string, unknown> = {},
): HassEntity {
  return { entity_id: entityId, state, attributes, ...ENTITY_DEFAULTS };
}

export function lightEntity(
  entityId: string,
  state: 'on' | 'off' | 'unavailable' = 'on',
  brightness = 255,
): HassEntity {
  return makeEntity(entityId, state, state === 'on' ? { brightness } : {});
}

export function climateEntity(
  entityId: string,
  state = 'cool',
  attributes: Record<string, unknown> = {},
): HassEntity {
  return makeEntity(entityId, state, { current_temperature: 24.5, ...attributes });
}

export function coverEntity(
  entityId: string,
  position = 100,
  attributes: Record<string, unknown> = {},
): HassEntity {
  return makeEntity(entityId, position > 0 ? 'open' : 'closed', {
    current_position: position,
    ...attributes,
  });
}

export function sensorEntity(
  entityId: string,
  state: string,
  attributes: Record<string, unknown> = {},
): HassEntity {
  return makeEntity(entityId, state, attributes);
}

function findApiStub(
  stubs: Readonly<Record<string, unknown>> | undefined,
  path: string,
): unknown {
  if (stubs === undefined) {
    return undefined;
  }
  if (path in stubs) {
    return stubs[path];
  }
  const prefixKey = Object.keys(stubs).find((key) => path.startsWith(key));
  return prefixKey === undefined ? undefined : stubs[prefixKey];
}

export function makeMockHass(
  entities: ReadonlyArray<HassEntity> = [],
  options: string | MockHassOptions = {},
): MockHass {
  const opts: MockHassOptions = typeof options === 'string' ? { language: options } : options;
  const language = opts.language ?? 'en';
  const calls: RecordedServiceCall[] = [];
  const apiCalls: RecordedApiCall[] = [];
  const wsCalls: Array<Record<string, unknown>> = [];
  return {
    states: Object.fromEntries(entities.map((entity) => [entity.entity_id, entity])),
    language,
    locale: { language },
    user: opts.user,
    calls,
    apiCalls,
    wsCalls,
    callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown> {
      calls.push({ domain, service, data });
      return Promise.resolve(undefined);
    },
    callApi<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string): Promise<T> {
      apiCalls.push({ method, path });
      const stub = findApiStub(opts.apiResponses, path);
      if (stub === undefined) {
        return Promise.reject(new Error(`mock-hass: no apiResponses stub matches "${path}"`));
      }
      return Promise.resolve(stub as T);
    },
    callWS<T>(message: { readonly type: string } & Record<string, unknown>): Promise<T> {
      wsCalls.push(message);
      const stub = (opts.wsResponses ?? {})[message.type];
      if (stub === undefined) {
        return Promise.reject(new Error(`mock-hass: no wsResponses stub for "${message.type}"`));
      }
      return Promise.resolve(stub as T);
    },
  };
}
