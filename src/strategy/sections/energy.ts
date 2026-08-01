import { t } from '../../i18n/translate';
import { viewUrl, type EnergyConfig } from '../config';
import {
  isSection,
  PATHS,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type StrategyContext,
} from '../types';
import { headingCard, sectionOf } from './heading';

/** Home glance strip (spec §6 right rail / mobile glance row). */
export function energySection(ctx: StrategyContext): LovelaceSectionConfig | null {
  const energy = ctx.home.energy;
  if (energy === false) {
    return null;
  }
  return sectionOf(headingCard(ctx.locale, 'section.energy', viewUrl(ctx.home, PATHS.energy)), [
    {
      type: 'custom:quiet-luxe-energy-card',
      form: 'strip',
      power_entity: energy.power_entity,
      today_entity: energy.today_entity,
    },
  ]);
}

/** History chart delegated to apexcharts-card (Plan 3b D1 / spec §8). */
export function apexchartsHistoryCard(ctx: StrategyContext, energy: EnergyConfig): LovelaceCardConfig {
  return {
    type: 'custom:apexcharts-card',
    graph_span: '24h',
    header: { show: true, title: t(ctx.locale, 'energy.history') },
    series: [{ entity: energy.power_entity, name: t(ctx.locale, 'common.power'), stroke_width: 2 }],
  };
}

/** Energy page: strip + per-phase rings + chart WHEN apexcharts-card exists (D6). */
export function energyViewSections(ctx: StrategyContext): ReadonlyArray<LovelaceSectionConfig> {
  const energy = ctx.home.energy;
  if (energy === false) {
    return [];
  }
  const strip: LovelaceCardConfig = {
    type: 'custom:quiet-luxe-energy-card',
    form: 'strip',
    power_entity: energy.power_entity,
    today_entity: energy.today_entity,
  };
  const rings = (energy.phase_entities ?? []).map((entity, index) => ({
    type: 'custom:quiet-luxe-energy-card',
    form: 'ring',
    power_entity: entity,
    name: `L${index + 1}`,
    grid_options: { columns: 4 },
  }));
  const chart = ctx.hasApexcharts ? [apexchartsHistoryCard(ctx, energy)] : [];
  return [sectionOf(headingCard(ctx.locale, 'section.energy'), [strip, ...rings, ...chart])].filter(
    isSection,
  );
}
