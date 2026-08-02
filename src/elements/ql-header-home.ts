import { css, html, LitElement, nothing, type CSSResult, type TemplateResult } from 'lit';
import type { TranslationKey } from '../i18n/locales/en';
import { t } from '../i18n/translate';
import type { Locale } from '../i18n/types';

export type QlHeaderVariant = 'mobile' | 'ipad' | 'desktop';

/** One person the header knows about, already resolved from hass. */
export interface QlHeaderPerson {
  readonly name: string;
  readonly picture?: string;
  readonly home: boolean;
}

/** Meta values arrive pre-joined ("26° · AQI 0.5"); each part stays unbreakable. */
export const META_SEPARATOR = ' · ';

export function metaParts(meta: string): ReadonlyArray<string> {
  return meta === '' ? [] : meta.split(META_SEPARATOR);
}

/**
 * Home header (Figma `header/home-v2`, 56:730). v1 ordered the block
 * meta → greeting → presence, which pushed who-is-home to the bottom and let
 * the Home view repeat it in a section of its own.
 *
 * v2 leads with the presence cluster at the TOP-LEFT — overlapping avatars,
 * who is home, then the home name as an eyebrow — followed by the greeting and
 * then the meta line. Mobile stacks all three; ipad and desktop keep presence
 * and greeting on the left and right-align the meta on the greeting baseline.
 *
 * The greeting NEVER names a person on ipad or desktop: those are shared
 * consoles (spec §2). The strategy already withholds userName there, and this
 * element ignores it for those variants regardless.
 */
export class QlHeaderHome extends LitElement {
  static override properties = {
    variant: { type: String, reflect: true },
    homeName: { attribute: 'home-name', type: String },
    userName: { attribute: 'user-name', type: String },
    meta: { type: String },
    people: { attribute: false },
    hour: { type: Number },
    locale: { type: String },
  };

  declare variant: QlHeaderVariant;
  declare homeName: string;
  declare userName: string;
  declare meta: string;
  declare people: ReadonlyArray<QlHeaderPerson>;
  declare hour?: number;
  declare locale: Locale;

  constructor() {
    super();
    this.variant = 'mobile';
    this.homeName = '';
    this.userName = '';
    this.meta = '';
    this.people = [];
    this.locale = 'en';
  }

  greeting(): string {
    const hour = this.hour ?? new Date().getHours();
    const key: TranslationKey =
      hour < 12 ? 'greeting.morning' : hour < 18 ? 'greeting.afternoon' : 'greeting.evening';
    return t(this.locale, key);
  }

  /** "Steven, Mei at home" / "Nobody home" / "" when the home has no people. */
  presenceLabel(): string {
    if (this.people.length === 0) {
      return '';
    }
    const home = this.people.filter((person) => person.home).map((person) => person.name);
    if (home.length === 0) {
      return t(this.locale, 'header.nobody_home');
    }
    return `${home.join(', ')} ${t(this.locale, 'header.home_suffix')}`;
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
    .meta {
      margin: 0;
      color: var(--ql-ink-muted, #8c8578);
      font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      letter-spacing: 0.02em;
    }
    /* Values like "26°" or "AQI 0.5" must never break across lines. */
    .atom {
      white-space: nowrap;
    }
    .presence-cluster {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--ql-space-s, 8px);
      min-width: 0;
    }
    .who {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .avatars {
      display: flex;
      flex: none;
      align-items: center;
    }
    .avatar {
      width: 18px;
      height: 18px;
      border-radius: var(--ql-radius-chip, 999px);
      object-fit: cover;
      background: var(--ql-accent-champagne, #b08d57);
      color: #2b2620;
      font: 500 10px/18px var(--ql-font-body, Outfit, sans-serif);
      text-align: center;
      /* Overlapped, so a household reads as one cluster rather than a row of
         separate people. A hairline in the page colour keeps them separable. */
      box-shadow: 0 0 0 1.5px var(--ql-bg-base, #f4f0e8);
    }
    .avatar + .avatar {
      margin-left: -6px;
    }
    .avatar.away {
      background: var(--ql-surface-border, #e4dccb);
      color: var(--ql-ink-muted, #8c8578);
    }
    .presence {
      color: var(--ql-accent-champagne, #b08d57);
      font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      letter-spacing: 0.02em;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dot {
      color: var(--ql-ink-muted, #8c8578);
      font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
    }
    .home-name {
      color: var(--ql-ink-muted, #8c8578);
      font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
      letter-spacing: 0.14em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    header.stack {
      display: flex;
      flex-direction: column;
      gap: var(--ql-space-s, 8px);
    }
    header.row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      flex-wrap: nowrap;
      gap: var(--ql-space-l, 16px);
      min-width: 0;
    }
    .identity {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--ql-space-s, 8px);
      min-width: 0;
    }
    header.row .display {
      font-size: 34px;
      line-height: 40px;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    header.row .meta {
      flex: 0 0 auto;
      text-align: right;
      white-space: nowrap;
    }
    .trailing {
      display: flex;
      align-items: center;
      gap: var(--ql-space-m, 12px);
      flex: 0 0 auto;
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

  private renderAvatars(): TemplateResult | typeof nothing {
    if (this.people.length === 0) {
      return nothing;
    }
    return html`
      <span class="avatars" aria-hidden="true">
        ${this.people.map((person) =>
          person.picture === undefined
            ? html`<span class="avatar ${person.home ? '' : 'away'}"
                >${person.name.charAt(0).toUpperCase()}</span
              >`
            : html`<img class="avatar ${person.home ? '' : 'away'}" src=${person.picture} alt="" />`,
        )}
      </span>
    `;
  }

  private renderPresenceCluster(): TemplateResult | typeof nothing {
    const label = this.presenceLabel();
    if (label === '' && this.homeName === '') {
      return nothing;
    }
    return html`
      <div class="presence-cluster">
        ${label === ''
          ? nothing
          : html`
              <span class="who">
                ${this.renderAvatars()}<span class="presence">${label}</span>
              </span>
            `}
        ${label === '' || this.homeName === ''
          ? nothing
          : html`<span class="dot" aria-hidden="true">·</span>`}
        ${this.homeName === '' ? nothing : html`<span class="home-name">${this.homeName}</span>`}
      </div>
    `;
  }

  protected override render(): TemplateResult {
    const personal = this.variant === 'mobile' && this.userName !== '';
    const greeting = personal ? `${this.greeting()}, ${this.userName}` : this.greeting();
    if (this.variant === 'mobile') {
      return html`
        <header class="stack">
          ${this.renderPresenceCluster()}
          <h1 class="display">${greeting}</h1>
          ${this.renderMeta()}
        </header>
      `;
    }
    return html`
      <header class="row">
        <div class="identity">
          ${this.renderPresenceCluster()}
          <h1 class="display">${greeting}</h1>
        </div>
        <div class="trailing">${this.renderMeta()}<slot name="chip"></slot></div>
      </header>
    `;
  }
}

customElements.define('ql-header-home', QlHeaderHome);
