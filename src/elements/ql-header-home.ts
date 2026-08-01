import { css, html, LitElement, nothing, type CSSResult, type TemplateResult } from 'lit';
import type { TranslationKey } from '../i18n/locales/en';
import { t } from '../i18n/translate';
import type { Locale } from '../i18n/types';

export type QlHeaderVariant = 'mobile' | 'ipad' | 'desktop';

/**
 * Home header (Figma `header/home`, spec §6):
 * - mobile: meta line → personal greeting (Marcellus) → home + presence line.
 * - ipad/desktop: single row, home name in Marcellus, meta + presence + chip
 *   slot (globe language chip). NEVER a personal greeting — iPads are shared
 *   consoles (spec §2). The strategy simply does not set userName here, and the
 *   element ignores it for these variants regardless.
 */
export class QlHeaderHome extends LitElement {
  static override properties = {
    variant: { type: String, reflect: true },
    homeName: { attribute: 'home-name', type: String },
    userName: { attribute: 'user-name', type: String },
    meta: { type: String },
    presence: { type: String },
    hour: { type: Number },
    locale: { type: String },
  };

  declare variant: QlHeaderVariant;
  declare homeName: string;
  declare userName: string;
  declare meta: string;
  declare presence: string;
  declare hour?: number;
  declare locale: Locale;

  constructor() {
    super();
    this.variant = 'mobile';
    this.homeName = '';
    this.userName = '';
    this.meta = '';
    this.presence = '';
    this.locale = 'en';
  }

  greeting(): string {
    const hour = this.hour ?? new Date().getHours();
    const key: TranslationKey =
      hour < 12 ? 'greeting.morning' : hour < 18 ? 'greeting.afternoon' : 'greeting.evening';
    return t(this.locale, key);
  }

  static override styles: CSSResult = css`
    :host {
      display: block;
      color: var(--ql-ink-primary, #2b2620);
    }
    .display {
      margin: 0;
      font: 400 34px/40px var(--ql-font-display, Marcellus, serif);
      letter-spacing: 0.04em;
    }
    .meta,
    .sub {
      margin: 0;
      color: var(--ql-ink-muted, #8c8578);
      font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      letter-spacing: 0.02em;
    }
    .presence {
      color: var(--ql-accent-champagne, #b08d57);
    }
    header.stack {
      display: flex;
      flex-direction: column;
      gap: var(--ql-space-xs, 4px);
    }
    header.row {
      display: flex;
      align-items: center;
      gap: var(--ql-space-l, 16px);
    }
    header.row .display {
      font-size: 24px;
      line-height: 30px;
    }
    header.row .meta {
      margin-left: auto;
    }
  `;

  protected override render(): TemplateResult {
    if (this.variant === 'mobile') {
      const greeting =
        this.userName === '' ? this.greeting() : `${this.greeting()}, ${this.userName}`;
      return html`
        <header class="stack">
          ${this.meta === '' ? nothing : html`<p class="meta">${this.meta}</p>`}
          <h1 class="display">${greeting}</h1>
          <p class="sub">
            ${this.homeName}${this.presence === ''
              ? nothing
              : html` · <span class="presence">${this.presence}</span>`}
          </p>
        </header>
      `;
    }
    return html`
      <header class="row">
        <h1 class="display">${this.homeName}</h1>
        <p class="meta">${this.meta}</p>
        ${this.presence === '' ? nothing : html`<span class="presence">${this.presence}</span>`}
        <slot name="chip"></slot>
      </header>
    `;
  }
}

customElements.define('ql-header-home', QlHeaderHome);
