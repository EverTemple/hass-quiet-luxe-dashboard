import type { TranslationKey } from '../../i18n/locales/en';
import { t } from '../../i18n/translate';
import type { Locale } from '../../i18n/types';
import { viewUrl } from '../config';
import { REGION_SPAN } from '../layout';
import {
  PATHS,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type StrategyContext,
} from '../types';

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

export interface HeadingGroup {
  readonly heading: LovelaceCardConfig;
  readonly cards: ReadonlyArray<LovelaceCardConfig>;
}

/**
 * One view COLUMN: several headed groups inside a single grid section.
 *
 * A column is a section rather than a section per group because HA's view grid
 * is a plain CSS grid — every section in a row is as tall as the tallest one,
 * and a short section leaves the difference as dead space in the middle of the
 * page. Regions that belong side by side therefore have to share a section, and
 * their eyebrows ride along as `heading` cards. Empty groups drop with their
 * heading (spec §8), and a column with nothing left in it drops entirely.
 */
export function columnSection(
  groups: ReadonlyArray<HeadingGroup>,
  columnSpan: number,
  rowSpan?: number,
): LovelaceSectionConfig | null {
  const cards = groups.flatMap((group) =>
    group.cards.length === 0 ? [] : [group.heading, ...group.cards],
  );
  if (cards.length === 0) {
    return null;
  }
  const section: LovelaceSectionConfig = { type: 'grid', column_span: columnSpan, cards };
  return rowSpan === undefined ? section : { ...section, row_span: rowSpan };
}

export interface ViewHeaderOptions {
  /** Shown in `display/home` — the view's own name, already localised. */
  readonly title: string;
  /** Static caption. Room views instead hand over the entities below. */
  readonly subtitle?: string;
  readonly temperatureEntity?: string;
  readonly humidityEntity?: string;
  readonly aqiEntity?: string;
  /** Right-hand slot: label plus the view it opens. Both or neither. */
  readonly actionLabel?: string;
  readonly actionPath?: string;
}

/**
 * The `header/view` band every non-Home view opens with (Figma 99:2442).
 *
 * Back always points at the dashboard root: a sub-view is one level down from
 * Home, and "one level up" is the only thing a back control may promise. The
 * band owns the full content width at every breakpoint.
 */
export function viewHeaderSection(
  ctx: StrategyContext,
  options: ViewHeaderOptions,
): LovelaceSectionConfig {
  const card: LovelaceCardConfig = {
    type: 'custom:quiet-luxe-header-card',
    form: 'view',
    name: options.title,
    back_path: viewUrl(ctx.home, PATHS.home),
    back_label: t(ctx.locale, 'view.home'),
    ...(options.subtitle === undefined ? {} : { subtitle: options.subtitle }),
    ...(options.temperatureEntity === undefined
      ? {}
      : { temperature_entity: options.temperatureEntity }),
    ...(options.humidityEntity === undefined ? {} : { humidity_entity: options.humidityEntity }),
    ...(options.aqiEntity === undefined ? {} : { aqi_entity: options.aqiEntity }),
    ...(options.actionLabel === undefined || options.actionPath === undefined
      ? {}
      : { action_label: options.actionLabel, action_path: options.actionPath }),
  };
  return { type: 'grid', column_span: REGION_SPAN.viewHeader, cards: [card] };
}
