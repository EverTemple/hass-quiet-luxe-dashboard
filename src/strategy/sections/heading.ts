import type { TranslationKey } from '../../i18n/locales/en';
import { t } from '../../i18n/translate';
import type { Locale } from '../../i18n/types';
import type { LovelaceCardConfig, LovelaceSectionConfig } from '../types';

/** Native HA heading card; tap_action navigates when a path is given. */
export function headingCard(
  locale: Locale,
  key: TranslationKey,
  navigationPath?: string,
): LovelaceCardConfig {
  if (navigationPath === undefined) {
    return { type: 'heading', heading: t(locale, key) };
  }
  return {
    type: 'heading',
    heading: t(locale, key),
    tap_action: { action: 'navigate', navigation_path: navigationPath },
  };
}

/** null when there is nothing beyond the heading — spec §8 graceful omission. */
export function sectionOf(
  heading: LovelaceCardConfig,
  cards: ReadonlyArray<LovelaceCardConfig>,
  columnSpan?: number,
): LovelaceSectionConfig | null {
  if (cards.length === 0) {
    return null;
  }
  const section: LovelaceSectionConfig = { type: 'grid', cards: [heading, ...cards] };
  return columnSpan === undefined ? section : { ...section, column_span: columnSpan };
}
