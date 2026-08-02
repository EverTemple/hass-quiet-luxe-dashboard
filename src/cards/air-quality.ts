import type { HassEntity } from '../types/home-assistant';
import type { TranslationKey } from '../i18n/locales/en';

/**
 * The band model behind `readout/air-quality` (Figma 108:9844).
 *
 * ## Where these numbers come from, and where they do not
 *
 * Dyson publishes **no numeric band boundaries** for any pollutant. The device
 * shows a four-colour LCD scale (Good / Fair / Poor / Very poor) and the
 * MyDyson app shows the same words; neither the owner's guide nor the
 * integration exposes the cut-offs behind them. Every number below is therefore
 * either corroborated by independent sources or explicitly community-derived,
 * and each carries its confidence in a comment. None of them is presented to
 * the user as authoritative: the readout shows the device's own reading and a
 * band word, never "the official Dyson threshold".
 *
 * Because the boundaries are uncertain, they are configurable per home — see
 * `resolveThresholds` and the card's `air_quality_thresholds` option — so a user
 * who prefers WHO guideline values or their own local standard can say so
 * without patching the bundle.
 *
 * ## Units
 *
 * PM2.5 and PM10 are µg/m³. VOC and NO₂ are Dyson's own **0–9 index**, not a
 * concentration: `ha-dyson` divides the device's raw `va10`/`noxl` fields by ten
 * before publishing them, and HA labels both `device_class: aqi` with no unit.
 * Verified on the live TP09 (HA 2026.7.1, `ha-dyson` 1.5.7, 2026-08-03).
 */

/** The four words the device's own display uses, worst last. */
export type AirBand = 'good' | 'fair' | 'poor' | 'very-poor';

/** Ordered worst-last, so "the worst band present" is a max over indices. */
export const AIR_BANDS: ReadonlyArray<AirBand> = ['good', 'fair', 'poor', 'very-poor'];

export type PollutantId = 'pm25' | 'pm10' | 'voc' | 'no2';

/** The pollutants the readout draws, in the order the design draws them. */
export const POLLUTANT_ORDER: ReadonlyArray<PollutantId> = ['pm25', 'pm10', 'voc', 'no2'];

/**
 * Upper bounds, inclusive: a reading at or below `good` is good, at or below
 * `fair` is fair, and so on. Anything above `poor` is very poor, so the scale
 * needs no open-ended fourth number.
 */
export interface BandThresholds {
  readonly good: number;
  readonly fair: number;
  readonly poor: number;
}

export type AirQualityThresholds = Readonly<Record<PollutantId, BandThresholds>>;

/**
 * PM2.5, µg/m³.
 *
 * `good: 35` is the ONE boundary here with two independent sources — the
 * `homebridge-dyson-pure-cool` band table and TechRadar's TP10 review both put
 * the Good/Fair line at 35 µg/m³. Confidence: CORROBORATED.
 *
 * `fair: 53` and `poor: 70` are community-derived: they are the widely-repeated
 * Dyson community mapping and they reproduce every sample reading in the Figma
 * component, but no primary source states them. Confidence: COMMUNITY.
 */
export const PM25_THRESHOLDS: BandThresholds = { good: 35, fair: 53, poor: 70 };

/**
 * PM10, µg/m³. Community-derived throughout; no primary source publishes Dyson's
 * PM10 boundaries. Confidence: COMMUNITY.
 */
export const PM10_THRESHOLDS: BandThresholds = { good: 50, fair: 75, poor: 100 };

/**
 * VOC, Dyson 0–9 index (not a concentration). The 0–9 range splits evenly into
 * the four displayed bands at 2 / 4 / 6, which is what the device's own LCD
 * segments suggest, but Dyson states no cut-offs. Confidence: COMMUNITY.
 */
export const VOC_THRESHOLDS: BandThresholds = { good: 2, fair: 4, poor: 6 };

/**
 * NO₂, Dyson 0–9 index. Same even split as VOC, same absence of a primary
 * source. Confidence: COMMUNITY.
 */
export const NO2_THRESHOLDS: BandThresholds = { good: 2, fair: 4, poor: 6 };

export const DEFAULT_AIR_QUALITY_THRESHOLDS: AirQualityThresholds = {
  pm25: PM25_THRESHOLDS,
  pm10: PM10_THRESHOLDS,
  voc: VOC_THRESHOLDS,
  no2: NO2_THRESHOLDS,
};

/** A per-home override: any subset of pollutants, any subset of their bounds. */
export type AirQualityThresholdOverride = {
  readonly [K in PollutantId]?: Partial<BandThresholds>;
};

