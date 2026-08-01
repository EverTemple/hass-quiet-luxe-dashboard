import type { LovelaceSectionConfig, StrategyContext } from '../types';
import { headingCard, sectionOf } from './heading';

/** Node-RED flow toggle rows (spec §6 Admin). Admin tier only, always. */
export function adminSection(ctx: StrategyContext): LovelaceSectionConfig | null {
  if (ctx.tier !== 'admin') {
    return null;
  }
  const cards = (ctx.home.admin_flows ?? []).map((flow) => ({
    type: 'custom:ql-row-network-flow',
    entity: flow.entity,
    name: flow.name,
    description: flow.description,
  }));
  return sectionOf(headingCard(ctx.locale, 'section.network'), cards);
}
