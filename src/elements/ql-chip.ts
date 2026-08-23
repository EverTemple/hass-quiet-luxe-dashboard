import { css, html, LitElement, nothing, type CSSResult, type TemplateResult } from 'lit';
import { TYPE } from '../tokens/type';

export type QlChipVariant = 'device' | 'scene';
export type QlChipEmphasis = 'primary' | 'secondary';

/**
 * Pill chip (Figma `chip/device` + `chip/scene`).
 * - variant=device: stateful on/off (aria-pressed), on = champagne fill.
 * - variant=scene: momentary action; emphasis primary (ink fill) or secondary (surface).
 * - touch: 56px min height for iPad targets.
 * Emits only native click (composed); never calls hass — consumers own actions.
 * Content: default slot label, optional slot="icon".
 */
export class QlChip extends LitElement {
  static override properties = {
    variant: { type: String, reflect: true },
    emphasis: { type: String, reflect: true },
    active: { type: Boolean, reflect: true },
    touch: { type: Boolean, reflect: true },
  };

  declare variant: QlChipVariant;
  declare emphasis: QlChipEmphasis;
  declare active: boolean;
  declare touch: boolean;

  constructor() {
    super();
    this.variant = 'device';
    this.emphasis = 'secondary';
    this.active = false;
    this.touch = false;
  }

  static override styles: CSSResult = css`
    :host {
      display: inline-flex;
    }
    button {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: var(--ql-space-xs, 4px);
      min-height: 28px;
      padding: 4px var(--ql-space-m, 12px);
      border-radius: var(--ql-radius-chip, 999px);
      border: 1px solid var(--ql-surface-border, #e4dccb);
      background: var(--ql-surface-inset, #fdfbf6);
      color: var(--ql-ink-primary, #2b2620);
      ${TYPE.caption}
      cursor: pointer;
      transition:
        background 200ms ease,
        color 200ms ease;
    }
    /* The default and scene pills paint at 28px/36px — under the touch
       minimum, and this is what a room card's own chip row taps. An
       invisible ::before extends the hit area to --ql-touch-min without
       growing the painted pill. Width stays at the chip's own 100% (never
       the row's), so it can never reach into the small gap that separates
       wrapped chips from their neighbours. Harmless, same-size no-op on a
       [touch] chip, which already clears the floor via min-height below. */
    button::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 0;
      width: 100%;
      height: var(--ql-touch-min, 56px);
      transform: translateY(-50%);
    }
    /* Label on a filled chip reads against the base, like the primary scene
       chip. --ql-surface-card is a near-transparent white in dark mode, which
       left an active chip's label invisible on the champagne fill. */
    :host([variant='device'][active]) button {
      background: var(--ql-accent-champagne, #b08d57);
      border-color: transparent;
      color: var(--ql-bg-base, #f4f0e8);
    }
    :host([variant='scene']) button {
      min-height: 36px;
      font-weight: 500;
      font-size: 13px;
    }
    :host([variant='scene'][emphasis='primary']) button {
      background: var(--ql-ink-primary, #2b2620);
      border-color: transparent;
      color: var(--ql-bg-base, #f4f0e8);
    }
    :host([touch]) button {
      min-height: var(--ql-touch-min, 56px);
      padding: var(--ql-space-s, 8px) var(--ql-space-l, 16px);
    }
    @media (prefers-reduced-motion: reduce) {
      button {
        transition: none;
      }
    }
  `;

  protected override render(): TemplateResult {
    return html`
      <button type="button" aria-pressed=${this.variant === 'device' ? String(this.active) : nothing}>
        <slot name="icon"></slot><slot></slot>
      </button>
    `;
  }
}

customElements.define('ql-chip', QlChip);
