import { css, html, LitElement, nothing, type CSSResult, type TemplateResult } from 'lit';

/**
 * Slider (Figma `control/slider`): 4px track, champagne fill, 16px surface thumb.
 * Wraps a native <input type="range"> so arrow/Home/End keys work for free.
 * Emits `ql-input` {value} while dragging and `ql-change` {value} on commit;
 * never calls hass. Fill is painted via the --ql-slider-fill host property.
 *
 * The drawn track/thumb are 16px tall, well under the shared touch minimum —
 * padding plus a matching negative margin gives the input's own pointer
 * target the full `--ql-touch-min` height without growing the visible strip
 * or the layout space this element occupies (see the `input` rule below).
 */
export class QlSlider extends LitElement {
  static override properties = {
    value: { type: Number },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    label: { type: String },
    disabled: { type: Boolean, reflect: true },
  };

  declare value: number;
  declare min: number;
  declare max: number;
  declare step: number;
  declare label: string;
  declare disabled: boolean;

  constructor() {
    super();
    this.value = 0;
    this.min = 0;
    this.max = 100;
    this.step = 1;
    this.label = '';
    this.disabled = false;
  }

  static override styles: CSSResult = css`
    :host {
      display: block;
    }
    /* A native range input's whole box is its pointer/drag target, not just
       the painted track — so the touch minimum comes from padding around the
       16px content box, kept centred (::-webkit-slider-runnable-track and its
       Firefox equivalent stay 4px, positioned by the browser at the padded
       box's centre either way). The matching negative margin pulls that extra
       padding back out of the surrounding layout, so nothing downstream of
       this element grows — only the invisible hit area does. touch-action is
       left at its default so a vertical scroll gesture over the control still
       passes through as a scroll rather than being captured as a drag. */
    input {
      box-sizing: content-box;
      width: 100%;
      height: 16px;
      padding: calc((var(--ql-touch-min, 56px) - 16px) / 2) 0;
      margin: calc(-1 * (var(--ql-touch-min, 56px) - 16px) / 2) 0;
      -webkit-appearance: none;
      appearance: none;
      background: transparent;
      cursor: pointer;
    }
    :host([disabled]) input {
      cursor: default;
      opacity: 0.5;
    }
    input::-webkit-slider-runnable-track {
      height: 4px;
      border-radius: 2px;
      background: linear-gradient(
        to right,
        var(--ql-accent-champagne, #b08d57) var(--ql-slider-fill, 0%),
        var(--ql-surface-border, #e4dccb) var(--ql-slider-fill, 0%)
      );
    }
    input::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 16px;
      height: 16px;
      margin-top: -6px;
      border-radius: var(--ql-radius-chip, 999px);
      background: var(--ql-surface-card, #fdfbf6);
      border: 1px solid var(--ql-surface-border, #e4dccb);
    }
    input::-moz-range-track {
      height: 4px;
      border-radius: 2px;
      background: var(--ql-surface-border, #e4dccb);
    }
    input::-moz-range-progress {
      height: 4px;
      border-radius: 2px;
      background: var(--ql-accent-champagne, #b08d57);
    }
    input::-moz-range-thumb {
      width: 16px;
      height: 16px;
      border-radius: var(--ql-radius-chip, 999px);
      background: var(--ql-surface-card, #fdfbf6);
      border: 1px solid var(--ql-surface-border, #e4dccb);
    }
  `;

  private readValue(event: Event): number {
    return Number((event.target as HTMLInputElement).value);
  }

  private emit(name: 'ql-input' | 'ql-change', value: number): void {
    this.value = value;
    this.dispatchEvent(
      new CustomEvent(name, { detail: { value }, bubbles: true, composed: true }),
    );
  }

  private onInput(event: Event): void {
    this.emit('ql-input', this.readValue(event));
  }

  private onChange(event: Event): void {
    this.emit('ql-change', this.readValue(event));
  }

  protected override updated(): void {
    const range = this.max - this.min;
    const pct = range === 0 ? 0 : ((this.value - this.min) / range) * 100;
    this.style.setProperty('--ql-slider-fill', `${pct}%`);
  }

  protected override render(): TemplateResult {
    return html`
      <input
        type="range"
        min=${this.min}
        max=${this.max}
        step=${this.step}
        .value=${String(this.value)}
        aria-label=${this.label === '' ? nothing : this.label}
        ?disabled=${this.disabled}
        @input=${this.onInput}
        @change=${this.onChange}
      />
    `;
  }
}

customElements.define('ql-slider', QlSlider);
