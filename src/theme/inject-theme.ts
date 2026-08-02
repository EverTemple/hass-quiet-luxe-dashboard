import {
  FONT_BODY_STACK,
  FONT_BODY_STACK_HANS,
  FONT_DISPLAY_STACK,
  FONT_DISPLAY_STACK_HANS,
} from '../fonts/font-stacks';
import {
  COLUMN_GUTTER_PX,
  COLUMN_MAX_WIDTH_PX,
  COLUMN_MIN_WIDTH_PX,
  NARROW_GUTTER_PX,
  ROW_GAP_PX,
} from '../strategy/layout';
import { colorCssVariables, cssVariableBlock } from '../tokens/css';

export const THEME_STYLE_ID = 'quiet-luxe-theme';

/**
 * Set on <html> from `hass.themes.darkMode` — HA's own resolved dark-mode flag
 * (`selectedTheme.dark` is explicitly documented as unusable for this). The HA
 * frontend exposes no class, attribute or `color-scheme` property to key off
 * in pure CSS, so the flag has to be republished by the bundle; until a card
 * has seen `hass` the stylesheet follows `prefers-color-scheme`.
 */
export const DARK_MODE_ATTRIBUTE = 'data-ql-dark';

/**
 * HA writes the user's language to <html lang> and uses script subtags for
 * Chinese (`zh-Hans` / `zh-Hant`); `zh-CN` covers non-HA hosts of the bundle.
 */
const HANS_SELECTORS = [':root:lang(zh-Hans)', ':root:lang(zh-CN)'];

function rule(selector: string, body: string): string {
  return `${selector} {\n${body}\n}`;
}

function declarations(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
}

function indent(block: string): string {
  return block
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

/**
 * The knobs `hui-sections-view` and `hui-grid-section` expose (read from
 * home-assistant/frontend, HA 2026.7). They are the ONLY runtime lever on the
 * view grid: the column count comes out of a ResizeController that reads
 * `--column-min-width` and the container's own `column-gap` off computed
 * style, so setting them here makes the grid answer to the width the view
 * actually has — sidebar, split view and all — not to a media query.
 *
 * - gutter 24 → also the page padding, since `.wrapper` pads by the gutter.
 *   Below 600px HA swaps to the narrow gutter, which is the design's 16.
 * - max column width 390 → `.wrapper` caps at
 *   `columns × 390 + (columns − 1) × 24` = 1632 at four tracks. Past 1680 the
 *   band stays 1632 and the margins take the rest: never a fifth column, never
 *   a wider card.
 * - vertical rhythm 16 everywhere: header → grid, section → section, card →
 *   card.
 */
export function layoutCssVariables(): Record<string, string> {
  return {
    '--ha-view-sections-column-gap': `${COLUMN_GUTTER_PX}px`,
    '--ha-view-sections-narrow-column-gap': `${NARROW_GUTTER_PX}px`,
    '--ha-view-sections-column-max-width': `${COLUMN_MAX_WIDTH_PX}px`,
    '--ha-view-sections-column-min-width': `${COLUMN_MIN_WIDTH_PX}px`,
    '--ha-view-sections-row-gap': `${ROW_GAP_PX}px`,
    '--ha-section-grid-row-gap': `${ROW_GAP_PX}px`,
    '--ha-section-grid-column-gap': `${ROW_GAP_PX}px`,
  };
}

/**
 * The `--ql-*` custom properties for both modes, so every card renders
 * correctly with no `themes/quiet-luxe.yaml` installed. When the YAML theme IS
 * installed HA writes the same tokens as inline styles on <html>, which beat
 * these document rules — the theme stays authoritative, and additionally
 * styles HA's own chrome.
 */
export function themeStyleCss(): string {
  const light = colorCssVariables('light');
  const dark = colorCssVariables('dark');
  return [
    rule(
      ':root',
      [
        indent(cssVariableBlock('light')),
        `  --ql-font-display: ${FONT_DISPLAY_STACK};`,
        `  --ql-font-body: ${FONT_BODY_STACK};`,
        declarations(layoutCssVariables()),
      ].join('\n'),
    ),
    rule(
      HANS_SELECTORS.join(',\n'),
      [
        `  --ql-font-display: ${FONT_DISPLAY_STACK_HANS};`,
        `  --ql-font-body: ${FONT_BODY_STACK_HANS};`,
      ].join('\n'),
    ),
    rule(
      '@media (prefers-color-scheme: dark)',
      indent(rule(`:root:not([${DARK_MODE_ATTRIBUTE}='false'])`, declarations(dark))),
    ),
    rule(`:root[${DARK_MODE_ATTRIBUTE}='true']`, declarations(dark)),
    rule(`:root[${DARK_MODE_ATTRIBUTE}='false']`, declarations(light)),
  ].join('\n');
}

/** Injects the base stylesheet into the document. Idempotent. */
export function injectThemeStyle(doc: Document): void {
  if (doc.getElementById(THEME_STYLE_ID) !== null) {
    return;
  }
  const style = doc.createElement('style');
  style.id = THEME_STYLE_ID;
  style.textContent = themeStyleCss();
  doc.head.append(style);
}

/**
 * Mirrors HA's resolved dark-mode flag onto <html> so the injected stylesheet
 * follows HA rather than the OS. `undefined` (mock hass, HA too old) clears the
 * attribute and hands control back to `prefers-color-scheme`.
 */
export function syncDarkMode(doc: Document, darkMode: boolean | undefined): void {
  const root = doc.documentElement;
  if (darkMode === undefined) {
    root.removeAttribute(DARK_MODE_ATTRIBUTE);
    return;
  }
  root.setAttribute(DARK_MODE_ATTRIBUTE, darkMode ? 'true' : 'false');
}
