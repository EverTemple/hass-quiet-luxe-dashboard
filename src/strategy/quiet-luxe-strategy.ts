import { resolveLocale } from '../i18n/resolve';
import { t } from '../i18n/translate';
import type { HomeAssistant } from '../types/home-assistant';
import { validateHomeConfig } from './config';
import { buildRegistryIndex, fetchRegistrySnapshot } from './registry';
import { resolveTier, viewsForTier } from './rbac';
import type {
  LovelaceDashboardConfig,
  LovelaceViewConfig,
  StrategyContext,
} from './types';
import {
  adminView,
  carView,
  climatesView,
  energyView,
  languageView,
  mediaView,
  securityView,
} from './views/domain';
import { homeView } from './views/home';
import { roomViews } from './views/room';

export const STRATEGY_ELEMENT_TAG = 'll-strategy-dashboard-quiet-luxe';

export interface QuietLuxeStrategyConfig {
  readonly type: string;
  /** The per-home config block from the dashboard YAML. */
  readonly home?: unknown;
}

/**
 * English-only by design (D8): when generation fails the config itself may be
 * broken, so locale resolution is not trusted. Error detail is admin-only
 * (spec §8: diagnostic card admin-visible only).
 */
export function fallbackDashboard(error: unknown, isAdmin: boolean): LovelaceDashboardConfig {
  const message = error instanceof Error ? error.message : String(error);
  const detail = isAdmin ? `\n\n\`${message}\`` : '';
  return {
    title: 'Quiet Luxe',
    views: [
      {
        title: t('en', 'strategy.error.title'),
        path: 'home',
        type: 'sections',
        sections: [
          {
            type: 'grid',
            cards: [
              {
                type: 'markdown',
                content: `## ${t('en', 'strategy.error.title')}\n\n${t('en', 'strategy.error.body')}${detail}`,
              },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Custom dashboard strategy (HA contract verified 2026-08-01):
 * `ll-strategy-dashboard-quiet-luxe`, referenced as `custom:quiet-luxe`,
 * static async generate(config, hass) → dashboard config.
 */
export class QuietLuxeStrategy extends HTMLElement {
  static async generate(
    config: QuietLuxeStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceDashboardConfig> {
    try {
      const home = validateHomeConfig(config.home);
      const tier = resolveTier(hass.user, home);
      const haLanguage = hass.locale?.language ?? hass.language;
      // Spec §10: user profile language → kiosk default → en. Guests are the
      // kiosk, so the home's kiosk default outranks the shared account locale.
      const locale = resolveLocale(
        tier === 'guest' ? [home.kiosk?.language, haLanguage] : [haLanguage, home.kiosk?.language],
      );
      const snapshot = await fetchRegistrySnapshot(hass);
      const ctx: StrategyContext = {
        home,
        registry: buildRegistryIndex(snapshot, hass.states),
        states: hass.states,
        locale,
        tier,
        hasApexcharts: customElements.get('apexcharts-card') !== undefined,
        hasWebrtcCard: customElements.get('webrtc-camera') !== undefined,
      };
      const views = [
        homeView(ctx),
        ...roomViews(ctx),
        mediaView(ctx),
        securityView(ctx),
        energyView(ctx),
        climatesView(ctx),
        carView(ctx),
        adminView(ctx),
        languageView(ctx),
      ].filter((view): view is LovelaceViewConfig => view !== null);
      return { title: home.name, views: [...viewsForTier(views, tier)] };
    } catch (error) {
      console.error('[quiet-luxe] dashboard generation failed:', error);
      return fallbackDashboard(error, hass.user?.is_admin === true);
    }
  }
}

declare global {
  interface Window {
    /** HA ≥2026.5 strategy picker metadata (UNCONFIRMED shape; harmless no-op earlier). */
    customStrategies?: Array<{ type: string; name: string; description: string }>;
  }
}

customElements.define(STRATEGY_ELEMENT_TAG, QuietLuxeStrategy);
window.customStrategies = window.customStrategies ?? [];
window.customStrategies.push({
  type: 'quiet-luxe',
  name: 'Quiet Luxe',
  description: 'Generates the Quiet Luxe dashboard from HA registries and a per-home config.',
});
