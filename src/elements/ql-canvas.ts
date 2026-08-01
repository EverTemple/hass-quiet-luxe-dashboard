import { css, html, LitElement, type CSSResult, type TemplateResult } from 'lit';

/**
 * Full-bleed dashboard background implementing the Figma `bg/canvas`
 * composition: solid bg/base + glow ellipse at 50%/15% + edge vignette
 * (transparent to ~50% radius, full alpha at ~130%). Colors come from the
 * quiet-luxe theme's --ql-bg-* variables so the element themes with HA
 * light/dark mode; fallbacks are the locked light-mode values.
 */
export class QlCanvas extends LitElement {
  static override styles: CSSResult = css`
    :host {
      position: absolute;
      inset: 0;
      display: block;
      overflow: hidden;
      pointer-events: none;
    }
    :host > * {
      position: absolute;
      inset: 0;
    }
    .base {
      background: var(--ql-bg-base, #f4f0e8);
    }
    .glow {
      background: radial-gradient(
        ellipse 120% 85% at 50% 15%,
        var(--ql-bg-glow-center, #fffdf4) 0%,
        transparent 65%
      );
    }
    .vignette {
      background: radial-gradient(
        circle at 50% 15%,
        transparent 50%,
        var(--ql-bg-vignette, rgba(26, 18, 9, 0.08)) 130%
      );
    }
  `;

  protected override render(): TemplateResult {
    return html`
      <div class="base"></div>
      <div class="glow"></div>
      <div class="vignette"></div>
    `;
  }
}

customElements.define('ql-canvas', QlCanvas);
