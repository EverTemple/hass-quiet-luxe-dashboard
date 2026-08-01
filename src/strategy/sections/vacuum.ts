import type { LovelaceSectionConfig, StrategyContext } from '../types';
import { headingCard, sectionOf } from './heading';

export function vacuumSection(ctx: StrategyContext): LovelaceSectionConfig | null {
  if (!ctx.home.vacuum) {
    return null;
  }
  const entity = ctx.registry.all('vacuum')[0];
  if (entity === undefined) {
    return null; // flag on but integration absent → never renders (spec §8)
  }
  return sectionOf(headingCard(ctx.locale, 'section.vacuum'), [
    { type: 'custom:quiet-luxe-vacuum-card', entity },
  ]);
}
