import { css, html, LitElement, type CSSResult, type TemplateResult } from 'lit';
import { TYPE } from '../tokens/type';

/** Caption pill (Figma `badge/count`): slotted caption text in a 999-radius surface pill. */
export class QlBadge extends LitElement {
  static override styles: CSSResult = css`
    :host {
      display: inline-flex;
      align-items: center;
      padding: 2px var(--ql-space-s, 8px);
      border-radius: var(--ql-radius-chip, 999px);
      background: var(--ql-surface-inset, #fdfbf6);
      border: 1px solid var(--ql-surface-border, #e4dccb);
      color: var(--ql-ink-primary, #2b2620);
      ${TYPE.caption}
      letter-spacing: 0.02em;
    }
  `;

  protected override render(): TemplateResult {
    return html`<slot></slot>`;
  }
}

customElements.define('ql-badge', QlBadge);
