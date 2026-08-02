import { describe, expect, it } from 'vitest';
import { makeContext } from '../../testing/mock-registry';
import type { LovelaceCardConfig } from '../types';
import { columnSection, headingCard, sectionOf, viewHeaderSection } from './heading';

const light = (entity: string): LovelaceCardConfig => ({
  type: 'custom:quiet-luxe-light-card',
  entity,
});

describe('headingCard', () => {
  it('navigates only when given a path', () => {
    expect(headingCard('en', 'section.lights')).toEqual({ type: 'heading', heading: 'Lights' });
    expect(headingCard('en', 'section.lights', '/quiet-luxe/home')).toEqual({
      type: 'heading',
      heading: 'Lights',
      tap_action: { action: 'navigate', navigation_path: '/quiet-luxe/home' },
    });
  });
});

describe('sectionOf', () => {
  it('drops a section that has nothing beyond its heading (spec §8)', () => {
    expect(sectionOf(headingCard('en', 'section.lights'), [])).toBeNull();
  });

  it('carries a span only when one is asked for', () => {
    const cards = [light('light.a')];
    expect(sectionOf(headingCard('en', 'section.lights'), cards)?.column_span).toBeUndefined();
    expect(sectionOf(headingCard('en', 'section.lights'), cards, 2)?.column_span).toBe(2);
  });
});

describe('columnSection', () => {
  it('runs several headed groups down one section, in order', () => {
    const section = columnSection(
      [
        { heading: headingCard('en', 'section.lights'), cards: [light('light.a')] },
        { heading: headingCard('en', 'section.covers'), cards: [{ type: 'custom:x' }] },
      ],
      2,
    );
    expect(section?.column_span).toBe(2);
    expect(section?.cards.map((card) => card.heading ?? card.type)).toEqual([
      'Lights',
      'custom:quiet-luxe-light-card',
      'Covers',
      'custom:x',
    ]);
  });

  it('drops an empty group with its heading, and the column when all are empty', () => {
    const partial = columnSection(
      [
        { heading: headingCard('en', 'section.lights'), cards: [] },
        { heading: headingCard('en', 'section.covers'), cards: [light('light.a')] },
      ],
      2,
    );
    expect(partial?.cards.map((card) => card.heading ?? card.type)).toEqual([
      'Covers',
      'custom:quiet-luxe-light-card',
    ]);
    expect(
      columnSection([{ heading: headingCard('en', 'section.lights'), cards: [] }], 1),
    ).toBeNull();
  });
});

describe('viewHeaderSection', () => {
  const ctx = makeContext({});

  it('spans the whole band and always points back at the dashboard root', () => {
    const section = viewHeaderSection(ctx, { title: 'Security' });
    expect(section.column_span).toBe(4);
    expect(section.cards[0]).toEqual({
      type: 'custom:quiet-luxe-header-card',
      form: 'view',
      name: 'Security',
      back_path: '/quiet-luxe/home',
      back_label: 'Home',
    });
  });

  it('carries a subtitle, stat entities and an action when given them', () => {
    const section = viewHeaderSection(ctx, {
      title: 'Living Room',
      temperatureEntity: 'sensor.temp',
      aqiEntity: 'sensor.aqi',
      actionLabel: 'All climates',
      actionPath: '/quiet-luxe/climates',
    });
    expect(section.cards[0]).toMatchObject({
      temperature_entity: 'sensor.temp',
      aqi_entity: 'sensor.aqi',
      action_label: 'All climates',
      action_path: '/quiet-luxe/climates',
    });
    expect(section.cards[0]?.humidity_entity).toBeUndefined();
  });

  it('omits the action unless both a label and a path arrive', () => {
    const section = viewHeaderSection(ctx, { title: 'Media', actionLabel: 'All climates' });
    expect(section.cards[0]?.action_label).toBeUndefined();
  });
});
