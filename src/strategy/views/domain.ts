import type { TranslationKey } from '../../i18n/locales/en';
import { t } from '../../i18n/translate';
import { roomName } from '../labels';
import { MAX_COLUMNS, REGION_SPAN } from '../layout';
import { adminSection } from '../sections/admin';
import { carCard } from '../sections/car';
import { climateColumnCards } from '../sections/climate';
import { energyViewSections } from '../sections/energy';
import { sectionOf, viewHeaderSection } from '../sections/heading';
import { mediaViewSections } from '../sections/media';
import { orderedAreas } from '../sections/rooms';
import { securityViewSections } from '../sections/security';
import {
  isSection,
  PATHS,
  type LovelaceSectionConfig,
  type LovelaceViewConfig,
  type StrategyContext,
} from '../types';

/** Views that hold a single card keep a narrow band; the card is not a grid. */
const SINGLE_CARD_MAX_COLUMNS = 2;

/**
 * Every non-Home view opens with the `header/view` band and runs the same grid
 * contract: up to 4 tracks, dense placement, sections carrying their own spans.
 */
function view(
  ctx: StrategyContext,
  key: TranslationKey,
  path: string,
  icon: string,
  sections: ReadonlyArray<LovelaceSectionConfig>,
  maxColumns = MAX_COLUMNS,
): LovelaceViewConfig | null {
  if (sections.length === 0) {
    return null;
  }
  const title = t(ctx.locale, key);
  return {
    title,
    path,
    icon,
    type: 'sections',
    max_columns: maxColumns,
    dense_section_placement: true,
    sections: [viewHeaderSection(ctx, { title }), ...sections],
  };
}

export function mediaView(ctx: StrategyContext): LovelaceViewConfig | null {
  return view(ctx, 'view.media', PATHS.media, 'mdi:music', mediaViewSections(ctx));
}

export function securityView(ctx: StrategyContext): LovelaceViewConfig | null {
  return view(ctx, 'view.security', PATHS.security, 'mdi:shield-home-outline', securityViewSections(ctx));
}

export function energyView(ctx: StrategyContext): LovelaceViewConfig | null {
  return view(ctx, 'view.energy', PATHS.energy, 'mdi:lightning-bolt-outline', energyViewSections(ctx));
}

/**
 * All Climates (spec §6): devices grouped by room; area names are proper nouns.
 * One span-1 column per area, free flow across the four tracks.
 *
 * The column is a single track, so it takes the same card treatment as the room
 * view's climate column — full-track cards, tallest first. Sharing the helper
 * is what stops a dehumidifier tile standing half-width under a full-width
 * dial, which is what the two views did differently before.
 */
export function climatesView(ctx: StrategyContext): LovelaceViewConfig | null {
  const sections = orderedAreas(ctx)
    .map((area) =>
      sectionOf(
        { type: 'heading', heading: roomName(ctx.home, area) },
        climateColumnCards(ctx, area.area_id, 'full'),
        REGION_SPAN.climatesArea,
      ),
    )
    .filter(isSection);
  return view(ctx, 'view.climates', PATHS.climates, 'mdi:thermostat', sections);
}

export function carView(ctx: StrategyContext): LovelaceViewConfig | null {
  const card = carCard(ctx);
  const sections: ReadonlyArray<LovelaceSectionConfig> =
    card === null
      ? []
      : [{ type: 'grid', column_span: SINGLE_CARD_MAX_COLUMNS, cards: [card] }];
  return view(ctx, 'view.car', PATHS.car, 'mdi:car-outline', sections, SINGLE_CARD_MAX_COLUMNS);
}

export function adminView(ctx: StrategyContext): LovelaceViewConfig | null {
  const section = adminSection(ctx);
  const sections =
    section === null
      ? []
      : [{ ...section, column_span: SINGLE_CARD_MAX_COLUMNS }];
  return view(ctx, 'view.admin', PATHS.admin, 'mdi:tune', sections, SINGLE_CARD_MAX_COLUMNS);
}

/** Language page always exists (spec §5) — kiosk-friendly full-page switcher. */
export function languageView(ctx: StrategyContext): LovelaceViewConfig {
  const title = t(ctx.locale, 'view.language');
  return {
    title,
    path: PATHS.language,
    icon: 'mdi:translate',
    type: 'sections',
    max_columns: SINGLE_CARD_MAX_COLUMNS,
    dense_section_placement: true,
    sections: [
      viewHeaderSection(ctx, { title }),
      {
        type: 'grid',
        column_span: SINGLE_CARD_MAX_COLUMNS,
        cards: [{ type: 'custom:quiet-luxe-language-card' }],
      },
    ],
  };
}
