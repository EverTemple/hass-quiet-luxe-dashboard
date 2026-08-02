import { svg, type TemplateResult } from 'lit';

/**
 * Figma `Cards — Revisions v2` glyphs (node 46:461), inlined as exported path
 * data rather than redrawn — same reasoning as `dyson-icons.ts`: the bundle
 * ships as one JS file with no sidecar assets, and a stroked glyph has to
 * inherit `currentColor` so it follows the surface it sits on (white over a
 * photo, ink/muted on a fallback card).
 *
 * Sizes come from the design as a 1.5× pair (36×24 / 54×36 for the camera,
 * 32 for the picture glyph); the geometry is identical, so each glyph is drawn
 * once on its base viewBox and scaled by the caller.
 */

/**
 * `glyph/camera` (Figma 47:568 / 49:526): the placeholder a camera card shows
 * instead of a snapshot. Drawn at 0.7 opacity by the design so it reads as a
 * quiet mark rather than an error icon.
 */
export function cameraGlyph(size: number): TemplateResult<2> {
  const height = (size * 24) / 36;
  return svg`
    <svg
      class="glyph"
      width=${size}
      height=${height}
      viewBox="0 0 36 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="0.75"
        y="1.75"
        width="28.5"
        height="20.5"
        rx="5.25"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <circle cx="15" cy="12" r="4.25" stroke="currentColor" stroke-width="1.5" />
      <rect x="28" y="9" width="8" height="6" rx="2" fill="currentColor" />
    </svg>
  `;
}

/**
 * `affordance/edit-image` glass glyph (Figma 50:571): a picture mark — frame,
 * sun, mountain — that opens the room background picker. The 32px disc behind
 * it is drawn in CSS so it can tint with the surface it sits on.
 */
export function pictureGlyph(size: number): TemplateResult<2> {
  return svg`
    <svg
      class="glyph"
      width=${size}
      height=${size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="8.75"
        y="10.25"
        width="14.5"
        height="11.5"
        rx="1.75"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <circle cx="12.75" cy="13.75" r="1.75" fill="currentColor" />
      <path d="M17 15L21.3301 19.5H12.6699L17 15Z" fill="currentColor" />
    </svg>
  `;
}
