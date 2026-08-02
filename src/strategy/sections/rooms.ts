import { DEFAULT_PHOTO_BASE, viewUrl, type HomeConfig } from '../config';
import { chipLabels, roomName } from '../labels';
import type { AreaEntry } from '../registry';
import {
  roomPath,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type StrategyContext,
} from '../types';
import { headingCard, sectionOf } from './heading';

/** Photo precedence: config override → HA area picture → photo_base default. */
export function roomPhoto(home: HomeConfig, area: AreaEntry): string {
  const override = home.rooms?.[area.area_id]?.photo;
  if (override !== undefined) {
    return override;
  }
  if (area.picture !== null) {
    return area.picture;
  }
  return `${home.photo_base ?? DEFAULT_PHOTO_BASE}/${area.area_id}.jpg`;
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
  return {
    type: 'custom:quiet-luxe-room-card',
    name: roomName(ctx.home, area),
    image: roomPhoto(ctx.home, area),
    navigation_path: viewUrl(ctx.home, roomPath(areaId)),
    temperature_entity: registry.inArea(areaId, 'sensor', 'temperature')[0],
    aqi_entity: registry.inArea(areaId, 'sensor', 'aqi')[0],
    lights_entity: registry.inArea(areaId, 'light')[0],
    chips,
    grid_options: { columns: 6 },
  };
}

/** Home "Rooms" grid: 2-per-row photo cards spanning two view columns (spec §6). */
export function roomsSection(ctx: StrategyContext): LovelaceSectionConfig | null {
  const cards = orderedAreas(ctx).map((area) => roomCardFor(ctx, area));
  return sectionOf(headingCard(ctx.locale, 'section.rooms'), cards, 2);
}
