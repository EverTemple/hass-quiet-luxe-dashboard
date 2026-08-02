import type { TranslationKey } from '../i18n/locales/en';
import { t } from '../i18n/translate';
import type { Locale } from '../i18n/types';
import type { HassEntity } from '../types/home-assistant';
import {
  angleForSpan,
  ANGLE_SPANS,
  CLIMATE_FEATURE,
  climateTargetTemperature,
  coverTiltPosition,
  FAN_FEATURE,
  fanOscillationAngle,
  fanPercentage,
  HUMIDIFIER_FEATURE,
  humidifierTargetHumidity,
  nearestSpan,
  selectableOptions,
  supportsFeature,
  type NumericTarget,
} from './supported-features';

/**
 * The inline control surface.
 *
 * `deviceControls` reads an entity and returns only the controls that entity
 * genuinely supports; `controlServiceCall` turns one interaction back into a
 * Home Assistant service call. Both are pure, so the whole "what can this
 * device do, and what do we send it" contract is testable without a DOM.
 *
 * Nothing here knows about a brand. A Dyson gets a rotation control because
 * it reports `angle_low`/`angle_high`, not because it is a Dyson.
 */

/** Names the action, not the widget — the card maps it back to a service. */
export type ControlId =
  | 'temperature'
  | 'hvac_mode'
  | 'preset_mode'
  | 'fan_mode'
  | 'humidity'
  | 'humidifier_mode'
  | 'percentage'
  | 'fan_preset'
  | 'oscillate'
  | 'direction'
  | 'angle'
  | 'tilt';

interface BaseControl {
  readonly id: ControlId;
  readonly labelKey: TranslationKey;
}

export interface StepperControl extends BaseControl {
  readonly kind: 'stepper';
  readonly target: NumericTarget;
  readonly unit: string;
}

export interface SliderControl extends BaseControl {
  readonly kind: 'slider';
  readonly target: NumericTarget;
  readonly unit: string;
}

export interface SelectControl extends BaseControl {
  readonly kind: 'select';
  readonly options: ReadonlyArray<string>;
  readonly value: string;
}

export interface ToggleControl extends BaseControl {
  readonly kind: 'toggle';
  readonly on: boolean;
}

/** Oscillation sweep width, offered as the presets the device's app offers. */
export interface SpanControl extends BaseControl {
  readonly kind: 'span';
  readonly spans: ReadonlyArray<number>;
  readonly value?: number;
}

export type DeviceControl =
  | StepperControl
  | SliderControl
  | SelectControl
  | ToggleControl
  | SpanControl;

function climateControls(entity: HassEntity): DeviceControl[] {
  const controls: DeviceControl[] = [];
  const temperature = climateTargetTemperature(entity);
  if (temperature !== undefined) {
    controls.push({
      kind: 'stepper',
      id: 'temperature',
      labelKey: 'control.target',
      target: temperature,
      unit: '°',
    });
  }
  // A climate entity's state IS its hvac mode, which is what makes
  // heat/cool reachable on a Dyson without touching the fan entity.
  const hvacModes = selectableOptions(entity, 'hvac_modes');
  if (hvacModes.length > 0) {
    controls.push({
      kind: 'select',
      id: 'hvac_mode',
      labelKey: 'control.mode',
      options: hvacModes,
      value: entity.state,
    });
  }
  const presets = selectableOptions(entity, 'preset_modes', CLIMATE_FEATURE.PRESET_MODE);
  if (presets.length > 0) {
    controls.push({
      kind: 'select',
      id: 'preset_mode',
      labelKey: 'control.preset',
      options: presets,
      value: String(entity.attributes.preset_mode ?? ''),
    });
  }
  const fanModes = selectableOptions(entity, 'fan_modes', CLIMATE_FEATURE.FAN_MODE);
  if (fanModes.length > 0) {
    controls.push({
      kind: 'select',
      id: 'fan_mode',
      labelKey: 'control.fan_speed',
      options: fanModes,
      value: String(entity.attributes.fan_mode ?? ''),
    });
  }
  return controls;
}

