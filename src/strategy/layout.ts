import type { LovelaceCardConfig } from './types';

/**
 * The view-grid contract (Figma `04 Desktop` → "Rules — responsive + climate
 * packing", 101:2476).
 *
 * Nothing here draws anything. HA's `hui-sections-view` owns the grid; this
 * module states the numbers it is fed and mirrors the maths it runs, so the
 * layout can be asserted in tests instead of eyeballed in a browser.
 */

/** Gutter between view columns, and therefore the page padding (HA reuses it). */
export const COLUMN_GUTTER_PX = 24;
/** Page padding below 600px, where HA switches to its narrow gap. */
export const NARROW_GUTTER_PX = 16;
/** Vertical rhythm: header → grid, section → section, card → card. */
export const ROW_GAP_PX = 16;
/** A track never grows past this, so 2000px screens gain margin, not fatter cards. */
export const COLUMN_MAX_WIDTH_PX = 390;
/** A track never shrinks past this; it is what decides the column count. */
export const COLUMN_MIN_WIDTH_PX = 320;
export const MAX_COLUMNS = 4;

/** 4 × 390 + 3 × 24. The band is capped, not fluid. */
export const CONTENT_BAND_PX =
  MAX_COLUMNS * COLUMN_MAX_WIDTH_PX + (MAX_COLUMNS - 1) * COLUMN_GUTTER_PX;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The design's stated breakpoints: < 640 → 1, 640–1023 → 2, 1024–1439 → 3,
 * ≥ 1440 → 4.
 */
export function columnsForWidth(width: number): number {
  if (width >= 1440) {
    return 4;
  }
  if (width >= 1024) {
    return 3;
  }
  if (width >= 640) {
    return 2;
  }
  return 1;
}

/**
 * What HA actually resolves, given the tokens above — `hui-sections-view`'s
 * ResizeController runs `floor((width + gap) / (minWidth + gap))` against the
 * view's OWN width (so a docked sidebar shifts it, exactly as it should) and
 * clamps to the view's `max_columns`.
 *
 * With gutter 24 and min-width 320 the steps land at 664 / 1008 / 1352 rather
 * than the design's 640 / 1024 / 1440. One constant cannot hit all three: HA's
 * steps are arithmetic in (minWidth + gutter) and the design's are not. 320 is
 * both the closest fit and a track width the cards genuinely need, and it errs
 * towards MORE columns sooner — the direction the brief asks for.
 *
 * HA measures the view, not the band, and the band is two gutters narrower, so
 * the track at a step is min-width − 2 × gutter / n: 296 at two tracks, 308 at
 * four. Still comfortably above the ~180px a light card wants.
 */
export function haColumnsForWidth(width: number, maxColumns: number = MAX_COLUMNS): number {
  const columns = Math.floor(
    (width + COLUMN_GUTTER_PX) / (COLUMN_MIN_WIDTH_PX + COLUMN_GUTTER_PX),
  );
  return clamp(columns, 1, maxColumns);
}

/** The centred band: fluid up to CONTENT_BAND_PX, then margins take the rest. */
export function contentBandWidth(available: number, columns: number = MAX_COLUMNS): number {
  const cap = columns * COLUMN_MAX_WIDTH_PX + (columns - 1) * COLUMN_GUTTER_PX;
  return Math.min(Math.max(available, 0), cap);
}

/** Track = (band − gutter × (n − 1)) / n. */
export function trackWidth(band: number, columns: number): number {
  return (band - COLUMN_GUTTER_PX * (columns - 1)) / columns;
}

/** `hui-sections-view` clamps a section's span to the columns it actually has. */
export function clampedSpan(span: number, columns: number): number {
  return Math.min(Math.max(span, 1), columns);
}

/**
 * Region spans at 4 tracks, per view (Figma 04 Desktop). At fewer tracks HA
 * clamps these down; the widest region is the one that gives way.
 */
export const REGION_SPAN = {
  /** Room: climate 1 · lights + covers 2 · sensors + cameras 1. */
  roomClimate: 1,
  roomLights: 2,
  roomSensors: 1,
  /** All Climates: one span-1 column per area, free flow. */
  climatesArea: 1,
  /** Security: every band is 4 across, so each section takes the whole band. */
  securityBand: 4,
  /** Media: now playing 1 · zones 2 · idle 1. */
  mediaNowPlaying: 1,
  mediaZones: 2,
  mediaIdle: 1,
  /** Energy: now 1 · charts 2 · consumers 1. */
  energyNow: 1,
  energyCharts: 2,
  /** The view header always owns the full band. */
  viewHeader: MAX_COLUMNS,
} as const;

/**
 * Grid rows the room's control column claims.
 *
 * At four tracks the three room columns sit in one row and this changes
 * nothing. At three the control column no longer fits beside BOTH neighbours,
 * and without a row span the sensors column starts a new row below the whole
 * grid — leaving the height difference as a hole under the climate column.
 * Claiming rows lets sensors slot in under climate instead, which is the
 * packing the design draws.
 *
 * Three rather than two: CSS spreads a spanning item's surplus height across
 * every auto row it covers, so with two rows the first grows past the climate
 * column and the hole only shrinks. With three, row one is free to size to the
 * climate column alone. Measured on the live room at 1180px, the sensors
 * column moved 1616 → 1101 → 822, and 822 is exactly where the climate column
 * ends plus one gap.
 */
