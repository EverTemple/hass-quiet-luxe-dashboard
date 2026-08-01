import { css, html, LitElement, type CSSResult, type TemplateResult } from 'lit';

/**
 * Section eyebrow (Figma `section/eyebrow`): letterspaced uppercase micro-label
 * with an optional right-aligned link slot ("All climates →" pattern — the
 * caller slots a localized <a>/<button>).
 */
export class QlSectionEyebrow extends LitElement {
  static override properties = {
    label: { type: String },
  };

  declare label: string;

  constructor() {
    super();
    this.label = '';
  }

  static override styles: CSSResult = css`
    :host {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--ql-space-s, 8px);
    }
    .label {
      color: var(--ql-ink-muted, #8c8578);
      font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    ::slotted(*) {
      color: var(--ql-accent-champagne, #b08d57);
      font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      text-decoration: none;
    }
  `;

  protected override render(): TemplateResult {
    return html`<span class="label">${this.label}</span><slot name="link"></slot>`;
  }
}

customElements.define('ql-section-eyebrow', QlSectionEyebrow);