function humidifierControls(entity: HassEntity): DeviceControl[] {
  const controls: DeviceControl[] = [];
  const humidity = humidifierTargetHumidity(entity);
  if (humidity !== undefined) {
    controls.push({
      kind: 'stepper',
      id: 'humidity',
      labelKey: 'control.humidity',
      target: humidity,
      unit: '%',
    });
  }
  const modes = selectableOptions(entity, 'available_modes', HUMIDIFIER_FEATURE.MODES);
  if (modes.length > 0) {
    controls.push({
      kind: 'select',
      id: 'humidifier_mode',
      labelKey: 'control.mode',
      options: modes,
      value: String(entity.attributes.mode ?? ''),
    });
  }
  return controls;
}

function fanControls(entity: HassEntity): DeviceControl[] {
  const controls: DeviceControl[] = [];
  const percentage = fanPercentage(entity);
  if (percentage !== undefined) {
    controls.push({
      kind: 'slider',
      id: 'percentage',
      labelKey: 'control.speed',
      target: percentage,
      unit: '%',
    });
  }
  const presets = selectableOptions(entity, 'preset_modes', FAN_FEATURE.PRESET_MODE);
  if (presets.length > 0) {
    controls.push({
      kind: 'select',
      id: 'fan_preset',
      labelKey: 'control.preset',
      options: presets,
      value: String(entity.attributes.preset_mode ?? ''),
    });
  }
  if (supportsFeature(entity, FAN_FEATURE.OSCILLATE)) {
    controls.push({
      kind: 'toggle',
      id: 'oscillate',
      labelKey: 'control.oscillate',
      on: entity.attributes.oscillating === true,
    });
  }
  if (supportsFeature(entity, FAN_FEATURE.DIRECTION)) {
    controls.push({
      kind: 'select',
      id: 'direction',
      labelKey: 'control.direction',
      options: ['forward', 'reverse'],
      value: String(entity.attributes.direction ?? ''),
    });
  }
  const angle = fanOscillationAngle(entity);
  if (angle !== undefined) {
    controls.push({
      kind: 'span',
      id: 'angle',
      labelKey: 'control.angle',
      spans: ANGLE_SPANS,
      value: nearestSpan(angle),
    });
  }
  return controls;
}

function coverControls(entity: HassEntity): DeviceControl[] {
  const tilt = coverTiltPosition(entity);
  if (tilt === undefined) {
    return [];
  }
  return [{ kind: 'slider', id: 'tilt', labelKey: 'control.tilt', target: tilt, unit: '%' }];
}

/**
 * Every control the entity supports, in the order the card renders them.
 * An unavailable or unknown entity yields nothing: there is no honest control
 * to draw for a device that is not answering.
 */
export function deviceControls(entity: HassEntity | undefined): ReadonlyArray<DeviceControl> {
  if (entity === undefined || entity.state === 'unavailable' || entity.state === 'unknown') {
    return [];
  }
  switch (entity.entity_id.split('.')[0]) {
    case 'climate':
      return climateControls(entity);
    case 'humidifier':
      return humidifierControls(entity);
    case 'fan':
      return fanControls(entity);
    case 'cover':
      return coverControls(entity);
    default:
      return [];
  }
}

export interface ServiceCall {
  readonly domain: string;
  readonly service: string;
  readonly data: Record<string, unknown>;
}

/**
 * The oscillation sweep is set through the integration that reports it.
 * `dyson_local.set_angle` is the only service that accepts `angle_low` /
 * `angle_high`, and it is the same integration that publishes those
 * attributes — so a device advertising them can always be driven by it.
 */
const ANGLE_SERVICE = { domain: 'dyson_local', service: 'set_angle' } as const;

/**
 * Translates one control interaction into the service call it should make.
 * Returns undefined when the value cannot drive that control, so a card never
 * fires a half-formed call.
 */
