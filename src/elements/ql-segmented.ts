import { css, html, LitElement, type CSSResult, type TemplateResult } from 'lit';
import { TYPE } from '../tokens/type';

export interface QlSegmentOption {
  readonly value: string;
  readonly label: string;
  /** Disabled segments render inert. */
  readonly disabled?: boolean;
}

/**
 * Segmented control (Figma `control/segmented`): 2–4 segments, selected =
 * ink pill with bg/base text. Radiogroup semantics with roving tabindex and
 * arrow-key wrap. Emits `ql-change` {value}; never calls hass.
 */
export class QlSegmented extends LitElement {
  static override properties = {
    options: { attribute: false },
    value: { type: String },
    label: { type: String },
    size: { type: String, reflect: true },
  };

  declare options: ReadonlyArray<QlSegmentOption>;
  declare value: string;
  declare label: string;
  /** `touch` meets the 56px target every on-card device control needs. */
  declare size: 'compact' | 'touch';

  constructor() {
    super();
    this.options = [];
    this.value = '';
    this.label = '';
    this.size = 'compact';
  }

  static override styles: CSSResult = css`
    .group {
      display: inline-flex;
      /* The border and inner padding must come out of the declared width, or
         a full-width group sits 6px wider than the card that holds it. */
      box-sizing: border-box;
      gap: 2px;
      padding: 2px;
      border-radius: var(--ql-radius-chip, 999px);
      border: 1px solid var(--ql-surface-border, #e4dccb);
      background: var(--ql-surface-inset, #fdfbf6);
    }
    button {
      position: relative;
      border: 0;
      background: transparent;
      color: var(--ql-ink-muted, #736d63);
      padding: 4px var(--ql-space-m, 12px);
      border-radius: var(--ql-radius-chip, 999px);
      ${TYPE.caption}
      cursor: pointer;
      transition:
        background 200ms ease,
        color 200ms ease;
    }
    /* At compact size the pill paints at 24px — well under the touch
       minimum, and the most-tapped choice on cards like the Home view's
       Tasks/Agenda switch. An invisible ::before extends the hit area to
       --ql-touch-min without growing the painted segment. Width stays at
       the button's own 100% (never the group's), so it can never reach past
       a 2px gap into the segment next to it — segments sit directly
       adjacent, and a wider overlay would fire the wrong option. Harmless,
       same-size no-op at the touch size, which already clears the floor via
       min-height below. */
    button::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 0;
      width: 100%;
      height: var(--ql-touch-min, 56px);
      transform: translateY(-50%);
    }
    button[aria-checked='true'] {
      background: var(--ql-ink-primary, #2b2620);
      color: var(--ql-bg-base, #f4f0e8);
      font-weight: 500;
    }
    button:focus-visible {
      outline: 2px solid var(--ql-accent-champagne, #b08d57);
      outline-offset: 2px;
    }
    button:disabled {
      opacity: 0.45;
      cursor: default;
    }
    /* On-card device controls are thumb targets, not chips. A device with
       more modes than fit one line wraps onto the next: an AC with six hvac
       modes shows all six. Nothing scrolls, so no option can hide off-edge —
       the group softens to a rounded rect once it is more than one row tall. */
    :host([size='touch']) .group {
      display: flex;
      flex-wrap: wrap;
      width: 100%;
      border-radius: var(--ql-radius-thumb, 12px);
      gap: 4px;
    }
    :host([size='touch']) button {
      flex: 1 1 auto;
      min-height: var(--ql-touch-min, 56px);
      min-width: 0;
      padding: 0 var(--ql-space-m, 12px);
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    @media (prefers-reduced-motion: reduce) {
      button {
        transition: none;
      }
    }
  `;

  private select(option: QlSegmentOption): void {
    if (option.disabled === true || option.value === this.value) {
      return;
    }
    this.value = option.value;
    this.dispatchEvent(
      new CustomEvent('ql-change', {
        detail: { value: option.value },
        bubbles: true,
        composed: true,
      }),
    );
    void this.updateComplete.then(() => {
      const selected = this.shadowRoot?.querySelector<HTMLButtonElement>(
        "button[aria-checked='true']",
      );
      selected?.focus();
    });
  }

  private onKeydown(event: KeyboardEvent): void {
    const count = this.options.length;
    if (count === 0) {
      return;
    }
    let direction: 1 | -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      direction = 1;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      direction = -1;
    } else {
      return;
    }
    event.preventDefault();
    const start = this.options.findIndex((option) => option.value === this.value);
    for (let offset = 1; offset <= count; offset += 1) {
      const index = (((start + direction * offset) % count) + count) % count;
      const option = this.options[index];
      if (option !== undefined && option.disabled !== true) {
        this.select(option);
        return;
      }
    }
  }

  protected override render(): TemplateResult {
    // Exactly one button must always be tabbable, or the group falls out of
    // the tab order the moment the bound value matches none of the options.
    // The fallback skips disabled options — landing tab focus on an inert
    // segment would be its own dead end.
    const selectedIndex = this.options.findIndex((option) => option.value === this.value);
    const fallbackIndex = this.options.findIndex((option) => option.disabled !== true);
    const tabbableIndex = selectedIndex !== -1 ? selectedIndex : Math.max(fallbackIndex, 0);
    return html`
      <div class="group" role="radiogroup" aria-label=${this.label} @keydown=${this.onKeydown}>
        ${this.options.map(
          (option, index) => html`
            <button
              type="button"
              role="radio"
              aria-checked=${String(option.value === this.value)}
              tabindex=${index === tabbableIndex ? 0 : -1}
              ?disabled=${option.disabled === true}
              @click=${(): void => this.select(option)}
            >
              ${option.label}
            </button>
          `,
        )}
      </div>
    `;
  }
}

customElements.define('ql-segmented', QlSegmented);
