import { css, html, LitElement, nothing, type CSSResult, type TemplateResult } from 'lit';

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
      display: inline-flex;
      align-items: center;
      gap: var(--ql-space-xs, 4px);
      min-height: 28px;
      padding: 4px var(--ql-space-m, 12px);
      border-radius: var(--ql-radius-chip, 999px);
      border: 1px solid var(--ql-surface-border, #e4dccb);
      background: var(--ql-surface-card, #fdfbf6);
      color: var(--ql-ink-primary, #2b2620);
      font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      cursor: pointer;
      transition:
        background 200ms ease,
        color 200ms ease;
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
  `;

  protected override render(): TemplateResult {
    return html`
      <button aria-pressed=${this.variant === 'device' ? String(this.active) : nothing}>
        <slot name="icon"></slot><slot></slot>
      </button>
    `;
  }
}

customElements.define('ql-chip', QlChip);
