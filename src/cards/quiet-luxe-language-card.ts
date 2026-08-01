import {
  css,
  html,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import { SUPPORTED_LOCALES, type Locale } from '../i18n/types';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';

export interface LanguageTile {
  readonly code: Locale;
  /** Endonym — locale-invariant by design; deliberately not via t(). */
  readonly native: string;
  /** English gloss per Figma card/language anatomy; locale-invariant. */
  readonly gloss: string;
}

export const LANGUAGE_TILES: ReadonlyArray<LanguageTile> = [
  { code: 'en', native: 'English', gloss: 'English' },
  { code: 'zh-Hant', native: '繁體中文', gloss: 'Traditional Chinese' },
  { code: 'zh-Hans', native: '简体中文', gloss: 'Simplified Chinese' },
  { code: 'ms', native: 'Bahasa Melayu', gloss: 'Malay' },
  { code: 'id', native: 'Bahasa Indonesia', gloss: 'Indonesian' },
];

export interface LanguageCardConfig {
  readonly type: string;
  /** Optional subset; defaults to all five supported locales. */
  readonly languages?: ReadonlyArray<Locale>;
}

/**
 * Language card (Figma `card/language`): five large kiosk-friendly tiles.
 * Switching per plan D2 (verified 2026-08-01): dispatch the
 * `hass-language-select` event with the bare language-code string, bubbling
 * and composed so the HA frontend root receives it; HA updates hass.locale,
 * browser storage, and the user profile (saveTranslationPreferences).
 * Selected state derives from the live hass locale.
 */
export class QuietLuxeLanguageCard extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
  };

  declare config?: LanguageCardConfig;

  setConfig(config: LanguageCardConfig): void {
    for (const code of config.languages ?? []) {
      if (!SUPPORTED_LOCALES.includes(code)) {
        throw new Error(`quiet-luxe-language-card: unsupported language "${code}"`);
      }
    }
    this.config = config;
  }

  getCardSize(): number {
    return 2;
  }

  getGridOptions(): { rows: number; columns: number } {
    return { rows: 2, columns: 12 };
  }

  private tiles(): ReadonlyArray<LanguageTile> {
    const subset = this.config?.languages;
    if (subset === undefined || subset.length === 0) {
      return LANGUAGE_TILES;
    }
    return LANGUAGE_TILES.filter((tile) => subset.includes(tile.code));
  }

  private onSelect(code: Locale): void {
    this.dispatchEvent(
      new CustomEvent<string>('hass-language-select', {
        detail: code,
        bubbles: true,
        composed: true,
      }),
    );
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .grid {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ql-space-m, 12px);
      }
      button {
        flex: 1 1 160px;
        min-height: var(--ql-touch-min, 56px);
        padding: var(--ql-space-m, 12px) var(--ql-space-l, 16px);
        border-radius: var(--ql-radius-card, 18px);
        border: 1px solid var(--ql-surface-border, #e4dccb);
        background: var(--ql-surface-card, #fdfbf6);
        color: var(--ql-ink-primary, #2b2620);
        cursor: pointer;
        text-align: left;
        transition: border-color 200ms ease;
      }
      button[aria-pressed='true'] {
        border-color: var(--ql-accent-champagne, #b08d57);
      }
      .native {
        margin: 0;
        font: 500 16px/22px var(--ql-font-body, Outfit, sans-serif);
      }
      .gloss {
        margin: 2px 0 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
    `,
  ];

  protected override render(): TemplateResult {
    if (this.config === undefined) {
      return html``;
    }
    const current = this.locale();
    return html`
      <div class="grid">
        ${this.tiles().map(
          (tile) => html`
            <button
              aria-pressed=${String(tile.code === current)}
              lang=${tile.code}
              @click=${(): void => this.onSelect(tile.code)}
            >
              <p class="native">${tile.native}</p>
              <p class="gloss">${tile.gloss}</p>
            </button>
          `,
        )}
      </div>
    `;
  }
}

registerCard('quiet-luxe-language-card', QuietLuxeLanguageCard, {
  name: 'Quiet Luxe Language Card',
  description: 'Kiosk-friendly language tiles that fire hass-language-select.',
});
