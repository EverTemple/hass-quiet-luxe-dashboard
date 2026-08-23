import { css, html, LitElement, type CSSResult, type TemplateResult } from 'lit';
import { TYPE } from '../tokens/type';

/** Figma `modal/timer` dial stage: 372x240, centre (186,118), ring r=100. */
const STAGE_W = 372;
const STAGE_H = 240;
const CX = 186;
const CY = 118;
const R_RING = 100;
const RING_WIDTH = 4;
/**
 * Page Up/Down move five times the base step — the same multiplier the
 * climate ring dial uses for its own coarse jump (`DIAL_COARSE_MULTIPLIER`)
 * — so an 8-hour timer at 15-minute steps takes about seven presses to cross
 * instead of thirty-two.
 */
const TIMER_PAGE_MULTIPLIER = 5;

/** Progress runs clockwise from 12 o'clock; a full ring is `max` minutes. */
function polar(radius: number, fraction: number): readonly [number, number] {
  const radians = (fraction * 360 - 90) * (Math.PI / 180);
  return [CX + radius * Math.cos(radians), CY + radius * Math.sin(radians)];
}

function progressPath(fraction: number): string {
  const [x0, y0] = polar(R_RING, 0);
  const [x1, y1] = polar(R_RING, Math.min(fraction, 0.9999));
  const largeArc = fraction > 0.5 ? 1 : 0;
  return `M ${String(x0)} ${String(y0)} A ${String(R_RING)} ${String(R_RING)} 0 ${String(largeArc)} 1 ${String(x1)} ${String(y1)}`;
}

/**
 * Sleep-timer picker (Figma `modal/timer`): a ring whose sweep maps the chosen
 * duration against `max`, with one draggable grip and the reading in the middle.
 * The grip is a real button so it focuses and takes arrow keys, and it carries a
 * 56px hit area while drawing as a 16px dot. Emits `ql-input` during a drag and
 * `ql-change` on release; never calls hass.
 */
export class QlTimerDial extends LitElement {
  static override properties = {
    minutes: { type: Number },
    max: { type: Number },
    step: { type: Number },
    label: { type: String },
    valueText: { attribute: 'value-text', type: String },
    reading: { type: String },
    caption: { type: String },
  };

  declare minutes: number;
  declare max: number;
  declare step: number;
  declare label: string;
  declare valueText: string;
  /** Large numeral in the middle of the ring. */
  declare reading: string;
  declare caption: string;

  private dragging = false;

  constructor() {
    super();
    this.minutes = 0;
    this.max = 480;
    this.step = 15;
    this.label = 'Timer';
    this.valueText = '';
    this.reading = '0';
    this.caption = '';
  }

  static override styles: CSSResult = css`
    :host {
      display: block;
      min-width: 0;
    }
    .stage {
      position: relative;
      width: 100%;
      aspect-ratio: ${STAGE_W} / ${STAGE_H};
      touch-action: none;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .track {
      fill: none;
      stroke: var(--ql-accent-champagne, #b08d57);
      stroke-opacity: 0.28;
      stroke-width: ${RING_WIDTH};
    }
    .progress {
      fill: none;
      stroke: var(--ql-accent-champagne, #b08d57);
      stroke-width: ${RING_WIDTH};
      stroke-linecap: round;
    }
    .readout {
      position: absolute;
      top: 50%;
      left: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      transform: translate(-50%, -50%);
      pointer-events: none;
      text-align: center;
    }
    .reading {
      color: var(--ql-ink-primary, #2b2620);
      /* A numeral, so the body face — the third site of the wrong-token bug
         the fan card's two numerals carried. It read --ql-font-display with an
         Outfit fallback, which resolves to Marcellus in production and put the
         timer's digits in a serif while every other numeral in the library is
         Outfit. */
      ${TYPE.numeralXl}
      letter-spacing: 0.01em;
      font-variant-numeric: tabular-nums;
    }
    .caption {
      color: var(--ql-ink-muted, #736d63);
      ${TYPE.caption}
      letter-spacing: 0.02em;
    }
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
      width: 16px;
      height: 16px;
      margin: -8px 0 0 -8px;
      border-radius: var(--ql-radius-chip, 999px);
      border: 1.5px solid var(--ql-accent-champagne, #b08d57);
      background: var(--ql-surface-card, #fdfbf6);
      box-shadow: 0 0 18px rgba(224, 178, 99, 0.45);
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
  `;

