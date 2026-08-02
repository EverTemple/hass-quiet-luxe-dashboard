import { describe, expect, it } from 'vitest';
import { makeEntity } from '../../testing/mock-hass';
import { makeContext, mockArea, mockRegEntity, referenceHome } from '../../testing/mock-registry';
import { SUBANG_CONFIG } from '../reference-homes';
import type { StrategyContext } from '../types';
import { roomViews } from './room';

function subangContext(tier: 'admin' | 'family' | 'guest' = 'admin'): StrategyContext {
  const { snapshot, entities } = referenceHome('subang');
  return makeContext({ home: { ...SUBANG_CONFIG }, snapshot, entities, tier });
}

describe('roomViews', () => {
  it('creates one subview per populated area in room_order', () => {
    const views = roomViews(subangContext());
    expect(views.map((view) => view.path)).toEqual([
      'room-main_living',
      'room-side_living',
      'room-master_bedroom',
    ]);
    expect(views[0]?.subview).toBe(true);
    expect(views[0]?.max_columns).toBe(2);
    expect(views[0]?.title).toBe('Main Living');
  });

  it('leads with a room header carrying stats entities and the back path', () => {
    const view = roomViews(subangContext())[0];
    expect(view?.sections[0]).toEqual({
      type: 'grid',
      column_span: 2,
      cards: [
        {
          type: 'custom:quiet-luxe-header-card',
          form: 'room',
          name: 'Main Living',
          temperature_entity: 'sensor.main_living_temp',
          humidity_entity: 'sensor.main_living_humidity',
          aqi_entity: 'sensor.main_living_aqi',
          back_path: '/quiet-luxe/home',
        },
      ],
    });
  });

  it('renders room sections in the fixed spec §6 priority, only what exists', () => {
    const view = roomViews(subangContext())[0];
    const headings = view?.sections
      .flatMap((section) => section.cards)
      .filter((card) => card.type === 'heading')
      .map((card) => card.heading);
    expect(headings).toEqual([
      'Lights',
      'Climate',
      'Covers',
      'Music',
      'Air & sensors',
      'Switches',
    ]);
  });

  it('the switches section excludes admin flows and motion-toggle switches', () => {
    const view = roomViews(subangContext())[0];
    const switches = view?.sections
      .flatMap((section) => section.cards)
      .filter((card) => card.type === 'custom:quiet-luxe-device-cutout-card')
      .map((card) => card.entity);
    expect(switches).toEqual(['switch.living_fan_rf']);
  });

  it('names room-view cards without repeating the room the view is titled with', () => {
    const ctx = makeContext({
      snapshot: {
        areas: [mockArea('bedroom', 'Master Bedroom')],
        devices: [],
        entities: [
          mockRegEntity('light.a', { area_id: 'bedroom' }),
          mockRegEntity('light.b', { area_id: 'bedroom' }),
          mockRegEntity('cover.a', { area_id: 'bedroom' }),
          mockRegEntity('cover.b', { area_id: 'bedroom' }),
        ],
      },
      entities: [
        makeEntity('light.a', 'on', { friendly_name: 'Master Bedroom Ceiling' }),
        makeEntity('light.b', 'off', { friendly_name: 'Master Bedroom' }),
        makeEntity('cover.a', 'open', { friendly_name: '窗帘 Curatain', device_class: 'curtain' }),
        makeEntity('cover.b', 'open', { friendly_name: '窗纱 Curatain', device_class: 'curtain' }),
      ],
    });
    const named = roomViews(ctx)[0]
      ?.sections.flatMap((section) => section.cards)
      .filter((card) => typeof card['entity'] === 'string')
      .map((card) => card['name']);
    // Ceiling: room name stripped. Lights: name was only the room name.
    // The two curtains keep their own names — they are genuinely different covers.
    expect(named).toEqual(['Ceiling', 'Lights', '窗帘 Curatain', '窗纱 Curatain']);
  });

  it('a bathroom-like sparse area renders only its own sections', () => {
    const views = roomViews(subangContext());
    const sideLiving = views.find((view) => view.path === 'room-side_living');
    const headings = sideLiving?.sections
      .flatMap((section) => section.cards)
      .filter((card) => card.type === 'heading')
      .map((card) => card.heading);
    expect(headings).toEqual(['Climate']); // fan only → just the climate section
  });
});
