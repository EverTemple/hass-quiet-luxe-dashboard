import type { TranslationKey } from '../i18n/locales/en';
import type { HassEntity } from '../types/home-assistant';
import { setTemperatureCall } from './climate-dial';
import type { ServiceCall } from './device-controls';
import {
  CLIMATE_FEATURE,
  HUMIDIFIER_FEATURE,
  humidifierTargetHumidity,
  selectableOptions,
  supportsFeature,
  type NumericTarget,
} from './supported-features';

/**
 * The control model behind `modal/climate-controls` (Figma 56:4698).
 *
 * Every group is derived from the entity's own `supported_features` mask and
 * attributes, and a group with nothing to show is not returned at all — so the
 * sheet for a six-mode Sensibo and the sheet for a heat/cool-only purifier are
 * the same code producing genuinely different surfaces, and neither renders a
 * control its device cannot take.
 *
 * Pure: no DOM, no hass. The sheet renders these; the card turns one
 * interaction back into a service call.
 */

export type ClimateControlId =
  | 'hvac_mode'
  | 'temperature'
  | 'temp_low'
  | 'temp_high'
  | 'fan_mode'
  | 'swing_mode'
  | 'swing_horizontal_mode'
  | 'target_humidity'
  | 'humidifier_mode'
  | 'preset_mode';

interface BaseControl {
  readonly id: ClimateControlId;
  readonly labelKey: TranslationKey;
}

export interface SheetSelectControl extends BaseControl {
  readonly kind: 'select';
  readonly options: ReadonlyArray<string>;
  readonly value: string;
}

/**
 * A two-option select reads better as a switch than as a two-segment picker,
 * which is how the design draws vertical and horizontal swing. The off value is
 * whatever the device calls "not swinging".
 */
export interface SheetToggleControl extends BaseControl {
  readonly kind: 'toggle';
  readonly on: boolean;
  readonly onValue: string;
  readonly offValue: string;
}

export interface SheetStepperControl extends BaseControl {
  readonly kind: 'stepper';
  readonly target: NumericTarget;
  readonly unit: string;
}

export type ClimateSheetControl = SheetSelectControl | SheetToggleControl | SheetStepperControl;

