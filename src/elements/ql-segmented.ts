import { css, html, LitElement, nothing, type CSSResult, type TemplateResult } from 'lit';

export interface QlSegmentOption {
  readonly value: string;
  readonly label: string;
  /** Disabled segments render inert with a hint tooltip (native title). */
  readonly disabled?: boolean;
  readonly hint?: string;
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
  };

  declare options: ReadonlyArray<QlSegmentOption>;
  declare value: string;
  declare label: string;

  constructor() {
    super();
    this.options = [];
    this.value = '';
    this.label = '';
  }

  static override styles: CSSResult = css`
    .group {
      display: inline-flex;
      gap: 2px;
      padding: 2px;
      border-radius: var(--ql-radius-chip, 999px);
      border: 1px solid var(--ql-surface-border, #e4dccb);
      background: var(--ql-surface-card, #fdfbf6);
    }
    button {
      border: 0;
      background: transparent;
      color: var(--ql-ink-muted, #8c8578);
      padding: 4px var(--ql-space-m, 12px);
      border-radius: var(--ql-radius-chip, 999px);
      font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      cursor: pointer;
      transition:
        background 200ms ease,
        color 200ms ease;
    }
    button[aria-checked='true'] {
      background: var(--ql-ink-primary, #2b2620);
      color: var(--ql-bg-base, #f4f0e8);
      font-weight: 500;
    }
    button:disabled {
      opacity: 0.45;
      cursor: default;
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
    return html`
      <div class="group" role="radiogroup" aria-label=${this.label} @keydown=${this.onKeydown}>
        ${this.options.map(
          (option) => html`
            <button
              role="radio"
              aria-checked=${String(option.value === this.value)}
              tabindex=${option.value === this.value ? 0 : -1}
              ?disabled=${option.disabled === true}
              title=${option.hint ?? nothing}
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
