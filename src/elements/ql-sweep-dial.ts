import { css, html, LitElement, svg, type CSSResult, type SVGTemplateResult, type TemplateResult } from 'lit';
import {
  SWEEP_COARSE_STEP,
  SWEEP_FINE_STEP,
  isMinSweep,
  normaliseSweep,
  sweepAimDrag,
  sweepBearing,
  sweepHandleDrag,
  sweepNudge,
  sweepRotate,
  type SweepHandle,
} from '../cards/fan-capabilities';
import { ANGLE_MAX, ANGLE_MIN, type OscillationAngle } from '../cards/supported-features';

/** Figma `modal/oscillation-v2` dial stage: 372x284, centre (186,162), track r=120. */
const STAGE_W = 372;
const STAGE_H = 284;
const CX = 186;
const CY = 162;
const R_TRACK = 120;
/** The swept sector is a three-step wedge: r120 @10%, r84 @14%, r52 @18%. */
const WEDGE_STEPS: ReadonlyArray<readonly [number, number]> = [
  [120, 0.1],
  [84, 0.14],
  [52, 0.18],
];
/** The champagne band sits on the track itself (innerRadius 0.965 -> 4px). */
const R_BAND = 118;
const BAND_WIDTH = 4;
/** The aim indicator: a 1x28 bar on the bisector, centred at r=32. */
const R_AIM_LINE_INNER = 18;
const R_AIM_LINE_OUTER = 46;
/** The slide grip rides the bisector at r=62. */
const R_AIM_GRIP = 62;

/** What a pointer is currently moving. */
type SweepDrag = SweepHandle | 'aim';

/**
 * Pointer capture, which must never take the gesture down with it.
 *
 * `setPointerCapture` throws when the id belongs to no active pointer — a
 * synthetic event, or a pointer the UA has already released after a cancel.
 * Capture is an improvement to the drag (it keeps events coming when the finger
 * leaves the element), not a precondition for it, so a failure here is
 * swallowed rather than allowed to abort a handler that has already committed
 * to dragging.
 */
function capturePointer(target: EventTarget | null, pointerId: number, capture: boolean): void {
  if (!(target instanceof Element)) {
    return;
  }
  try {
    if (capture) {
      target.setPointerCapture(pointerId);
    } else {
      target.releasePointerCapture(pointerId);
    }
  } catch {
    // No active pointer with that id; the drag continues without capture.
  }
}

/** Screen up is the device's front (180), so screen degrees lag device by 270. */
function polar(radius: number, device: number): readonly [number, number] {
  const radians = ((device - 270) * Math.PI) / 180;
  return [CX + radius * Math.cos(radians), CY + radius * Math.sin(radians)];
}

function arcPath(radius: number, angle: OscillationAngle, close: boolean): string {
  const [x0, y0] = polar(radius, angle.low);
  const [x1, y1] = polar(radius, angle.high);
  const largeArc = angle.high - angle.low > 180 ? 1 : 0;
  const arc = `M ${String(x0)} ${String(y0)} A ${String(radius)} ${String(radius)} 0 ${String(largeArc)} 1 ${String(x1)} ${String(y1)}`;
  return close ? `M ${String(CX)} ${String(CY)} L ${String(x0)} ${String(y0)} A ${String(radius)} ${String(radius)} 0 ${String(largeArc)} 1 ${String(x1)} ${String(y1)} Z` : arc;
}

/**
 * Oscillation sweep picker (Figma `modal/oscillation-v2`, 113:11176).
 *
 * A top-down fan inside a 120px-radius track. Two things can be grabbed, and
 * they mean different things:
 *
 * - the two **edge handles** resize the sweep, as they always have;
 * - the **wedge body** — and the slide grip on its bisector — re-aims the sweep
 *   without changing its width. "Point it at the sofa" and "make it wider" are
 *   separate intentions, and before this the only way to express the first was
 *   to move both edges and hope the span survived.
 *
 * The span is floored at `MIN_SWEEP`. Below that the handles pin rather than
 * cross, and the element reflects `min-locked` so the sheet can say so.
 *
 * The wedge is a neutral `ink/muted` wash, not champagne: it is the area the
 * fan covers, a reading rather than a control, and the champagne is spent on
 * the band and the handles that actually take a gesture.
 *
 * Emits `ql-input` {angle, drag} continuously during a drag and `ql-change`
 * on release or on a key; never calls hass.
 */
