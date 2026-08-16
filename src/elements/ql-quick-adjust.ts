import { css, html, LitElement, nothing, type CSSResult, type TemplateResult } from 'lit';
import {
  QUICK_ADJUST_REPEAT_DELAY_MS,
  QUICK_ADJUST_REPEAT_INTERVAL_MS,
  type AdjustDirection,
} from '../cards/quick-adjust';

export type QlQuickAdjustDirection = 'minus' | 'plus';

/**
 * The minimal quick-adjust glyph that flanks a climate dial
 * (Figma `control/quick-adjust`, 99:7312).
 *
 * A 56×56 hit frame carrying nothing but an 18×2 bar at rest — no ring, no
 * fill, no chrome. It is the dial's primary action, not a shortcut beside it,
 * so the bar carries full `ink/primary` weight rather than `ink/muted`:
 * heavier than every other mark on the card, without gaining a background,
 * border or container of its own — the de-chroming elsewhere stays.
 *
 * Pressing reveals a 44px halo and turns the glyph champagne; holding repeats.
 * At the setpoint's own limit the glyph drops to `surface/border` and the
 * button disables, because a control that cannot move anything should not look
 * like one that can.
 *
 * Emits `ql-adjust` {direction}; never calls hass.
 */
export class QlQuickAdjust extends LitElement {
  static override properties = {
    dir: { type: String, reflect: true },
    label: { type: String },
    disabled: { type: Boolean, reflect: true },
    pressed: { type: Boolean, reflect: true, state: true },
  };

  declare dir: QlQuickAdjustDirection;
  declare label: string;
  declare disabled: boolean;
  declare pressed: boolean;

  private repeatTimer?: number;

  constructor() {
    super();
    this.dir = 'minus';
    this.label = '';
    this.disabled = false;
    this.pressed = false;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopRepeat();
  }

  static override styles: CSSResult = css`
    :host {
      display: inline-block;
      flex: 0 0 auto;
    }
    button {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      width: var(--ql-touch-min, 56px);
      height: var(--ql-touch-min, 56px);
      padding: 0;
      border: 0;
      border-radius: var(--ql-radius-chip, 999px);
      background: transparent;
      color: inherit;
      cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    button:disabled {
      cursor: default;
    }
    /* The halo only exists while the press does: it is the whole of the
       pressed state, so it is painted rather than merely tinted. */
    .halo {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 44px;
      height: 44px;
      margin: -22px 0 0 -22px;
      box-sizing: border-box;
      border: 1px solid var(--ql-surface-border, #e4dccb);
      border-radius: var(--ql-radius-chip, 999px);
      /* --ql-surface-card is a translucent tint in dark mode; painted over
         --ql-bg-base it gives the card's exact colour as an opaque fill so the
         halo reads as a lifted disc rather than a hole. */
      background:
        linear-gradient(var(--ql-surface-card, #fdfbf6), var(--ql-surface-card, #fdfbf6)),
        var(--ql-bg-base, #f4f0e8);
      pointer-events: none;
    }
    .glyph {
      position: relative;
      width: 18px;
      height: 18px;
    }
    .bar {
      position: absolute;
      border-radius: 1px;
      background: var(--ql-ink-primary, #2b2620);
      transition: background 160ms ease;
    }
    .bar.h {
      top: 8px;
      left: 0;
      width: 18px;
      height: 2px;
    }
    .bar.v {
      top: 0;
      left: 8px;
      width: 2px;
      height: 18px;
    }
    :host([pressed]) .bar {
      background: var(--ql-accent-champagne, #b08d57);
    }
    :host([disabled]) .bar {
      background: var(--ql-surface-border, #e4dccb);
    }
    button:focus-visible {
      outline: 2px solid var(--ql-accent-champagne, #b08d57);
      outline-offset: -4px;
    }
    @media (prefers-reduced-motion: reduce) {
      .bar {
        transition: none;
      }
    }
  `;

  private direction(): AdjustDirection {
    return this.dir === 'plus' ? 1 : -1;
  }

  private emit(): void {
    this.dispatchEvent(
      new CustomEvent('ql-adjust', {
        detail: { direction: this.direction() },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private stopRepeat(): void {
    window.clearTimeout(this.repeatTimer);
    this.repeatTimer = undefined;
  }

  /**
   * A held press repeats after a deliberate pause, then on a steady interval.
   * Chained timeouts rather than an interval so a press released mid-tick
   * cannot leave one more step queued behind it.
   */
  private scheduleRepeat(delay: number): void {
    this.repeatTimer = window.setTimeout(() => {
      if (this.disabled) {
        this.release();
        return;
      }
      this.emit();
      this.scheduleRepeat(QUICK_ADJUST_REPEAT_INTERVAL_MS);
    }, delay);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.disabled) {
      return;
    }
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.pressed = true;
    this.emit();
    this.scheduleRepeat(QUICK_ADJUST_REPEAT_DELAY_MS);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    this.release();
  };

  private release(): void {
    this.stopRepeat();
    this.pressed = false;
  }

  /**
   * Keyboard is a discrete press, not a hold: the browser's own key repeat
   * already fires `click` repeatedly, so adding ours would double the rate.
   * A pointer press has already emitted on pointerdown, so the click that
   * follows it is swallowed.
   */
  private readonly onClick = (event: MouseEvent): void => {
    if (this.disabled || event.detail !== 0) {
      return;
    }
    this.emit();
  };

  protected override render(): TemplateResult {
    return html`
      <button
        type="button"
        aria-label=${this.label === '' ? nothing : this.label}
        ?disabled=${this.disabled}
        @pointerdown=${this.onPointerDown}
        @pointerup=${this.onPointerUp}
        @pointercancel=${this.onPointerUp}
        @pointerleave=${this.onPointerUp}
        @click=${this.onClick}
      >
        ${this.pressed ? html`<span class="halo"></span>` : nothing}
        <span class="glyph">
          <span class="bar h"></span>
          ${this.dir === 'plus' ? html`<span class="bar v"></span>` : nothing}
        </span>
      </button>
    `;
  }
}

customElements.define('ql-quick-adjust', QlQuickAdjust);
