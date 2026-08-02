/**
 * Font stacks used by the injected base stylesheet (src/theme/inject-theme.ts)
 * and by the YAML theme.
 *
 * Marcellus and Outfit are inlined into the bundle (Latin only). CJK is never
 * inlined — the Noto CJK webfonts are tens of MB — so each stack names the
 * Noto family first (present only when the optional /local font install is
 * done) and then falls through to the CJK system fonts that ship with macOS,
 * iOS/iPadOS, Windows and desktop Linux.
 *
 * Every stack must end in a generic (`serif` / `sans-serif`): Android matches
 * none of these family names and resolves CJK through its own lang-tagged Noto
 * fallback, which the generic is what triggers. The Latin face also has to come
 * first, or Latin text and digits pick up the CJK font's own wide Latin glyphs.
 */

/**
 * Traditional Chinese sans: Apple (PingFang HK carries the Hong Kong shapes,
 * which matters for the Tung Chung instance), Windows, then the open-source
 * naming Linux distros and webfonts use.
 */
const SANS_TC =
  "'Noto Sans TC', 'PingFang TC', 'PingFang HK', 'Hiragino Sans TC', 'Hiragino Sans CNS', 'Microsoft JhengHei', 'Noto Sans CJK TC', 'Source Han Sans TC'";
/** Simplified Chinese sans: Apple, Windows, Android/Linux. */
const SANS_SC =
  "'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Source Han Sans SC'";
/**
 * Traditional Chinese serif. Weakest stack by necessity: Windows ships plain
 * PMingLiU only with the Traditional Chinese language pack, so a default
 * Windows install falls through to the generic `serif`.
 */
const SERIF_TC =
  "'Noto Serif TC', 'Songti TC', 'Source Han Serif TC', 'Noto Serif CJK TC', 'PMingLiU'";
/** Simplified Chinese serif. SimSun ships with a default Windows install. */
const SERIF_SC =
  "'Noto Serif SC', 'Songti SC', 'Source Han Serif SC', 'Noto Serif CJK SC', 'SimSun'";

/** Display stack (Marcellus + Traditional-first CJK serif). */
export const FONT_DISPLAY_STACK = `Marcellus, ${SERIF_TC}, ${SERIF_SC}, serif`;
/** Body stack (Outfit + Traditional-first CJK sans). */
export const FONT_BODY_STACK = `Outfit, ${SANS_TC}, ${SANS_SC}, sans-serif`;
/** Display stack for Simplified Chinese sessions. */
export const FONT_DISPLAY_STACK_HANS = `Marcellus, ${SERIF_SC}, ${SERIF_TC}, serif`;
/** Body stack for Simplified Chinese sessions. */
export const FONT_BODY_STACK_HANS = `Outfit, ${SANS_SC}, ${SANS_TC}, sans-serif`;
