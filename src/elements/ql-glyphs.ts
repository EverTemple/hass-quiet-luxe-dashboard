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

/*
 * Authored UI glyphs for the KTV song picker. Unlike the two Figma exports
 * above, these were drawn in code (the KTV card has no Figma phase). They share
 * one 20×20 grid, a 1.5 stroke with round caps and joins, and `currentColor`,
 * so a button colours them by setting `color` and never needs a second asset.
 * Transport glyphs (play, pause, next) are solid shapes with the same stroke
 * rounding their corners, so they stay legible at 18–20px.
 */
const GLYPH_GRID = 20;
const GLYPH_STROKE = 1.5;

function strokeGlyph(size: number, body: TemplateResult<2>): TemplateResult<2> {
  return svg`
    <svg
      class="glyph"
      width=${size}
      height=${size}
      viewBox="0 0 ${GLYPH_GRID} ${GLYPH_GRID}"
      fill="none"
      stroke="currentColor"
      stroke-width=${GLYPH_STROKE}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      ${body}
    </svg>
  `;
}

function solidGlyph(size: number, body: TemplateResult<2>): TemplateResult<2> {
  return svg`
    <svg
      class="glyph"
      width=${size}
      height=${size}
      viewBox="0 0 ${GLYPH_GRID} ${GLYPH_GRID}"
      fill="currentColor"
      stroke="currentColor"
      stroke-width=${GLYPH_STROKE}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      ${body}
    </svg>
  `;
}

export function playGlyph(size: number): TemplateResult<2> {
  return solidGlyph(size, svg`<path d="M6.5 4.75 15 10 6.5 15.25Z" />`);
}

export function pauseGlyph(size: number): TemplateResult<2> {
  return solidGlyph(
    size,
    svg`<rect x="5.25" y="4.75" width="3.25" height="10.5" rx="0.75" /><rect x="11.5" y="4.75" width="3.25" height="10.5" rx="0.75" />`,
  );
}

export function nextGlyph(size: number): TemplateResult<2> {
  return solidGlyph(size, svg`<path d="M4.75 4.75 12.5 10 4.75 15.25Z" /><path d="M15.5 4.75v10.5" fill="none" />`);
}

export function plusGlyph(size: number): TemplateResult<2> {
  return strokeGlyph(size, svg`<path d="M10 4.5v11M4.5 10h11" />`);
}

export function minusGlyph(size: number): TemplateResult<2> {
  return strokeGlyph(size, svg`<path d="M4.5 10h11" />`);
}

/** An arrow rising to a bar: "put this at the top of the queue". */
export function toTopGlyph(size: number): TemplateResult<2> {
  return strokeGlyph(size, svg`<path d="M5 4.5h10M10 16V8M6.5 11.5 10 8l3.5 3.5" />`);
}

export function removeGlyph(size: number): TemplateResult<2> {
  return strokeGlyph(size, svg`<path d="m5.5 5.5 9 9M14.5 5.5l-9 9" />`);
}

export function searchGlyph(size: number): TemplateResult<2> {
  return strokeGlyph(size, svg`<circle cx="9" cy="9" r="5" /><path d="m13 13 3.5 3.5" />`);
}

export function checkGlyph(size: number): TemplateResult<2> {
  return strokeGlyph(size, svg`<path d="m4.5 10.5 4 4 7-8.5" />`);
}

/** A speaker with one sound wave: marks the volume group. */
export function speakerGlyph(size: number): TemplateResult<2> {
  return strokeGlyph(size, svg`<path d="M4 8.25h2.5L10 5.5v9l-3.5-2.75H4Z" /><path d="M13 7.5a3.5 3.5 0 0 1 0 5" />`);
}
