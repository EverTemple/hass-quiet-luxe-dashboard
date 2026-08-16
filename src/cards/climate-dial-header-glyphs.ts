import { svg, type SVGTemplateResult, type TemplateResult } from 'lit';
import type { DialMode } from './climate-dial';

/**
 * The three glyphs on `card/climate-dial-v2`'s header row (Figma 114:2885,
 * `slot/left` 150:3453, `icon/mode` 150:3456, `slot/right` 150:3459) — path
 * data exported from Figma rather than redrawn, matching `ql-glyphs.ts`'s
 * convention. The weather and menu glyphs stay in `--ql-ink-muted`, so the
 * mode glyph — the one glyph carrying a state colour — reads as the one
 * exception in the row rather than one of a matching set.
 */

const STROKE = 'var(--ql-ink-muted, #8c8578)';

/** The cloud half of every non-clear weather glyph, undrawn here since sun,
 * rain, snow and storm all sit it at a slightly different lift. */
const CLOUD_PATH =
  'M10.7625 11.725H6.1245C5.1185 11.725 4.2875 11.069 4.2875 10.15C4.2875 9.231 4.9435 8.487 5.8185 8.225C5.9495 6.956 7.0435 5.95 8.3995 5.95C9.5805 5.95 10.5875 6.694 10.9375 7.788C11.9865 7.875 12.7745 8.706 12.7745 9.756C12.7745 10.85 11.8995 11.725 10.7625 11.725Z';

/** `partlycloudy`'s sun-behind-cloud mark, and this card's static fallback
 * when it has no weather entity to read a live condition from. */
const SUN_BEHIND_CLOUD: SVGTemplateResult = svg`
  <path d="M3.50217 7.42766C2.93331 7.22053 2.43861 6.84944 2.08055 6.36128C1.7225 5.87312 1.51716 5.2898 1.49048 4.68499C1.46379 4.08018 1.61696 3.48104 1.93063 2.96324C2.2443 2.44545 2.7044 2.03223 3.2528 1.7758C3.8012 1.51937 4.4133 1.43123 5.01178 1.52251C5.61025 1.6138 6.16824 1.88041 6.61526 2.28867C7.06228 2.69693 7.37827 3.22852 7.52331 3.81628C7.66835 4.40404 7.63593 5.02161 7.43016 5.59096" />
  <path d=${CLOUD_PATH} />
`;

/** A plain sun, full-strength — `sunny`. */
const SUN: SVGTemplateResult = svg`
  <circle cx="7" cy="7" r="2.4" />
  <path d="M7 1.4V2.9" />
  <path d="M7 11.1V12.6" />
  <path d="M1.4 7H2.9" />
  <path d="M11.1 7H12.6" />
  <path d="M3.03 3.03L4.06 4.06" />
  <path d="M9.94 9.94L10.97 10.97" />
  <path d="M10.97 3.03L9.94 4.06" />
  <path d="M4.06 9.94L3.03 10.97" />
`;

/** A crescent moon — `clear-night`. */
const NIGHT: SVGTemplateResult = svg`
  <path d="M9 2.2A5 5 0 1 0 9 11.8 4.1 4.1 0 0 1 9 2.2Z" />
`;

/** A bare cloud, lifted to centre without anything hanging beneath it —
 * `cloudy`, and the fallback for the two wind conditions. */
const CLOUD: SVGTemplateResult = svg`
  <path d=${CLOUD_PATH} transform="translate(0, -1)" />
`;

/** Cloud with three straight drops — `rainy`, `pouring`. */
const RAIN: SVGTemplateResult = svg`
  <path d=${CLOUD_PATH} transform="translate(0, -1.4)" />
  <path d="M5.6 12.1L5 13.3" />
  <path d="M7.9 12.1L7.3 13.3" />
  <path d="M10.2 12.1L9.6 13.3" />
`;

/** Cloud with three small flake crosses — `snowy`, `snowy-rainy`, `hail`. */
const SNOW: SVGTemplateResult = svg`
  <path d=${CLOUD_PATH} transform="translate(0, -1.4)" />
  <path d="M5.3 12.35V13.65M4.65 13H5.95" />
  <path d="M8 12.35V13.65M7.35 13H8.65" />
  <path d="M10.7 12.35V13.65M10.05 13H11.35" />
`;

/** Cloud with a lightning bolt — `lightning`, `lightning-rainy`. */
const STORM: SVGTemplateResult = svg`
  <path d=${CLOUD_PATH} transform="translate(0, -1.6)" />
  <path d="M7.5 11.2L6.3 13.1H7.7L6.5 14" />
`;

