import { describe, expect, it } from 'vitest';
import { SUBANG_CONFIG, XIAMEN_CONFIG } from '../reference-homes';
import { makeContext, referenceHome } from '../../testing/mock-registry';
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

  it('securityView covers wall + doors/motion', () => {
    const view = securityView(contextFor('subang'));
    expect(view?.path).toBe('security');
    expect(view?.sections).toHaveLength(2);
    expect(securityView(makeContext({}))).toBeNull();
  });

  it('energyView exists only for energy homes', () => {
    expect(energyView(contextFor('subang'))?.path).toBe('energy');
    expect(energyView(contextFor('xiamen'))).toBeNull();
  });

  it('climatesView groups climate devices under area-name headings', () => {
    const view = climatesView(contextFor('subang'));
    const headings = view?.sections.map((section) => section.cards[0]?.heading);
    expect(headings).toEqual(['Main Living', 'Side Living', 'Master Bedroom']);
    expect(climatesView(makeContext({}))).toBeNull();
  });

  it('carView carries the per-home brand and is null for car: none', () => {
    const subangCar = carView(contextFor('subang'));
    expect(subangCar?.sections[0]?.cards[0]).toMatchObject({ brand: 'bmw' });
    const xiamenCar = carView(contextFor('xiamen'));
    expect(xiamenCar?.sections[0]?.cards[0]).toMatchObject({ brand: 'liauto' });
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
    expect(view.sections[0]?.cards[0]).toEqual({ type: 'custom:quiet-luxe-language-card' });
  });
});
