import { css, type CSSResult } from 'lit';

/**
 * The type scale, as shared `font:` shorthand fragments.
 *
 * Unlike `DIMENSIONS` (src/tokens/palette.ts), these are not exposed as CSS
 * custom properties: the `font:` shorthand would need two var()s per role —
 * one for size, one for line-height — and that reads far worse than reusing
 * a shared fragment. Interpolate a role directly where the `font:` line goes,
 * the same way `QlBaseCard.qlCardStyles` shares a style fragment:
 *
 *   .caption {
 *     color: var(--ql-ink-muted, #736d63);
 *     ${TYPE.caption}
 *   }
 *
 * Every role name describes what the text IS in this product (a caption, an
 * eyebrow label, a dial numeral, ...), not the pixel size it happens to be
 * today. Not every `font:` shorthand in the codebase maps to a role here —
 * one-off sizes used once or twice, and `/1` line-height variants, are left
 * as literals at their call sites on purpose. See the ADR note in
 * `src/tokens/type.test.ts` for the full accounting.
 */
export const TYPE = {
  /**
   * Secondary/meta text: card captions, status lines, chip and badge labels.
   * The most common role in the scale.
   */
  caption: css`font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);`,

  /**
   * Uppercase, letter-spaced section/field labels (`.eyebrow`,
   * `ql-section-eyebrow`).
   */
  eyebrow: css`font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);`,

  /** Primary body copy — list rows, dial captions, clock date/labels. */
  body: css`font: 400 14px/20px var(--ql-font-body, Outfit, sans-serif);`,

  /** Card/section titles and sheet button labels (`.title`, `ql-sheet`). */
  title: css`font: 500 16px/22px var(--ql-font-body, Outfit, sans-serif);`,

  /**
   * Base dial/value numeral: temperatures, percentages, stat values
   * (`.numeral`, `.value`).
   */
  numeral: css`font: 300 26px/30px var(--ql-font-body, Outfit, sans-serif);`,

  /** Larger numeral tier — the fan card's auto-mode readout (`.numeral-xl`). */
  numeralXl: css`font: 300 44px/48px var(--ql-font-body, Outfit, sans-serif);`,

  /**
   * Largest numeral tier — the climate ring dial's central reading
   * (`ql-ring-dial`'s `.numeral`).
   */
  numeralXxl: css`font: 200 56px/60px var(--ql-font-body, Outfit, sans-serif);`,

  /**
   * Marcellus display heading — the home header greeting and view titles
   * (`.display`, `h1`).
   */
  display: css`font: 400 34px/40px var(--ql-font-display, Marcellus, serif);`,

  /** Smaller Marcellus display heading — the large room-card name. */
  displaySmall: css`font: 400 24px/30px var(--ql-font-display, Marcellus, serif);`,
} as const satisfies Record<string, CSSResult>;
