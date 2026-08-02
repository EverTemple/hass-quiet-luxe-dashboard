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
import {
  angleForOffset,
  angleForValue,
  arcPath,
  clampRange,
  DIAL_START_ANGLE,
  DIAL_SWEEP,
  fineTickValues,
  normaliseAngle,
  nudgeValue,
  polarPoint,
  tickValues,
  valueForAngle,
  type DialMode,
  type DialScale,
  type DialSetpointKind,
} from '../cards/climate-dial';

export type QlRingDialSize = 'full' | 'compact';
/** Which grip a gesture belongs to. A single-setpoint dial only has `value`. */
export type QlRingDialHandle = 'value' | 'low' | 'high';

interface DialGeometry {
  /** The drawn box, and so the SVG viewBox. */
  readonly size: number;
  readonly stroke: number;
  /** Centreline radius of the ring: the grips ride on it. */
  readonly radius: number;
  readonly grip: number;
  readonly ticks: boolean;
}

/** Figma `card/climate-dial` (55:4707), both sizes. */
export const DIAL_GEOMETRY: Readonly<Record<QlRingDialSize, DialGeometry>> = {
  full: { size: 220, stroke: 14, radius: 103, grip: 18, ticks: true },
  compact: { size: 136, stroke: 10, radius: 63, grip: 14, ticks: false },
};

/** Major ticks: 1x6, just inside the ring. Fine ticks: 1x4, closer to it. */
const TICK_OUTER = 88;
const TICK_LENGTH = 6;
const FINE_TICK_OUTER = 94;
const FINE_TICK_LENGTH = 4;

/**
 * The climate ring dial (Figma `card/climate-dial`, 55:4707).
 *
 * An Ecobee-style ring: a 270° track opening at the bottom, a coloured arc from
 * the band's floor to the setpoint, and a grip that can be dragged or driven
 * from the keyboard. `heat_cool` draws the same ring with two grips and the arc
 * spanning low→high.
 *
 * The grips are real `<button>`s overlaid on the SVG rather than SVG nodes, so
 * they focus, take arrow keys and carry a 56px hit area while drawing as an
 * 18px dot — the same approach `ql-sweep-dial` uses.
 *
 * Emits `ql-input` {handle, value, low, high} continuously during a drag and
 * `ql-change` on release or on a key; never calls hass.
 */
export class QlRingDial extends LitElement {
  static override properties = {
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    kind: { type: String },
    value: { type: Number },
    low: { type: Number },
    high: { type: Number },
    mode: { type: String, reflect: true },
    size: { type: String, reflect: true },
    unit: { type: String },
    modeLabel: { attribute: 'mode-label', type: String },
    ambientText: { attribute: 'ambient-text', type: String },
    heroText: { attribute: 'hero-text', type: String },
    valueLabel: { attribute: 'value-label', type: String },
    lowLabel: { attribute: 'low-label', type: String },
    highLabel: { attribute: 'high-label', type: String },
    disabled: { type: Boolean, reflect: true },
  };

  declare min: number;
  declare max: number;
  declare step: number;
  declare kind: DialSetpointKind;
  declare value: number;
  declare low: number;
  declare high: number;
  declare mode: DialMode;
  declare size: QlRingDialSize;
  declare unit: string;
  /** The eyebrow above the numeral — "Heating", "Cooling", "Auto", "Off". */
  declare modeLabel: string;
  /** The caption under it — "Now 22.6°", or "Set to 23°" when off. */
  declare ambientText: string;
  /** Replaces the setpoint as the hero numeral when the device is off. */
  declare heroText: string;
  declare valueLabel: string;
  declare lowLabel: string;
  declare highLabel: string;
  declare disabled: boolean;

  private dragging?: QlRingDialHandle;

  constructor() {
    super();
    this.min = 15;
    this.max = 30;
    this.step = 0.5;
    this.kind = 'single';
    this.value = 22;
    this.low = 21;
    this.high = 25;
    this.mode = 'off';
    this.size = 'full';
    this.unit = '°';
    this.modeLabel = '';
    this.ambientText = '';
    this.heroText = '';
    this.valueLabel = 'Target temperature';
    this.lowLabel = 'Heat to';
    this.highLabel = 'Cool to';
    this.disabled = false;
  }

