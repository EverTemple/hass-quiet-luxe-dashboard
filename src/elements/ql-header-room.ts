import { css, html, LitElement, nothing, type CSSResult, type TemplateResult } from 'lit';
import { t } from '../i18n/translate';
import type { Locale } from '../i18n/types';

/**
 * Room header (Figma `header/room`, spec §6): back affordance + room name in
 * Marcellus + micro-stats row (temp · humidity · AQI, pre-formatted strings).
 * Emits `ql-back`; the strategy wires navigation.
 */
export class QlHeaderRoom extends LitElement {
  static override properties = {
    name: { type: String },
    stats: { attribute: false },
    locale: { type: String },
  };

  declare name: string;
  declare stats: ReadonlyArray<string>;
  declare locale: Locale;

  constructor() {
    super();
    this.name = '';
    this.stats = [];
    this.locale = 'en';
  }

  static override styles: CSSResult = css`
    header {
      display: flex;
      align-items: center;
      gap: var(--ql-space-m, 12px);
      color: var(--ql-ink-primary, #2b2620);
    }
    .back {
      width: 36px;
      height: 36px;
      border-radius: var(--ql-radius-chip, 999px);
      border: 1px solid var(--ql-surface-border, #e4dccb);
      background: var(--ql-surface-card, #fdfbf6);
      color: var(--ql-ink-primary, #2b2620);
      font: 400 18px/1 var(--ql-font-body, Outfit, sans-serif);
      cursor: pointer;
    }
    h1 {
      margin: 0;
      font: 400 24px/30px var(--ql-font-display, Marcellus, serif);
      letter-spacing: 0.04em;
    }
    .stats {
      margin: 0;
      color: var(--ql-ink-muted, #8c8578);
      font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
    }
  `;

  private onBack(): void {
    this.dispatchEvent(new CustomEvent('ql-back', { bubbles: true, composed: true }));
  }

  protected override render(): TemplateResult {
    return html`
      <header>
        <button class="back" aria-label=${t(this.locale, 'common.back')} @click=${this.onBack}>
          ‹
        </button>
        <div>
          <h1>${this.name}</h1>
          ${this.stats.length === 0
            ? nothing
            : html`<p class="stats">${this.stats.join(' · ')}</p>`}
        </div>
      </header>
    `;
  }
}

customElements.define('ql-header-room', QlHeaderRoom);
