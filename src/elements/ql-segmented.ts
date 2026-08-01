import { css, html, LitElement, type CSSResult, type TemplateResult } from 'lit';

export interface QlSegmentOption {
  readonly value: string;
  readonly label: string;
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
  `;

  private select(value: string): void {
    if (value === this.value) {
      return;
    }
    this.value = value;
    this.dispatchEvent(
      new CustomEvent('ql-change', { detail: { value }, bubbles: true, composed: true }),
    );
    void this.updateComplete.then(() => {
      const selected = this.shadowRoot?.querySelector<HTMLButtonElement>(
        "button[aria-checked='true']",
      );
      selected?.focus();
    });
  }

  private onKeydown(event: KeyboardEvent): void {
    if (this.options.length === 0) {
      return;
    }
    const index = this.options.findIndex((option) => option.value === this.value);
    let next: number;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = (index + 1) % this.options.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = (index - 1 + this.options.length) % this.options.length;
    } else {
      return;
    }
    event.preventDefault();
    const option = this.options[next];
    if (option !== undefined) {
      this.select(option.value);
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
              @click=${(): void => this.select(option.value)}
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