  static override styles: CSSResult = css`
    :host {
      display: block;
      min-width: 0;
    }
    .stage {
      position: relative;
      width: 100%;
      max-width: ${DIAL_GEOMETRY.full.size}px;
      margin: 0 auto;
      aspect-ratio: 1;
      touch-action: none;
    }
    :host([size='compact']) .stage {
      max-width: ${DIAL_GEOMETRY.compact.size}px;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .track {
      fill: none;
      stroke: var(--ql-surface-border, #e4dccb);
      stroke-linecap: round;
    }
    .arc {
      fill: none;
      stroke-linecap: round;
    }
    .tick {
      stroke: var(--ql-ink-muted, #8c8578);
      stroke-width: 1;
      stroke-opacity: 0.55;
      stroke-linecap: round;
    }
    .tick.fine {
      stroke-opacity: 0.3;
    }
    /* A 56px target centred on the drawn dot: the hit area is transparent, so
       the grip reads as an 18px bead while staying a full thumb target. */
    .grip {
      position: absolute;
      width: var(--ql-touch-min, 56px);
      height: var(--ql-touch-min, 56px);
      margin: calc(-0.5 * var(--ql-touch-min, 56px)) 0 0 calc(-0.5 * var(--ql-touch-min, 56px));
      padding: 0;
      border: 0;
      border-radius: var(--ql-radius-chip, 999px);
      background: transparent;
      cursor: grab;
      touch-action: none;
    }
    .grip::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: var(--ql-grip-size, 18px);
      height: var(--ql-grip-size, 18px);
      margin: calc(-0.5 * var(--ql-grip-size, 18px)) 0 0 calc(-0.5 * var(--ql-grip-size, 18px));
      box-sizing: border-box;
      border-radius: var(--ql-radius-chip, 999px);
      border: 2px solid var(--ql-grip-stroke, var(--ql-accent-champagne, #b08d57));
      /* --ql-surface-card is a 5.5%-opacity white in dark mode: a tint meant to
         sit on the opaque page. Used alone the ring's own arc would read
         straight through the bead, so it is painted over --ql-bg-base to give
         the card's exact colour as an opaque fill. */
      background:
        linear-gradient(var(--ql-surface-card, #fdfbf6), var(--ql-surface-card, #fdfbf6)),
        var(--ql-bg-base, #f4f0e8);
      box-shadow: 0 0 18px rgba(224, 178, 99, 0.45);
    }
    :host([size='compact']) .grip::after {
      --ql-grip-size: 14px;
    }
    .grip:active {
      cursor: grabbing;
    }
    .grip:focus-visible {
      outline: none;
    }
    .grip:focus-visible::after {
      outline: 2px solid var(--ql-accent-champagne, #b08d57);
      outline-offset: 3px;
    }
    :host([disabled]) .grip {
      cursor: default;
    }
    /* The centre stack sits inside the ring, clear of the track. */
    .centre {
      position: absolute;
      inset: 22%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--ql-space-xs, 4px);
      pointer-events: none;
      text-align: center;
      min-width: 0;
    }
    .eyebrow {
      margin: 0;
      color: var(--ql-ink-muted, #8c8578);
      font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    /* numeral/dial — Outfit Light 56/60. The one type style this element adds;
       every other size here is an existing card style. */
    .numeral {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      margin: 0;
      color: var(--ql-ink-primary, #2b2620);
      font: 300 56px/60px var(--ql-font-body, Outfit, sans-serif);
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.01em;
    }
    :host([size='compact']) .numeral {
      font-size: 30px;
      line-height: 34px;
    }
    /* The pair needs room for two readings and a divider, so it steps down. */
    .numeral.pair {
      gap: var(--ql-space-s, 8px);
      font-size: 40px;
      line-height: 44px;
    }
    :host([size='compact']) .numeral.pair {
      gap: var(--ql-space-xs, 4px);
      font-size: 22px;
      line-height: 26px;
    }
    /* The degree mark rides at the numeral's cap height, not on its baseline,
       so "24°" reads as one figure rather than a number and a stray dot. */
    .reading {
      display: inline-flex;
      align-items: flex-start;
    }
    .unit {
      font-size: 0.34em;
      line-height: 1;
      /* Drops the mark from the line box's top to the numeral's cap height.
         Both this and the size are relative to the type, so the compact dial
         and the full one place the mark identically. */
      margin-top: 0.6em;
    }
    .divider {
      color: var(--ql-surface-border, #e4dccb);
      font-size: 0.7em;
    }
    .caption {
      margin: 0;
      color: var(--ql-ink-muted, #8c8578);
      font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
    }
    /* Mode palette. Heat is champagne, cool is the good/sage green, auto shows
       one of each, off is muted throughout. */
    :host([mode='heat']) .eyebrow,
    :host([mode='other']) .eyebrow {
      color: var(--ql-accent-champagne, #b08d57);
    }
    :host([mode='cool']) .eyebrow {
      color: var(--ql-status-good, #7e8b6f);
    }
    :host([mode='heat_cool']) .eyebrow {
      color: var(--ql-accent-champagne, #b08d57);
    }
    :host([mode='off']) .numeral {
      color: var(--ql-ink-muted, #8c8578);
    }
    .reading.low {
      color: var(--ql-accent-champagne, #b08d57);
    }
    .reading.high {
      color: var(--ql-status-good, #7e8b6f);
    }
    @media (prefers-reduced-motion: reduce) {
      .grip::after {
        transition: none;
      }
    }
  `;

