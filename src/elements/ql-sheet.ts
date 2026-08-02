import { css, html, LitElement, type CSSResult, type TemplateResult } from 'lit';
import { dysonIcon } from './dyson-icons';

/**
 * Modal shell for the on-card control sheets (Figma `modal/control-sheet`):
 * a 420-wide sheet over a #080604 60% backdrop, with a title row carrying a
 * 56x56 close target, a content slot, and a footer slot for `ql-sheet-button`s.
 * Emits `ql-sheet-close` {reason}; never calls hass.
 *
 * ## Why a native `<dialog>`
 *
 * A card sheet has to escape its card. HA renders custom cards inside a grid
 * section whose ancestors clip (`.ql-card` is `overflow: hidden`) and establish
 * stacking contexts, so a plain absolutely-positioned overlay is cropped to the
 * card no matter how high its z-index. The three ways out are HA's own
 * `show-dialog` event (couples us to frontend internals that are not a public
 * API), portalling the element to `document.body` (works, but the sheet leaves
 * its shadow root and its styles and lifecycle with it), or the platform's
 * top layer.
 *
 * `dialog.showModal()` promotes the element to the browser's top layer, which
 * sits above the whole document and is unaffected by any ancestor's `overflow`,
 * `transform`, `filter` or `z-index`. The element stays in this shadow root, so
 * its styles stay encapsulated, and the platform supplies the modal contract
 * for free: focus is trapped inside the dialog, everything behind it is inert
 * to pointer and assistive technology, Escape fires `cancel`, and `::backdrop`
 * paints the scrim. Focus restoration is done explicitly below rather than
 * relying on the UA, so the invoking dial is reliably refocused.
 */
export class QlSheet extends LitElement {
  static override properties = {
    open: { type: Boolean, reflect: true },
    heading: { type: String },
    closeLabel: { attribute: 'close-label', type: String },
  };

  declare open: boolean;
  declare heading: string;
  declare closeLabel: string;

  /** The control that opened the sheet, refocused when it closes. */
  private opener?: HTMLElement;

  constructor() {
    super();
    this.open = false;
    this.heading = '';
    this.closeLabel = 'Close';
  }

  static override styles: CSSResult = css`
    :host {
      display: contents;
    }
    dialog {
      /* The dialog is only a positioning surface — the scrim is ::backdrop and
         the visible panel is .sheet, so clicks landing here are backdrop taps. */
      box-sizing: border-box;
      width: 100vw;
      max-width: 100vw;
      height: 100dvh;
      max-height: 100dvh;
      margin: 0;
      padding: var(--ql-space-l, 16px);
      border: 0;
      background: transparent;
      overflow: hidden;
      display: none;
    }
    dialog[open] {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    dialog::backdrop {
      /* Documented exemption: a fixed near-black scrim in both modes, so the
         sheet reads as lifted off the dashboard rather than tinted by it. */
      background: rgba(8, 6, 4, 0.6);
    }
    .sheet {
      display: flex;
      flex-direction: column;
      gap: var(--ql-space-l, 16px);
      box-sizing: border-box;
      width: min(420px, 100%);
      max-height: calc(100dvh - 2 * var(--ql-space-l, 16px));
      overflow-y: auto;
      padding: var(--ql-space-xl, 24px);
      border: 1px solid var(--ql-surface-border, #e4dccb);
      border-radius: var(--ql-radius-card, 18px);
      /* --ql-surface-card is a 5.5%-opacity white in dark mode: it is a tint
         meant to sit on the opaque page, and used alone here it let the whole
         dashboard read straight through the sheet. Painting it over --ql-bg-base
         keeps the card's exact colour while making the panel opaque. */
      background:
        linear-gradient(var(--ql-surface-card, #fdfbf6), var(--ql-surface-card, #fdfbf6)),
        var(--ql-bg-base, #f4f0e8);
      box-shadow: 0 1px 6px rgba(80, 65, 40, 0.08);
      color: var(--ql-ink-primary, #2b2620);
      font-family: var(--ql-font-body, Outfit, 'Noto Sans TC', 'Noto Sans SC', sans-serif);
    }
    /* The panel takes initial focus so nothing inside looks preselected; it is
       a focus target, not a control, so it draws no ring. */
    .sheet:focus {
      outline: none;
    }
    .title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ql-space-s, 8px);
      /* The close target is 56px but reads as a 24px glyph; pulling the row's
         trailing edge back keeps the glyph optically aligned to the padding. */
      margin-right: calc(-1 * var(--ql-space-l, 16px));
    }
    h2 {
      margin: 0;
      min-width: 0;
      overflow-wrap: anywhere;
      font: 500 16px/22px var(--ql-font-body, Outfit, sans-serif);
      color: var(--ql-ink-primary, #2b2620);
    }
    .close {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      width: var(--ql-touch-min, 56px);
      height: var(--ql-touch-min, 56px);
      padding: 0;
      border: 0;
      border-radius: var(--ql-radius-chip, 999px);
      background: transparent;
      color: var(--ql-ink-muted, #8c8578);
      cursor: pointer;
      transition: background 200ms ease;
    }
    .close:hover {
      background: color-mix(in srgb, var(--ql-accent-champagne, #b08d57) 8%, transparent);
    }
    .close:focus-visible {
      outline: 2px solid var(--ql-accent-champagne, #b08d57);
      outline-offset: -4px;
    }
    .footer {
      display: flex;
      align-items: center;
      gap: var(--ql-space-m, 12px);
    }
    .footer.empty {
      display: none;
    }
    @media (prefers-reduced-motion: reduce) {
      .close {
        transition: none;
      }
    }
  `;

