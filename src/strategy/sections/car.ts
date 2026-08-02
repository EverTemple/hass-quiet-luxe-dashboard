import { anyExists } from '../availability';
import { viewUrl } from '../config';
import {
  PATHS,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type StrategyContext,
} from '../types';
import { headingCard, sectionOf } from './heading';

/**
 * Null unless the car integration is actually present: `car: audi` with
 * placeholder ids is a config intent, not a car (spec §8).
 */
export function carCard(ctx: StrategyContext): LovelaceCardConfig | null {
  if (ctx.home.car === 'none') {
    return null;
  }
  const entities = ctx.home.car_entities ?? {};
  if (!anyExists(ctx, Object.values(entities))) {
    return null;
  }
  return {
    type: 'custom:quiet-luxe-car-card',
    brand: ctx.home.car,
    ...entities,
  };
}

/** Home glance car card — admin only (spec §5: Car is admin-only). */
export function carSection(ctx: StrategyContext): LovelaceSectionConfig | null {
  if (ctx.tier !== 'admin') {
    return null;
  }
  const card = carCard(ctx);
  if (card === null) {
    return null;
  }
  return sectionOf(headingCard(ctx.locale, 'section.car', viewUrl(ctx.home, PATHS.car)), [card]);
}
