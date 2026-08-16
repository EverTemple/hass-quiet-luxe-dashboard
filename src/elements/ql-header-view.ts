import { css, html, LitElement, nothing, type CSSResult, type TemplateResult } from 'lit';
import { t } from '../i18n/translate';
import type { Locale } from '../i18n/types';
import type { QlHeaderVariant } from './ql-header-home';

/**
 * View header (Figma `header/view`, 99:2442) — the chrome every non-Home view
 * wears.
 *
 * Three things the old `header/room` did not do:
 * - The back affordance sits at the very top-left and clears the 56px touch
 *   floor, but carries no fill or border — Figma dropped the bordered pill in
 *   favour of a bare left arrow + label. min-height/min-width stay at 56px so
 *   the target size survives even though the visible chrome is gone.
 * - The title is `display/home` (34/40 Marcellus), so a drill-down heading
 *   ranks equal to the Home greeting instead of shrinking below it.
 * - iPad keeps the back control. `nav/pills` moves laterally between top-level
 *   tabs and has no state for "you are inside a drill-down", so the pills are
 *   siblings and the control is the parent — not a redundancy.
 *
 * mobile stacks control-over-title (390 × 128); ipad and desktop place them
 * inline (× 60) to reclaim the vertical space.
 */
export class QlHeaderView extends LitElement {
  static override properties = {
    variant: { type: String, reflect: true },
    heading: { type: String },
    subtitle: { type: String },
    backLabel: { attribute: 'back-label', type: String },
    actionLabel: { attribute: 'action-label', type: String },
    locale: { type: String },
  };

  declare variant: QlHeaderVariant;
  declare heading: string;
  declare subtitle: string;
  declare backLabel: string;
  declare actionLabel: string;
  declare locale: Locale;

  constructor() {
    super();
    this.variant = 'mobile';
    this.heading = '';
    this.subtitle = '';
    this.backLabel = '';
    this.actionLabel = '';
    this.locale = 'en';
  }

  static override styles: CSSResult = css`
    :host {
      display: block;
      color: var(--ql-ink-primary, #2b2620);
    }
    header {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--ql-space-m, 12px);
    }
    /* ipad and desktop collapse the stack into one 60px band. */
    :host([variant='ipad']) header,
    :host([variant='desktop']) header {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: var(--ql-space-l, 16px);
    }
    .top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ql-space-m, 12px);
      width: 100%;
      min-width: 0;
    }
    :host([variant='ipad']) .top-row,
    :host([variant='desktop']) .top-row {
      width: auto;
      gap: var(--ql-space-l, 16px);
    }
    .titles {
      display: flex;
      flex-direction: column;
      gap: var(--ql-space-xs, 4px);
      min-width: 0;
    }
    h1 {
      margin: 0;
      font: 400 34px/40px var(--ql-font-display, Marcellus, serif);
      letter-spacing: 0.04em;
    }
    .subtitle {
      margin: 0;
      color: var(--ql-ink-muted, #8c8578);
      font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      letter-spacing: 0.02em;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: var(--ql-touch-min, 56px);
      min-width: var(--ql-touch-min, 56px);
      border-radius: var(--ql-radius-chip, 999px);
      border: 1px solid var(--ql-surface-border, #e4dccb);
      cursor: pointer;
      white-space: nowrap;
      flex: none;
    }
    /* Figma dropped the filled pill: a bare arrow + label, no fill or
       border. The 56px touch target from the shared button rule stays. */
    .back {
      gap: var(--ql-space-xs, 4px);
      padding: var(--ql-space-s, 8px) 0;
      background: none;
      border: none;
      border-radius: 0;
      color: var(--ql-ink-primary, #2b2620);
      font: 500 16px/22px var(--ql-font-body, Outfit, sans-serif);
    }
    .back:hover {
      color: var(--ql-accent-champagne, #b08d57);
    }
    .back-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      flex: none;
    }
    .back-icon svg {
      width: 16px;
      height: 10px;
    }
    .action {
      padding: var(--ql-space-s, 8px) var(--ql-space-m, 12px);
      background: none;
      color: var(--ql-accent-champagne, #b08d57);
      font: 400 14px/20px var(--ql-font-body, Outfit, sans-serif);
    }
    button:focus-visible {
      outline: 2px solid var(--ql-accent-champagne, #b08d57);
      outline-offset: 2px;
    }
    @media (prefers-reduced-motion: no-preference) {
      button {
        transition: opacity 120ms ease;
      }
      button:hover {
        opacity: 0.82;
      }
    }
  `;

  private emit(name: 'ql-back' | 'ql-action'): void {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
  }

  private readonly onBack = (): void => this.emit('ql-back');
  private readonly onAction = (): void => this.emit('ql-action');

  private renderBack(): TemplateResult {
    const label = this.backLabel === '' ? t(this.locale, 'view.home') : this.backLabel;
    return html`
      <button class="back" aria-label=${t(this.locale, 'common.back')} @click=${this.onBack}>
        <span class="back-icon">
          <svg viewBox="0 0 16 10" aria-hidden="true" fill="none">
            <path
              d="M 16 5 L 0 5 M 0 5 L 5 0 M 0 5 L 5 10"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span>${label}</span>
      </button>
    `;
  }

  private renderAction(): TemplateResult | typeof nothing {
    if (this.actionLabel === '') {
      return nothing;
    }
    return html`
      <button class="action" @click=${this.onAction}>${this.actionLabel} →</button>
    `;
  }

  private renderTitles(): TemplateResult {
    return html`
      <div class="titles">
        <h1>${this.heading}</h1>
        ${this.subtitle === '' ? nothing : html`<p class="subtitle">${this.subtitle}</p>`}
      </div>
    `;
  }

  protected override render(): TemplateResult {
    if (this.variant === 'mobile') {
      return html`
        <header>
          <div class="top-row">${this.renderBack()}${this.renderAction()}</div>
          ${this.renderTitles()}
        </header>
      `;
    }
    return html`
      <header>
        <div class="top-row">${this.renderBack()}${this.renderTitles()}</div>
        ${this.renderAction()}
      </header>
    `;
  }
}

customElements.define('ql-header-view', QlHeaderView);