export function controlServiceCall(
  entityId: string,
  id: ControlId,
  value: string | number | boolean,
  entity?: HassEntity,
): ServiceCall | undefined {
  const target = { entity_id: entityId };
  switch (id) {
    case 'temperature':
      return typeof value === 'number'
        ? { domain: 'climate', service: 'set_temperature', data: { ...target, temperature: value } }
        : undefined;
    case 'hvac_mode':
      return typeof value === 'string'
        ? { domain: 'climate', service: 'set_hvac_mode', data: { ...target, hvac_mode: value } }
        : undefined;
    case 'preset_mode':
      return typeof value === 'string'
        ? { domain: 'climate', service: 'set_preset_mode', data: { ...target, preset_mode: value } }
        : undefined;
    case 'fan_mode':
      return typeof value === 'string'
        ? { domain: 'climate', service: 'set_fan_mode', data: { ...target, fan_mode: value } }
        : undefined;
    case 'humidity':
      return typeof value === 'number'
        ? { domain: 'humidifier', service: 'set_humidity', data: { ...target, humidity: value } }
        : undefined;
    case 'humidifier_mode':
      return typeof value === 'string'
        ? { domain: 'humidifier', service: 'set_mode', data: { ...target, mode: value } }
        : undefined;
    case 'percentage':
      return typeof value === 'number'
        ? { domain: 'fan', service: 'set_percentage', data: { ...target, percentage: value } }
        : undefined;
    case 'fan_preset':
      return typeof value === 'string'
        ? { domain: 'fan', service: 'set_preset_mode', data: { ...target, preset_mode: value } }
        : undefined;
    case 'oscillate':
      return typeof value === 'boolean'
        ? { domain: 'fan', service: 'oscillate', data: { ...target, oscillating: value } }
        : undefined;
    case 'direction':
      return value === 'forward' || value === 'reverse'
        ? { domain: 'fan', service: 'set_direction', data: { ...target, direction: value } }
        : undefined;
    case 'tilt':
      return typeof value === 'number'
        ? {
            domain: 'cover',
            service: 'set_cover_tilt_position',
            data: { ...target, tilt_position: value },
          }
        : undefined;
    case 'angle': {
      const current = fanOscillationAngle(entity);
      if (typeof value !== 'number' || current === undefined) {
        return undefined;
      }
      const next = angleForSpan(current, value);
      return {
        ...ANGLE_SERVICE,
        data: { ...target, angle_low: next.low, angle_high: next.high },
      };
    }
    default:
      return undefined;
  }
}

const TITLE_SEPARATOR = /[_\s]+/;

/** "clothes drying" → "Clothes Drying"; already-cased vendor labels survive. */
export function titleCase(raw: string): string {
  return raw
    .split(TITLE_SEPARATOR)
    .filter((word) => word !== '')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const HVAC_LABELS: Readonly<Record<string, TranslationKey>> = {
  off: 'hvac.off',
  heat: 'hvac.heat',
  cool: 'hvac.cool',
  heat_cool: 'hvac.heat_cool',
  auto: 'hvac.auto',
  dry: 'hvac.dry',
  fan_only: 'hvac.fan_only',
};

const DIRECTION_LABELS: Readonly<Record<string, TranslationKey>> = {
  forward: 'fan.forward',
  reverse: 'fan.reverse',
};

/**
 * Localizes an option where we know the vocabulary, and title-cases anything
 * a vendor invented ("Clothes Drying", "Normal") rather than showing a raw
 * token or hiding the option.
 */
export function optionLabel(locale: Locale, id: ControlId, raw: string): string {
  if (id === 'hvac_mode') {
    const key = HVAC_LABELS[raw];
    return key === undefined ? titleCase(raw) : t(locale, key);
  }
  if (id === 'direction') {
    const key = DIRECTION_LABELS[raw];
    return key === undefined ? titleCase(raw) : t(locale, key);
  }
  return titleCase(raw);
}
