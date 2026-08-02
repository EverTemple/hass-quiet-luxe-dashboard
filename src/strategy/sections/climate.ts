import { viewUrl } from '../config';
import {
  PATHS,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type StrategyContext,
} from '../types';
import { headingCard, sectionOf } from './heading';

/** Spec climate row covers ACs, fans/purifiers, dehumidifiers (§6). */
export const CLIMATE_DOMAINS = ['climate', 'fan', 'humidifier'] as const;

const INACTIVE_STATES = new Set(['off', 'unavailable', 'unknown', 'idle']);

/** "Active devices first" sort (spec §6), stable within groups. */
export function climateEntityIds(ctx: StrategyContext, areaId?: string): ReadonlyArray<string> {
  const ids = CLIMATE_DOMAINS.flatMap((domain) =>
    areaId === undefined ? ctx.registry.all(domain) : ctx.registry.inArea(areaId, domain),
  );
  const inactiveRank = (id: string): number =>
    INACTIVE_STATES.has(ctx.states[id]?.state ?? 'unavailable') ? 1 : 0;
  return [...ids].sort((a, b) => inactiveRank(a) - inactiveRank(b));
}

export function climateCards(
  ctx: StrategyContext,
  areaId?: string,
  limit?: number,
): ReadonlyArray<LovelaceCardConfig> {
  const ids = climateEntityIds(ctx, areaId);
  const scoped = limit === undefined ? ids : ids.slice(0, limit);
  return scoped.map((entity) => ({ type: 'custom:quiet-luxe-climate-card', entity }));
}

export interface ClimateSectionOptions {
  readonly areaId?: string;
  readonly limit?: number;
}

export function climateSection(
  ctx: StrategyContext,
  options: ClimateSectionOptions = {},
): LovelaceSectionConfig | null {
  const nav = options.areaId === undefined ? viewUrl(ctx.home, PATHS.climates) : undefined;
  return sectionOf(
    headingCard(ctx.locale, 'section.climate', nav),
    climateCards(ctx, options.areaId, options.limit),
  );
}