  private geometry(): DialGeometry {
    return DIAL_GEOMETRY[this.size] ?? DIAL_GEOMETRY.full;
  }

  private scale(): DialScale {
    return { min: this.min, max: this.max, step: this.step };
  }

  private emit(type: 'ql-input' | 'ql-change', handle: QlRingDialHandle): void {
    this.dispatchEvent(
      new CustomEvent(type, {
        detail: { handle, value: this.value, low: this.low, high: this.high },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /** Writes a handle's new value, holding a range open by at least one step. */
  private apply(handle: QlRingDialHandle, next: number, type: 'ql-input' | 'ql-change'): void {
    if (handle === 'value') {
      if (next === this.value) {
        return;
      }
      this.value = next;
    } else {
      const proposed = handle === 'low' ? { low: next, high: this.high } : { low: this.low, high: next };
      const bounded = clampRange(this.scale(), proposed.low, proposed.high, handle);
      if (bounded.low === this.low && bounded.high === this.high) {
        return;
      }
      this.low = bounded.low;
      this.high = bounded.high;
    }
    this.emit(type, handle);
  }

  private stageCentre(): { readonly x: number; readonly y: number } | undefined {
    const stage = this.shadowRoot?.querySelector('.stage');
    if (stage === null || stage === undefined) {
      return undefined;
    }
    const box = stage.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }

  private static handleOf(event: Event): QlRingDialHandle | undefined {
    const raw = (event.currentTarget as HTMLElement | null)?.dataset.handle;
    return raw === 'value' || raw === 'low' || raw === 'high' ? raw : undefined;
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    const handle = QlRingDial.handleOf(event);
    if (handle === undefined || this.disabled) {
      return;
    }
    event.preventDefault();
    this.dragging = handle;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const handle = this.dragging;
    if (handle === undefined) {
      return;
    }
    const centre = this.stageCentre();
    if (centre === undefined) {
      return;
    }
    const angle = angleForOffset(event.clientX - centre.x, event.clientY - centre.y);
    this.apply(handle, valueForAngle(this.scale(), angle), 'ql-input');
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const handle = this.dragging;
    if (handle === undefined) {
      return;
    }
    this.dragging = undefined;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    this.emit('ql-change', handle);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const handle = QlRingDial.handleOf(event);
    if (handle === undefined || this.disabled) {
      return;
    }
    let direction: 1 | -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      direction = 1;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      direction = -1;
    } else {
      return;
    }
    event.preventDefault();
    const current = this.readingOf(handle);
    this.apply(handle, nudgeValue(this.scale(), current, direction, event.shiftKey), 'ql-change');
  };

  private readingOf(handle: QlRingDialHandle): number {
    if (handle === 'low') {
      return this.low;
    }
    return handle === 'high' ? this.high : this.value;
  }

  /** The arc's own span: floor→setpoint, or low→high for a range. */
  private arcSpan(): { readonly from: number; readonly to: number } | undefined {
    if (this.mode === 'off' || this.kind === 'none') {
      return undefined;
    }
    const scale = this.scale();
    if (this.kind === 'range') {
      return { from: angleForValue(scale, this.low), to: angleForValue(scale, this.high) };
    }
    return { from: DIAL_START_ANGLE, to: angleForValue(scale, this.value) };
  }

  private renderTicks(centre: number, radius: number): SVGTemplateResult | typeof nothing {
    const geometry = this.geometry();
    if (!geometry.ticks) {
      return nothing;
    }
    const scale = this.scale();
    const setpoint = this.kind === 'range' ? this.high : this.value;
    const line = (value: number, outer: number, length: number, cls: string): SVGTemplateResult => {
      const angle = angleForValue(scale, value);
      const [x0, y0] = polarPoint(centre, centre, outer, angle);
      const [x1, y1] = polarPoint(centre, centre, outer - length, angle);
      return svg`<line class=${cls} x1=${x0} y1=${y0} x2=${x1} y2=${y1} />`;
    };
    void radius;
    return svg`
      ${tickValues(scale).map((value) => line(value, TICK_OUTER, TICK_LENGTH, 'tick'))}
      ${fineTickValues(scale, setpoint).map((value) =>
        line(value, FINE_TICK_OUTER, FINE_TICK_LENGTH, 'tick fine'),
      )}
    `;
  }

  /**
   * The arc's ramp. Drawn in user space from the arc's first point to its last,
   * so the colour runs along the arc rather than across the box.
   */
  private renderGradient(
    id: string,
    centre: number,
    radius: number,
    span: { readonly from: number; readonly to: number },
  ): SVGTemplateResult {
    const [x1, y1] = polarPoint(centre, centre, radius, span.from);
    const [x2, y2] = polarPoint(centre, centre, radius, span.to);
    const ramps: Readonly<Record<DialMode, readonly [string, string]>> = {
      heat: ['var(--ql-accent-champagne, #b08d57)', 'var(--ql-glow-lamp-outer, #e0b263)'],
      cool: ['var(--ql-ink-muted, #8c8578)', 'var(--ql-status-good, #7e8b6f)'],
      heat_cool: ['var(--ql-accent-champagne, #b08d57)', 'var(--ql-status-good, #7e8b6f)'],
      other: ['var(--ql-accent-champagne, #b08d57)', 'var(--ql-glow-lamp-outer, #e0b263)'],
      off: ['var(--ql-surface-border, #e4dccb)', 'var(--ql-surface-border, #e4dccb)'],
    };
    const [from, to] = ramps[this.mode] ?? ramps.other;
    return svg`
      <linearGradient id=${id} gradientUnits="userSpaceOnUse" x1=${x1} y1=${y1} x2=${x2} y2=${y2}>
        <stop offset="0" stop-color=${from} />
        <stop offset="1" stop-color=${to} />
      </linearGradient>
    `;
  }

  private renderGrip(handle: QlRingDialHandle): TemplateResult | typeof nothing {
    if (this.mode === 'off' || this.kind === 'none') {
      return nothing;
    }
    const geometry = this.geometry();
    const reading = this.readingOf(handle);
    const angle = angleForValue(this.scale(), reading);
    const [x, y] = polarPoint(geometry.size / 2, geometry.size / 2, geometry.radius, angle);
    const stroke =
      handle === 'high' || (handle === 'value' && this.mode === 'cool')
        ? 'var(--ql-status-good, #7e8b6f)'
        : 'var(--ql-accent-champagne, #b08d57)';
    const labels: Record<QlRingDialHandle, string> = {
      value: this.valueLabel,
      low: this.lowLabel,
      high: this.highLabel,
    };
    return html`
      <button
        class="grip"
        type="button"
        role="slider"
        data-handle=${handle}
        aria-label=${labels[handle]}
        aria-valuemin=${this.min}
        aria-valuemax=${this.max}
        aria-valuenow=${reading}
        aria-valuetext=${`${String(reading)}${this.unit}`}
        ?disabled=${this.disabled}
        style=${`left:${String((x / geometry.size) * 100)}%;top:${String(
          (y / geometry.size) * 100,
        )}%;--ql-grip-stroke:${stroke}`}
        @pointerdown=${this.onPointerDown}
        @pointermove=${this.onPointerMove}
        @pointerup=${this.onPointerUp}
        @pointercancel=${this.onPointerUp}
        @keydown=${this.onKeyDown}
      ></button>
    `;
  }

  private reading(value: number, cls = ''): TemplateResult {
    const text = Number.isInteger(this.step) ? String(Math.round(value)) : value.toFixed(1);
    return html`<span class="reading ${cls}">${text}<span class="unit">${this.unit}</span></span>`;
  }

  /**
   * The compact dial carries the mode and the reading only. At 136px the ring's
   * inner well is not tall enough for a third line, and the room view already
   * shows the room's own temperature above the card.
   */
  private caption(): TemplateResult | typeof nothing {
    if (this.size === 'compact' || this.ambientText === '') {
      return nothing;
    }
    return html`<p class="caption">${this.ambientText}</p>`;
  }

  private renderCentre(): TemplateResult {
    // Off shows the room's own reading as the hero, with the standing setpoint
    // demoted to the caption — the honest statement of a device doing nothing.
    if (this.mode === 'off' || this.kind === 'none') {
      return html`
        <p class="eyebrow">${this.modeLabel}</p>
        <p class="numeral">${this.heroText}</p>
        ${this.caption()}
      `;
    }
    if (this.kind === 'range') {
      return html`
        <p class="eyebrow">${this.modeLabel}</p>
        <p class="numeral pair">
          ${this.reading(this.low, 'low')}<span class="divider">|</span>${this.reading(
            this.high,
            'high',
          )}
        </p>
        ${this.caption()}
      `;
    }
    return html`
      <p class="eyebrow">${this.modeLabel}</p>
      <p class="numeral">${this.reading(this.value)}</p>
      ${this.caption()}
    `;
  }

  protected override render(): TemplateResult {
    const geometry = this.geometry();
    const centre = geometry.size / 2;
    const span = this.arcSpan();
    // Scoped per instance: several dials share one document and an id collision
    // would make them all take the first one's ramp.
    const gradientId = `ql-dial-ramp-${String(geometry.size)}-${this.mode}`;
    return html`
      <div class="stage">
        <svg viewBox=${`0 0 ${String(geometry.size)} ${String(geometry.size)}`} aria-hidden="true">
          <defs>
            ${span === undefined ? nothing : this.renderGradient(gradientId, centre, geometry.radius, span)}
          </defs>
          <path
            class="track"
            stroke-width=${geometry.stroke}
            d=${arcPath(
              centre,
              centre,
              geometry.radius,
              DIAL_START_ANGLE,
              DIAL_START_ANGLE + DIAL_SWEEP,
            )}
          />
          ${this.renderTicks(centre, geometry.radius)}
          ${span === undefined || normaliseAngle(span.to - span.from) === 0
            ? nothing
            : svg`<path
                class="arc"
                stroke-width=${geometry.stroke}
                stroke=${`url(#${gradientId})`}
                d=${arcPath(centre, centre, geometry.radius, span.from, span.to)}
              />`}
        </svg>
        <div class="centre">${this.renderCentre()}</div>
        ${this.kind === 'range'
          ? html`${this.renderGrip('low')}${this.renderGrip('high')}`
          : this.renderGrip('value')}
      </div>
    `;
  }
}

customElements.define('ql-ring-dial', QlRingDial);
