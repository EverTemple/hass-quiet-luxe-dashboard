import type { LovelaceSectionConfig, StrategyContext } from '../types';
import { headingCard, sectionOf } from './heading';

export function presenceSection(ctx: StrategyContext): LovelaceSectionConfig | null {
  const persons = ctx.registry.all('person');
  if (persons.length === 0) {
    return null;
  }
  return sectionOf(headingCard(ctx.locale, 'section.presence'), [
    { type: 'custom:ql-row-presence', entities: persons },
  ]);
}
