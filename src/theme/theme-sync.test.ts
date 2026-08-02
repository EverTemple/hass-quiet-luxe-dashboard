import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { FONT_BODY_STACK, FONT_DISPLAY_STACK } from '../fonts/font-stacks';
import { colorCssVariables, dimensionCssVariables } from '../tokens/css';
import { COLORS, DIMENSIONS, SHADOW_CARD_LIGHT } from '../tokens/palette';

type ThemeModes = { light: Record<string, string>; dark: Record<string, string> };
type Theme = Record<string, string> & { modes: ThemeModes };

const themeFile = load(readFileSync('themes/quiet-luxe.yaml', 'utf8')) as Record<string, Theme>;
const maybeTheme = themeFile['quiet-luxe'];
if (maybeTheme === undefined) {
  throw new Error('themes/quiet-luxe.yaml does not define a quiet-luxe theme');
}
const theme: Theme = maybeTheme;

describe('themes/quiet-luxe.yaml', () => {
  it('defines the quiet-luxe theme with light and dark modes', () => {
    expect(theme).toBeDefined();
    expect(theme.modes.light).toBeDefined();
    expect(theme.modes.dark).toBeDefined();
  });

  it.each(['light', 'dark'] as const)('maps core HA variables to %s tokens', (mode) => {
    const m = theme.modes[mode];
    const c = COLORS[mode];
    expect(m['primary-background-color']).toBe(c.bgBase);
    expect(m['card-background-color']).toBe(c.surfaceCard);
    expect(m['ha-card-background']).toBe(c.surfaceCard);
    expect(m['primary-text-color']).toBe(c.inkPrimary);
    expect(m['secondary-text-color']).toBe(c.inkMuted);
    expect(m['disabled-text-color']).toBe(c.inkMuted);
    expect(m['primary-color']).toBe(c.accentChampagne);
    expect(m['accent-color']).toBe(c.accentChampagne);
    expect(m['divider-color']).toBe(c.surfaceBorder);
    expect(m['ha-card-border-color']).toBe(c.surfaceBorder);
    expect(m['success-color']).toBe(c.statusGood);
    expect(m['warning-color']).toBe(c.statusWarn);
    expect(m['error-color']).toBe(c.statusAlert);
  });

  it.each(['light', 'dark'] as const)(
    'passes through every --ql-* color token as a %s-mode theme key',
    (mode) => {
      for (const [cssVar, value] of Object.entries(colorCssVariables(mode))) {
        expect(theme.modes[mode][cssVar.slice(2)]).toBe(value);
      }
    },
  );

  it('passes through every --ql-* dimension token as a mode-independent key', () => {
    for (const [cssVar, value] of Object.entries(dimensionCssVariables())) {
      expect(theme[cssVar.slice(2)]).toBe(value);
    }
  });

  it('carries the same font stacks as the injected stylesheet', () => {
    // HA applies theme variables as inline styles on <html>, which outrank the
    // injected :root rules — so a stale stack here would silently drop the CJK
    // system-font fallbacks for anyone who installs the theme.
    expect(theme['ql-font-display']).toBe(FONT_DISPLAY_STACK);
    expect(theme['ql-font-body']).toBe(FONT_BODY_STACK);
  });

  it('applies shape and depth tokens', () => {
    expect(theme['ha-card-border-radius']).toBe(`${DIMENSIONS.radiusCard}px`);
    expect(theme.modes.light['ha-card-box-shadow']).toBe(SHADOW_CARD_LIGHT);
    expect(theme.modes.dark['ha-card-box-shadow']).toBe('none');
  });
});
