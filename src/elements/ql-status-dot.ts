import { css, html, LitElement, type CSSResult, type TemplateResult } from 'lit';

export type QlStatus = 'good' | 'warn' | 'alert' | 'neutral';

/** 8px status dot (Figma `status/dot`): good/warn/alert/neutral, colors from theme vars. */
export class QlStatusDot extends LitElement {
  static override properties = {
    status: { type: String, reflect: true },
  };

  declare status: QlStatus;

  constructor() {
    super();
    this.status = 'neutral';
  }

  static override styles: CSSResult = css`
    :host {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: var(--ql-radius-chip, 999px);
      background: var(--ql-ink-muted, #8c8578);
    }
    :host([status='good']) {
      background: var(--ql-status-good, #7e8b6f);
    }
    :host([status='warn']) {
      background: var(--ql-status-warn, #c08552);
    }
    :host([status='alert']) {
      background: var(--ql-status-alert, #a85b4e);
    }
  `;

  protected override render(): TemplateResult {
    return html``;
  }
}

customElements.define('ql-status-dot', QlStatusDot);
