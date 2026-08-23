import { css, html, LitElement, type CSSResult, type TemplateResult } from 'lit';
import { TYPE } from '../tokens/type';

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
      color: var(--ql-ink-muted, #736d63);
      ${TYPE.eyebrow}
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    ::slotted(*) {
      color: var(--ql-accent-champagne-text, #846a41);
      ${TYPE.caption}
      text-decoration: none;
    }
  `;

  protected override render(): TemplateResult {
    return html`<span class="label">${this.label}</span><slot name="link"></slot>`;
  }
}

customElements.define('ql-section-eyebrow', QlSectionEyebrow);
