import { describe, expect, it } from 'vitest';
import { SUBANG_CONFIG } from '../reference-homes';
import { makeContext, referenceHome } from '../../testing/mock-registry';
import type { StrategyContext } from '../types';
import { homeView } from './home';

function subangContext(tier: 'admin' | 'family' | 'guest' = 'admin'): StrategyContext {
  const { snapshot, entities } = referenceHome('subang');
  return makeContext({ home: { ...SUBANG_CONFIG }, snapshot, entities, tier });
}

describe('homeView', () => {
  it('is a sections view at path home with a full-width header first', () => {
    const view = homeView(subangContext());
    expect(view.title).toBe('Home');
    expect(view.path).toBe('home');
    expect(view.type).toBe('sections');
    expect(view.max_columns).toBe(4);
    expect(view.sections[0]).toEqual({
      type: 'grid',
      column_span: 4,
      cards: [
        {
          type: 'custom:quiet-luxe-header-card',
          form: 'home',
          name: 'Subang Jaya',
          show_greeting: true,
          weather_entity: 'weather.subang',
          aqi_entity: 'sensor.main_living_aqi',
          presence_entities: ['person.mei', 'person.steven'],
        },
      ],
    });
  });

  it('includes the Subang matrix sections: rooms, climate, music, cameras, energy, schedule, presence, car', () => {
    const view = homeView(subangContext());
    const headings = view.sections
      .flatMap((section) => section.cards)
      .filter((card) => card.type === 'heading')
      .map((card) => card.heading);
    expect(headings).toEqual([
      'Rooms',
      'Climate',
      'Music',
      'Cameras',
      'Energy',
      'Schedule',
      'Presence',
      'Car',
    ]);
  });

  it('caps the climate row at three cards', () => {
    const view = homeView(subangContext());
    const climate = view.sections.find((section) =>
      section.cards.some((card) => card.type === 'custom:quiet-luxe-climate-card'),
    );
    expect(
      climate?.cards.filter((card) => card.type === 'custom:quiet-luxe-climate-card'),
    ).toHaveLength(3);
  });

  it('guest tier: no greeting, no car section', () => {
    const view = homeView(subangContext('guest'));
    expect(view.sections[0]?.cards[0]).toMatchObject({ show_greeting: false });
    const headings = view.sections
      .flatMap((section) => section.cards)
      .filter((card) => card.type === 'heading')
      .map((card) => card.heading);
    expect(headings).not.toContain('Car');
  });

  it('an empty home still yields a valid view with just the header', () => {
    const view = homeView(makeContext({}));
    expect(view.sections).toHaveLength(1);
  });
});
