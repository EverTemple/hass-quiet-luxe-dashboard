import { css, html, LitElement, type CSSResult, type TemplateResult } from 'lit';

export interface QlPresetOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Equal-width preset pill row (Figma `control/preset-row`): a local extension of
 * `control/segmented`, which only ships 2–4 segments — oscillation needs 5 and
 * the timer needs 7. Selected matches segmented exactly: ink/primary fill with a
 * bg/base label. Radiogroup semantics with roving tabindex and arrow-key wrap.
 * Emits `ql-change` {value}; never calls hass.
 *
 * Segments are deliberately below the 56px touch minimum: the row is a shortcut
 * that sits beside a full-size dial or drag handle, never the only way to reach
 * a value, and at 7 segments a 56px-tall row would dominate the sheet.
 */
export class QlPresetRow extends LitElement {
  static override properties = {
    options: { attribute: false },
    value: { type: String },
    label: { type: String },
  };

  declare options: ReadonlyArray<QlPresetOption>;
  declare value: string;
  declare label: string;

  constructor() {
    super();
    this.options = [];
    this.value = '';
    this.label = '';
  }

  static override styles: CSSResult = css`
    :host {
      display: block;
      min-width: 0;
    }
    .row {
      display: flex;
      align-items: center;
      box-sizing: border-box;
      width: 100%;
      padding: var(--ql-space-xs, 4px);
      border-radius: var(--ql-radius-chip, 999px);
      border: 1px solid var(--ql-surface-border, #e4dccb);
      background: var(--ql-surface-card, #fdfbf6);
    }
    button {
      flex: 1 1 0;
      min-width: 0;
      padding: 6px var(--ql-space-s, 8px);
      border: 0;
      border-radius: var(--ql-radius-chip, 999px);
      background: transparent;
      color: var(--ql-ink-muted, #8c8578);
      font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      letter-spacing: 0.02em;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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
    button:focus-visible {
      outline: 2px solid var(--ql-accent-champagne, #b08d57);
      outline-offset: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
      button {
        transition: none;
      }
    }
  `;

  private select(option: QlPresetOption): void {
    if (option.value === this.value) {
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
      this.shadowRoot?.querySelector<HTMLButtonElement>("button[aria-checked='true']")?.focus();
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
    const index = (((start + direction) % count) + count) % count;
    const option = this.options[index];
    if (option !== undefined) {
      this.select(option);
    }
  }

  protected override render(): TemplateResult {
    return html`
      <div class="row" role="radiogroup" aria-label=${this.label} @keydown=${this.onKeydown}>
        ${this.options.map(
          (option) => html`
            <button
              type="button"
              role="radio"
              aria-checked=${String(option.value === this.value)}
              tabindex=${option.value === this.value ? 0 : -1}
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

customElements.define('ql-preset-row', QlPresetRow);