export class QlSweepDial extends LitElement {
  static override properties = {
    angle: { attribute: false },
    startLabel: { attribute: 'start-label', type: String },
    endLabel: { attribute: 'end-label', type: String },
    aimLabel: { attribute: 'aim-label', type: String },
    frontLabel: { attribute: 'front-label', type: String },
    dragging: { type: String, reflect: true },
    minLocked: { attribute: 'min-locked', type: Boolean, reflect: true },
  };

  declare angle: OscillationAngle;
  declare startLabel: string;
  declare endLabel: string;
  declare aimLabel: string;
  declare frontLabel: string;
  /** Reflected so the sheet and the styles can both see the live gesture. */
  declare dragging?: SweepDrag;
  declare minLocked: boolean;

  /**
   * The bisector the last pointer sample resolved to, unwrapped. Held across
   * samples so a drag through the bottom seam runs past 360 instead of flipping
   * the fan to the other side of the room.
   */
  private aimBearing = 0;

  constructor() {
    super();
    this.angle = { low: 135, high: 225, span: 90 };
    this.startLabel = 'Sweep start';
    this.endLabel = 'Sweep end';
    this.aimLabel = 'Sweep direction';
    this.frontLabel = 'Front';
    this.minLocked = false;
  }

  static override styles: CSSResult = css`
    :host {
      display: block;
      min-width: 0;
    }
    .stage {
      position: relative;
      width: 100%;
      /* Locked to the Figma stage so the overlaid handles stay on the track at
         every width. */
      aspect-ratio: ${STAGE_W} / ${STAGE_H};
      touch-action: none;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .front {
      fill: var(--ql-ink-muted, #8c8578);
      font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .track {
      fill: none;
      stroke: var(--ql-accent-champagne, #b08d57);
      stroke-opacity: 0.28;
      stroke-width: 1.5;
    }
    /* The wash the design intends: the area the fan covers, stated quietly.
       The shipped v1 bound this to accent/champagne and rendered grey from a
       stale literal — the grey was right and the binding was not. */
    .wedge {
      fill: var(--ql-ink-muted, #8c8578);
    }
    /* The whole wedge is the aim target. It is the only large thing on the
       stage, so grabbing "the pie" needs no instruction. */
    .wedge-hit {
      fill: transparent;
      cursor: grab;
      touch-action: none;
    }
    :host([dragging='aim']) .wedge-hit {
      cursor: grabbing;
    }
    .band {
      fill: none;
      stroke: var(--ql-accent-champagne, #b08d57);
      stroke-width: ${BAND_WIDTH};
      stroke-linecap: round;
    }
    .aim-line {
      stroke: var(--ql-ink-muted, #8c8578);
      stroke-width: 1;
      pointer-events: none;
    }
    .fan-body {
      fill: none;
      stroke: var(--ql-ink-primary, #2b2620);
      stroke-width: 1.5;
      pointer-events: none;
    }
    .fan-hub {
      fill: var(--ql-accent-champagne, #b08d57);
      pointer-events: none;
    }
    /* A 56px target centred on a 16px dot: the hit area is transparent and
       overlaps its neighbour only when the sweep is on its 30deg floor. */
    .handle,
    .aim {
      position: absolute;
      width: var(--ql-touch-min, 56px);
      height: var(--ql-touch-min, 56px);
      margin: calc(-0.5 * var(--ql-touch-min, 56px)) 0 0 calc(-0.5 * var(--ql-touch-min, 56px));
      padding: 0;
      border: 0;
      background: transparent;
      border-radius: var(--ql-radius-chip, 999px);
      cursor: grab;
      touch-action: none;
    }
    .handle::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 16px;
      height: 16px;
      margin: -8px 0 0 -8px;
      box-sizing: border-box;
      border-radius: var(--ql-radius-chip, 999px);
      border: 1.5px solid var(--ql-accent-champagne, #b08d57);
      background: var(--ql-surface-card, #fdfbf6);
      box-shadow: 0 0 18px rgba(224, 178, 99, 0.45);
    }
    /* On the floor the handles cannot narrow the sweep any further, so they
       thicken: the control is still live, it has simply run out of room. */
    :host([min-locked]) .handle::after {
      border-width: 3px;
      background: var(--ql-accent-champagne, #b08d57);
    }
    .handle:active,
    .aim:active {
      cursor: grabbing;
    }
    .handle:focus-visible,
    .aim:focus-visible {
      outline: none;
    }
    .handle:focus-visible::after,
    .aim:focus-visible .grip {
      outline: 2px solid var(--ql-accent-champagne, #b08d57);
      outline-offset: 3px;
    }
    /* The slide grip: 32px disc, three bars, riding the bisector at r=62. */
    .grip {
      position: absolute;
      top: 50%;
      left: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      width: 32px;
      height: 32px;
      margin: -16px 0 0 -16px;
      box-sizing: border-box;
      border: 1px solid var(--ql-surface-border, #e4dccb);
      border-radius: 16px;
      background:
        linear-gradient(var(--ql-surface-card, #fdfbf6), var(--ql-surface-card, #fdfbf6)),
        var(--ql-bg-base, #f4f0e8);
    }
    .grip-bar {
      width: 1.5px;
      height: 11px;
      border-radius: 0.75px;
      background: var(--ql-ink-muted, #8c8578);
    }
    :host([dragging='aim']) .grip {
      border-color: transparent;
      background: var(--ql-accent-champagne, #b08d57);
    }
    :host([dragging='aim']) .grip-bar {
      background: var(--ql-bg-base, #f4f0e8);
    }
  `;

