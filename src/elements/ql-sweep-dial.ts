import { css, html, LitElement, svg, type CSSResult, type SVGTemplateResult, type TemplateResult } from 'lit';
import {
  SWEEP_COARSE_STEP,
  SWEEP_FINE_STEP,
  sweepHandleDrag,
  sweepNudge,
  type SweepHandle,
} from '../cards/fan-capabilities';
import { ANGLE_MAX, ANGLE_MIN, type OscillationAngle } from '../cards/supported-features';

/** Figma `modal/oscillation` dial stage: 372x284, centre (186,162), track r=120. */
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
 * Oscillation sweep picker (Figma `modal/oscillation`): a top-down fan inside a
 * 120px-radius track, with the swept sector drawn as a champagne wedge and two
 * independent handles for the start and end of the sweep.
 *
 * Both handles are real buttons overlaid on the SVG rather than SVG nodes, so
 * they focus, take arrow keys and carry a 56px hit area while drawing as a 16px
 * dot. Emits `ql-input` continuously during a drag and `ql-change` on release;
 * never calls hass.
 */
export class QlSweepDial extends LitElement {
  static override properties = {
    angle: { attribute: false },
    startLabel: { attribute: 'start-label', type: String },
    endLabel: { attribute: 'end-label', type: String },
    frontLabel: { attribute: 'front-label', type: String },
  };

  declare angle: OscillationAngle;
  declare startLabel: string;
  declare endLabel: string;
  declare frontLabel: string;

  private dragging?: SweepHandle;

  constructor() {
    super();
    this.angle = { low: 135, high: 225, span: 90 };
    this.startLabel = 'Sweep start';
    this.endLabel = 'Sweep end';
    this.frontLabel = 'Front';
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
    .wedge {
      fill: var(--ql-accent-champagne, #b08d57);
    }
    .band {
      fill: none;
      stroke: var(--ql-accent-champagne, #b08d57);
      stroke-width: ${BAND_WIDTH};
      stroke-linecap: round;
    }
    .fan-body {
      fill: none;
      stroke: var(--ql-ink-primary, #2b2620);
      stroke-width: 1.5;
    }
    .fan-hub {
      fill: var(--ql-accent-champagne, #b08d57);
    }
    /* A 56px target centred on a 16px dot: the hit area is transparent and
       overlaps its neighbour only when the sweep is near its 5deg minimum. */
    .handle {
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
    .handle::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 16px;
      height: 16px;
      margin: -8px 0 0 -8px;
      border-radius: var(--ql-radius-chip, 999px);
      border: 1.5px solid var(--ql-accent-champagne, #b08d57);
      background: var(--ql-surface-card, #fdfbf6);
      box-shadow: 0 0 18px rgba(224, 178, 99, 0.45);
    }
    .handle:active {
      cursor: grabbing;
    }
    .handle:focus-visible {
      outline: none;
    }
    .handle:focus-visible::after {
      outline: 2px solid var(--ql-accent-champagne, #b08d57);
      outline-offset: 3px;
    }
  `;

  private emit(type: 'ql-input' | 'ql-change'): void {
    this.dispatchEvent(
      new CustomEvent(type, {
        detail: { angle: this.angle },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private apply(next: OscillationAngle, type: 'ql-input' | 'ql-change'): void {
    if (next.low === this.angle.low && next.high === this.angle.high) {
      return;
    }
    this.angle = next;
    this.emit(type);
  }

  private centre(): { readonly x: number; readonly y: number } | undefined {
    const stage = this.shadowRoot?.querySelector('.stage');
    if (stage === null || stage === undefined) {
      return undefined;
    }
    const box = stage.getBoundingClientRect();
    return { x: box.left + (box.width * CX) / STAGE_W, y: box.top + (box.height * CY) / STAGE_H };
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    const handle = (event.currentTarget as HTMLElement | null)?.dataset.handle;
    if (handle !== 'low' && handle !== 'high') {
      return;
    }
    event.preventDefault();
    this.dragging = handle;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.dragging === undefined) {
      return;
    }
    const centre = this.centre();
    if (centre === undefined) {
      return;
    }
    this.apply(
      sweepHandleDrag(this.angle, this.dragging, event.clientX - centre.x, event.clientY - centre.y),
      'ql-input',
    );
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.dragging === undefined) {
      return;
    }
    this.dragging = undefined;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    this.emit('ql-change');
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const handle = (event.currentTarget as HTMLElement | null)?.dataset.handle;
    if (handle !== 'low' && handle !== 'high') {
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
    const step = event.shiftKey ? SWEEP_FINE_STEP : SWEEP_COARSE_STEP;
    this.apply(sweepNudge(this.angle, handle, direction * step), 'ql-change');
  };

  private renderHandle(handle: SweepHandle): TemplateResult {
    const device = handle === 'low' ? this.angle.low : this.angle.high;
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

  private renderWedges(): SVGTemplateResult {
    return svg`${WEDGE_STEPS.map(
      ([radius, opacity]) =>
        svg`<path class="wedge" opacity=${opacity} d=${arcPath(radius, this.angle, true)} />`,
    )}`;
  }

  protected override render(): TemplateResult {
    return html`
      <div class="stage">
        <svg viewBox=${`0 0 ${String(STAGE_W)} ${String(STAGE_H)}`} aria-hidden="true">
          <text class="front" x=${CX} y="17" text-anchor="middle">${this.frontLabel}</text>
          <circle class="track" cx=${CX} cy=${CY} r=${R_TRACK} />
          ${this.renderWedges()}
          <path class="band" d=${arcPath(R_BAND, this.angle, false)} />
          <ellipse class="fan-body" cx=${CX} cy=${CY} rx="28" ry="16" />
          <circle class="fan-hub" cx=${CX} cy=${CY} r="4" />
        </svg>
        ${this.renderHandle('low')}${this.renderHandle('high')}
      </div>
    `;
  }
}

customElements.define('ql-sweep-dial', QlSweepDial);
