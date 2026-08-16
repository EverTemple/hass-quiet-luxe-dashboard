import { svg, type TemplateResult } from 'lit';
import type { DialMode } from './climate-dial';

/**
 * The three glyphs on `card/climate-dial-v2`'s header row (Figma 114:2885,
 * `slot/left` 150:3453, `icon/mode` 150:3456, `slot/right` 150:3459) — path
 * data exported from Figma rather than redrawn, matching `ql-glyphs.ts`'s
 * convention. All three are drawn stroke-only at 14×14 in `--ql-ink-muted`,
 * so the eyebrow, the mode and the menu read as one quiet family regardless
 * of which mode the dial is in.
 */

const STROKE = 'var(--ql-ink-muted, #8c8578)';

/**
 * `icon/weather` (Figma 150:3453 subtree): a fixed decorative mark, not a
 * live forecast — the component exposes no weather-condition variant, and
 * this card has no weather-entity binding to drive one. Figma's export fills
 * the sun solid and only strokes the cloud; redrawn stroke-only here so it
 * reads as one family with the mode and menu glyphs beside it.
 */
export function weatherGlyph(): TemplateResult<2> {
  return svg`
    <svg
      class="glyph"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke=${STROKE}
      stroke-width="1.3"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3.50217 7.42766C2.93331 7.22053 2.43861 6.84944 2.08055 6.36128C1.7225 5.87312 1.51716 5.2898 1.49048 4.68499C1.46379 4.08018 1.61696 3.48104 1.93063 2.96324C2.2443 2.44545 2.7044 2.03223 3.2528 1.7758C3.8012 1.51937 4.4133 1.43123 5.01178 1.52251C5.61025 1.6138 6.16824 1.88041 6.61526 2.28867C7.06228 2.69693 7.37827 3.22852 7.52331 3.81628C7.66835 4.40404 7.63593 5.02161 7.43016 5.59096"
      />
      <path
        d="M10.7625 11.725H6.1245C5.1185 11.725 4.2875 11.069 4.2875 10.15C4.2875 9.231 4.9435 8.487 5.8185 8.225C5.9495 6.956 7.0435 5.95 8.3995 5.95C9.5805 5.95 10.5875 6.694 10.9375 7.788C11.9865 7.875 12.7745 8.706 12.7745 9.756C12.7745 10.85 11.8995 11.725 10.7625 11.725Z"
      />
    </svg>
  `;
}

const MODE_PATHS: Readonly<Record<'heat' | 'cool' | 'heat_cool', string>> = {
  heat: 'M10.2375 7.6125C10.2375 5.0755 8.3135 4.1125 7.0005 2.0125C6.5635 3.0635 6.4755 4.5505 6.8695 6.0385C6.3005 5.7755 5.7755 5.2505 5.5135 4.0255C4.6815 4.9875 3.7625 5.9505 3.7625 7.6125C3.7625 9.8885 5.2065 11.8135 7.0005 11.8135C8.7945 11.8135 10.2375 9.8885 10.2375 7.6125Z',
  cool: 'M7.00025 2.1V11.9M2.75625 4.55L11.2442 9.45M2.75625 9.45L11.2442 4.55',
  heat_cool: 'M4.5495 11.55V3.15M6.5625 5.163L4.5495 3.15L2.5375 5.163M9.4495 2.45V10.85M11.4625 8.838L9.4495 10.85L7.4375 8.838',
};

/**
 * `icon/mode` (Figma 150:3456): hvac-mode aware — Figma draws heat, cool,
 * auto and off. There is no fifth drawing for `dialMode`'s `other` (a
 * thermostat reporting `dry`/`fan_only`/anything else the four canonical
 * modes don't cover): it borrows auto's two-arrow mark, the closest reading
 * of "actively doing something the design didn't name a glyph for".
 *
 * Figma's `off` glyph is a filled ring-and-stem shape (a filled arc plus a
 * filled bar); stroking that exact outline would trace both its inner and
 * outer edges as two parallel lines rather than one clean mark, so `off` is
 * redrawn here as the equivalent stroke-only power symbol — same geometry,
 * same 14×14 box, drawn the way a line-icon set would.
 */
export function climateModeGlyph(mode: DialMode): TemplateResult<2> {
  if (mode === 'off') {
    return svg`
      <svg
        class="glyph"
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke=${STROKE}
        stroke-width="1.3"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M7 2.45V6.475" />
        <path d="M9.55 3.696A4.55 4.55 0 1 1 4.45 3.696" />
      </svg>
    `;
  }
  const key = mode === 'other' ? 'heat_cool' : mode;
  const path = MODE_PATHS[key];
  return svg`
    <svg
      class="glyph"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke=${STROKE}
      stroke-width="1.3"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d=${path} />
    </svg>
  `;
}

/** `icon/menu` (Figma 150:3459): the hamburger that opens the control sheet. */
export function menuGlyph(): TemplateResult<2> {
  return svg`
    <svg
      class="glyph"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke=${STROKE}
      stroke-width="1.3"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2.625 4.55H11.375M2.625 7H11.375M2.625 9.45H11.375" />
    </svg>
  `;
}
