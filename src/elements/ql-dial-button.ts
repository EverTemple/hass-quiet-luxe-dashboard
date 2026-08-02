import { css, html, LitElement, nothing, type CSSResult, type TemplateResult } from 'lit';
import { dysonIcon, type DysonIconName } from './dyson-icons';

export type QlDialState = 'off' | 'on' | 'auto';

/**
 * Circular device control (Figma `control/dial-button`): a 64px dial with an
 * optional state word inside it and a caption label beneath. state=off is
 * surface + hairline, on is a champagne fill with a dark glyph and the on-glow,
 * auto is a champagne outline. Emits `ql-change` {state}; never calls hass.
 *
 * The button is 84px tall including its label and the dial itself carries a
 * 64px hit area extended to `--ql-touch-min` by the host padding, so a dial in
 * a dense grid still meets the 56px minimum.
 */
export class QlDialButton extends LitElement {
  static override properties = {
    icon: { type: String },
    label: { type: String },
    stateWord: { attribute: 'state-word', type: String },
    state: { type: String, reflect: true },
    disabled: { type: Boolean, reflect: true },
  };

  declare icon: DysonIconName;
  declare label: string;
  /** Shown inside the dial under the glyph; empty renders the glyph alone. */
  declare stateWord: string;
  declare state: QlDialState;
  declare disabled: boolean;

  constructor() {
    super();
    this.icon = 'power';
    this.label = '';
    this.stateWord = '';
    this.state = 'off';
    this.disabled = false;
  }

  static override styles: CSSResult = css`
    :host {
      display: inline-block;
      min-width: 0;
    }
    button {
      display: flex;
      flex-direction: column;
      align-items: center;
      /* A dial and its label are one unit, so they sit closer to each other
         than the grid's own rows do to one another. It also buys back 12px a
         row, which is three rows' worth in the 3x3 grid. */
      gap: var(--ql-space-xs, 4px);
      width: 100%;
      min-width: 0;
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .dial {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--ql-space-xs, 4px);
      box-sizing: border-box;
      width: 64px;
      height: 64px;
      border-radius: var(--ql-radius-chip, 999px);
      border: 1px solid var(--ql-surface-border, #e4dccb);
      background: var(--ql-surface-card, #fdfbf6);
      color: var(--ql-ink-muted, #8c8578);
      transition:
        background 200ms ease,
        border-color 200ms ease,
        color 200ms ease,
        box-shadow 200ms ease;
    }
    /* The state word is set in the caption face so a numeral ("5", "90°") and a
       word ("AUTO") share one baseline inside the dial. */
    .word {
      font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      letter-spacing: 0.02em;
      font-variant-numeric: tabular-nums;
    }
    .label {
      color: var(--ql-ink-muted, #8c8578);
      font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      letter-spacing: 0.02em;
      text-align: center;
      width: 100%;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    /* A lit dial reads as ink on champagne. #2b2620 is the fixed ink the design
       specifies for both modes — a documented contrast exemption, since the
       champagne fill is the same value in light and dark. */
    :host([state='on']) .dial {
      background: var(--ql-accent-champagne, #b08d57);
      border-color: transparent;
      color: #2b2620;
      box-shadow: 0 0 18px rgba(224, 178, 99, 0.45);
    }
    :host([state='auto']) .dial {
      border: 1.5px solid var(--ql-accent-champagne, #b08d57);
      color: var(--ql-accent-champagne, #b08d57);
    }
    :host([state='on']) .label,
    :host([state='auto']) .label {
      color: var(--ql-ink-primary, #2b2620);
    }
    button:focus-visible {
      outline: none;
    }
    button:focus-visible .dial {
      outline: 2px solid var(--ql-accent-champagne, #b08d57);
      outline-offset: 3px;
    }
    @media (prefers-reduced-motion: reduce) {
      .dial {
        transition: none;
      }
    }
  `;

  private onClick(): void {
    if (this.disabled) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent('ql-change', {
        detail: { state: this.state },
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected override render(): TemplateResult {
    // The dial's own state word is decorative once the label and pressed state
    // are announced, so the accessible name stays "Oscillation", not "90° Oscillation".
    const pressed = this.state === 'off' ? 'false' : 'true';
    return html`
      <button
        type="button"
        aria-pressed=${pressed}
        aria-label=${this.label === '' ? nothing : this.label}
        ?disabled=${this.disabled}
        @click=${this.onClick}
      >
        <span class="dial">
          ${dysonIcon(this.icon)}
          ${this.stateWord === '' ? nothing : html`<span class="word">${this.stateWord}</span>`}
        </span>
        ${this.label === '' ? nothing : html`<span class="label">${this.label}</span>`}
      </button>
    `;
  }
}

customElements.define('ql-dial-button', QlDialButton);
