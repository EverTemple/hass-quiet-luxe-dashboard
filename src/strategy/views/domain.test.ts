import { describe, expect, it } from 'vitest';
import { SUBANG_CONFIG, XIAMEN_CONFIG } from '../reference-homes';
import { makeEntity } from '../../testing/mock-hass';
import { makeContext, mockArea, mockRegEntity, referenceHome } from '../../testing/mock-registry';
import type { StrategyContext } from '../types';
import {
  adminView,
  carView,
  climatesView,
  energyView,
  languageView,
  mediaView,
  securityView,
} from './domain';

function contextFor(
  name: 'subang' | 'xiamen',
  tier: 'admin' | 'family' | 'guest' = 'admin',
): StrategyContext {
  const home = name === 'subang' ? SUBANG_CONFIG : XIAMEN_CONFIG;
  const { snapshot, entities } = referenceHome(name);
  return makeContext({ home: { ...home }, snapshot, entities, tier });
}

describe('domain views', () => {
  it('mediaView exists when players exist and is null otherwise', () => {
    expect(mediaView(contextFor('subang'))?.path).toBe('media');
    expect(mediaView(makeContext({}))).toBeNull();
  });

  it('securityView covers wall + doors/motion behind the view header', () => {
    const view = securityView(contextFor('subang'));
    expect(view?.path).toBe('security');
    expect(view?.sections).toHaveLength(3);
    expect(securityView(makeContext({}))).toBeNull();
  });

  it('every non-Home view opens with a header that goes back to the dashboard', () => {
    const views = [
      mediaView(contextFor('subang')),
      securityView(contextFor('subang')),
      energyView(contextFor('subang')),
      climatesView(contextFor('subang')),
      carView(contextFor('subang')),
      adminView(contextFor('subang')),
      languageView(contextFor('subang')),
    ];
    for (const view of views) {
      expect(view?.sections[0]?.cards[0]).toMatchObject({
        type: 'custom:quiet-luxe-header-card',
        form: 'view',
        name: view?.title,
        back_path: '/quiet-luxe/home',
      });
      expect(view?.sections[0]?.column_span).toBe(4);
      expect(view?.dense_section_placement).toBe(true);
    }
  });

  it('every view runs the full four-track grid, single-card views included', () => {
    expect(mediaView(contextFor('subang'))?.max_columns).toBe(4);
    expect(securityView(contextFor('subang'))?.max_columns).toBe(4);
    expect(energyView(contextFor('subang'))?.max_columns).toBe(4);
    expect(climatesView(contextFor('subang'))?.max_columns).toBe(4);
    expect(carView(contextFor('subang'))?.max_columns).toBe(4);
    expect(adminView(contextFor('subang'))?.max_columns).toBe(4);
    expect(languageView(contextFor('subang')).max_columns).toBe(4);
  });

  it('car, admin and language keep their content column narrow within the four-track view', () => {
    expect(carView(contextFor('subang'))?.sections[1]?.column_span).toBe(2);
    expect(adminView(contextFor('subang'))?.sections[1]?.column_span).toBe(2);
    expect(languageView(contextFor('subang')).sections[1]?.column_span).toBe(2);
  });

  it('energyView exists only for energy homes', () => {
    expect(energyView(contextFor('subang'))?.path).toBe('energy');
    expect(energyView(contextFor('xiamen'))).toBeNull();
  });

  /**
   * The strategy runs once, with no viewport, so a section can never claim
   * "4 columns" worth of span — HA resolves the real column count at
   * render time and would clamp a wider span wrong at any narrower width.
   * Each area therefore contributes a full-band heading section plus one
   * span-1 section PER CARD, so HA's own row-flow tiles them across however
   * many columns it resolves, at every width, with no assumption baked in
   * here.
   */
  describe('climatesView (three areas, one card each — subang)', () => {
    it('groups climate devices under area-name headings, in room order', () => {
      const view = climatesView(contextFor('subang'));
      const headingSections = view?.sections.slice(1).filter((section) => section.cards[0]?.type === 'heading');
      expect(headingSections?.map((section) => section.cards[0]?.heading)).toEqual([
        'Main Living',
        'Side Living',
        'Master Bedroom',
      ]);
      /* Every heading owns the full four-track band. */
      expect(headingSections?.every((section) => section.column_span === 4)).toBe(true);
      expect(climatesView(makeContext({}))).toBeNull();
    });

    /**
     * The column is one track, so a card that keeps its half-track default stands
     * ~150px wide under a full-width dial. The room view already forced the full
     * track; All Climates did not, which put a half-width dehumidifier tile at the
     * bottom of the live Steven Bedroom column.
     */
    it('gives every All-Climates card its own span-1 section at the whole track width', () => {
      const view = climatesView(contextFor('subang'));
      const cardSections = view?.sections.slice(1).filter((section) => section.cards[0]?.type !== 'heading') ?? [];
      expect(cardSections.length).toBeGreaterThan(0);
      for (const section of cardSections) {
        expect(section.column_span, JSON.stringify(section.cards[0])).toBe(1);
        expect(section.cards).toHaveLength(1);
        expect(section.cards[0]?.grid_options, section.cards[0]?.entity as string).toEqual({
          columns: 12,
          rows: 'auto',
        });
      }
    });
  });

  describe('climatesView (single qualifying area, two cards)', () => {
    const snapshot = {
      areas: [mockArea('bedroom', 'Bedroom')],
      devices: [],
      entities: [
        mockRegEntity('climate.steven_bedroom', { area_id: 'bedroom' }),
        mockRegEntity('climate.exhaust', { area_id: 'bedroom' }),
      ],
    };
    /** 937 with a reported setpoint → dial (446px); 384 = on/off only → plain tile (130px). */
    const entities = [
      makeEntity('climate.steven_bedroom', 'cool', { supported_features: 937, temperature: 23 }),
      makeEntity('climate.exhaust', 'fan_only', { supported_features: 384 }),
    ];

    it('emits one full-band heading then one span-1 section per card, tallest first', () => {
      const view = climatesView(makeContext({ snapshot, entities }));
      const sections = view?.sections.slice(1) ?? [];
      expect(sections).toHaveLength(3);
      expect(sections[0]).toEqual({
        type: 'grid',
        column_span: 4,
        cards: [{ type: 'heading', heading: 'Bedroom' }],
      });
      expect(sections[1]?.column_span).toBe(1);
      expect(sections[1]?.cards[0]).toMatchObject({
        type: 'custom:quiet-luxe-climate-dial-card',
        entity: 'climate.steven_bedroom',
      });
      expect(sections[2]?.column_span).toBe(1);
      expect(sections[2]?.cards[0]).toMatchObject({
        type: 'custom:quiet-luxe-climate-card',
        entity: 'climate.exhaust',
      });
    });
  });

  describe('climatesView (two qualifying areas, one card each)', () => {
    const snapshot = {
      areas: [mockArea('living', 'Living Room'), mockArea('bedroom', 'Bedroom')],
      devices: [],
      entities: [
        mockRegEntity('climate.living_ac', { area_id: 'living' }),
        mockRegEntity('climate.bedroom_ac', { area_id: 'bedroom' }),
        mockRegEntity('light.storage_light', { area_id: 'storage' }),
      ],
    };
    const entities = [
      makeEntity('climate.living_ac', 'cool', { supported_features: 937, temperature: 22 }),
      makeEntity('climate.bedroom_ac', 'cool', { supported_features: 937, temperature: 24 }),
    ];

    it('keeps area grouping and ordering, heading then card, per area', () => {
      const view = climatesView(makeContext({ snapshot, entities }));
      const shape = (view?.sections.slice(1) ?? []).map((section) => ({
        span: section.column_span,
        first: section.cards[0]?.heading ?? section.cards[0]?.entity,
      }));
      /* No room_order override, so orderedAreas falls back to name order:
         Bedroom before Living Room. */
      expect(shape).toEqual([
        { span: 4, first: 'Bedroom' },
        { span: 1, first: 'climate.bedroom_ac' },
        { span: 4, first: 'Living Room' },
        { span: 1, first: 'climate.living_ac' },
      ]);
    });

    it('drops an area entirely, heading included, when it has no climate cards', () => {
      const noClimateSnapshot = {
        areas: [mockArea('living', 'Living Room'), mockArea('storage', 'Storage')],
        devices: [],
        entities: [
          mockRegEntity('climate.living_ac', { area_id: 'living' }),
          mockRegEntity('light.storage_light', { area_id: 'storage' }),
        ],
      };
      const noClimateEntities = [
        makeEntity('climate.living_ac', 'cool', { supported_features: 937, temperature: 22 }),
        makeEntity('light.storage_light', 'off'),
      ];
      const view = climatesView(makeContext({ snapshot: noClimateSnapshot, entities: noClimateEntities }));
      const headings = view?.sections
        .slice(1)
        .filter((section) => section.cards[0]?.type === 'heading')
        .map((section) => section.cards[0]?.heading);
      expect(headings).toEqual(['Living Room']);
    });
  });

  it('carView carries the per-home brand and is null for car: none', () => {
    const subangCar = carView(contextFor('subang'));
    expect(subangCar?.sections[1]?.cards[0]).toMatchObject({ brand: 'bmw' });
    const xiamenCar = carView(contextFor('xiamen'));
    expect(xiamenCar?.sections[1]?.cards[0]).toMatchObject({ brand: 'liauto' });
    expect(carView(makeContext({}))).toBeNull();
  });

  it('adminView exists only with configured flows and admin tier', () => {
    expect(adminView(contextFor('subang'))?.path).toBe('admin');
    expect(adminView(contextFor('subang', 'family'))).toBeNull();
    expect(adminView(makeContext({}))).toBeNull();
  });

  it('languageView always exists with the language card', () => {
    const view = languageView(makeContext({}));
    expect(view.path).toBe('language');
    expect(view.sections[1]?.cards[0]).toEqual({ type: 'custom:quiet-luxe-language-card' });
  });
});
