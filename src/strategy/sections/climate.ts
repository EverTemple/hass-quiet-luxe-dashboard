import { hasDialSetpoint } from '../../cards/climate-dial';
import { contentGrid, COLUMNS_FULL } from '../../cards/grid-options';
import { viewUrl } from '../config';
import { orderTallestFirst } from '../layout';
import { areaNameVariants, entityName, stripAreaName } from '../labels';
import type { AreaEntry } from '../registry';
import {
  PATHS,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type StrategyContext,
} from '../types';
import { climatePartnerOf, fanCardConfig, isFanDevice } from './fan-device';
import { headingCard, sectionOf } from './heading';

/**
 * A shorter name is worth it only where the room is already established by
 * context — the room view's own title. A card that reads "AC" (or nothing at
 * all) is worse than one repeating the room name once, so a stripped result
 * under 3 characters is treated the same as an empty one and the untouched
 * name is kept instead.
 */
const MIN_STRIPPED_NAME_LENGTH = 3;

/**
 * A climate card's name inside a single-room view, with that room's own name
 * cut off the entity's name — the room view's title already says it. Feeds
 * both the dial card's eyebrow and the plain tile's label, the same way
 * `roomScopedLabels` already does for the room's light/cover/switch cards.
 * Matches the resolved area (and its aliases/config override) rather than a
 * hardcoded word list, so it degrades safely on a device whose name never
 * mentioned the room to begin with.
 */
function roomScopedClimateName(ctx: StrategyContext, area: AreaEntry, entityId: string): string {
  const full = entityName(ctx, entityId);
  const stripped = stripAreaName(full, areaNameVariants(ctx.home, area));
  return stripped.length < MIN_STRIPPED_NAME_LENGTH ? full : stripped;
}

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

/**
 * A `climate` entity that reports a setpoint gets the dial; one that does not —
 * a purifier or exhaust whose climate entity is only an on/off and a mode — has
 * nothing for a dial to point at and keeps the plain tile.
 *
 * The dial's header glyph mirrors the home header's weather icon, so it
 * resolves the entity the same way the header card does (`home.ts`):
 * `registry.all('weather')[0]` — favourited weather entity first, otherwise
 * alphabetically first, same as every other single-entity registry pick. When
 * an instance has none, the key is omitted rather than sent as `undefined` so
 * the card can tell "no weather entity" apart from a still-loading one.
 *
 * `roomScopedArea`, when given, is the single room the whole view is already
 * titled with (the room view only — Home and All Climates mix rooms on one
 * screen, so they always pass nothing here and keep the full name). It
 * shortens the name on both branches below: the plain tile uses the same
 * shared `nameOf` chain as the dial card, so it crowds the same way.
 */
function climateCardConfig(
  ctx: StrategyContext,
  entity: string,
  form: 'compact' | 'full',
  roomScopedArea?: AreaEntry,
): LovelaceCardConfig {
  if (!entity.startsWith('climate.') || !hasDialSetpoint(ctx.states[entity])) {
    return {
      type: 'custom:quiet-luxe-climate-card',
      entity,
      ...(roomScopedArea === undefined
        ? {}
        : { name: roomScopedClimateName(ctx, roomScopedArea, entity) }),
    };
  }
  const weatherEntity = ctx.registry.all('weather')[0];
  return {
    type: 'custom:quiet-luxe-climate-dial-card',
    entity,
    form,
    ...(weatherEntity === undefined ? {} : { weather_entity: weatherEntity }),
    ...(roomScopedArea === undefined
      ? {}
      : { name: roomScopedClimateName(ctx, roomScopedArea, entity) }),
  };
}

/**
 * `form` is the room a card is given, not the view it is in: All Climates
 * groups by area too, so it passes an `areaId` and still asks for `full`.
 * Every card in one call takes the same form, so a fan and a thermostat
 * standing side by side are the same height.
 */
export function climateCards(
  ctx: StrategyContext,
  areaId?: string,
  limit?: number,
  form: 'compact' | 'full' = 'compact',
  roomScopedArea?: AreaEntry,
): ReadonlyArray<LovelaceCardConfig> {
  const ids = climateEntityIds(ctx, areaId);
  const paired = pairedClimateIds(ctx, ids);
  const visible = ids.filter((id) => !paired.has(id));
  const scoped = limit === undefined ? visible : visible.slice(0, limit);
  return scoped.map((entity) =>
    isFanDevice(ctx, entity)
      ? fanCardConfig(ctx, entity, form)
      : climateCardConfig(ctx, entity, form, roomScopedArea),
  );
}

/**
 * Climate cards for a column that is ONE view track wide — which is every
 * climate column there is: Home's climate rail, the room view's climate region
 * and each All-Climates area column.
 *
 * A track is 296–390px, so the small climate tile's usual half-track is
 * 148–195px: standing under a full-width dial it reads as a stray narrow card
 * rather than the bottom of a stack. In a single-track column every card takes
 * the whole track. Ordered tallest → shortest so the height the column cannot
 * fill is spent at its bottom edge (packing rule 3); the limit is applied first
 * so which devices appear still follows the active-first sort, not the heights.
 */
export function climateColumnCards(
  ctx: StrategyContext,
  areaId?: string,
  limit?: number,
  form: 'compact' | 'full' = 'compact',
  roomScopedArea?: AreaEntry,
): ReadonlyArray<LovelaceCardConfig> {
  return orderTallestFirst(climateCards(ctx, areaId, limit, form, roomScopedArea)).map((card) => ({
    ...card,
    grid_options: contentGrid(COLUMNS_FULL),
  }));
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
    climateColumnCards(ctx, options.areaId, options.limit),
  );
}
