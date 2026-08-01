import { viewUrl } from '../config';
import {
  PATHS,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type StrategyContext,
} from '../types';
import { headingCard, sectionOf } from './heading';

export function carCard(ctx: StrategyContext): LovelaceCardConfig | null {
  if (ctx.home.car === 'none') {
    return null;
  }
  return {
    type: 'custom:quiet-luxe-car-card',
    brand: ctx.home.car,
    ...(ctx.home.car_entities ?? {}),
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
