import {
  FONT_BODY_STACK,
  FONT_BODY_STACK_HANS,
  FONT_DISPLAY_STACK,
  FONT_DISPLAY_STACK_HANS,
} from '../fonts/font-stacks';
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
