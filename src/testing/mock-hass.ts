import type { HassEntity, HomeAssistant } from '../types/home-assistant';

export interface RecordedServiceCall {
  readonly domain: string;
  readonly service: string;
  readonly data?: Record<string, unknown>;
}

/** HomeAssistant double with a service-call spy. Test/dev-harness use only. */
export interface MockHass extends HomeAssistant {
  readonly calls: ReadonlyArray<RecordedServiceCall>;
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

export function makeMockHass(
  entities: ReadonlyArray<HassEntity> = [],
  language = 'en',
): MockHass {
  const calls: RecordedServiceCall[] = [];
  return {
    states: Object.fromEntries(entities.map((entity) => [entity.entity_id, entity])),
    language,
    locale: { language },
    calls,
    callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown> {
      calls.push({ domain, service, data });
      return Promise.resolve(undefined);
    },
  };
}
