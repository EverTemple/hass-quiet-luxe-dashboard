import { viewUrl } from '../config';
import {
  PATHS,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type StrategyContext,
} from '../types';
import { climatePartnerOf, fanCardConfig, isFanDevice } from './fan-device';
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

export interface ClimateCardOptions {
  readonly areaId?: string;
  readonly limit?: number;
  /**
   * The All-Climates view is the one place a device gets the room to itself, so
   * fan devices draw their whole dial grid there instead of the compact card.
   */
  readonly fanForm?: 'compact' | 'full';
}

/**
 * A fan device and its paired `climate` entity are one appliance, so the pair
 * collapses to a single fan card. Dropping the climate id here rather than in
 * `climateEntityIds` keeps the ordering — and the "active devices first" sort —
 * working off the full set.
 */
function pairedClimateIds(
  ctx: StrategyContext,
  ids: ReadonlyArray<string>,
): ReadonlySet<string> {
  const paired = new Set<string>();
  for (const id of ids) {
    if (!isFanDevice(ctx, id)) {
      continue;
    }
    const climate = climatePartnerOf(ctx, id);
    if (climate !== undefined) {
      paired.add(climate);
    }
  }
  return paired;
}

export function climateCards(
  ctx: StrategyContext,
  areaId?: string,
  limit?: number,
  fanForm: 'compact' | 'full' = 'compact',
): ReadonlyArray<LovelaceCardConfig> {
  const ids = climateEntityIds(ctx, areaId);
  const paired = pairedClimateIds(ctx, ids);
  const visible = ids.filter((id) => !paired.has(id));
  const scoped = limit === undefined ? visible : visible.slice(0, limit);
  return scoped.map((entity) =>
    isFanDevice(ctx, entity)
      ? fanCardConfig(ctx, entity, fanForm)
      : { type: 'custom:quiet-luxe-climate-card', entity },
  );
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
