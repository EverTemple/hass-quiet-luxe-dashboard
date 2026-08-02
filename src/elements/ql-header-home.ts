import { css, html, LitElement, nothing, type CSSResult, type TemplateResult } from 'lit';
import type { TranslationKey } from '../i18n/locales/en';
import { t } from '../i18n/translate';
import type { Locale } from '../i18n/types';

export type QlHeaderVariant = 'mobile' | 'ipad' | 'desktop';

/** Meta values arrive pre-joined ("26° · AQI 0.5"); each part stays unbreakable. */
export const META_SEPARATOR = ' · ';

export function metaParts(meta: string): ReadonlyArray<string> {
  return meta === '' ? [] : meta.split(META_SEPARATOR);
}

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
    /* Values like "26°" or "AQI 0.5" must never break across lines. */
    .atom {
      white-space: nowrap;
    }
    header.stack {
      display: flex;
      flex-direction: column;
      gap: var(--ql-space-xs, 4px);
    }
    header.row {
      display: flex;
      align-items: baseline;
      flex-wrap: nowrap;
      gap: var(--ql-space-l, 16px);
      min-width: 0;
    }
    header.row .display {
      font-size: 24px;
      line-height: 30px;
      flex: 0 1 auto;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    header.row .meta {
      margin-left: auto;
      flex: 0 0 auto;
      white-space: nowrap;
    }
    header.row .presence {
      flex: 0 1 auto;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      letter-spacing: 0.02em;
    }
  `;

  private renderMeta(): TemplateResult | typeof nothing {
    const parts = metaParts(this.meta);
    if (parts.length === 0) {
      return nothing;
    }
    return html`<p class="meta">
      ${parts.map(
        (part, index) =>
          html`${index === 0 ? nothing : META_SEPARATOR}<span class="atom">${part}</span>`,
      )}
    </p>`;
  }

  protected override render(): TemplateResult {
    if (this.variant === 'mobile') {
      const greeting =
        this.userName === '' ? this.greeting() : `${this.greeting()}, ${this.userName}`;
      return html`
        <header class="stack">
          ${this.renderMeta()}
          <h1 class="display">${greeting}</h1>
          <p class="sub">
            <span class="atom">${this.homeName}</span>${this.presence === ''
              ? nothing
              : html` · <span class="presence atom">${this.presence}</span>`}
          </p>
        </header>
      `;
    }
    return html`
      <header class="row">
        <h1 class="display">${this.homeName}</h1>
        ${this.renderMeta()}
        ${this.presence === '' ? nothing : html`<span class="presence">${this.presence}</span>`}
        <slot name="chip"></slot>
      </header>
    `;
  }
}

customElements.define('ql-header-home', QlHeaderHome);