  private dialog(): HTMLDialogElement | null {
    return this.shadowRoot?.querySelector('dialog') ?? null;
  }

  /**
   * `document.activeElement` stops at the shadow host, so walk down each root
   * to find the control the user actually pressed.
   */
  private static deepActiveElement(): HTMLElement | undefined {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement != null) {
      active = active.shadowRoot.activeElement;
    }
    return active instanceof HTMLElement ? active : undefined;
  }

  protected override updated(changed: Map<string, unknown>): void {
    if (!changed.has('open')) {
      return;
    }
    const dialog = this.dialog();
    if (dialog === null) {
      return;
    }
    if (this.open && !dialog.open) {
      this.opener = QlSheet.deepActiveElement();
      dialog.showModal();
      // showModal() autofocuses the first focusable descendant, which puts a
      // focus ring on the close button as if it were the recommended action.
      // The panel itself is the correct initial target: it is labelled, so
      // assistive technology announces the sheet rather than "Close, button".
      this.shadowRoot?.querySelector<HTMLElement>('.sheet')?.focus();
      return;
    }
    if (!this.open && dialog.open) {
      dialog.close();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    const dialog = this.dialog();
    if (dialog?.open === true) {
      dialog.close();
    }
    this.opener = undefined;
  }

  private requestClose(reason: 'close' | 'escape' | 'backdrop'): void {
    if (!this.open) {
      return;
    }
    this.open = false;
    const opener = this.opener;
    this.opener = undefined;
    // Focus moves after the dialog has actually left the top layer, or the UA
    // takes it back.
    void this.updateComplete.then(() => opener?.focus());
    this.dispatchEvent(
      new CustomEvent('ql-sheet-close', {
        detail: { reason },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /** Escape reaches the dialog as `cancel`; the sheet owns the close instead. */
  private readonly onCancel = (event: Event): void => {
    event.preventDefault();
    this.requestClose('escape');
  };

  /** A click that lands on the dialog itself missed the sheet — that is the scrim. */
  private readonly onDialogClick = (event: MouseEvent): void => {
    if (event.target === this.dialog()) {
      this.requestClose('backdrop');
    }
  };

  protected override render(): TemplateResult {
    return html`
      <dialog
        role="dialog"
        aria-modal="true"
        aria-label=${this.heading}
        @cancel=${this.onCancel}
        @click=${this.onDialogClick}
      >
        <div class="sheet" part="sheet" tabindex="-1">
          <div class="title-row">
            <h2>${this.heading}</h2>
            <button
              class="close"
              type="button"
              aria-label=${this.closeLabel}
              @click=${(): void => this.requestClose('close')}
            >
              ${dysonIcon('close')}
            </button>
          </div>
          <slot></slot>
          <div class="footer"><slot name="footer"></slot></div>
        </div>
      </dialog>
    `;
  }
}

customElements.define('ql-sheet', QlSheet);
