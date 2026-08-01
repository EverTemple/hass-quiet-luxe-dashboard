import type { HassEntity } from '../types/home-assistant';

export type ClimateDeviceType = 'ac' | 'purifier' | 'dehumidifier' | 'fan' | 'exhaust';
export type ClimateActivity = 'active' | 'idle' | 'off';

const DOMAIN_DEFAULTS: Readonly<Record<string, ClimateDeviceType>> = {
  climate: 'ac',
  humidifier: 'dehumidifier',
  fan: 'fan',
  switch: 'exhaust',
};

/**
 * Domain-based default per spec §6 climate variants. Purifiers (fan domain,
 * e.g. Dyson) and exhausts wired as fans are indistinguishable from plain
 * fans by domain — those homes set `device_type` explicitly in config.
 */
export function detectClimateDeviceType(entityId: string): ClimateDeviceType {
  const domain = entityId.split('.')[0] ?? '';
  return DOMAIN_DEFAULTS[domain] ?? 'fan';
}

/** active | idle | off for any climate-family entity. */
export function climateActivity(entity: HassEntity): ClimateActivity {
  if (entity.state === 'off') {
    return 'off';
  }
  if (entity.attributes.hvac_action === 'idle') {
    return 'idle';
  }
  return 'active';
}
