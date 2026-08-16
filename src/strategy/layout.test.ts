import { describe, expect, it } from 'vitest';
import {
  clampedSpan,
  columnsForWidth,
  contentBandWidth,
  estimatedCardHeight,
  exceedsHeightBudget,
  haColumnsForWidth,
  medianCardHeight,
  orderTallestFirst,
  trackWidth,
  COLUMN_GUTTER_PX,
  COLUMN_MAX_WIDTH_PX,
  CONTENT_BAND_PX,
  MAX_COLUMNS,
  REGION_SPAN,
} from './layout';
import type { LovelaceCardConfig } from './types';

const card = (type: string, form?: string): LovelaceCardConfig =>
  form === undefined ? { type } : { type, form };

describe('column resolution', () => {
  it('follows the design breakpoints: <640 1, 640 2, 1024 3, 1440 4', () => {
    expect(columnsForWidth(0)).toBe(1);
    expect(columnsForWidth(390)).toBe(1);
    expect(columnsForWidth(639)).toBe(1);
    expect(columnsForWidth(640)).toBe(2);
    expect(columnsForWidth(1023)).toBe(2);
    expect(columnsForWidth(1024)).toBe(3);
    expect(columnsForWidth(1439)).toBe(3);
    expect(columnsForWidth(1440)).toBe(4);
    expect(columnsForWidth(2000)).toBe(4);
  });

  it('never resolves a fifth column', () => {
    expect(columnsForWidth(4000)).toBe(MAX_COLUMNS);
    expect(haColumnsForWidth(4000)).toBe(MAX_COLUMNS);
  });

  /*
   * HA's own steps are arithmetic in (min-width + gutter), so one constant
   * cannot land on 640 / 1024 / 1440. These are what 320 + 24 actually gives —
   * within 40px of the design at every step, and erring towards MORE columns
   * at the top end.
   */
  it('mirrors what HA resolves at runtime: steps at 664 / 1008 / 1352', () => {
    expect(haColumnsForWidth(390)).toBe(1);
    expect(haColumnsForWidth(663)).toBe(1);
    expect(haColumnsForWidth(664)).toBe(2);
    expect(haColumnsForWidth(1007)).toBe(2);
    expect(haColumnsForWidth(1008)).toBe(3);
    expect(haColumnsForWidth(1351)).toBe(3);
    expect(haColumnsForWidth(1352)).toBe(4);
    expect(haColumnsForWidth(2000)).toBe(4);
  });

  it('never resolves a track narrower than the cards need', () => {
    for (const width of [664, 1008, 1352, 1440, 1680, 2000]) {
      const columns = haColumnsForWidth(width);
      const band = contentBandWidth(width - 2 * COLUMN_GUTTER_PX, columns);
      expect(trackWidth(band, columns)).toBeGreaterThanOrEqual(290);
    }
  });

  it('never falls below one column, whatever the view asks for', () => {
    expect(haColumnsForWidth(0)).toBe(1);
    expect(haColumnsForWidth(2000, 1)).toBe(1);
    expect(haColumnsForWidth(2000, 2)).toBe(2);
  });
});

describe('the content band', () => {
  it('caps at 1632 = 4 × 390 + 3 × 24', () => {
    expect(CONTENT_BAND_PX).toBe(1632);
    expect(MAX_COLUMNS * COLUMN_MAX_WIDTH_PX + (MAX_COLUMNS - 1) * COLUMN_GUTTER_PX).toBe(1632);
  });

  it('is fluid below the cap and fixed above it, so 2000px grows the margins', () => {
    expect(contentBandWidth(1200)).toBe(1200);
    expect(contentBandWidth(1632)).toBe(1632);
    /* 2000 viewport − 2 × 24 page padding = 1952 available. */
    expect(contentBandWidth(1952)).toBe(CONTENT_BAND_PX);
    expect(contentBandWidth(3000)).toBe(CONTENT_BAND_PX);
  });

  it('caps proportionally at fewer tracks — a track never exceeds 390', () => {
    expect(contentBandWidth(3000, 3)).toBe(3 * 390 + 2 * 24);
    expect(contentBandWidth(3000, 1)).toBe(390);
  });

  it('splits the band into (band − gutter × (n − 1)) / n', () => {
    expect(trackWidth(CONTENT_BAND_PX, 4)).toBe(390);
    expect(trackWidth(1352, 4)).toBe(320);
    expect(trackWidth(976, 3)).toBeCloseTo(309.33, 1);
  });
});

describe('span clamping', () => {
  it('gives the widest region up whenever the tracks run out, as HA does', () => {
    expect(clampedSpan(REGION_SPAN.roomLights, 4)).toBe(2);
    expect(clampedSpan(REGION_SPAN.roomLights, 2)).toBe(2);
    expect(clampedSpan(REGION_SPAN.roomLights, 1)).toBe(1);
    expect(clampedSpan(REGION_SPAN.securityBand, 4)).toBe(4);
    expect(clampedSpan(REGION_SPAN.securityBand, 3)).toBe(3);
    expect(clampedSpan(REGION_SPAN.securityBand, 1)).toBe(1);
  });

  it('holds the design spans at four tracks', () => {
    expect([
      REGION_SPAN.roomClimate,
      REGION_SPAN.roomLights,
      REGION_SPAN.roomSensors,
    ]).toEqual([1, 2, 1]);
    expect([
      REGION_SPAN.mediaNowPlaying,
      REGION_SPAN.mediaZones,
      REGION_SPAN.mediaIdle,
    ]).toEqual([1, 2, 1]);
    expect([REGION_SPAN.energyNow, REGION_SPAN.energyCharts]).toEqual([1, 2]);
    expect(REGION_SPAN.viewHeader).toBe(4);
  });
});

