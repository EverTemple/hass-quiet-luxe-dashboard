/**
 * Faithful stand-in for HA's sections view + grid section, so the harness
 * reproduces the real layout contract rather than an approximation of it.
 *
 * Transcribed from home-assistant/frontend (read 2026-08-02, HA 2026.7):
 * - views/hui-sections-view.ts   — column count, --column-span clamping, gaps
 * - sections/hui-grid-section.ts — --grid-column-count = 12 × column_span,
 *                                  .fit-rows fixed heights, .full-width
 * - common/compute-card-grid-size.ts — defaults { columns: 12, rows: 'auto' }
 *
 * Keep this file in sync when HA changes those files; it is the only place the
 * repo asserts what HA does with grid_options.
 */

export const BASE_COLUMN_COUNT = 12;
export const ROW_HEIGHT_PX = 56;
export const ROW_GAP_PX = 8;
export const COLUMN_GAP_PX = 8;
export const VIEW_COLUMN_MIN_WIDTH_PX = 320;
export const VIEW_COLUMN_GAP_PX = 32;
export const VIEW_ROW_GAP_PX = 24;
export const DEFAULT_MAX_COLUMNS = 4;

export interface GridOptions {
  readonly columns?: number | 'full';
  readonly rows?: number | 'auto';
  readonly min_columns?: number;
  readonly max_columns?: number;
  readonly min_rows?: number;
  readonly max_rows?: number;
}

interface CardConfigLike {
  readonly type: string;
  readonly grid_options?: GridOptions;
  readonly [key: string]: unknown;
}

interface SectionConfigLike {
  readonly type: string;
  readonly column_span?: number;
  readonly cards: ReadonlyArray<CardConfigLike>;
}

interface ViewConfigLike {
  readonly title: string;
  readonly path: string;
  readonly max_columns?: number;
  readonly sections: ReadonlyArray<SectionConfigLike>;
}

