import { viewUrl } from '../config';
import { roomName, roomScopedLabels } from '../labels';
import type { AreaEntry } from '../registry';
import { climateSection } from '../sections/climate';
import { headingCard, sectionOf } from '../sections/heading';
import { mediaSection } from '../sections/media';
import { orderedAreas } from '../sections/rooms';
import { sensorsSection } from '../sections/sensors';
import {
  isSection,
  PATHS,
  roomPath,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type LovelaceViewConfig,
  type StrategyContext,
} from '../types';

function roomHeaderSection(ctx: StrategyContext, area: AreaEntry): LovelaceSectionConfig {
  const areaId = area.area_id;
  return {
    type: 'grid',
    column_span: 2,
    cards: [
      {
        type: 'custom:quiet-luxe-header-card',
        form: 'room',
        name: roomName(ctx.home, area),
        temperature_entity: ctx.registry.inArea(areaId, 'sensor', 'temperature')[0],
        humidity_entity: ctx.registry.inArea(areaId, 'sensor', 'humidity')[0],
        aqi_entity: ctx.registry.inArea(areaId, 'sensor', 'aqi')[0],
        back_path: viewUrl(ctx.home, PATHS.home),
      },
    ],
  };
}

/* Room views are titled with the room, so their cards are named without it. */
function lightCards(ctx: StrategyContext, area: AreaEntry): ReadonlyArray<LovelaceCardConfig> {
  return roomScopedLabels(ctx, area, ctx.registry.inArea(area.area_id, 'light')).map(
    ({ entityId, label }) => ({
      type: 'custom:quiet-luxe-light-card',
      entity: entityId,
      name: label,
      grid_options: { columns: 6 },
    }),
  );
}

function coverCards(ctx: StrategyContext, area: AreaEntry): ReadonlyArray<LovelaceCardConfig> {
  return roomScopedLabels(ctx, area, ctx.registry.inArea(area.area_id, 'cover')).map(
    ({ entityId, label }) => ({
      type: 'custom:quiet-luxe-cover-card',
      entity: entityId,
      name: label,
      grid_options: { columns: 6 },
    }),
  );
}

/** Switches already surfaced as admin flows or motion toggles stay out (D9). */
function excludedSwitchIds(ctx: StrategyContext): ReadonlySet<string> {
  const flowIds = (ctx.home.admin_flows ?? []).map((flow) => flow.entity);
  const motionToggleIds = ctx.registry
    .all('binary_sensor', 'motion')
    .flatMap((motion) => ctx.registry.siblings(motion).filter((id) => id.startsWith('switch.')));
  return new Set([...flowIds, ...motionToggleIds]);
}

function switchCards(ctx: StrategyContext, area: AreaEntry): ReadonlyArray<LovelaceCardConfig> {
  const excluded = excludedSwitchIds(ctx);
  const entityIds = ctx.registry.inArea(area.area_id, 'switch').filter((id) => !excluded.has(id));
  return roomScopedLabels(ctx, area, entityIds).map(({ entityId, label }) => ({
    type: 'custom:quiet-luxe-device-cutout-card',
    entity: entityId,
    name: label,
  }));
}

/** Room drill-in (spec §6): fixed priority, rendering only what exists. */
export function roomView(ctx: StrategyContext, area: AreaEntry): LovelaceViewConfig {
  const areaId = area.area_id;
  const sections = [
    roomHeaderSection(ctx, area),
    sectionOf(headingCard(ctx.locale, 'section.lights'), lightCards(ctx, area)),
    climateSection(ctx, { areaId }),
    sectionOf(headingCard(ctx.locale, 'section.covers'), coverCards(ctx, area)),
    mediaSection(ctx, areaId),
    sensorsSection(ctx, areaId),
    sectionOf(headingCard(ctx.locale, 'section.switches'), switchCards(ctx, area)),
  ].filter(isSection);
  return {
    title: roomName(ctx.home, area),
    path: roomPath(areaId),
    type: 'sections',
    subview: true,
    max_columns: 2,
    sections,
  };
}

export function roomViews(ctx: StrategyContext): ReadonlyArray<LovelaceViewConfig> {
  return orderedAreas(ctx).map((area) => roomView(ctx, area));
}
