import type { HassEntity } from '../types/home-assistant';
import type { Locale } from '../i18n/types';
import type { HomeConfig } from './config';
import type { RegistryIndex } from './registry';

/**
 * Lovelace JSON emitted by the strategy. Shapes follow the HA sections-view
 * YAML schema (home-assistant.io/dashboards/sections + /views, verified
 * 2026-08-01). Card configs are open records: HA passes them through to each
 * card's setConfig untouched, and layout keys like grid_options ride along.
 */
export type Tier = 'admin' | 'family' | 'guest';

export interface LovelaceCardConfig {
  readonly type: string;
  readonly [key: string]: unknown;
}

export interface LovelaceSectionConfig {
  readonly type: 'grid';
  readonly column_span?: number;
  readonly cards: ReadonlyArray<LovelaceCardConfig>;
}

export interface LovelaceViewConfig {
  readonly title: string;
  readonly path: string;
  readonly type: 'sections';
  readonly icon?: string;
  readonly subview?: boolean;
  readonly max_columns?: number;
  readonly sections: ReadonlyArray<LovelaceSectionConfig>;
}

export interface LovelaceDashboardConfig {
  readonly title?: string;
  readonly views: ReadonlyArray<LovelaceViewConfig>;
}

export const PATHS = {
  home: 'home',
  media: 'media',
  security: 'security',
  energy: 'energy',
  climates: 'climates',
  car: 'car',
  admin: 'admin',
  language: 'language',
} as const;

export function roomPath(areaId: string): string {
  return `room-${areaId}`;
}

export function isSection(
  section: LovelaceSectionConfig | null,
): section is LovelaceSectionConfig {
  return section !== null;
}

/** Everything section/view builders may read. Builders stay pure over this. */
export interface StrategyContext {
  readonly home: HomeConfig;
  readonly registry: RegistryIndex;
  readonly states: Readonly<Record<string, HassEntity>>;
  readonly locale: Locale;
  readonly tier: Tier;
  readonly hasApexcharts: boolean;
  readonly hasWebrtcCard: boolean;
}
