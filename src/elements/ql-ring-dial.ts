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
import { dropletGlyph } from './climate-dial-centre-glyphs';
import { formatFixed, formatInteger } from '../i18n/format-number';
import type { Locale } from '../i18n/types';
import { TYPE } from '../tokens/type';

export type QlRingDialSize = 'full' | 'compact' | 'sheet';
/** Which grip a gesture belongs to. A single-setpoint dial only has `value`. */
export type QlRingDialHandle = 'value' | 'low' | 'high';

interface DialGeometry {
  /** The SVG viewBox the ring is drawn in. */
  readonly size: number;
  readonly stroke: number;
  /** Centreline radius of the ring: the grips ride on it. */
  readonly radius: number;
  /** How wide the drawn ring is on screen; the SVG scales to it. */
  readonly box: number;
  readonly grip: number;
  readonly ticks: boolean;
}

/**
 * Figma `card/climate-dial-v2` (114:2885) and `modal/climate-dial` (106:8971).
 *
 * `full` and `sheet` are the same drawing at two scales — the card dial is 198
 * across, the sheet's is 244 — so they share one viewBox and differ only in the
 * box they are rendered into. `compact` is a genuinely different drawing: no
 * ticks, and a thinner ring, because at 136 the tick marks would close up into
 * a solid band.
 */