  private emit(type: 'ql-input' | 'ql-change'): void {
    this.dispatchEvent(
      new CustomEvent(type, {
        detail: { angle: this.angle, drag: this.dragging, minLocked: this.minLocked },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Writes a new sweep and tells the owner about it.
   *
   * A move that changes nothing still reports while a drag is live. The case
   * that matters is a handle already pinned on the floor: the finger is moving,
   * the sweep is not, and staying silent is what makes a pinned handle read as
   * a broken one. The sheet needs the event to say why it has stopped. A
   * keypress that changes nothing stays silent, because there is no gesture in
   * progress to explain.
   */
  private apply(next: OscillationAngle, type: 'ql-input' | 'ql-change'): void {
    this.minLocked = isMinSweep(next);
    const moved = next.low !== this.angle.low || next.high !== this.angle.high;
    if (moved) {
      this.angle = next;
    }
    if (moved || (type === 'ql-input' && this.dragging !== undefined)) {
      this.emit(type);
    }
  }

  private centre(): { readonly x: number; readonly y: number } | undefined {
    const stage = this.shadowRoot?.querySelector('.stage');
    if (stage === null || stage === undefined) {
      return undefined;
    }
    const box = stage.getBoundingClientRect();
    return { x: box.left + (box.width * CX) / STAGE_W, y: box.top + (box.height * CY) / STAGE_H };
  }

  /** The sweep the control operates on, never narrower than the floor. */
  private sweep(): OscillationAngle {
    return normaliseSweep(this.angle);
  }

  private static dragOf(event: Event): SweepDrag | undefined {
    const raw = (event.currentTarget as HTMLElement | null)?.dataset.handle;
    return raw === 'low' || raw === 'high' || raw === 'aim' ? raw : undefined;
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    const drag = QlSweepDial.dragOf(event);
    if (drag === undefined) {
      return;
    }
    event.preventDefault();
    this.dragging = drag;
    this.aimBearing = sweepBearing(this.sweep());
    capturePointer(event.currentTarget, event.pointerId, true);
    // Announced on grab, not on first movement, so the sheet can say what this
    // gesture does before the user has found out by trying it.
    this.emit('ql-input');
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const drag = this.dragging;
    if (drag === undefined) {
      return;
    }
    const centre = this.centre();
    if (centre === undefined) {
      return;
    }
    const dx = event.clientX - centre.x;
    const dy = event.clientY - centre.y;
    if (drag === 'aim') {
      const aimed = sweepAimDrag(this.sweep(), this.aimBearing, dx, dy);
      this.aimBearing = aimed.bearing;
      this.apply(aimed.angle, 'ql-input');
      return;
    }
    this.apply(sweepHandleDrag(this.sweep(), drag, dx, dy), 'ql-input');
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.dragging === undefined) {
      return;
    }
    this.dragging = undefined;
    capturePointer(event.currentTarget, event.pointerId, false);
    this.emit('ql-change');
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const drag = QlSweepDial.dragOf(event);
    if (drag === undefined) {
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
    const step = (event.shiftKey ? SWEEP_FINE_STEP : SWEEP_COARSE_STEP) * direction;
    const sweep = this.sweep();
    this.apply(drag === 'aim' ? sweepRotate(sweep, step) : sweepNudge(sweep, drag, step), 'ql-change');
  };

  private renderHandle(handle: SweepHandle): TemplateResult {
    const angle = this.sweep();
    const device = handle === 'low' ? angle.low : angle.high;
    const [x, y] = polar(R_TRACK, device);
    return html`
      <button
        class="handle"
        type="button"
        role="slider"
        data-handle=${handle}
        aria-label=${handle === 'low' ? this.startLabel : this.endLabel}
        aria-valuemin=${ANGLE_MIN}
        aria-valuemax=${ANGLE_MAX}
        aria-valuenow=${device}
        aria-valuetext=${`${device > 180 ? '+' : ''}${String(device - 180)}°`}
        style=${`left:${String((x / STAGE_W) * 100)}%;top:${String((y / STAGE_H) * 100)}%`}
        @pointerdown=${this.onPointerDown}
        @pointermove=${this.onPointerMove}
        @pointerup=${this.onPointerUp}
        @pointercancel=${this.onPointerUp}
        @keydown=${this.onKeyDown}
      ></button>
    `;
  }

  /** The slide grip on the bisector: the wedge's aim, made grabbable. */
  private renderAim(): TemplateResult {
    const angle = this.sweep();
    const bearing = sweepBearing(angle);
    const [x, y] = polar(R_AIM_GRIP, bearing);
    return html`
      <button
        class="aim"
        type="button"
        role="slider"
        data-handle="aim"
        aria-label=${this.aimLabel}
        aria-valuemin=${ANGLE_MIN}
        aria-valuemax=${ANGLE_MAX}
        aria-valuenow=${Math.round(bearing)}
        aria-valuetext=${`${bearing > 180 ? '+' : ''}${String(Math.round(bearing) - 180)}°`}
        style=${`left:${String((x / STAGE_W) * 100)}%;top:${String((y / STAGE_H) * 100)}%`}
        @pointerdown=${this.onPointerDown}
        @pointermove=${this.onPointerMove}
        @pointerup=${this.onPointerUp}
        @pointercancel=${this.onPointerUp}
        @keydown=${this.onKeyDown}
      >
        <span class="grip">
          <span class="grip-bar"></span><span class="grip-bar"></span><span class="grip-bar"></span>
        </span>
      </button>
    `;
  }

  private renderWedges(angle: OscillationAngle): SVGTemplateResult {
    return svg`${WEDGE_STEPS.map(
      ([radius, opacity]) =>
        svg`<path class="wedge" opacity=${opacity} d=${arcPath(radius, angle, true)} />`,
    )}`;
  }

  protected override render(): TemplateResult {
    const angle = this.sweep();
    const bearing = sweepBearing(angle);
    const [aimX0, aimY0] = polar(R_AIM_LINE_INNER, bearing);
    const [aimX1, aimY1] = polar(R_AIM_LINE_OUTER, bearing);
    return html`
      <div class="stage">
        <svg viewBox=${`0 0 ${String(STAGE_W)} ${String(STAGE_H)}`}>
          <text class="front" x=${CX} y="17" text-anchor="middle" aria-hidden="true">
            ${this.frontLabel}
          </text>
          <circle class="track" cx=${CX} cy=${CY} r=${R_TRACK} />
          ${this.renderWedges(angle)}
          <path
            class="wedge-hit"
            data-handle="aim"
            d=${arcPath(R_TRACK, angle, true)}
            @pointerdown=${this.onPointerDown}
            @pointermove=${this.onPointerMove}
            @pointerup=${this.onPointerUp}
            @pointercancel=${this.onPointerUp}
          />
          <path class="band" d=${arcPath(R_BAND, angle, false)} />
          <line class="aim-line" x1=${aimX0} y1=${aimY0} x2=${aimX1} y2=${aimY1} />
          <ellipse class="fan-body" cx=${CX} cy=${CY} rx="28" ry="16" />
          <circle class="fan-hub" cx=${CX} cy=${CY} r="4" />
        </svg>
        ${this.renderAim()}${this.renderHandle('low')}${this.renderHandle('high')}
      </div>
    `;
  }
}

customElements.define('ql-sweep-dial', QlSweepDial);
