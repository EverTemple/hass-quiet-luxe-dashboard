import { css, html, LitElement, type CSSResult, type TemplateResult } from 'lit';

export type QlSheetButtonEmphasis = 'primary' | 'secondary';

/**
 * Modal footer action (Figma `control/sheet-button`): primary is a champagne
 * fill with a #2B2620 label (a documented contrast exemption — the fill is the
 * same value in both modes), secondary is transparent with a hairline. Minimum
 * height is bound to `--ql-touch-min`. Emits native composed `click`; the
 * sheet's owner decides what the action means, so there is no custom event and
 * it never calls hass.
 */
export class QlSheetButton extends LitElement {
  static override properties = {
    emphasis: { type: String, reflect: true },
    disabled: { type: Boolean, reflect: true },
  };

  declare emphasis: QlSheetButtonEmphasis;
  declare disabled: boolean;

  constructor() {
    super();
    this.emphasis = 'secondary';
    this.disabled = false;
  }

  static override styles: CSSResult = css`
    :host {
      display: block;
      flex: 1 1 0;
      min-width: 0;
    }
    button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--ql-space-s, 8px);
      box-sizing: border-box;
      width: 100%;
      min-height: var(--ql-touch-min, 56px);
      padding: var(--ql-space-l, 16px) var(--ql-space-xl, 24px);
      border: 1px solid var(--ql-surface-border, #e4dccb);
      border-radius: var(--ql-radius-chip, 999px);
      background: transparent;
      color: var(--ql-ink-primary, #2b2620);
      font: 500 16px/22px var(--ql-font-body, Outfit, sans-serif);
      cursor: pointer;
      transition:
        background 200ms ease,
        border-color 200ms ease;
    }
    :host([emphasis='primary']) button {
      border-color: transparent;
      background: var(--ql-accent-champagne, #b08d57);
      color: #2b2620;
    }
    button:focus-visible {
      outline: 2px solid var(--ql-accent-champagne, #b08d57);
      outline-offset: 2px;
    }
    button:disabled {
      opacity: 0.45;
      cursor: default;
    }
    @media (prefers-reduced-motion: reduce) {
      button {
        transition: none;
      }
    }
  `;

  protected override render(): TemplateResult {
    return html`
      <button type="button" ?disabled=${this.disabled}><slot></slot></button>
    `;
  }
}

customElements.define('ql-sheet-button', QlSheetButton);
