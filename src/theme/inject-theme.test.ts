import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import {
  FONT_BODY_STACK,
  FONT_BODY_STACK_HANS,
  FONT_DISPLAY_STACK,
  FONT_DISPLAY_STACK_HANS,
} from '../fonts/font-stacks';
import { colorCssVariables, dimensionCssVariables } from '../tokens/css';
import {
  DARK_MODE_ATTRIBUTE,
  injectThemeStyle,
  syncDarkMode,
  THEME_STYLE_ID,
  themeStyleCss,
} from './inject-theme';

function freshDocument(): Document {
  return new Window().document as unknown as Document;
}

const css = themeStyleCss();

/** The rule text between `selector {` and the next `}`. */
function ruleBody(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

describe('themeStyleCss', () => {
  it('defines every light token on :root', () => {
    const body = ruleBody(':root');
    for (const [name, value] of Object.entries(colorCssVariables('light'))) {
      expect(body, name).toContain(`${name}: ${value};`);
    }
    for (const [name, value] of Object.entries(dimensionCssVariables())) {
      expect(body, name).toContain(`${name}: ${value};`);
    }
  });

  it('defines every dark token behind the system dark-mode query', () => {
    const query = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
    for (const [name, value] of Object.entries(colorCssVariables('dark'))) {
      expect(query, name).toContain(`${name}: ${value};`);
    }
  });

  it('lets HA dark mode win over the system preference in both directions', () => {
    const dark = ruleBody(`:root[${DARK_MODE_ATTRIBUTE}='true']`);
    const light = ruleBody(`:root[${DARK_MODE_ATTRIBUTE}='false']`);
    expect(dark).toContain(`--ql-ink-primary: ${colorCssVariables('dark')['--ql-ink-primary']};`);
    expect(light).toContain(`--ql-ink-primary: ${colorCssVariables('light')['--ql-ink-primary']};`);
    // The attribute rules must come after the media query to win the cascade.
    expect(css.indexOf(`:root[${DARK_MODE_ATTRIBUTE}='true']`)).toBeGreaterThan(
      css.indexOf('@media (prefers-color-scheme: dark)'),
    );
    // An explicit light session must ignore the system preference.
    expect(css).toContain(`:root:not([${DARK_MODE_ATTRIBUTE}='false'])`);
  });

  it('defines the font stacks, with a Simplified Chinese override', () => {
    expect(ruleBody(':root')).toContain(`--ql-font-display: ${FONT_DISPLAY_STACK};`);
    expect(ruleBody(':root')).toContain(`--ql-font-body: ${FONT_BODY_STACK};`);
    const hans = css.slice(css.indexOf(':root:lang(zh-Hans)'));
    expect(hans).toContain(`--ql-font-display: ${FONT_DISPLAY_STACK_HANS};`);
    expect(hans).toContain(`--ql-font-body: ${FONT_BODY_STACK_HANS};`);
    expect(css).toContain(':lang(zh-CN)');
  });

  it('hard-codes no colour of its own', () => {
    const known = new Set([
      ...Object.values(colorCssVariables('light')),
      ...Object.values(colorCssVariables('dark')),
    ]);
    for (const literal of css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) {
      expect(known.has(literal), literal).toBe(true);
    }
  });
});

describe('injectThemeStyle', () => {
  it('appends one style element', () => {
    const doc = freshDocument();
    injectThemeStyle(doc);
    injectThemeStyle(doc);
    expect(doc.querySelectorAll(`#${THEME_STYLE_ID}`)).toHaveLength(1);
    expect(doc.getElementById(THEME_STYLE_ID)?.textContent).toBe(css);
  });
});

describe('syncDarkMode', () => {
  it('mirrors the HA dark-mode flag onto the document element', () => {
    const doc = freshDocument();
    syncDarkMode(doc, true);
    expect(doc.documentElement.getAttribute(DARK_MODE_ATTRIBUTE)).toBe('true');
    syncDarkMode(doc, false);
    expect(doc.documentElement.getAttribute(DARK_MODE_ATTRIBUTE)).toBe('false');
  });

  it('falls back to the system preference when HA reports nothing', () => {
    const doc = freshDocument();
    syncDarkMode(doc, true);
    syncDarkMode(doc, undefined);
    expect(doc.documentElement.hasAttribute(DARK_MODE_ATTRIBUTE)).toBe(false);
  });
});