export interface ClimateSheetGroup {
  readonly titleKey: TranslationKey;
  readonly controls: ReadonlyArray<ClimateSheetControl>;
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** The values integrations use for "swing is parked". */
const SWING_OFF_VALUES = new Set(['off', 'stopped', 'none', 'hold']);

/**
 * A swing axis: a switch when the device offers exactly two positions (the live
 * Sensibo reports `stopped` / `rangefull`), a picker when it offers more.
 */
function swingControl(
  entity: HassEntity,
  id: 'swing_mode' | 'swing_horizontal_mode',
  attribute: string,
  feature: number,
  labelKey: TranslationKey,
): ClimateSheetControl | undefined {
  const options = selectableOptions(entity, attribute, feature);
  if (options.length === 0) {
    return undefined;
  }
  const current = String(entity.attributes[id] ?? '');
  if (options.length !== 2) {
    return { kind: 'select', id, labelKey, options, value: current };
  }
  const offValue = options.find((option) => SWING_OFF_VALUES.has(option.toLowerCase()));
  const onValue = options.find((option) => option !== offValue);
  if (offValue === undefined || onValue === undefined) {
    return { kind: 'select', id, labelKey, options, value: current };
  }
  return { kind: 'toggle', id, labelKey, on: current === onValue, onValue, offValue };
}

/** Target humidity published by a climate entity (distinct from a humidifier). */
export function climateTargetHumidity(entity: HassEntity | undefined): NumericTarget | undefined {
  if (!supportsFeature(entity, CLIMATE_FEATURE.TARGET_HUMIDITY)) {
    return undefined;
  }
  const value = optionalNumber(entity?.attributes.humidity);
  if (value === undefined) {
    return undefined;
  }
  return {
    value,
    min: numberOr(entity?.attributes.min_humidity, 0),
    max: numberOr(entity?.attributes.max_humidity, 100),
    step: 1,
  };
}

function temperatureControls(entity: HassEntity): ClimateSheetControl[] {
  const min = numberOr(entity.attributes.min_temp, 7);
  const max = numberOr(entity.attributes.max_temp, 35);
  const step = numberOr(entity.attributes.target_temp_step, 0.5);
  const bounds = { min, max, step: step > 0 ? step : 0.5 };
  const low = optionalNumber(entity.attributes.target_temp_low);
  const high = optionalNumber(entity.attributes.target_temp_high);
  if (
    supportsFeature(entity, CLIMATE_FEATURE.TARGET_TEMPERATURE_RANGE) &&
    low !== undefined &&
    high !== undefined
  ) {
    return [
      { kind: 'stepper', id: 'temp_low', labelKey: 'control.heat_to', target: { value: low, ...bounds }, unit: '' },
      { kind: 'stepper', id: 'temp_high', labelKey: 'control.cool_to', target: { value: high, ...bounds }, unit: '' },
    ];
  }
  const value = optionalNumber(entity.attributes.temperature);
  if (supportsFeature(entity, CLIMATE_FEATURE.TARGET_TEMPERATURE) && value !== undefined) {
    return [
      { kind: 'stepper', id: 'temperature', labelKey: 'control.target', target: { value, ...bounds }, unit: '' },
    ];
  }
  return [];
}

function group(
  titleKey: TranslationKey,
  controls: ReadonlyArray<ClimateSheetControl | undefined>,
): ClimateSheetGroup | undefined {
  const present = controls.filter((control): control is ClimateSheetControl => control !== undefined);
  return present.length === 0 ? undefined : { titleKey, controls: present };
}

function climateGroups(entity: HassEntity): Array<ClimateSheetGroup | undefined> {
  const hvacModes = selectableOptions(entity, 'hvac_modes');
  const humidity = climateTargetHumidity(entity);
  return [
    group('control.hvac_mode', [
      hvacModes.length === 0
        ? undefined
        : { kind: 'select', id: 'hvac_mode', labelKey: 'control.hvac_mode', options: hvacModes, value: entity.state },
    ]),
    group('control.temperature_range', temperatureControls(entity)),
    group('control.fan', [
      ((): ClimateSheetControl | undefined => {
        const options = selectableOptions(entity, 'fan_modes', CLIMATE_FEATURE.FAN_MODE);
        return options.length === 0
          ? undefined
          : {
              kind: 'select',
              id: 'fan_mode',
              labelKey: 'control.fan',
              options,
              value: String(entity.attributes.fan_mode ?? ''),
            };
      })(),
    ]),
    group('control.swing', [
      swingControl(entity, 'swing_mode', 'swing_modes', CLIMATE_FEATURE.SWING_MODE, 'control.swing_vertical'),
      swingControl(
        entity,
        'swing_horizontal_mode',
        'swing_horizontal_modes',
        CLIMATE_FEATURE.SWING_HORIZONTAL_MODE,
        'control.swing_horizontal',
      ),
    ]),
    group('control.humidity', [
      humidity === undefined
        ? undefined
        : { kind: 'stepper', id: 'target_humidity', labelKey: 'control.humidity', target: humidity, unit: '%' },
    ]),
    group('control.preset', [
      ((): ClimateSheetControl | undefined => {
        const options = selectableOptions(entity, 'preset_modes', CLIMATE_FEATURE.PRESET_MODE);
        return options.length === 0
          ? undefined
          : {
              kind: 'select',
              id: 'preset_mode',
              labelKey: 'control.preset',
              options,
              value: String(entity.attributes.preset_mode ?? ''),
            };
      })(),
    ]),
  ];
}

/**
 * `control/dehumidifier` (Figma 49:4492): the target-humidity stepper and the
 * mode picker, which is all a humidifier-domain entity exposes.
 */
function humidifierGroups(entity: HassEntity): Array<ClimateSheetGroup | undefined> {
  const humidity = humidifierTargetHumidity(entity);
  const modes = selectableOptions(entity, 'available_modes', HUMIDIFIER_FEATURE.MODES);
  return [
    group('control.humidity', [
      humidity === undefined
        ? undefined
        : { kind: 'stepper', id: 'target_humidity', labelKey: 'control.humidity', target: humidity, unit: '%' },
    ]),
    group('control.humidity_mode', [
      modes.length === 0
        ? undefined
        : {
            kind: 'select',
            id: 'humidifier_mode',
            labelKey: 'control.humidity_mode',
            options: modes,
            value: String(entity.attributes.mode ?? ''),
          },
    ]),
  ];
}

/**
 * Every group the entity can actually drive, in the order the sheet renders
 * them. An entity that is not answering yields nothing: there is no honest
 * control to offer for a device that cannot take one.
 */
export function climateSheetGroups(entity: HassEntity | undefined): ReadonlyArray<ClimateSheetGroup> {
  if (entity === undefined || entity.state === 'unavailable' || entity.state === 'unknown') {
    return [];
  }
  const domain = entity.entity_id.split('.')[0];
  const groups =
    domain === 'humidifier'
      ? humidifierGroups(entity)
      : domain === 'climate'
        ? climateGroups(entity)
        : [];
  return groups.filter((entry): entry is ClimateSheetGroup => entry !== undefined);
}

/** True when the sheet would have something to show. */
export function hasClimateSheet(entity: HassEntity | undefined): boolean {
  return climateSheetGroups(entity).length > 0;
}

/**
 * One sheet interaction as a service call.
 *
 * `set_temperature` on a range thermostat has to carry both ends — sending one
 * alone makes HA drop the other — so the untouched end is read back off the
 * entity here rather than being guessed by the caller.
 */
export function climateSheetCall(
  entityId: string,
  id: ClimateControlId,
  value: string | number | boolean,
  entity: HassEntity | undefined,
): ServiceCall | undefined {
  const target = { entity_id: entityId };
  const domain = entityId.split('.')[0] ?? '';
  switch (id) {
    case 'hvac_mode':
      return typeof value === 'string'
        ? { domain: 'climate', service: 'set_hvac_mode', data: { ...target, hvac_mode: value } }
        : undefined;
    case 'temperature':
      return typeof value === 'number' ? setTemperatureCall(entityId, { temperature: value }) : undefined;
    case 'temp_low':
    case 'temp_high': {
      if (typeof value !== 'number') {
        return undefined;
      }
      const low = optionalNumber(entity?.attributes.target_temp_low);
      const high = optionalNumber(entity?.attributes.target_temp_high);
      if (low === undefined || high === undefined) {
        return undefined;
      }
      return setTemperatureCall(entityId, {
        targetLow: id === 'temp_low' ? value : low,
        targetHigh: id === 'temp_high' ? value : high,
      });
    }
    case 'fan_mode':
      return typeof value === 'string'
        ? { domain: 'climate', service: 'set_fan_mode', data: { ...target, fan_mode: value } }
        : undefined;
    case 'swing_mode':
      return typeof value === 'string'
        ? { domain: 'climate', service: 'set_swing_mode', data: { ...target, swing_mode: value } }
        : undefined;
    case 'swing_horizontal_mode':
      return typeof value === 'string'
        ? {
            domain: 'climate',
            service: 'set_swing_horizontal_mode',
            data: { ...target, swing_horizontal_mode: value },
          }
        : undefined;
    case 'target_humidity':
      if (typeof value !== 'number') {
        return undefined;
      }
      // Both domains name the service `set_humidity`; only the domain differs.
      return {
        domain: domain === 'humidifier' ? 'humidifier' : 'climate',
        service: 'set_humidity',
        data: { ...target, humidity: value },
      };
    case 'humidifier_mode':
      return typeof value === 'string'
        ? { domain: 'humidifier', service: 'set_mode', data: { ...target, mode: value } }
        : undefined;
    case 'preset_mode':
      return typeof value === 'string'
        ? { domain: 'climate', service: 'set_preset_mode', data: { ...target, preset_mode: value } }
        : undefined;
    default:
      return undefined;
  }
}
