import {
  css,
  html,
  LitElement,
  nothing,
  svg,
  type CSSResult,
  type SVGTemplateResult,
  type TemplateResult,
} from 'lit';
import { snapToStep } from '../cards/supported-features';

/**
 * How long the stepper waits after the last press before committing. Tapping
 * "+" four times is one intent, not four; devices like the Sensibo and the
 * Dyson answer slowly and would otherwise be sent four setpoints in a row.
 */
export const STEPPER_COMMIT_MS = 500;

/**
 * Glyph geometry, from Figma `control/stepper` (49:481).
 *
 * The marks are drawn as vectors in a 20x20 box rather than typed as "−" and
 * "+", because a font glyph is positioned by the face's own metrics, not by the
 * box it sits in. Measured in the shipped product, the typed marks came out
 * 8.5x1.5 and 8.25x8.75 — two different sizes — and both painted ~0.8px below
 * the button's centre, which is the misalignment this element was reported for.
 *
 * Drawn as rects the two glyphs are the same 20px span by construction, and
 * each bar is centred because BAR_OFFSET is exactly (BOX - THICKNESS) / 2.
 */
export const STEPPER_GLYPH_BOX = 20;
export const STEPPER_GLYPH_THICKNESS = 1.5;
export const STEPPER_GLYPH_OFFSET = (STEPPER_GLYPH_BOX - STEPPER_GLYPH_THICKNESS) / 2;
export const STEPPER_GLYPH_RADIUS = STEPPER_GLYPH_THICKNESS / 2;

/**
 * Stepper (Figma `control/stepper`): −, numeral, +. Used for any bounded
 * setpoint — climate target temperature, dehumidifier target humidity.
 *
 * The numeral shows the user's intent immediately and turns champagne while
 * the device has not confirmed it yet, so a slow device never looks broken.
 * Emits `ql-change` {value} once the presses settle; never calls hass.
 *
 * Variants are default | min-reached | max-reached: the end a value has already
 * reached drops its stroke and mutes its glyph rather than dimming the whole
 * control, so the row still reads as a matched pair.
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
      gap: var(--ql-space-m, 12px);
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
         of the card; the height, and so the tap area, is never reduced. Both
         buttons carry the same basis, so they always give way together. */
      flex: 0 1 auto;
      min-width: 44px;
      padding: 0;
      border-radius: var(--ql-radius-chip, 999px);
      border: 1px solid var(--ql-surface-border, #e4dccb);
      background: var(--ql-surface-card, #fdfbf6);
      color: var(--ql-ink-primary, #2b2620);
      cursor: pointer;
      transition:
        border-color 200ms ease,
        color 200ms ease;
    }
    /* Flex centres the box; the bars are centred inside it by construction. */
    .glyph {
      display: block;
      flex: 0 0 auto;
      width: ${STEPPER_GLYPH_BOX}px;
      height: ${STEPPER_GLYPH_BOX}px;
      fill: currentColor;
    }
    button:hover:not(:disabled) {
      border-color: var(--ql-accent-champagne, #b08d57);
      color: var(--ql-accent-champagne, #b08d57);
    }
    button:focus-visible {
      outline: 2px solid var(--ql-accent-champagne, #b08d57);
      outline-offset: 2px;
    }
    /* An end the value has already reached: no stroke, muted glyph. The button
       keeps its full size so the row stays symmetrical. */
    button:disabled {
      border-color: transparent;
      color: var(--ql-ink-muted, #8c8578);
      cursor: default;
    }
    /* A stepper whose entity is not answering dims as a whole, which is a
       different statement from "this end is as far as it goes". */
    :host([disabled]) button {
      opacity: 0.45;
    }
    .readout {
      /* The numeral column is the row's centre: it takes the free space and
         centres its text, so the reading sits exactly midway between the two
         buttons at every width and for every number of digits. */
      flex: 1 1 auto;
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

  /**
   * A device on a fractional grid reads to one decimal even at a whole number,
   * so 23 -> 23.5 -> 24 does not change the numeral's width mid-press.
   */
  private readout(): string {
    const value = this.shown();
    const fractional = this.step > 0 && !Number.isInteger(this.step);
    const text = fractional ? value.toFixed(1) : String(Math.round(value * 10) / 10);
    return `${text}${this.unit}`;
  }

  /**
   * Minus is one horizontal bar; plus is that bar plus its vertical mirror.
   * Both span the full 20px box, so the two buttons read as one pair.
   */
  private static glyph(kind: 'minus' | 'plus'): SVGTemplateResult {
    const bar = svg`<rect
      x="0"
      y=${STEPPER_GLYPH_OFFSET}
      width=${STEPPER_GLYPH_BOX}
      height=${STEPPER_GLYPH_THICKNESS}
      rx=${STEPPER_GLYPH_RADIUS}
    />`;
    const stem = svg`<rect
      x=${STEPPER_GLYPH_OFFSET}
      y="0"
      width=${STEPPER_GLYPH_THICKNESS}
      height=${STEPPER_GLYPH_BOX}
      rx=${STEPPER_GLYPH_RADIUS}
    />`;
    return svg`${bar}${kind === 'plus' ? stem : nothing}`;
  }

  private renderGlyph(kind: 'minus' | 'plus'): TemplateResult {
    return html`
      <svg
        class="glyph"
        viewBox=${`0 0 ${String(STEPPER_GLYPH_BOX)} ${String(STEPPER_GLYPH_BOX)}`}
        aria-hidden="true"
        focusable="false"
      >
        ${QlStepper.glyph(kind)}
      </svg>
    `;
  }

  protected override render(): TemplateResult {
    const shown = this.shown();
    return html`
      <div class="stepper" role="group" aria-label=${this.label}>
        <button
          type="button"
          aria-label=${this.decreaseLabel}
          ?disabled=${this.disabled || shown <= this.min}
          @click=${(): void => this.nudge(-1)}
        >
          ${this.renderGlyph('minus')}
        </button>
        <output class="readout ${this.pending === undefined ? '' : 'pending'}" role="status">
          ${this.readout()}
        </output>
        <button
          type="button"
          aria-label=${this.increaseLabel}
          ?disabled=${this.disabled || shown >= this.max}
          @click=${(): void => this.nudge(1)}
        >
          ${this.renderGlyph('plus')}
        </button>
      </div>
    `;
  }
}

customElements.define('ql-stepper', QlStepper);
