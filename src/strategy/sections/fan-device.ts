import { FAN_FEATURE, supportsFeature } from '../../cards/supported-features';
import type { LovelaceCardConfig, StrategyContext } from '../types';

/**
 * Routing for the Dyson-style fan card.
 *
 * Detection is capability-based, never brand- or integration-name based: a fan
 * earns the richer card when it can oscillate or reverse its airflow, or when
 * its device also exposes a `climate` entity (the fan/climate pair a purifying
 * heater/cooler presents). A plain three-speed ceiling fan matches none of
 * those and keeps the ordinary climate card.
 */

function domainOf(entityId: string): string {
  return entityId.split('.')[0] ?? '';
}

/** The paired `climate` entity on the same physical device, if there is one. */
export function climatePartnerOf(ctx: StrategyContext, fanId: string): string | undefined {
  return ctx.registry.deviceEntities(fanId).find((id) => domainOf(id) === 'climate');
}

export function isFanDevice(ctx: StrategyContext, entityId: string): boolean {
  if (domainOf(entityId) !== 'fan') {
    return false;
  }
  const entity = ctx.states[entityId];
  return (
    supportsFeature(entity, FAN_FEATURE.OSCILLATE) ||
    supportsFeature(entity, FAN_FEATURE.DIRECTION) ||
    climatePartnerOf(ctx, entityId) !== undefined
  );
}

function siblingWithDeviceClass(
  ctx: StrategyContext,
  fanId: string,
  deviceClasses: ReadonlyArray<string>,
): string | undefined {
  const candidates = ctx.registry
    .deviceEntities(fanId)
    .filter((id) => domainOf(id) === 'sensor');
  for (const deviceClass of deviceClasses) {
    const found = candidates.find((id) => ctx.states[id]?.attributes.device_class === deviceClass);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

/**
 * The night-mode switch a purifier exposes as a config entity. Matched on the
 * entity id suffix because HA gives config switches no device class to key off.
 */
function nightModeOf(ctx: StrategyContext, fanId: string): string | undefined {
  return ctx.registry
    .deviceEntities(fanId)
    .find((id) => domainOf(id) === 'switch' && /night/.test(id));
}

/**
 * The card has no registry access of its own, so every companion entity is
 * resolved here and passed on the config.
 */
export function fanCardConfig(
  ctx: StrategyContext,
  entityId: string,
  form: 'compact' | 'full',
): LovelaceCardConfig {
  const climate = climatePartnerOf(ctx, entityId);
  const nightMode = nightModeOf(ctx, entityId);
  const temperature = siblingWithDeviceClass(ctx, entityId, ['temperature']);
  const aqi = siblingWithDeviceClass(ctx, entityId, ['pm25', 'aqi', 'pm10']);
  const platform = ctx.registry.platformOf(entityId);
  return {
    type: 'custom:quiet-luxe-fan-card',
    entity: entityId,
    form,
    ...(platform === undefined || platform === '' ? {} : { platform }),
    ...(climate === undefined ? {} : { climate_entity: climate }),
    ...(nightMode === undefined ? {} : { night_mode_entity: nightMode }),
    ...(temperature === undefined ? {} : { temperature_entity: temperature }),
    ...(aqi === undefined ? {} : { aqi_entity: aqi }),
  };
}
