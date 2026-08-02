import type { TranslationKey } from '../../i18n/locales/en';
import { t } from '../../i18n/translate';
import { roomName } from '../labels';
import { adminSection } from '../sections/admin';
import { carCard } from '../sections/car';
import { climateCards } from '../sections/climate';
import { energyViewSections } from '../sections/energy';
import { sectionOf } from '../sections/heading';
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

function view(
  ctx: StrategyContext,
  key: TranslationKey,
  path: string,
  icon: string,
  sections: ReadonlyArray<LovelaceSectionConfig>,
  maxColumns = 3,
): LovelaceViewConfig | null {
  if (sections.length === 0) {
    return null;
  }
  return { title: t(ctx.locale, key), path, icon, type: 'sections', max_columns: maxColumns, sections };
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

/** All Climates (spec §6): devices grouped by room; area names are proper nouns. */
export function climatesView(ctx: StrategyContext): LovelaceViewConfig | null {
  const sections = orderedAreas(ctx)
    .map((area) =>
      sectionOf(
        { type: 'heading', heading: roomName(ctx.home, area) },
        climateCards(ctx, area.area_id, undefined, 'full'),
      ),
    )
    .filter(isSection);
  return view(ctx, 'view.climates', PATHS.climates, 'mdi:thermostat', sections);
}

export function carView(ctx: StrategyContext): LovelaceViewConfig | null {
  const card = carCard(ctx);
  const sections: ReadonlyArray<LovelaceSectionConfig> =
    card === null ? [] : [{ type: 'grid', cards: [card] }];
  return view(ctx, 'view.car', PATHS.car, 'mdi:car-outline', sections, 2);
}

export function adminView(ctx: StrategyContext): LovelaceViewConfig | null {
  const sections = [adminSection(ctx)].filter(isSection);
  return view(ctx, 'view.admin', PATHS.admin, 'mdi:tune', sections, 2);
}

/** Language page always exists (spec §5) — kiosk-friendly full-page switcher. */
export function languageView(ctx: StrategyContext): LovelaceViewConfig {
  return {
    title: t(ctx.locale, 'view.language'),
    path: PATHS.language,
    icon: 'mdi:translate',
    type: 'sections',
    max_columns: 2,
    sections: [{ type: 'grid', cards: [{ type: 'custom:quiet-luxe-language-card' }] }],
  };
}
