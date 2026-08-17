import type { TranslationKey } from '../../i18n/locales/en';
import { t } from '../../i18n/translate';
import { roomName } from '../labels';
import { MAX_COLUMNS, REGION_SPAN } from '../layout';
import { adminSection } from '../sections/admin';
import { carCard } from '../sections/car';
import { climateColumnCards } from '../sections/climate';
import { energyViewSections } from '../sections/energy';
import { viewHeaderSection } from '../sections/heading';
import { mediaViewSections } from '../sections/media';
import { orderedAreas } from '../sections/rooms';
import { securityViewSections } from '../sections/security';
import {
  PATHS,
  type LovelaceSectionConfig,
  type LovelaceViewConfig,
  type StrategyContext,
} from '../types';

/**
 * Sections that hold a single card keep a narrow column, since the card is
 * not a grid. The view itself still runs the full `MAX_COLUMNS` track count
 * (like every other view), so the narrow section sits left-aligned beside
 * the rest of the band instead of being centred alone in its own 2-track
 * view — `max_columns` here would otherwise be the one thing pulling these
 * three views out of the shared left-aligned layout.
 */
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
 *
 * The strategy runs once, with no viewport — HA resolves the column count at
 * runtime from the width it actually has, and clamps at narrower widths. A
 * span computed from "4 columns" would be wrong the moment the view is
 * narrower, so the area is never one section spanning several tracks: the
 * heading gets its own full-band section, and each card gets its OWN
 * span-1 section. HA then flows those single-track sections across however
 * many columns it resolves — four per row at four columns, two at two,
 * stacked at one — with no viewport knowledge baked in here.
 *
 * Cards keep the room's tallest-first order and the room's full-track sizing
 * (`climateColumnCards`) — the same treatment as the room view's climate
 * column, so a dehumidifier tile never stands half-width under a full-width
 * dial. Areas with no climate cards are dropped entirely, heading included.
 */
export function climatesView(ctx: StrategyContext): LovelaceViewConfig | null {
  const sections = orderedAreas(ctx).flatMap((area): ReadonlyArray<LovelaceSectionConfig> => {
    const cards = climateColumnCards(ctx, area.area_id, undefined, 'full');
    if (cards.length === 0) {
      return [];
    }
    const heading: LovelaceSectionConfig = {
      type: 'grid',
      column_span: MAX_COLUMNS,
      cards: [{ type: 'heading', heading: roomName(ctx.home, area) }],
    };
    const cardSections = cards.map(
      (card): LovelaceSectionConfig => ({
        type: 'grid',
        column_span: REGION_SPAN.climatesArea,
        cards: [card],
      }),
    );
    return [heading, ...cardSections];
  });
  return view(ctx, 'view.climates', PATHS.climates, 'mdi:thermostat', sections);
}

export function carView(ctx: StrategyContext): LovelaceViewConfig | null {
  const card = carCard(ctx);
  const sections: ReadonlyArray<LovelaceSectionConfig> =
    card === null
      ? []
      : [{ type: 'grid', column_span: SINGLE_CARD_MAX_COLUMNS, cards: [card] }];
  return view(ctx, 'view.car', PATHS.car, 'mdi:car-outline', sections, MAX_COLUMNS);
}

export function adminView(ctx: StrategyContext): LovelaceViewConfig | null {
  const section = adminSection(ctx);
  const sections =
    section === null
      ? []
      : [{ ...section, column_span: SINGLE_CARD_MAX_COLUMNS }];
  return view(ctx, 'view.admin', PATHS.admin, 'mdi:tune', sections, MAX_COLUMNS);
}

/** Language page always exists (spec §5) — kiosk-friendly full-page switcher. */
export function languageView(ctx: StrategyContext): LovelaceViewConfig {
  const title = t(ctx.locale, 'view.language');
  return {
    title,
    path: PATHS.language,
    icon: 'mdi:translate',
    type: 'sections',
    max_columns: MAX_COLUMNS,
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
