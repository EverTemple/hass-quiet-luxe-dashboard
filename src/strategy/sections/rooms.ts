import { viewUrl, type HomeConfig } from '../config';
import { chipLabels, roomName } from '../labels';
import type { AreaEntry } from '../registry';
import {
  roomPath,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type StrategyContext,
} from '../types';
import { headingCard, sectionOf } from './heading';

/**
 * Photo precedence: config override → HA area picture → `<photo_base>/<area>.jpg`.
 * Undefined when the home has not opted into a photo library, so the card draws
 * its own fallback instead of pointing at a path nobody has filled: guessing a
 * URL that 404s produced the empty black room cards on Tung Chung.
 */
export function roomPhoto(home: HomeConfig, area: AreaEntry): string | undefined {
  const override = home.rooms?.[area.area_id]?.photo;
  if (override !== undefined) {
    return override;
  }
  if (area.picture !== null) {
    return area.picture;
  }
  return home.photo_base === undefined ? undefined : `${home.photo_base}/${area.area_id}.jpg`;
}

/** Visible areas: not hidden by override, at least one visible entity; room_order first, then name. */
export function orderedAreas(ctx: StrategyContext): ReadonlyArray<AreaEntry> {
  const order = ctx.home.room_order ?? [];
  const rank = (area: AreaEntry): number => {
    const index = order.indexOf(area.area_id);
    return index === -1 ? order.length : index;
  };
  return ctx.registry.areas
    .filter((area) => ctx.home.rooms?.[area.area_id]?.hidden !== true)
    .filter((area) => ctx.registry.inAreaAll(area.area_id).length > 0)
    .slice()
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export function roomCardFor(ctx: StrategyContext, area: AreaEntry): LovelaceCardConfig {
  const { registry } = ctx;
  const areaId = area.area_id;
  const chipEntities = [
    registry.inArea(areaId, 'light')[0],
    registry.inArea(areaId, 'climate')[0],
    registry.inArea(areaId, 'cover')[0],
    registry.inArea(areaId, 'media_player', 'tv')[0],
  ].filter((entity): entity is string => entity !== undefined);
  const chips = chipLabels(ctx, area, chipEntities).map(({ entityId, label }) => ({
    entity: entityId,
    label,
  }));
  const photo = roomPhoto(ctx.home, area);
  /* The card's picker writes the AREA's picture, which a YAML `rooms.<id>.photo`
     would then override — so a pinned room is not offered the control at all
     rather than accepting an edit it would silently discard. */
  const pinnedInYaml = ctx.home.rooms?.[areaId]?.photo !== undefined;
  return {
    type: 'custom:quiet-luxe-room-card',
    name: roomName(ctx.home, area),
    ...(photo === undefined ? {} : { image: photo }),
    ...(pinnedInYaml ? {} : { area_id: areaId }),
    navigation_path: viewUrl(ctx.home, roomPath(areaId)),
    temperature_entity: registry.inArea(areaId, 'sensor', 'temperature')[0],
    humidity_entity: registry.inArea(areaId, 'sensor', 'humidity')[0],
    aqi_entity: registry.inArea(areaId, 'sensor', 'aqi')[0],
    lights_entity: registry.inArea(areaId, 'light')[0],
    chips,
    /* Half of the two-column Rooms section (12 of 12×2), which is also full
       width once the view collapses to one column — 2-up, then 1-up. */
    grid_options: { columns: 12 },
  };
}

/** Home "Rooms" grid: 2-per-row photo cards spanning two view columns (spec §6). */
export function roomsSection(ctx: StrategyContext): LovelaceSectionConfig | null {
  const cards = orderedAreas(ctx).map((area) => roomCardFor(ctx, area));
  return sectionOf(headingCard(ctx.locale, 'section.rooms'), cards, 2);
}
