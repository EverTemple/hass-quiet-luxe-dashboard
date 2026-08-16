import { contentGrid, COLUMNS_HALF_OF_WIDE_SECTION } from '../../cards/grid-options';
import { t } from '../../i18n/translate';
import { viewUrl } from '../config';
import { roomName, roomScopedLabels } from '../labels';
import { MAX_COLUMNS, REGION_SPAN, ROOM_CONTROLS_ROW_SPAN } from '../layout';
import type { AreaEntry } from '../registry';
import { climateColumnCards } from '../sections/climate';
import { columnSection, headingCard, viewHeaderSection } from '../sections/heading';
import { orderedPlayers } from '../sections/media';
import { orderedAreas } from '../sections/rooms';
import { doorMotionRows } from '../sections/security';
import { sensorTiles } from '../sections/sensors';
import {
  isSection,
  PATHS,
  roomPath,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type LovelaceViewConfig,
  type StrategyContext,
} from '../types';

/* Room views are titled with the room, so their cards are named without it. */
function lightCards(ctx: StrategyContext, area: AreaEntry): ReadonlyArray<LovelaceCardConfig> {
  return roomScopedLabels(ctx, area, ctx.registry.inArea(area.area_id, 'light')).map(
    ({ entityId, label }) => ({
      type: 'custom:quiet-luxe-light-card',
      entity: entityId,
      name: label,
    }),
  );
}

/**
 * Covers ask for half of ONE view column by default, which in this two-column
 * band leaves them ~189px — narrow enough that Open / Stop / Close wraps onto a
 * second line. Half of the BAND is the size the design draws them at, and the
 * same number collapses to full width once the band is one track (mobile).
 */
function coverCards(ctx: StrategyContext, area: AreaEntry): ReadonlyArray<LovelaceCardConfig> {
  return roomScopedLabels(ctx, area, ctx.registry.inArea(area.area_id, 'cover')).map(
    ({ entityId, label }) => ({
      type: 'custom:quiet-luxe-cover-card',
      entity: entityId,
      name: label,
      grid_options: contentGrid(COLUMNS_HALF_OF_WIDE_SECTION),
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

function mediaCards(ctx: StrategyContext, areaId: string): ReadonlyArray<LovelaceCardConfig> {
  const players = orderedPlayers(ctx, areaId);
  if (players.length === 0) {
    return [];
  }
  /* The bar is the last thing in the column, so it runs the column's width. */
  return [
    {
      type: 'custom:quiet-luxe-media-card',
      entity: players[0],
      form: 'bar',
      grid_options: contentGrid('full'),
    },
  ];
}

function headerSection(ctx: StrategyContext, area: AreaEntry): LovelaceSectionConfig {
  const areaId = area.area_id;
  return viewHeaderSection(ctx, {
    title: roomName(ctx.home, area),
    temperatureEntity: ctx.registry.inArea(areaId, 'sensor', 'temperature')[0],
    humidityEntity: ctx.registry.inArea(areaId, 'sensor', 'humidity')[0],
    aqiEntity: ctx.registry.inArea(areaId, 'sensor', 'aqi')[0],
    actionLabel: t(ctx.locale, 'section.all_climates'),
    actionPath: viewUrl(ctx.home, PATHS.climates),
  });
}

/**
 * Room drill-in (spec §6, Figma `04 Desktop` Room 102:1653): three columns —
 * climate (1 track) · lights + covers + switches + music (2) · sensors (1).
 *
 * The regions are three SECTIONS rather than seven because seven sections tile
 * across two grid rows and the short ones leave holes in the middle of the
 * page; three column-sections sit in one row, each hugging its own content.
 * Below 640px the three collapse into one stack in this order.
 *
 * KNOWN DEVIATION, awaiting a decision. The spec gives the room a fixed mobile
 * priority — lights → climate → covers → media → air & sensors → switches — and
 * one DOM order has to serve both breakpoints, so the columns decide the phone
 * stack: climate → lights/covers/switches/music → air & sensors. The spec order
 * interleaves climate between lights and covers and puts switches last, which
 * needs them in separate sections, i.e. not this layout. Three columns can lead
 * with either climate or the controls group; they cannot reproduce the spec's
 * order. Nothing per-breakpoint is available: a strategy runs once, with no
 * viewport, and `hui-sections-view` reads no ordering hint of ours.
 */
export function roomView(ctx: StrategyContext, area: AreaEntry): LovelaceViewConfig {
  const areaId = area.area_id;
  const climate = columnSection(
    [
      {
        heading: headingCard(ctx.locale, 'section.climate'),
        /* Only the room view passes its own area: the title already names the
           room, so the dial's eyebrow can drop it. Home and All Climates mix
           rooms on one screen and never pass this. */
        cards: climateColumnCards(ctx, areaId, undefined, 'compact', area),
      },
    ],
    REGION_SPAN.roomClimate,
  );
  const controls = columnSection(
    [
      { heading: headingCard(ctx.locale, 'section.lights'), cards: lightCards(ctx, area) },
      { heading: headingCard(ctx.locale, 'section.covers'), cards: coverCards(ctx, area) },
      { heading: headingCard(ctx.locale, 'section.switches'), cards: switchCards(ctx, area) },
      { heading: headingCard(ctx.locale, 'section.music'), cards: mediaCards(ctx, areaId) },
    ],
    REGION_SPAN.roomLights,
    ROOM_CONTROLS_ROW_SPAN,
  );
  const sensors = columnSection(
    [
      {
        heading: headingCard(ctx.locale, 'section.sensors'),
        cards: [...sensorTiles(ctx, areaId), ...doorMotionRows(ctx, areaId)],
      },
    ],
    REGION_SPAN.roomSensors,
  );
  const sections = [headerSection(ctx, area), climate, controls, sensors].filter(isSection);
  return {
    title: roomName(ctx.home, area),
    path: roomPath(areaId),
    type: 'sections',
    subview: true,
    max_columns: MAX_COLUMNS,
    dense_section_placement: true,
    sections,
  };
}

export function roomViews(ctx: StrategyContext): ReadonlyArray<LovelaceViewConfig> {
  return orderedAreas(ctx).map((area) => roomView(ctx, area));
}
