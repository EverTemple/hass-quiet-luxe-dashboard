import { css, html, LitElement, nothing, type CSSResult, type TemplateResult } from 'lit';

/**
 * Switch (Figma `control/toggle`): 44×26 track, 22px thumb, champagne on-fill.
 * Native button + role=switch → Space/Enter for free. Emits `ql-change`
 * { checked }; never calls hass.
 */
export class QlToggle extends LitElement {
  static override properties = {
    checked: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    label: { type: String },
  };

  declare checked: boolean;
  declare disabled: boolean;
  declare label: string;

  constructor() {
    super();
    this.checked = false;
    this.disabled = false;
    this.label = '';
  }

  static override styles: CSSResult = css`
    button {
      position: relative;
      width: 44px;
      height: 26px;
      border-radius: var(--ql-radius-chip, 999px);
      border: 1px solid var(--ql-surface-border, #e4dccb);
      background: var(--ql-surface-card, #fdfbf6);
      cursor: pointer;
      padding: 0;
      transition: background 200ms ease;
    }
    /* The track stays the drawn 44×26 switch; an invisible ::before extends
       the actual hit area to the shared touch minimum, matching the width so
       it never reaches sideways into whatever sits next to the toggle. */
    button::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 44px;
      height: var(--ql-touch-min, 56px);
      transform: translate(-50%, -50%);
    }
    button::after {
      content: '';
      position: absolute;
      top: 1px;
      left: 1px;
      width: 22px;
      height: 22px;
      border-radius: var(--ql-radius-chip, 999px);
      background: var(--ql-ink-muted, #736d63);
      transition:
        transform 200ms ease,
        background 200ms ease;
    }
    :host([checked]) button {
      background: var(--ql-accent-champagne, #b08d57);
      border-color: transparent;
    }
    /* The knob reads against the champagne track, not against the card behind
       it: --ql-surface-card is a 5.5%-opacity white in dark mode, which left
       the thumb all but invisible on every toggle in the product. --ql-bg-base
       is opaque in both modes and is the same token the selected segment of
       ql-segmented uses for its label on an ink fill. */
    :host([checked]) button::after {
      transform: translateX(18px);
      background: var(--ql-bg-base, #f4f0e8);
    }
    :host([disabled]) button {
      opacity: 0.5;
      cursor: default;
    }
    @media (prefers-reduced-motion: reduce) {
      button,
      button::after {
        transition: none;
      }
    }
  `;

  private onClick(): void {
    if (this.disabled) {
      return;
    }
    this.checked = !this.checked;
    this.dispatchEvent(
      new CustomEvent('ql-change', {
        detail: { checked: this.checked },
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected override render(): TemplateResult {
    return html`
      <button
        type="button"
        role="switch"
        aria-checked=${String(this.checked)}
        aria-label=${this.label === '' ? nothing : this.label}
        ?disabled=${this.disabled}
        @click=${this.onClick}
      ></button>
    `;
  }
}

customElements.define('ql-toggle', QlToggle);