  private fraction(): number {
    return this.max <= 0 ? 0 : Math.min(1, Math.max(0, this.minutes / this.max));
  }

  private emit(type: 'ql-input' | 'ql-change'): void {
    this.dispatchEvent(
      new CustomEvent(type, {
        detail: { minutes: this.minutes },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private apply(minutes: number, type: 'ql-input' | 'ql-change'): void {
    const snapped = Math.min(
      this.max,
      Math.max(0, Math.round(minutes / this.step) * this.step),
    );
    if (snapped === this.minutes) {
      return;
    }
    this.minutes = snapped;
    this.emit(type);
  }

  private stageCentre(): { readonly x: number; readonly y: number } | undefined {
    const stage = this.shadowRoot?.querySelector('.stage');
    if (stage === null || stage === undefined) {
      return undefined;
    }
    const box = stage.getBoundingClientRect();
    return { x: box.left + (box.width * CX) / STAGE_W, y: box.top + (box.height * CY) / STAGE_H };
  }

  /** Set while `centreCache` is good for the current animation frame. */
  private centreFresh = false;
  private centreCache?: { readonly x: number; readonly y: number };

  /**
   * `getBoundingClientRect` is a synchronous layout read; `pointermove` can
   * fire well above the paint rate, so the read is throttled to once per
   * animation frame instead of once per event. It is not cached for the
   * whole gesture: this dial can sit on a live dashboard where an unrelated
   * card's own update reflows the page mid-drag, and freezing the stage's
   * position for the whole gesture would let the drag silently drift off the
   * ring's actual box. Refreshing every frame keeps that drift to at most
   * one frame.
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

  private readonly onPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    this.dragging = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    // Force a fresh read at the start of the gesture rather than trusting
    // whatever frame the cache last settled on.
    this.centreFresh = false;
    this.currentCentre();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging) {
      return;
    }
    const centre = this.currentCentre();
    if (centre === undefined) {
      return;
    }
    const dx = event.clientX - centre.x;
    const dy = event.clientY - centre.y;
    const degrees = (((Math.atan2(dy, dx) * 180) / Math.PI + 90) % 360 + 360) % 360;
    this.apply((degrees / 360) * this.max, 'ql-input');
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!this.dragging) {
      return;
    }
    this.dragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    this.centreFresh = false;
    this.centreCache = undefined;
    this.emit('ql-change');
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = this.minutes + this.step;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = this.minutes - this.step;
        break;
      case 'PageUp':
        next = this.minutes + this.step * TIMER_PAGE_MULTIPLIER;
        break;
      case 'PageDown':
        next = this.minutes - this.step * TIMER_PAGE_MULTIPLIER;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = this.max;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.apply(next, 'ql-change');
  };

  protected override render(): TemplateResult {
    const fraction = this.fraction();
    const [gx, gy] = polar(R_RING, fraction);
    return html`
      <div class="stage">
        <svg
          viewBox=${`0 0 ${String(STAGE_W)} ${String(STAGE_H)}`}
          aria-hidden="true"
          focusable="false"
        >
          <circle class="track" cx=${CX} cy=${CY} r=${R_RING} />
          ${fraction > 0 ? html`<path class="progress" d=${progressPath(fraction)} />` : ''}
        </svg>
        <div class="readout">
          <!-- The reading, and only the reading, is the live region: a drag
               reports continuously and a keypress can repeat, so the caption
               stays a sibling outside it rather than being re-announced on
               every tick. output carries an implicit status role already;
               role=status is kept explicit, matching ql-stepper's readout. -->
          <output class="reading" role="status">${this.reading}</output>
          <span class="caption">${this.caption}</span>
        </div>
        <button
          class="grip"
          type="button"
          role="slider"
          aria-label=${this.label}
          aria-valuemin="0"
          aria-valuemax=${this.max}
          aria-valuenow=${this.minutes}
          aria-valuetext=${this.valueText}
          style=${`left:${String((gx / STAGE_W) * 100)}%;top:${String((gy / STAGE_H) * 100)}%`}
          @pointerdown=${this.onPointerDown}
          @pointermove=${this.onPointerMove}
          @pointerup=${this.onPointerUp}
          @pointercancel=${this.onPointerUp}
          @keydown=${this.onKeyDown}
        ></button>
      </div>
    `;
  }
}

customElements.define('ql-timer-dial', QlTimerDial);
