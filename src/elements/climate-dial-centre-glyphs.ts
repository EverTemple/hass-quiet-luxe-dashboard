import { svg, type TemplateResult } from 'lit';

/**
 * `icon/droplet` (Figma `card/climate-dial-v2` 114:2885, `row/humidity`
 * 150:12650 and siblings): the humidity reading beside the setpoint. Path
 * data exported from Figma rather than redrawn, matching `ql-glyphs.ts`'s
 * convention — the two sizes are genuinely different drawings, not one
 * scaled by CSS, so each keeps its own measured stroke width.
 */
export function dropletGlyph(size: 11 | 12): TemplateResult<2> {
  if (size === 11) {
    return svg`
      <svg
        class="glyph"
        width="11"
        height="11"
        viewBox="0 0 11 11"
        fill="none"
        stroke="var(--ql-ink-muted, #8c8578)"
        stroke-width="1.02"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M2.544 6.9435C2.544 5.0875 5.5 1.7875 5.5 1.7875C5.5 1.7875 8.456 5.0875 8.456 6.9435C8.456 8.5935 7.15 9.6245 5.5 9.6245C3.85 9.6245 2.544 8.5935 2.544 6.9435Z"
        />
      </svg>
    `;
  }
  return svg`
    <svg
      class="glyph"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="var(--ql-ink-muted, #8c8578)"
      stroke-width="1.11"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2.775 7.575C2.775 5.55 6 1.95 6 1.95C6 1.95 9.225 5.55 9.225 7.575C9.225 9.375 7.8 10.5 6 10.5C4.2 10.5 2.775 9.375 2.775 7.575Z"
      />
    </svg>
  `;
}
