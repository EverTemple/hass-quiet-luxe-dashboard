import {
  css,
  html,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import { t } from '../i18n/translate';
import { SUPPORTED_LOCALES, type Locale } from '../i18n/types';
import { contentGrid, COLUMNS_FULL, type QlGridOptions } from './grid-options';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';
import { TYPE } from '../tokens/type';

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
 *
 * The tiles are one mutually-exclusive choice, so they carry `radiogroup`/
 * `radio` semantics (roving tabindex, arrow-key move-and-select) rather than
 * a row of independent toggle buttons — `ql-preset-row`/`ql-segmented` cover
 * this pattern for a single text label per option, but a tile's two-line
 * native/gloss layout doesn't fit their API, so the semantics are hand-rolled
 * here on the same two-line tile Figma drew.
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

  getGridOptions(): QlGridOptions {
    return contentGrid(COLUMNS_FULL);
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

  /**
   * Arrow keys move AND select, per the radiogroup pattern — but unlike
   * `ql-preset-row`/`ql-segmented`, selection here isn't local state; it
   * only becomes true once hass round-trips the new locale back down. So
   * the button to focus is found by its position in the rendered list, not
   * by re-reading `aria-checked` after the (not yet updated) selection.
   */
  private onKeydown(event: KeyboardEvent, index: number): void {
    const tiles = this.tiles();
    const count = tiles.length;
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
    const next = (((index + direction) % count) + count) % count;
    const tile = tiles[next];
    if (tile === undefined) {
      return;
    }
    this.onSelect(tile.code);
    this.shadowRoot
      ?.querySelectorAll<HTMLButtonElement>('button[role="radio"]')
      .item(next)
      ?.focus();
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
        background: var(--ql-surface-inset, #fdfbf6);
        color: var(--ql-ink-primary, #2b2620);
        cursor: pointer;
        text-align: left;
        transition: border-color 200ms ease;
      }
      button[aria-checked='true'] {
        border-color: var(--ql-accent-champagne, #b08d57);
      }
      button:focus-visible {
        outline: 2px solid var(--ql-accent-champagne, #b08d57);
        outline-offset: 2px;
      }
      .native {
        display: block;
        margin: 0;
        ${TYPE.title}
      }
      .gloss {
        display: block;
        margin: 2px 0 0;
        color: var(--ql-ink-muted, #736d63);
        ${TYPE.caption}
      }
      @media (prefers-reduced-motion: reduce) {
        button {
          transition: none;
        }
      }
    `,
  ];

  protected override render(): TemplateResult {
    if (this.config === undefined) {
      return html``;
    }
    const current = this.locale();
    const tiles = this.tiles();
    return html`
      <div class="grid" role="radiogroup" aria-label=${t(current, 'view.language')}>
        ${tiles.map(
          (tile, index) => html`
            <button
              type="button"
              role="radio"
              aria-checked=${String(tile.code === current)}
              tabindex=${tile.code === current ? 0 : -1}
              lang=${tile.code}
              @click=${(): void => this.onSelect(tile.code)}
              @keydown=${(event: KeyboardEvent): void => this.onKeydown(event, index)}
            >
              <span class="native">${tile.native}</span>
              <span class="gloss">${tile.gloss}</span>
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