describe('climate packing', () => {
  it('reads a height off the card type, and its form when it has one', () => {
    expect(estimatedCardHeight(card('custom:quiet-luxe-fan-card'))).toBe(382);
    expect(estimatedCardHeight(card('custom:quiet-luxe-fan-card', 'compact'))).toBe(190);
    expect(estimatedCardHeight(card('custom:quiet-luxe-climate-card'))).toBe(130);
  });

  it('falls back rather than throwing on a card it has never seen', () => {
    expect(estimatedCardHeight(card('custom:third-party-thing'))).toBeGreaterThan(0);
  });

  it('takes the median of a grid, averaging the middle pair when even', () => {
    expect(medianCardHeight([])).toBe(0);
    expect(
      medianCardHeight([
        card('custom:quiet-luxe-climate-card'),
        card('custom:quiet-luxe-fan-card'),
        card('custom:quiet-luxe-climate-dial-card'),
      ]),
    ).toBe(382);
    expect(
      medianCardHeight([
        card('custom:quiet-luxe-climate-card'),
        card('custom:quiet-luxe-cover-card'),
      ]),
    ).toBe(157);
  });

  /* Packing rule 3: the deficit lands at the bottom edge, never mid-grid. */
  it('orders tallest → shortest and is stable within a height', () => {
    const grid = [
      card('custom:quiet-luxe-climate-card'),
      card('custom:quiet-luxe-fan-card'),
      card('custom:quiet-luxe-climate-dial-card'),
      { type: 'custom:quiet-luxe-climate-card', entity: 'climate.second' },
    ];
    expect(orderTallestFirst(grid).map((entry) => entry.type)).toEqual([
      'custom:quiet-luxe-climate-dial-card',
      'custom:quiet-luxe-fan-card',
      'custom:quiet-luxe-climate-card',
      'custom:quiet-luxe-climate-card',
    ]);
    expect(orderTallestFirst(grid)[3]?.entity).toBe('climate.second');
  });

  it('leaves the input untouched', () => {
    const grid = [card('custom:quiet-luxe-climate-card'), card('custom:quiet-luxe-fan-card')];
    orderTallestFirst(grid);
    expect(grid[0]?.type).toBe('custom:quiet-luxe-climate-card');
  });

  /* Packing rule 4: the Dyson card at 382 against a 130 median has to reflow. */
  it('flags a card more than twice its grid median', () => {
    const grid = [
      card('custom:quiet-luxe-fan-card'),
      card('custom:quiet-luxe-climate-card'),
      { type: 'custom:quiet-luxe-climate-card', entity: 'climate.second' },
    ];
    expect(exceedsHeightBudget(card('custom:quiet-luxe-fan-card'), grid)).toBe(true);
    expect(exceedsHeightBudget(card('custom:quiet-luxe-climate-card'), grid)).toBe(false);
  });

  it('clears the same card once it reflows to a shorter form', () => {
    const grid = [
      card('custom:quiet-luxe-fan-card', 'compact'),
      card('custom:quiet-luxe-climate-card'),
      { type: 'custom:quiet-luxe-climate-card', entity: 'climate.second' },
    ];
    expect(exceedsHeightBudget(card('custom:quiet-luxe-fan-card', 'compact'), grid)).toBe(false);
  });

  it('says nothing about an empty grid', () => {
    expect(exceedsHeightBudget(card('custom:quiet-luxe-fan-card'), [])).toBe(false);
  });

  /**
   * The two v0.7.0 branches meet here: the height budget was written expecting
   * the Dyson card to reflow, and the reflow (3×3 dials, whole card 382px)
   * arrived separately. This is the composed grid the live All Climates view
   * actually emits for Steven Bedroom — thermostat, Dyson, dehumidifier.
   */
  it('composes the Dyson reflow with the height budget on the real column', () => {
    const column = [
      card('custom:quiet-luxe-climate-dial-card', 'full'),
      card('custom:quiet-luxe-fan-card', 'full'),
      card('custom:quiet-luxe-climate-card'),
    ];
    /* 444 / 382 / 130 → median 382, budget 764. Nothing in the column exceeds
       it; before the reflow the Dyson's dial ladder alone was ~800px. */
    expect(medianCardHeight(column)).toBe(382);
    for (const entry of column) {
      expect(exceedsHeightBudget(entry, column), entry.type).toBe(false);
    }
    /* Tallest first, so the deficit is spent at the column's bottom edge. */
    expect(orderTallestFirst(column).map((entry) => entry.type)).toEqual([
      'custom:quiet-luxe-climate-dial-card',
      'custom:quiet-luxe-fan-card',
      'custom:quiet-luxe-climate-card',
    ]);
  });
});