/**
 * The thresholds actually in force. An override that names one pollutant leaves
 * the rest at their defaults, and one that names a single bound leaves the other
 * two — a user who only disagrees about "poor" should not have to restate the
 * whole scale.
 *
 * A bound that would put the bands out of order is refused rather than silently
 * reordered: an inverted scale would classify every reading wrongly, and failing
 * loudly here is better than a readout that quietly lies.
 */
export function resolveThresholds(
  override: AirQualityThresholdOverride | undefined,
): AirQualityThresholds {
  if (override === undefined) {
    return DEFAULT_AIR_QUALITY_THRESHOLDS;
  }
  const resolved = Object.fromEntries(
    POLLUTANT_ORDER.map((id) => {
      const base = DEFAULT_AIR_QUALITY_THRESHOLDS[id];
      const patch = override[id];
      if (patch === undefined) {
        return [id, base];
      }
      const merged: BandThresholds = {
        good: numberOr(patch.good, base.good),
        fair: numberOr(patch.fair, base.fair),
        poor: numberOr(patch.poor, base.poor),
      };
      if (!(merged.good < merged.fair && merged.fair < merged.poor)) {
        throw new Error(
          `air-quality: thresholds for "${id}" must increase (good < fair < poor)`,
        );
      }
      return [id, merged];
    }),
  ) as Record<PollutantId, BandThresholds>;
  return resolved;
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Which band a reading falls in. Boundaries are inclusive of the lower band. */
export function bandFor(thresholds: BandThresholds, value: number): AirBand {
  if (value <= thresholds.good) {
    return 'good';
  }
  if (value <= thresholds.fair) {
    return 'fair';
  }
  return value <= thresholds.poor ? 'poor' : 'very-poor';
}

/**
 * The worst band across whatever the device actually reports. A purifier with
 * clean particulates and a VOC spike is not "good": the summary has to follow
 * the pollutant that is actually a problem.
 */
export function worstBand(bands: ReadonlyArray<AirBand>): AirBand | undefined {
  if (bands.length === 0) {
    return undefined;
  }
  return bands.reduce((worst, band) =>
    AIR_BANDS.indexOf(band) > AIR_BANDS.indexOf(worst) ? band : worst,
  );
}

/** One label/value pair in the readout. */
export interface AirReading {
  readonly id: PollutantId;
  readonly label: string;
  readonly value: number;
  readonly text: string;
  readonly band: AirBand;
}

/** The entity ids a card was given for each pollutant. */
export type AirQualityEntities = {
  readonly [K in PollutantId]?: string;
};

/** The short labels the design prints. Not translated: they are unit symbols. */
export const POLLUTANT_LABELS: Readonly<Record<PollutantId, string>> = {
  pm25: 'PM2.5',
  pm10: 'PM10',
  voc: 'VOC',
  no2: 'NO₂',
};

/** The band word, as a translation key. */
export const BAND_KEYS: Readonly<Record<AirBand, TranslationKey>> = {
  good: 'air.good',
  fair: 'air.fair',
  poor: 'air.poor',
  'very-poor': 'air.very_poor',
};

/**
 * A Dyson index reads 0–9 with one decimal; a particulate count is a whole
 * number of µg/m³. Printing "6.4" for VOC and "12" for PM2.5 is what the
 * device itself does.
 */
function readingText(id: PollutantId, value: number): string {
  if (id === 'voc' || id === 'no2') {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
  return String(Math.round(value));
}

/**
 * The readings to draw, in design order, skipping every pollutant the device
 * does not report. A TP09 with only PM2.5 wired renders one cell — never a
 * placeholder for a sensor that does not exist.
 */
export function airReadings(
  entities: AirQualityEntities,
  lookup: (entityId: string) => HassEntity | undefined,
  thresholds: AirQualityThresholds = DEFAULT_AIR_QUALITY_THRESHOLDS,
): ReadonlyArray<AirReading> {
  const readings: AirReading[] = [];
  for (const id of POLLUTANT_ORDER) {
    const entityId = entities[id];
    if (entityId === undefined || entityId === '') {
      continue;
    }
    const value = Number(lookup(entityId)?.state);
    if (!Number.isFinite(value)) {
      continue;
    }
    readings.push({
      id,
      label: POLLUTANT_LABELS[id],
      value,
      text: readingText(id, value),
      band: bandFor(thresholds[id], value),
    });
  }
  return readings;
}

/** The summary band for a set of readings. */
export function summaryBand(readings: ReadonlyArray<AirReading>): AirBand | undefined {
  return worstBand(readings.map((reading) => reading.band));
}
