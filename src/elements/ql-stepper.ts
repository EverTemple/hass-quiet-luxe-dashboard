import { css, html, LitElement, type CSSResult, type TemplateResult } from 'lit';
import { snapToStep } from '../cards/supported-features';

/**
 * How long the stepper waits after the last press before committing. Tapping
 * "+" four times is one intent, not four; devices like the Sensibo and the
 * Dyson answer slowly and would otherwise be sent four setpoints in a row.
 */
export const STEPPER_COMMIT_MS = 500;

/**
 * Stepper (Figma `control/stepper`): −, numeral, +. Used for any bounded
 * setpoint — climate target temperature, dehumidifier target humidity.
 *
 * The numeral shows the user's intent immediately and turns champagne while
 * the device has not confirmed it yet, so a slow device never looks broken.
 * Emits `ql-change` {value} once the presses settle; never calls hass.
 */
export class QlStepper extends LitElement {
  static override properties = {
    value: { type: Number },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    unit: { type: String },
    label: { type: String },
    decreaseLabel: { attribute: 'decrease-label', type: String },
    increaseLabel: { attribute: 'increase-label', type: String },
    disabled: { type: Boolean, reflect: true },
    pending: { state: true },
  };

  declare value: number;
  declare min: number;
  declare max: number;
  declare step: number;
  declare unit: string;
  declare label: string;
  declare decreaseLabel: string;
  declare increaseLabel: string;
  declare disabled: boolean;
  declare pending?: number;

  private commitTimer?: number;

  constructor() {
    super();
    this.value = 0;
    this.min = 0;
    this.max = 100;
    this.step = 1;
    this.unit = '';
    this.label = '';
    this.decreaseLabel = 'Decrease';
    this.increaseLabel = 'Increase';
    this.disabled = false;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.commitTimer);
    this.pending = undefined;
  }

  static override styles: CSSResult = css`
    :host {
      display: block;
      min-width: 0;
    }
    /* The two buttons are fixed thumb targets; the numeral is what gives way
       on a narrow card, so the stepper always fits inside its card rather
       than spilling past the rounded edge. */
    .stepper {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--ql-space-s, 8px);
      min-width: 0;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      width: var(--ql-touch-min, 56px);
      height: var(--ql-touch-min, 56px);
      /* Full thumb size wherever the card affords it — which is every tablet
         and desktop breakpoint. On a phone, where two cards share a 390px
         row, the width gives way to 44px rather than the button spilling out
         of the card; the height, and so the tap area, is never reduced. */
      flex: 0 1 auto;
      min-width: 44px;
      border-radius: var(--ql-radius-chip, 999px);
      border: 1px solid var(--ql-surface-border, #e4dccb);
      background: var(--ql-surface-card, #fdfbf6);
      color: var(--ql-ink-primary, #2b2620);
      font: 300 20px/1 var(--ql-font-body, Outfit, sans-serif);
      cursor: pointer;
      transition:
        border-color 200ms ease,
        color 200ms ease;
    }
    button:hover:not(:disabled) {
      border-color: var(--ql-accent-champagne, #b08d57);
      color: var(--ql-accent-champagne, #b08d57);
    }
    button:focus-visible {
      outline: 2px solid var(--ql-accent-champagne, #b08d57);
      outline-offset: 2px;
    }
    button:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .readout {
      flex: 0 1 auto;
      min-width: 3ch;
      text-align: center;
      font: 300 22px/26px var(--ql-font-body, Outfit, sans-serif);
      color: var(--ql-ink-primary, #2b2620);
      font-variant-numeric: tabular-nums;
      transition: color 200ms ease;
    }
    /* Uncommitted intent reads champagne until the device confirms it. */
    .readout.pending {
      color: var(--ql-accent-champagne, #b08d57);
    }
    @media (prefers-reduced-motion: reduce) {
      button,
      .readout {
        transition: none;
      }
    }
  `;

  /** The value on screen: the user's uncommitted intent, else the device's. */
  private shown(): number {
    return this.pending ?? this.value;
  }

  private nudge(direction: 1 | -1): void {
    if (this.disabled) {
      return;
    }
    const bounds = { value: this.shown(), min: this.min, max: this.max, step: this.step };
    const next = snapToStep(bounds, this.shown() + direction * (this.step > 0 ? this.step : 1));
    if (next === this.shown()) {
      return;
    }
    this.pending = next;
    window.clearTimeout(this.commitTimer);
    this.commitTimer = window.setTimeout(() => this.commit(), STEPPER_COMMIT_MS);
  }

  private commit(): void {
    const value = this.pending;
    this.pending = undefined;
    if (value === undefined) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent('ql-change', {
        detail: { value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private readout(): string {
    const value = this.shown();
    const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
    return `${text}${this.unit}`;
  }

  protected override render(): TemplateResult {
    const shown = this.shown();
    return html`
      <div class="stepper" role="group" aria-label=${this.label}>
        <button
          aria-label=${this.decreaseLabel}
          ?disabled=${this.disabled || shown <= this.min}
          @click=${(): void => this.nudge(-1)}
        >
          −
        </button>
        <output class="readout ${this.pending === undefined ? '' : 'pending'}" role="status">
          ${this.readout()}
        </output>
        <button
          aria-label=${this.increaseLabel}
          ?disabled=${this.disabled || shown >= this.max}
          @click=${(): void => this.nudge(1)}
        >
          +
        </button>
      </div>
    `;
  }
}

customElements.define('ql-stepper', QlStepper);