/** Three fog bands of falling width — `fog`. */
const FOG: SVGTemplateResult = svg`
  <path d="M2.3 5H11.7" />
  <path d="M1.5 7.3H12.5" />
  <path d="M3 9.6H11" />
`;

type WeatherGlyphKind = 'sun' | 'night' | 'partly-cloudy' | 'cloud' | 'rain' | 'snow' | 'storm' | 'fog';

const GLYPH_BODY: Readonly<Record<WeatherGlyphKind, SVGTemplateResult>> = {
  sun: SUN,
  night: NIGHT,
  'partly-cloudy': SUN_BEHIND_CLOUD,
  cloud: CLOUD,
  rain: RAIN,
  snow: SNOW,
  storm: STORM,
  fog: FOG,
};

/**
 * HA's fifteen `weather.condition` states, folded onto eight distinguishable
 * marks (spec: sun, night, partly-cloudy, cloud, rain, snow, storm, fog need
 * not be fifteen separate drawings). Anything HA does not report here, or a
 * still-loading/unavailable entity's non-condition state, falls through the
 * `?? 'partly-cloudy'` below to the card's original static mark.
 */
const CONDITION_GLYPH: Readonly<Record<string, WeatherGlyphKind>> = {
  sunny: 'sun',
  'clear-night': 'night',
  partlycloudy: 'partly-cloudy',
  cloudy: 'cloud',
  rainy: 'rain',
  pouring: 'rain',
  snowy: 'snow',
  'snowy-rainy': 'snow',
  hail: 'snow',
  fog: 'fog',
  lightning: 'storm',
  'lightning-rainy': 'storm',
  windy: 'cloud',
  'windy-variant': 'cloud',
  exceptional: 'cloud',
};

/**
 * `icon/weather` (Figma 150:3453 subtree): a live mark when the card is given
 * a `weather_entity` to read, else the fixed decorative mark Figma exported —
 * the component's original, condition-less, partly-cloudy drawing. Figma's
 * export fills the sun solid and only strokes the cloud; every state here is
 * redrawn stroke-only so it reads as one family with the mode and menu glyphs
 * beside it.
 */
export function weatherGlyph(condition?: string): TemplateResult<2> {
  const kind = (condition === undefined ? undefined : CONDITION_GLYPH[condition]) ?? 'partly-cloudy';
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
      ${GLYPH_BODY[kind]}
    </svg>
  `;
}

const MODE_PATHS: Readonly<Record<'heat' | 'cool' | 'heat_cool', string>> = {
  heat: 'M10.2375 7.6125C10.2375 5.0755 8.3135 4.1125 7.0005 2.0125C6.5635 3.0635 6.4755 4.5505 6.8695 6.0385C6.3005 5.7755 5.7755 5.2505 5.5135 4.0255C4.6815 4.9875 3.7625 5.9505 3.7625 7.6125C3.7625 9.8885 5.2065 11.8135 7.0005 11.8135C8.7945 11.8135 10.2375 9.8885 10.2375 7.6125Z',
  cool: 'M7.00025 2.1V11.9M2.75625 4.55L11.2442 9.45M2.75625 9.45L11.2442 4.55',
  heat_cool: 'M4.5495 11.55V3.15M6.5625 5.163L4.5495 3.15L2.5375 5.163M9.4495 2.45V10.85M11.4625 8.838L9.4495 10.85L7.4375 8.838',
};

/**
 * The state colour the mode glyph now carries — the same mapping the centre
 * stack's mode-label eyebrow used before it was dropped (that text duplicated
 * this glyph directly above it). `off` stays `--ql-ink-muted` so it and
 * `heat_cool`/`other`'s champagne read as two distinct marks, not two shades
 * of the same one.
 */
const MODE_STROKE: Readonly<Record<DialMode, string>> = {
  heat: 'var(--ql-accent-champagne, #b08d57)',
  cool: 'var(--ql-status-good, #7e8b6f)',
  heat_cool: 'var(--ql-accent-champagne, #b08d57)',
  other: 'var(--ql-accent-champagne, #b08d57)',
  off: STROKE,
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
 *
 * Heavier than the weather and menu glyphs beside it (1.75 over their 1.3)
 * and coloured by mode rather than left in `--ql-ink-muted`: with the eyebrow
 * gone, this is the dial's one state cue in the header, not a third mark that
 * happens to sit between two others.
 */
export function climateModeGlyph(mode: DialMode): TemplateResult<2> {
  const stroke = MODE_STROKE[mode];
  if (mode === 'off') {
    return svg`
      <svg
        class="glyph"
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke=${stroke}
        stroke-width="1.75"
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
      stroke=${stroke}
      stroke-width="1.75"
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
