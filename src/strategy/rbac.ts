import type { HomeAssistant } from '../types/home-assistant';
import type { HomeConfig } from './config';
import { PATHS, type LovelaceViewConfig, type Tier } from './types';

/**
 * Generation-side RBAC (spec §9 layer 1). This is defense-in-depth, NOT the
 * security boundary — HA user permissions are (Plan 5 configures those).
 */
const EXCLUDED_PATHS: Readonly<Record<Tier, ReadonlyArray<string>>> = {
  admin: [],
  family: [PATHS.admin, PATHS.car],
  guest: [PATHS.admin, PATHS.car],
};

export function resolveTier(user: HomeAssistant['user'], home: HomeConfig): Tier {
  if (user === undefined) {
    return 'guest';
  }
  if (user.is_admin) {
    return 'admin';
  }
  const matches = (list: ReadonlyArray<string> | undefined): boolean =>
    list?.some((item) => item === user.id || item.toLowerCase() === user.name.toLowerCase()) ??
    false;
  if (matches(home.users?.guests)) {
    return 'guest';
  }
  if (matches(home.users?.family)) {
    return 'family';
  }
  return 'guest'; // unknown non-admin → least privilege (D5)
}

export function viewsForTier(
  views: ReadonlyArray<LovelaceViewConfig>,
  tier: Tier,
): ReadonlyArray<LovelaceViewConfig> {
  const excluded = EXCLUDED_PATHS[tier];
  return views.filter((view) => !excluded.includes(view.path));
}