export const DIAL_GEOMETRY: Readonly<Record<QlRingDialSize, DialGeometry>> = {
  full: { size: 220, stroke: 14, radius: 103, box: 198, grip: 16, ticks: true },
  compact: { size: 136, stroke: 10, radius: 63, box: 136, grip: 14, ticks: false },
  sheet: { size: 220, stroke: 14, radius: 103, box: 244, grip: 20, ticks: true },
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
    /** "77%", pre-formatted by the card — empty omits the row entirely. */
    humidityText: { attribute: 'humidity-text', type: String },
    ambientText: { attribute: 'ambient-text', type: String },
    heroText: { attribute: 'hero-text', type: String },
    valueLabel: { attribute: 'value-label', type: String },
    lowLabel: { attribute: 'low-label', type: String },
    highLabel: { attribute: 'high-label', type: String },
    disabled: { type: Boolean, reflect: true },
    locale: { type: String },
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
  /** "77%" above the numeral, or '' when the entity reports no humidity. */
  declare humidityText: string;
  /** The caption under it — "Now 22.6°", or "Set to 23°" when off. */
  declare ambientText: string;
  /** Replaces the setpoint as the hero numeral when the device is off. */
  declare heroText: string;
  declare valueLabel: string;
  declare lowLabel: string;
  declare highLabel: string;
  declare disabled: boolean;
  /** Session locale for the reading's decimal separator; defaults to `en` for a caller that has none. */
  declare locale: Locale;

  private dragging?: QlRingDialHandle;
  /** Distinguishes this dial's gradient from every other dial's on the page. */
  private readonly instanceId = String((QlRingDial.instances += 1));

  private static instances = 0;

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
    this.humidityText = '';
    this.ambientText = '';
    this.heroText = '';
    this.valueLabel = 'Target temperature';
    this.lowLabel = 'Heat to';
    this.highLabel = 'Cool to';
    this.disabled = false;
    this.locale = 'en';
  }

  static override styles: CSSResult = css`
    :host {
      display: block;
      min-width: 0;
    }
    .stage {
      position: relative;
      width: 100%;
      max-width: ${DIAL_GEOMETRY.full.box}px;
      margin: 0 auto;
      aspect-ratio: 1;
      touch-action: none;
    }
    :host([size='compact']) .stage {
      max-width: ${DIAL_GEOMETRY.compact.box}px;
    }
    :host([size='sheet']) .stage {
      max-width: ${DIAL_GEOMETRY.sheet.box}px;
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
      stroke: var(--ql-ink-muted, #736d63);
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
      width: var(--ql-grip-size, ${DIAL_GEOMETRY.full.grip}px);
      height: var(--ql-grip-size, ${DIAL_GEOMETRY.full.grip}px);
      margin: calc(-0.5 * var(--ql-grip-size, ${DIAL_GEOMETRY.full.grip}px)) 0 0
        calc(-0.5 * var(--ql-grip-size, ${DIAL_GEOMETRY.full.grip}px));
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
      --ql-grip-size: ${DIAL_GEOMETRY.compact.grip}px;
    }
    :host([size='sheet']) .grip::after {
      --ql-grip-size: ${DIAL_GEOMETRY.sheet.grip}px;
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
    /* numeral/dial — TYPE.numeralXxl (Outfit ExtraLight 56/60). The one type
       style this element adds; every other size here is an existing card style. */
    .numeral {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      margin: 0;
      color: var(--ql-ink-primary, #2b2620);
      ${TYPE.numeralXxl}
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.01em;
    }
    :host([size='compact']) .numeral {
      font-weight: 300;
      font-size: 26px;
      line-height: 30px;
    }
    /* Two readings and a divider bar, centred rather than top-aligned — the
       divider has no cap height of its own to align against. */
    .numeral.pair {
      align-items: center;
      gap: 10.8px;
      font-size: 44px;
      line-height: 48px;
    }
    :host([size='compact']) .numeral.pair {
      gap: var(--ql-space-s, 8px);
      font-size: 26px;
      line-height: 30px;
    }
    /* The degree mark sits inline with the numeral at its own font size, tight
       to the digit — the single setpoint and the low/high pair read the same
       way, so "24°" and "21°"/"25°" both read as one figure rather than a
       number with a stepped-down, raised dot beside it. */
    .reading {
      display: inline-flex;
      align-items: flex-start;
    }
    .range-divider {
      display: inline-block;
      flex: none;
      width: 0.9px;
      height: 25.2px;
      background: var(--ql-surface-border, #e4dccb);
    }
    :host([size='compact']) .range-divider {
      width: 1px;
      height: 18px;
    }
    /* The ambient caption below the numeral and the humidity reading above it
       share one quiet, secondary type style — kept as two class names rather
       than one so a test (or a future reader) querying one never picks up
       the other by accident. */
    .caption,
    .humidity-value {
      margin: 0;
      color: var(--ql-ink-muted, #736d63);
      ${TYPE.caption}
      letter-spacing: 0.02em;
    }
    .humidity-row {
      display: flex;
      align-items: center;
      gap: 3px;
    }
    :host([mode='off']) .numeral {
      color: var(--ql-ink-muted, #736d63);
    }
    .reading.low {
      color: var(--ql-accent-champagne-text, #846a41);
    }
    .reading.high {
      color: var(--ql-status-good-text, #67715b);
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

  /** Set while `centreCache` is good for the current animation frame. */
  private centreFresh = false;
  private centreCache?: { readonly x: number; readonly y: number };

  /**
   * `getBoundingClientRect` is a synchronous layout read; `pointermove` can
   * fire well above the paint rate, so the read is throttled to once per
   * animation frame instead of once per event. It is not cached for the
   * whole gesture: this dial can sit on a live dashboard where an unrelated
   * card's own update reflows the page mid-drag (a card above it changing
   * height, for instance), and freezing the stage's position for the whole
   * gesture would let the drag silently drift off the entity's actual box.
   * Refreshing every frame keeps that drift to at most one frame.
   */
  private currentCentre(): { readonly x: number; readonly y: number } | undefined {
    if (!this.centreFresh) {
      this.centreCache = this.stageCentre();
      this.centreFresh = true;
      requestAnimationFrame(() => {
        this.centreFresh = false;
      });
    }
    return this.centreCache;
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
    // Force a fresh read at the start of the gesture rather than trusting
    // whatever frame the cache last settled on.
    this.centreFresh = false;
    this.currentCentre();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const handle = this.dragging;
    if (handle === undefined) {
      return;
    }
    const centre = this.currentCentre();
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
    this.centreFresh = false;
    this.centreCache = undefined;
    this.emit('ql-change', handle);
  };

  /**
   * Home/End jump straight to the entity's own band ends. Page Up/Down move
   * the same coarse step Shift+Arrow already does (`DIAL_COARSE_MULTIPLIER`,
   * 5× the entity's step) — per the ARIA APG slider pattern, and enough to
   * cross a 7–35° band in around a dozen presses instead of fifty-six.
   */
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const handle = QlRingDial.handleOf(event);
    if (handle === undefined || this.disabled) {
      return;
    }
    const scale = this.scale();
    const current = this.readingOf(handle);
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = nudgeValue(scale, current, 1, event.shiftKey);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = nudgeValue(scale, current, -1, event.shiftKey);
        break;
      case 'PageUp':
        next = nudgeValue(scale, current, 1, true);
        break;
      case 'PageDown':
        next = nudgeValue(scale, current, -1, true);
        break;
      case 'Home':
        next = scale.min;
        break;
      case 'End':
        next = scale.max;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.apply(handle, next, 'ql-change');
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
      cool: ['var(--ql-ink-muted, #736d63)', 'var(--ql-status-good, #7e8b6f)'],
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

  /** A reading, e.g. "24°" or "21°" — the degree mark inline at the numeral's
   * own size, single setpoint and low/high pair alike. */
  private reading(value: number, cls = ''): TemplateResult {
    const text = Number.isInteger(this.step)
      ? formatInteger(value, this.locale)
      : formatFixed(value, this.locale, 1);
    return html`<span class="reading ${cls}">${text}${this.unit}</span>`;
  }

  /**
   * The caption under the numeral, at both sizes: dropping the mode-label row
   * (the eyebrow used to carry it) cost the compact ring a line, and without
   * this it goes visibly hollow on a device that reports no humidity.
   */
  private caption(): TemplateResult | typeof nothing {
    if (this.ambientText === '') {
      return nothing;
    }
    return html`<p class="caption">${this.ambientText}</p>`;
  }

  /**
   * The humidity reading above the numeral. Card-supplied and pre-formatted:
   * an entity that reports no humidity passes '', and the row disappears
   * entirely rather than showing a placeholder or a dash.
   */
  private renderHumidity(): TemplateResult | typeof nothing {
    if (this.humidityText === '') {
      return nothing;
    }
    return html`
      <div class="humidity-row">
        ${dropletGlyph(this.size === 'compact' ? 11 : 12)}
        <span class="humidity-value">${this.humidityText}</span>
      </div>
    `;
  }

  /**
   * The numeral, and only the numeral, is the live region: a drag reports
   * continuously and a keypress can repeat, so the humidity readout and the
   * ambient caption stay siblings outside it rather than being re-announced
   * on every tick. `<output>` carries an implicit `status` role already;
   * `role="status"` is kept explicit, matching `ql-stepper`'s readout.
   */
  private renderCentre(): TemplateResult {
    // Off shows the room's own reading as the hero, with the standing setpoint
    // demoted to the caption — the honest statement of a device doing nothing.
    if (this.mode === 'off' || this.kind === 'none') {
      return html`
        ${this.renderHumidity()}
        <output class="numeral" role="status">${this.heroText}</output>
        ${this.caption()}
      `;
    }
    if (this.kind === 'range') {
      return html`
        ${this.renderHumidity()}
        <output class="numeral pair" role="status">
          ${this.reading(this.low, 'low')}<span class="range-divider"></span>${this.reading(
            this.high,
            'high',
          )}
        </output>
        ${this.caption()}
      `;
    }
    return html`
      ${this.renderHumidity()}
      <output class="numeral" role="status">${this.reading(this.value)}</output>
      ${this.caption()}
    `;
  }

  protected override render(): TemplateResult {
    const geometry = this.geometry();
    const centre = geometry.size / 2;
    const span = this.arcSpan();
    // Scoped per instance: several dials share one document — a card's dial and
    // the same entity's dial inside an open sheet, at once — and an id collision
    // would make them all take the first one's ramp, which is drawn over the
    // first one's arc and so points the wrong way.
    const gradientId = `ql-dial-ramp-${this.instanceId}`;
    return html`
      <div class="stage">
        <svg
          viewBox=${`0 0 ${String(geometry.size)} ${String(geometry.size)}`}
          aria-hidden="true"
          focusable="false"
        >
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