type GridCard = HTMLElement & {
  hass?: unknown;
  setConfig?(config: unknown): void;
  getGridOptions?(): GridOptions;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** hui-sections-view's ResizeController maths. */
export function viewColumnCount(totalWidth: number, maxColumns: number): number {
  const columns = Math.floor(
    (totalWidth + VIEW_COLUMN_GAP_PX) / (VIEW_COLUMN_MIN_WIDTH_PX + VIEW_COLUMN_GAP_PX),
  );
  return clamp(Math.max(columns, 1), 1, maxColumns);
}

/** compute-card-grid-size.ts */
export function computeCardGridSize(options: GridOptions): {
  rows: number | 'auto';
  columns: number | 'full';
} {
  const rows = options.rows ?? 'auto';
  const columns = options.columns ?? BASE_COLUMN_COUNT;
  return {
    rows:
      typeof rows === 'string'
        ? rows
        : clamp(rows, options.min_rows ?? rows, options.max_rows ?? rows),
    columns:
      typeof columns === 'string'
        ? columns
        : clamp(columns, options.min_columns ?? columns, options.max_columns ?? columns),
  };
}

const HEADING_TAG = 'ql-dev-heading';

if (customElements.get(HEADING_TAG) === undefined) {
  class DevHeading extends HTMLElement {
    connectedCallback(): void {
      this.style.cssText =
        'display:block;font:400 20px/28px var(--ql-font-display, Marcellus, serif);' +
        'color:var(--ql-ink-primary,#2b2620);letter-spacing:0.02em;';
    }
    getGridOptions(): GridOptions {
      return { columns: 'full', rows: 1 };
    }
    setConfig(config: { heading?: string }): void {
      this.textContent = config.heading ?? '';
    }
  }
  customElements.define(HEADING_TAG, DevHeading);
}

function tagFor(type: string): string {
  return type.startsWith('custom:') ? type.slice('custom:'.length) : `hui-${type}-card`;
}

function makeCard(config: CardConfigLike, hass: unknown): GridCard {
  const tag = config.type === 'heading' ? HEADING_TAG : tagFor(config.type);
  const card = document.createElement(tag) as GridCard;
  try {
    card.setConfig?.(config);
  } catch (error) {
    card.textContent = `setConfig failed: ${String(error)}`;
  }
  card.hass = hass;
  return card;
}

function renderSection(section: SectionConfigLike, hass: unknown, columnSpan: number): HTMLElement {
  const host = document.createElement('div');
  host.className = 'ql-dev-section-host';
  host.style.cssText = `--base-column-count:${BASE_COLUMN_COUNT};--row-gap:${ROW_GAP_PX}px;--column-gap:${COLUMN_GAP_PX}px;--row-height:${ROW_HEIGHT_PX}px;--column-span:${columnSpan};display:flex;flex-direction:column;gap:var(--row-gap);`;
  const container = document.createElement('div');
  container.className = 'ql-dev-grid';
  host.append(container);
  for (const cardConfig of section.cards) {
    const card = makeCard(cardConfig, hass);
    const elementOptions = card.getGridOptions?.() ?? {};
    const { rows, columns } = computeCardGridSize({
      ...elementOptions,
      ...(cardConfig.grid_options ?? {}),
    });
    const slot = document.createElement('div');
    slot.className = `ql-dev-card${typeof rows === 'number' ? ' fit-rows' : ''}${columns === 'full' ? ' full-width' : ''}`;
    if (typeof columns === 'number') {
      slot.style.setProperty('--column-size', String(columns));
    }
    if (typeof rows === 'number') {
      slot.style.setProperty('--row-size', String(rows));
    }
    slot.append(card);
    container.append(slot);
  }
  return host;
}

export const HA_GRID_CSS = `
.ql-dev-content {
  display: grid;
  align-items: start;
  justify-content: center;
  grid-template-columns: repeat(var(--content-column-count), 1fr);
  grid-auto-flow: row;
  gap: ${VIEW_ROW_GAP_PX}px ${VIEW_COLUMN_GAP_PX}px;
  padding: ${VIEW_ROW_GAP_PX}px 0;
}
.ql-dev-view-section { grid-column: span var(--column-span); grid-row: span 1; }
.ql-dev-grid {
  --grid-column-count: calc(var(--base-column-count) * var(--column-span, 1));
  display: grid;
  grid-template-columns: repeat(var(--grid-column-count), minmax(0, 1fr));
  grid-auto-rows: auto;
  row-gap: var(--row-gap);
  column-gap: var(--column-gap);
  padding: 0;
  /* HA 2026.7 as shipped: the container fills its section (measured on the
     live instance; the dev branch's auto side margins would shrink-to-fit). */
  width: 100%;
}
.ql-dev-card {
  position: relative;
  grid-row: span var(--row-size, 1);
  grid-column: span min(var(--column-size, 1), var(--grid-column-count));
}
.ql-dev-card.fit-rows {
  height: calc((var(--row-size, 1) * (var(--row-height) + var(--row-gap))) - var(--row-gap));
}
.ql-dev-card.full-width { grid-column: 1 / -1; }
.ql-dev-card:has(> *) { display: block; }
`;

/** Renders one generated view the way HA's sections view would. */
export function renderView(view: ViewConfigLike, hass: unknown, totalWidth: number): HTMLElement {
  const columnCount = viewColumnCount(totalWidth, view.max_columns ?? DEFAULT_MAX_COLUMNS);
  const content = document.createElement('div');
  content.className = 'ql-dev-content';
  content.style.setProperty('--content-column-count', String(columnCount));
  for (const section of view.sections) {
    const columnSpan = Math.min(section.column_span ?? 1, columnCount);
    const wrapper = document.createElement('div');
    wrapper.className = 'ql-dev-view-section';
    wrapper.style.setProperty('--column-span', String(columnSpan));
    wrapper.append(renderSection(section, hass, columnSpan));
    content.append(wrapper);
  }
  return content;
}