export const ROOM_CONTROLS_ROW_SPAN = 3;

/**
 * Rendered heights at a 390px track.
 *
 * MEASURED, not drawn: read off the live Tung Chung instance (HA 2026.7.1) at a
 * 1680px viewport — four 390px tracks — across Home, both room views, All
 * Climates, Media, Energy and Security on 2026-08-03. The earlier figures came
 * from the Figma demonstration screens, and the climate work invalidated two of
 * them the moment the branches met: the compact dial card gained the mode and
 * fan rows (190 drawn → 402 rendered) and the Dyson card's dials reflowed 3×3
 * (a ~800px ladder → 382 for the whole card). With the drawn numbers, the
 * All-Climates column emitted the fan card above a thermostat 82px taller than
 * it — the exact inversion packing rule 3 exists to prevent.
 *
 * Remeasured 2026-08-17 after the Figma card/climate-dial-v2 alignment: the
 * dial card lost the More button's 56px pill for a text link, taking full 464 →
 * 444 and compact 402 → 378. The humidity readout added in the same pass costs
 * nothing here — it draws inside the ring's fixed diameter rather than
 * stacking below it.
 *
 * Remeasured again the same day after the design-review changes (mode label
 * removed, ambient shown at both sizes): full 446, compact 384, taken off
 * `climate.steven_bedroom` on the live snapshot at a 395px track across all
 * three views that emit the card. Compact matters more than its 6px suggests —
 * at 378 it sorted BELOW the 382 fan card and inverted the intended order;
 * at 384 it sorts above again.
 *
 * Still approximate by design: the only thing they decide is the ORDER cards
 * are emitted in, and being 10px out never changes a comparison. Entries with
 * no live instance to measure keep their drawn value and are marked.
 */
const CARD_HEIGHT_PX: Readonly<Record<string, number>> = {
  'custom:quiet-luxe-climate-dial-card': 446,
  'custom:quiet-luxe-climate-dial-card#compact': 384,
  'custom:quiet-luxe-fan-card': 382,
  'custom:quiet-luxe-fan-card#compact': 190,
  'custom:quiet-luxe-climate-card': 130,
  'custom:quiet-luxe-camera-card': 190,
  'custom:quiet-luxe-cover-card': 184,
  'custom:quiet-luxe-room-card': 192,
  'custom:quiet-luxe-schedule-card': 140,
  'custom:quiet-luxe-media-card#player': 178,
  'custom:quiet-luxe-media-card#bar': 68,
  'custom:ql-row-door-motion': 57,
  /* Not present on the instance these were measured on — Figma values. */
  'custom:quiet-luxe-light-card': 108,
  'custom:quiet-luxe-media-card': 50,
  'custom:quiet-luxe-energy-card': 64,
  'custom:quiet-luxe-energy-card#ring': 140,
  'custom:quiet-luxe-sensor-tile': 84,
  'custom:quiet-luxe-device-cutout-card': 108,
  'custom:ql-row-presence': 38,
  heading: 26,
};

const DEFAULT_CARD_HEIGHT_PX = 108;

export function estimatedCardHeight(card: LovelaceCardConfig): number {
  const form = typeof card.form === 'string' ? card.form : undefined;
  const keyed = form === undefined ? undefined : CARD_HEIGHT_PX[`${card.type}#${form}`];
  return keyed ?? CARD_HEIGHT_PX[card.type] ?? DEFAULT_CARD_HEIGHT_PX;
}

export function medianCardHeight(cards: ReadonlyArray<LovelaceCardConfig>): number {
  if (cards.length === 0) {
    return 0;
  }
  const heights = cards.map(estimatedCardHeight).sort((a, b) => a - b);
  const middle = Math.floor(heights.length / 2);
  const lower = heights[middle - 1] ?? 0;
  const upper = heights[middle] ?? 0;
  return heights.length % 2 === 1 ? upper : (lower + upper) / 2;
}

/** How much taller than the grid's median a single card is allowed to be. */
export const HEIGHT_BUDGET_FACTOR = 2;

/**
 * Packing rule 4: no card may exceed 2× the median height of its grid. A card
 * that does has to reflow internally — `card/device-dyson` at 404 against a
 * 152–190 median is the case the design calls out, and its 3×3 dial reflow
 * lands on its own branch. This side of the contract keeps working either way:
 * the offender is emitted first, so the height it costs its column is paid at
 * the bottom edge of the grid rather than as a hole in the middle.
 */
export function exceedsHeightBudget(
  card: LovelaceCardConfig,
  grid: ReadonlyArray<LovelaceCardConfig>,
): boolean {
  const median = medianCardHeight(grid);
  return median > 0 && estimatedCardHeight(card) > median * HEIGHT_BUDGET_FACTOR;
}

/**
 * Packing rule 3: tallest → shortest, so any height deficit lands at the bottom
 * edge of the grid and never as a gap in the middle of it. Stable, so equal
 * heights keep the order the section builder chose (active devices first).
 */
export function orderTallestFirst(
  cards: ReadonlyArray<LovelaceCardConfig>,
): ReadonlyArray<LovelaceCardConfig> {
  return cards
    .map((card, index) => ({ card, index, height: estimatedCardHeight(card) }))
    .sort((a, b) => b.height - a.height || a.index - b.index)
    .map((entry) => entry.card);
}
