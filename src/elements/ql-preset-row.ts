import { css, html, LitElement, type CSSResult, type TemplateResult } from 'lit';
import { TYPE } from '../tokens/type';

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
    /** Wraps onto a second line instead of truncating — the fan row's need,
     * not the default: a 2–4 segment mode row still fits one line untouched,
     * and a shortened label reads worse than a wrapped row. */
    wrap: { type: Boolean, reflect: true },
  };

  declare options: ReadonlyArray<QlPresetOption>;
  declare value: string;
  declare label: string;
  declare wrap: boolean;

  constructor() {
    super();
    this.options = [];
    this.value = '';
    this.label = '';
    this.wrap = false;
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
      background: var(--ql-surface-inset, #fdfbf6);
    }
    button {
      position: relative;
      flex: 1 1 0;
      min-width: 0;
      padding: 6px var(--ql-space-s, 8px);
      border: 0;
      border-radius: var(--ql-radius-chip, 999px);
      background: transparent;
      color: var(--ql-ink-muted, #736d63);
      ${TYPE.caption}
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
    /* The pill stays a 28px-tall visual chip — matching segmented exactly —
       while an invisible ::before extends the actual hit area to the shared
       touch minimum. It is taken out of flow (position: absolute) so it never
       grows the row's own height, and it is sized to the button's own width
       rather than the row's, so it doesn't reach across into a neighbour. */
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
    /* At wrap, a segment keeps its own content width rather than sharing an
       equal column, so a row that outgrows its line drops the overflow
       segments to a second one instead of squeezing every label to a
       truncated stub. */
    :host([wrap]) .row {
      flex-wrap: wrap;
    }
    :host([wrap]) button {
      flex: 1 1 auto;
      min-width: max-content;
      white-space: normal;
      overflow: visible;
      text-overflow: clip;
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
    // Exactly one button must always be tabbable, or the group falls out of
    // the tab order the moment the bound value matches none of the options
    // (an in-flight preset value, a stale default): the selected index falls
    // back to the first option so the group's own arrow keys stay reachable.
    const selectedIndex = this.options.findIndex((option) => option.value === this.value);
    const tabbableIndex = selectedIndex === -1 ? 0 : selectedIndex;
    return html`
      <div class="row" role="radiogroup" aria-label=${this.label} @keydown=${this.onKeydown}>
        ${this.options.map(
          (option, index) => html`
            <button
              type="button"
              role="radio"
              aria-checked=${String(option.value === this.value)}
              tabindex=${index === tabbableIndex ? 0 : -1}
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
