/**
 * Card sizing for HA's sections grid (contract read from
 * home-assistant/frontend on 2026-08-02, HA 2026.7):
 *
 * - A section's inner grid has `12 × column_span` columns, so a card's
 *   `columns` is measured in twelfths of ONE view column — not of the section.
 *   A card that wants half of one view column always asks for 6, whatever the
 *   section spans; a card that wants to fill a span-2 section asks for 24.
 * - `columns: 'full'` spans the section regardless of its span (`1 / -1`).
 * - A NUMERIC `rows` makes HA set a fixed pixel height
 *   (`rows × 64px − 8px`). Content taller than that is not clipped: it spills
 *   out of the card and over whatever sits below. Every card here is
 *   text-driven — device names, track titles, task lists all vary — so cards
 *   declare `rows: 'auto'` and let their own CSS decide the height.
 *
 * `rows: 'auto'` is HA's own default; declaring it is a statement of intent,
 * not decoration: no Quiet Luxe card may pin a row count.
 */

export type QlGridColumns = number | 'full';

export interface QlGridOptions {
  readonly columns: QlGridColumns;
  readonly rows: 'auto';
}

/** Twelfths of one view column. */
export const COLUMNS_FULL = 12;
export const COLUMNS_HALF = 6;
export const COLUMNS_THIRD = 4;
/** Fills a two-column section (24 = 12 × 2); collapses to full width at one column. */
export const COLUMNS_HALF_OF_WIDE_SECTION = 12;

export function contentGrid(columns: QlGridColumns): QlGridOptions {
  return { columns, rows: 'auto' };
}
