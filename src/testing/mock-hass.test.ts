import { describe, expect, it } from 'vitest';
import {
  climateEntity,
  coverEntity,
  lightEntity,
  makeEntity,
  makeMockHass,
  sensorEntity,
} from './mock-hass';

describe('makeEntity', () => {
  it('builds a fully-populated HassEntity', () => {
    const entity = makeEntity('light.desk', 'on', { brightness: 128 });
    expect(entity.entity_id).toBe('light.desk');
    expect(entity.state).toBe('on');
    expect(entity.attributes).toEqual({ brightness: 128 });
    expect(entity.context.user_id).toBeNull();
  });
});

describe('typed factories', () => {
  it('lightEntity carries brightness only when on', () => {
    expect(lightEntity('light.a', 'on', 178).attributes).toEqual({ brightness: 178 });
    expect(lightEntity('light.a', 'off').attributes).toEqual({});
  });

  it('climateEntity defaults current_temperature and merges attributes', () => {
    const entity = climateEntity('climate.ac', 'cool', { hvac_action: 'cooling' });
    expect(entity.attributes).toEqual({ current_temperature: 24.5, hvac_action: 'cooling' });
  });

  it('coverEntity derives state from position', () => {
    expect(coverEntity('cover.c', 65).state).toBe('open');
    expect(coverEntity('cover.c', 65).attributes.current_position).toBe(65);
    expect(coverEntity('cover.c', 0).state).toBe('closed');
  });

  it('sensorEntity passes state and attributes through', () => {
    const entity = sensorEntity('sensor.aqi', '18', { device_class: 'aqi' });
    expect(entity.state).toBe('18');
    expect(entity.attributes.device_class).toBe('aqi');
  });
});

describe('makeMockHass', () => {
  it('keys states by entity_id and exposes locale/language', () => {
    const hass = makeMockHass([lightEntity('light.a', 'on')], 'zh-Hant');
    expect(hass.states['light.a']?.state).toBe('on');
    expect(hass.language).toBe('zh-Hant');
    expect(hass.locale?.language).toBe('zh-Hant');
  });

  it('records every service call in order', async () => {
    const hass = makeMockHass();
    await hass.callService('light', 'turn_on', { entity_id: 'light.a', brightness_pct: 60 });
    await hass.callService('cover', 'stop_cover', { entity_id: 'cover.c' });
    expect(hass.calls).toEqual([
      { domain: 'light', service: 'turn_on', data: { entity_id: 'light.a', brightness_pct: 60 } },
      { domain: 'cover', service: 'stop_cover', data: { entity_id: 'cover.c' } },
    ]);
  });
});

describe('makeMockHass api/ws spies', () => {
  it('still accepts a plain language string (Plan 3a call sites)', () => {
    expect(makeMockHass([], 'ms').language).toBe('ms');
  });

  it('records callApi calls and resolves exact-path stubs', async () => {
    const hass = makeMockHass([], {
      apiResponses: { calendars: [{ entity_id: 'calendar.a' }] },
    });
    await expect(hass.callApi?.('GET', 'calendars')).resolves.toEqual([
      { entity_id: 'calendar.a' },
    ]);
    expect(hass.apiCalls).toEqual([{ method: 'GET', path: 'calendars' }]);
  });

  it('falls back to prefix-matched stubs for parameterised paths', async () => {
    const hass = makeMockHass([], { apiResponses: { 'calendars/calendar.a': [] } });
    await expect(hass.callApi?.('GET', 'calendars/calendar.a?start=x&end=y')).resolves.toEqual([]);
  });

  it('rejects loudly when no stub matches', async () => {
    const hass = makeMockHass();
    await expect(hass.callApi?.('GET', 'history')).rejects.toThrow('no apiResponses stub');
    await expect(hass.callWS?.({ type: 'todo/item/list' })).rejects.toThrow('no wsResponses stub');
  });

  it('records callWS messages and resolves stubs by type', async () => {
    const hass = makeMockHass([], { wsResponses: { 'todo/item/list': { items: [] } } });
    await expect(
      hass.callWS?.({ type: 'todo/item/list', entity_id: 'todo.a' }),
    ).resolves.toEqual({ items: [] });
    expect(hass.wsCalls).toEqual([{ type: 'todo/item/list', entity_id: 'todo.a' }]);
  });
});
