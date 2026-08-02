import { t } from '../../i18n/translate';
import { MAX_COLUMNS, REGION_SPAN } from '../layout';
import { carSection } from '../sections/car';
import { climateSection } from '../sections/climate';
import { energySection } from '../sections/energy';
import { mediaSection } from '../sections/media';
import { roomsSection } from '../sections/rooms';
import { scheduleSection } from '../sections/schedule';
import { securitySection } from '../sections/security';
import { vacuumSection } from '../sections/vacuum';
import {
  isSection,
  PATHS,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type LovelaceViewConfig,
  type StrategyContext,
} from '../types';

export function headerCardConfig(ctx: StrategyContext): LovelaceCardConfig {
  return {
    type: 'custom:quiet-luxe-header-card',
    form: 'home',
    name: ctx.home.name,
    show_greeting: ctx.tier !== 'guest',
    weather_entity: ctx.registry.all('weather')[0],
    aqi_entity: ctx.registry.all('sensor', 'aqi')[0],
    presence_entities: ctx.registry.all('person'),
  };
}

/**
 * Home view (spec §6). One sections view serves all breakpoints: HA's sections
 * layout collapses max_columns: 4 to a single column on phones; the rooms grid
 * spans 2 of 4 columns (≈ the iPad 64% left zone), the rest fill the rail.
 * Section order follows the mobile priority (Decision 10): rooms → climate →
 * music → cameras/energy → schedule → vacuum/car glance. Presence is not a
 * section: it lives in the header's top-left cluster (Figma header/home-v2),
 * and a second copy at the bottom of the view was pure duplication.
 */
export function homeView(ctx: StrategyContext): LovelaceViewConfig {
  const header: LovelaceSectionConfig = {
    type: 'grid',
    column_span: REGION_SPAN.viewHeader,
    cards: [headerCardConfig(ctx)],
  };
  const sections = [
    header,
    roomsSection(ctx),
    climateSection(ctx, { limit: 3 }),
    mediaSection(ctx),
    securitySection(ctx),
    energySection(ctx),
    scheduleSection(ctx),
    vacuumSection(ctx),
    carSection(ctx),
  ].filter(isSection);
  return {
    title: t(ctx.locale, 'view.home'),
    path: PATHS.home,
    icon: 'mdi:home-variant-outline',
    type: 'sections',
    max_columns: MAX_COLUMNS,
    dense_section_placement: true,
    sections,
  };
}
