import type { SensorMetric } from '../../cards/sensor-format';
import type { LovelaceCardConfig, LovelaceSectionConfig, StrategyContext } from '../types';
import { headingCard, sectionOf } from './heading';
import { doorMotionRows } from './security';

const TILE_METRICS: ReadonlyArray<{ readonly metric: SensorMetric; readonly deviceClass: string }> = [
  { metric: 'temp', deviceClass: 'temperature' },
  { metric: 'humidity', deviceClass: 'humidity' },
  { metric: 'aqi', deviceClass: 'aqi' },
];

export function sensorTiles(ctx: StrategyContext, areaId: string): ReadonlyArray<LovelaceCardConfig> {
  return TILE_METRICS.flatMap(({ metric, deviceClass }) =>
    ctx.registry
      .inArea(areaId, 'sensor', deviceClass)
      .map((entity) => ({ type: 'custom:quiet-luxe-sensor-tile', entity, metric })),
  );
}

/** Room "Air & sensors" (spec §6): tiles + door/motion rows (toggles per tier). */
export function sensorsSection(ctx: StrategyContext, areaId: string): LovelaceSectionConfig | null {
  const cards = [...sensorTiles(ctx, areaId), ...doorMotionRows(ctx, areaId)];
  return sectionOf(headingCard(ctx.locale, 'section.sensors'), cards);
}
