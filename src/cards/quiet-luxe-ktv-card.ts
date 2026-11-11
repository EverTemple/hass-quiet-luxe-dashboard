import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { live } from 'lit/directives/live.js';
import '../elements/ql-chip';
import '../elements/ql-segmented';
import type { QlSegmentOption } from '../elements/ql-segmented';
import {
  checkGlyph,
  minusGlyph,
  nextGlyph,
  pauseGlyph,
  playGlyph,
  plusGlyph,
  removeGlyph,
  searchGlyph,
  speakerGlyph,
  toTopGlyph,
} from '../elements/ql-glyphs';
import { formatInteger } from '../i18n/format-number';
import type { TranslationKey } from '../i18n/locales/en';
import type { Locale } from '../i18n/types';
import { t } from '../i18n/translate';
import { loadCatalogue } from './ktv-catalogue';
import { DEFAULT_KTV_COMMAND_ENTITY, DEFAULT_KTV_ENTITY } from './ktv-defaults';
import {
  LANG_FILTERS,
  normalise,
  search,
  type Catalogue,
  type LangFilter,
  type Song,
} from './ktv-search';
import { contentGrid, COLUMNS_FULL, type QlGridOptions } from './grid-options';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';
import { TYPE } from '../tokens/type';

export { DEFAULT_KTV_COMMAND_ENTITY, DEFAULT_KTV_ENTITY };
export const KTV_SEARCH_DEBOUNCE_MS = 120;
export const KTV_ADDED_FEEDBACK_MS = 1500;
export const KTV_UNDO_MS = 5000;
export const KTV_FAILURE_MS = 4000;
/** Scroll distance left in the language row below which the trailing fade is dropped. */
const CHIP_FADE_THRESHOLD_PX = 1;

/** Song numbers go into a command string, so only the backend's own shape is sent. */
const SONG_NO_PATTERN = /^[0-9]{1,12}$/;
const OFFLINE_STATES: ReadonlyArray<string> = ['offline', 'unknown', 'unavailable'];

export interface KtvCardConfig {
  readonly type: string;
  /** The box sensor. Defaults to `sensor.ktv_box`. */
  readonly entity?: string;
  /** The `text` entity commands are written to. Defaults to `text.ktv_command`. */
  readonly command_entity?: string;
  readonly title?: string;
}

type CatalogueState = 'idle' | 'loading' | 'ready' | 'error';

/** A song as the sensor publishes it (now playing and queue). */
interface BoxSong {
  readonly no: string;
  readonly title: string;
  readonly singer: string;
}

const LANG_FILTER_LABELS: Readonly<Record<LangFilter, TranslationKey>> = {
  all: 'ktv.lang_all',
  mandarin: 'ktv.lang_mandarin',
  cantonese: 'ktv.lang_cantonese',
  english: 'ktv.lang_english',
  other: 'ktv.lang_other',
};

/** Catalogue language codes → the name shown on a result's badge. */
const LANG_BADGE_LABELS: Readonly<Record<number, TranslationKey>> = {
  1: 'ktv.lang_mandarin',
  2: 'ktv.lang_cantonese',
  3: 'ktv.lang_minnan',
  4: 'ktv.lang_english',
  5: 'ktv.lang_japanese',
  6: 'ktv.lang_korean',
  8: 'ktv.lang_malay',
};

function toBoxSong(value: unknown): BoxSong | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { no, title, singer } = value as Record<string, unknown>;
  if (typeof no !== 'string' && typeof no !== 'number') {
    return undefined;
  }
  return {
    no: String(no),
    title: typeof title === 'string' ? title : '',
    singer: typeof singer === 'string' ? singer : '',
  };
}

function toBoxQueue(value: unknown): ReadonlyArray<BoxSong> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item): BoxSong[] => {
    const song = toBoxSong(item);
    return song === undefined ? [] : [song];
  });
}

/** A song with no title is still a song: show its number rather than a blank. */
function displayTitle(song: { readonly no: string; readonly title: string }, locale: Locale): string {
  return song.title.trim() !== '' ? song.title : `${t(locale, 'ktv.unknown_song')} #${song.no}`;
}

function singerLine(song: { readonly singer: string; readonly singer2?: string }): string {
  return [song.singer, song.singer2 ?? ''].filter((name) => name !== '').join(' · ');
}

/**
 * KTV song picker: search the box's catalogue, add to or reorder its queue, and
 * run the basic transport. The box is driven through a `text` entity (a service
 * call any HA user may make); its state is read from one sensor.
 *
 * The catalogue (about 56k songs) is downloaded once per version on first use
 * and searched in memory, so there is no round trip per keystroke. The queue is
 * never updated optimistically: it shows what the box reports, and a tap only
 * gives the button a short "added" acknowledgement.
 */
export class QuietLuxeKtvCard extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
    query: { state: true },
    appliedQuery: { state: true },
    lang: { state: true },
    results: { state: true },
    catalogueState: { state: true },
    added: { state: true },
    lastRemoved: { state: true },
    truncated: { state: true },
    announcement: { state: true },
    commandFailed: { state: true },
  };

  declare config?: KtvCardConfig;
  /** What the input shows. */
  declare query: string;
  /** The normalised query `results` were computed for. */
  declare appliedQuery: string;
  declare lang: LangFilter;
  declare results: ReadonlyArray<Song>;
  declare catalogueState: CatalogueState;
  /** `<action>:<song no>` keys whose button is showing its check mark. */
  declare added: ReadonlySet<string>;
  /** The song just removed from the queue, while its Undo is on offer. */
  declare lastRemoved: BoxSong | undefined;
  /** More songs matched than the list shows. */
  declare truncated: boolean;
  /** Text of the one visually hidden live region: counts, confirmations. */
  declare announcement: string;
  /** A command could not be delivered; shown for KTV_FAILURE_MS. */
  declare commandFailed: boolean;

  private catalogue?: Catalogue;
  /** The catalogue version most recently asked for, so a stale response is dropped. */
  private requestedVersion?: string;
  private searchTimer?: number;
  private readonly addedTimers = new Map<string, number>();
  private nonceCounter = 0;
  private undoTimer?: number;
  private failureTimer?: number;
  private chipsObserver?: ResizeObserver;

  constructor() {
    super();
    this.query = '';
    this.appliedQuery = '';
    this.lang = 'all';
    this.results = [];
    this.catalogueState = 'idle';
    this.added = new Set();
    this.lastRemoved = undefined;
    this.truncated = false;
    this.announcement = '';
    this.commandFailed = false;
  }

  setConfig(config: KtvCardConfig): void {
    for (const key of ['entity', 'command_entity'] as const) {
      const value = config[key];
      if (value !== undefined && (typeof value !== 'string' || value === '')) {
        throw new Error(`quiet-luxe-ktv-card: "${key}" must be a non-empty string`);
      }
    }
    if (config.title !== undefined && typeof config.title !== 'string') {
      throw new Error('quiet-luxe-ktv-card: "title" must be a string');
    }
    this.config = config;
  }

  getCardSize(): number {
    return 8;
  }

  getGridOptions(): QlGridOptions {
    return contentGrid(COLUMNS_FULL);
  }

  private entityId(): string {
    return this.config?.entity ?? DEFAULT_KTV_ENTITY;
  }

  private commandEntityId(): string {
    return this.config?.command_entity ?? DEFAULT_KTV_COMMAND_ENTITY;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // A new catalogue version means the backend rebuilt the index. Only cards
    // that already fetched one follow it; an untouched card stays lazy.
    if (this.catalogueState === 'idle') {
      return;
    }
    const source = this.catalogueSource();
    if (source !== undefined && source.version !== this.requestedVersion) {
      void this.loadCatalogueNow();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.searchTimer);
    this.searchTimer = undefined;
    for (const timer of this.addedTimers.values()) {
      window.clearTimeout(timer);
    }
    this.addedTimers.clear();
    window.clearTimeout(this.undoTimer);
    this.undoTimer = undefined;
    window.clearTimeout(this.failureTimer);
    this.failureTimer = undefined;
    // Only write state that changes: a write schedules an update, and an update
    // on a detached card must not rebuild what was just torn down.
    if (this.added.size > 0) {
      this.added = new Set();
    }
    if (this.lastRemoved !== undefined) {
      this.lastRemoved = undefined;
    }
    if (this.commandFailed) {
      this.commandFailed = false;
    }
    this.chipsObserver?.disconnect();
    this.chipsObserver = undefined;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) {
      this.observeChips();
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.observeChips();
    this.syncChipFade();
  }

  private chipRow(): HTMLElement | null {
    return this.shadowRoot?.querySelector<HTMLElement>('.chips') ?? null;
  }

  private observeChips(): void {
    const row = this.chipRow();
    if (
      !this.isConnected ||
      this.chipsObserver !== undefined ||
      row === null ||
      typeof ResizeObserver === 'undefined'
    ) {
      return;
    }
    this.chipsObserver = new ResizeObserver(() => this.syncChipFade());
    this.chipsObserver.observe(row);
  }

  /**
   * The language row scrolls sideways when it does not fit. A trailing fade
   * says "more this way", and only while there is more: not when everything
   * fits, and not once the row is scrolled to its end.
   */
  private readonly syncChipFade = (): void => {
    const row = this.chipRow();
    if (row === null) {
      return;
    }
    const remaining = row.scrollWidth - row.clientWidth - row.scrollLeft;
    row.toggleAttribute('data-fade', remaining > CHIP_FADE_THRESHOLD_PX);
  };

  // ---- catalogue -----------------------------------------------------------

  private catalogueSource(): { readonly url: string; readonly version: string } | undefined {
    const attributes = this.entity(this.entityId())?.attributes;
    const url = attributes?.catalogue_url;
    if (typeof url !== 'string' || url === '') {
      return undefined;
    }
    const version = attributes?.catalogue_version;
    return { url, version: typeof version === 'string' && version !== '' ? version : url };
  }

  /** What the backend itself says is wrong with the catalogue, if anything. */
  private backendCatalogueError(): string | undefined {
    const message = this.entity(this.entityId())?.attributes.catalogue_error;
    return typeof message === 'string' && message !== '' ? message : undefined;
  }

  private ensureCatalogue(): void {
    if (this.catalogueState === 'idle') {
      void this.loadCatalogueNow();
    }
  }

  /** Public for tests; safe to call repeatedly (downloads are shared per version). */
  async loadCatalogueNow(): Promise<void> {
    const source = this.catalogueSource();
    if (source === undefined) {
      this.requestedVersion = undefined;
      this.catalogueState = 'error';
      return;
    }
    this.requestedVersion = source.version;
    this.catalogueState = 'loading';
    try {
      const catalogue = await loadCatalogue(source.url, source.version);
      if (this.requestedVersion !== source.version) {
        return;
      }
      this.catalogue = catalogue;
      this.catalogueState = 'ready';
      this.runSearch();
    } catch (error) {
      if (this.requestedVersion !== source.version) {
        return;
      }
      this.catalogueState = 'error';
      console.error('quiet-luxe-ktv-card: catalogue load failed', error);
    }
  }

  // ---- search --------------------------------------------------------------

  private setQuery(value: string): void {
    this.query = value;
    window.clearTimeout(this.searchTimer);
    this.searchTimer = undefined;
    if (normalise(value) === '') {
      this.appliedQuery = '';
      this.results = [];
      return;
    }
    this.ensureCatalogue();
    this.searchTimer = window.setTimeout(() => {
      this.searchTimer = undefined;
      this.runSearch();
    }, KTV_SEARCH_DEBOUNCE_MS);
  }

  private runSearch(): void {
    const needle = normalise(this.query);
    this.appliedQuery = needle;
    if (this.catalogue === undefined || needle === '') {
      this.results = [];
      this.truncated = false;
      return;
    }
    const { songs, truncated } = search(this.catalogue, needle, this.lang);
    this.results = songs;
    this.truncated = truncated;
    const locale = this.locale();
    const count = `${formatInteger(songs.length, locale)}${truncated ? '+' : ''}`;
    this.announcement =
      songs.length === 0
        ? `${t(locale, 'ktv.no_results')} “${needle}”`
        : `${t(locale, 'ktv.results')} ${count}`;
  }

  /**
   * While an IME is composing, the field holds half-typed pinyin, not a query:
   * searching it would flash "No songs match". The finished text arrives with
   * `compositionend`.
   */
  private readonly onSearchInput = (event: Event): void => {
    if ((event as InputEvent).isComposing) {
      return;
    }
    this.setQuery((event.target as HTMLInputElement).value);
  };

  private readonly onSearchCompositionEnd = (event: Event): void => {
    this.setQuery((event.target as HTMLInputElement).value);
  };

  private readonly onSearchFocus = (): void => {
    this.ensureCatalogue();
  };

  private readonly onSearchKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.query !== '') {
      event.preventDefault();
      this.setQuery('');
    }
  };

  private readonly onClear = (): void => {
    this.setQuery('');
    this.shadowRoot?.querySelector<HTMLInputElement>('input.search-input')?.focus();
  };

  private readonly onRetry = (): void => {
    void this.loadCatalogueNow();
  };

  private onLangChange(lang: LangFilter): void {
    if (lang === this.lang) {
      return;
    }
    this.lang = lang;
    if (normalise(this.query) !== '') {
      this.runSearch();
    }
  }

  // ---- commands ------------------------------------------------------------

  /**
   * Writes `<command>#<nonce>` to the command entity. The nonce only makes two
   * identical commands in a row register as a change; the backend strips it and
   * checks the command against its own allow-list. Resolves false (after saying
   * so on the card) when the service call fails, so callers confirm nothing.
   */
  private async sendCommand(command: string): Promise<boolean> {
    const hass = this.hass;
    if (hass === undefined) {
      return false;
    }
    const nonce = `${Date.now().toString(36)}${(this.nonceCounter++).toString(36)}`;
    try {
      await hass.callService('text', 'set_value', {
        entity_id: this.commandEntityId(),
        value: `${command}#${nonce}`,
      });
      return true;
    } catch (error) {
      console.error(`quiet-luxe-ktv-card: command ${command} failed`, error);
      this.showCommandFailed();
      return false;
    }
  }

  private showCommandFailed(): void {
    window.clearTimeout(this.failureTimer);
    this.commandFailed = true;
    this.failureTimer = window.setTimeout(() => {
      this.failureTimer = undefined;
      this.commandFailed = false;
    }, KTV_FAILURE_MS);
  }

  private sendSongCommand(
    command: 'selectsong' | 'insertsong' | 'insertorder' | 'delorder',
    no: string,
  ): Promise<boolean> {
    if (!SONG_NO_PATTERN.test(no)) {
      console.error(`quiet-luxe-ktv-card: refusing ${command} for malformed song number`, no);
      return Promise.resolve(false);
    }
    return this.sendCommand(`${command}:${no}`);
  }

  private markAdded(key: string): void {
    window.clearTimeout(this.addedTimers.get(key));
    this.added = new Set(this.added).add(key);
    this.addedTimers.set(
      key,
      window.setTimeout(() => {
        this.addedTimers.delete(key);
        const next = new Set(this.added);
        next.delete(key);
        this.added = next;
      }, KTV_ADDED_FEEDBACK_MS),
    );
  }

  private async onAdd(song: Song): Promise<void> {
    if (await this.sendSongCommand('selectsong', song.no)) {
      this.markAdded(`add:${song.no}`);
      const locale = this.locale();
      this.announcement = `${t(locale, 'ktv.added')} ${displayTitle(song, locale)}`;
    }
  }

  private async onAddToTop(song: Song): Promise<void> {
    if (await this.sendSongCommand('insertsong', song.no)) {
      this.markAdded(`top:${song.no}`);
      const locale = this.locale();
      this.announcement = `${t(locale, 'ktv.added')} ${displayTitle(song, locale)}`;
    }
  }

  private async onMoveToTop(song: BoxSong): Promise<void> {
    await this.sendSongCommand('insertorder', song.no);
  }

  private async onRemove(song: BoxSong): Promise<void> {
    if (!(await this.sendSongCommand('delorder', song.no))) {
      return;
    }
    const locale = this.locale();
    this.announcement = `${t(locale, 'ktv.removed')} ${displayTitle(song, locale)}`;
    window.clearTimeout(this.undoTimer);
    this.lastRemoved = song;
    this.undoTimer = window.setTimeout(() => {
      this.undoTimer = undefined;
      this.endUndo();
    }, KTV_UNDO_MS);
  }

  /**
   * Closes the "Removed … Add back" offer. If the keyboard was on its button,
   * focus moves to the queue heading instead of falling to the page body.
   */
  private endUndo(): void {
    const hadFocus = this.shadowRoot?.activeElement?.classList.contains('add-back') ?? false;
    window.clearTimeout(this.undoTimer);
    this.undoTimer = undefined;
    this.lastRemoved = undefined;
    if (hadFocus) {
      void this.updateComplete.then(() => {
        this.shadowRoot?.querySelector<HTMLElement>('.queue .list-head')?.focus();
      });
    }
  }

  /**
   * The box has no "restore". Add back sends `selectsong` again, which puts the
   * song at the END of the queue, not back where it was.
   */
  private readonly onAddBack = async (): Promise<void> => {
    const song = this.lastRemoved;
    if (song === undefined) {
      return;
    }
    const added = await this.sendSongCommand('selectsong', song.no);
    if (!added) {
      return;
    }
    const locale = this.locale();
    this.announcement = `${t(locale, 'ktv.added')} ${displayTitle(song, locale)}`;
    this.endUndo();
  };

  private async onPlayPause(playing: boolean): Promise<void> {
    await this.sendCommand(playing ? 'pause' : 'play');
  }

  private readonly onNext = (): void => {
    void this.sendCommand('next');
  };

  private readonly onVolumeDown = (): void => {
    void this.sendCommand('voldn');
  };

  private readonly onVolumeUp = (): void => {
    void this.sendCommand('volup');
  };

  /**
   * The segmented control flips as soon as it is tapped. Once the command has
   * been sent, a re-render with `live()` puts it back on what the box reports,
   * so a lost command cannot leave it showing a mode the box is not in.
   */
  private readonly onVocalChange = async (event: Event): Promise<void> => {
    const value = (event as CustomEvent<{ value: string }>).detail.value;
    if (value === 'original') {
      await this.sendCommand('yuanchang');
    } else if (value === 'backing') {
      await this.sendCommand('banchang');
    }
    this.requestUpdate();
  };

  // ---- styles --------------------------------------------------------------

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      /* The wide layout keys off the card's own width, not the viewport: HA's
         sections view decides how much room a card gets. */
      :host {
        container-type: inline-size;
        container-name: ktv;
      }
      .eyebrow {
        display: block;
        margin: 0;
        color: var(--ql-ink-muted, #736d63);
        ${TYPE.eyebrow}
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      /* Tracked capitals are a Latin habit; Han characters do not take it. */
      .cjk .eyebrow {
        letter-spacing: 0;
      }
      .heading {
        margin-bottom: var(--ql-space-m, 12px);
      }
      .muted {
        color: var(--ql-ink-muted, #736d63);
      }

      /* Phone: one column in reading order. While a query is present the
         results take the place of the queue; wide shows both. */
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: var(--ql-space-m, 12px);
      }
      .layout > * {
        min-width: 0;
      }
      .layout:not(.searching) .results {
        display: none;
      }
      .layout.searching .queue {
        display: none;
      }

      /* Now playing sits on the card's own surface: the card is already the
         container, so there is no second panel inside it. */
      .now {
        display: flex;
        flex-direction: column;
        gap: var(--ql-space-l, 16px);
        /* 12 + the layout gap = 24 from the strip to the search field. */
        margin-bottom: var(--ql-space-m, 12px);
      }
      .now-eyebrow {
        display: none;
      }
      .now-head {
        display: flex;
        align-items: center;
        gap: var(--ql-space-m, 12px);
      }
      .now-text {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .now-title {
        margin: 0;
        ${TYPE.title}
      }
      .now-hint {
        margin: 0;
        color: var(--ql-ink-muted, #736d63);
        ${TYPE.caption}
      }
      .now-singer {
        margin: 0;
        color: var(--ql-ink-muted, #736d63);
        ${TYPE.caption}
      }
      .transport {
        flex: none;
        display: flex;
        align-items: center;
        /* Disc plus gap is the 56px touch pitch, so hit areas meet, not overlap. */
        gap: var(--ql-space-l, 16px);
      }
      .now-controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--ql-space-s, 8px) var(--ql-space-m, 12px);
        /* A 40px row keeps the vertical pitch to the transport at 56. */
        min-height: 40px;
      }
      .volume {
        display: inline-flex;
        align-items: center;
        gap: var(--ql-space-xs, 4px);
        /* When the controls wrap, the volume group sits at the end, not under
           the toggle. */
        margin-inline-start: auto;
      }
      .volume-icon {
        display: flex;
        margin-inline-end: var(--ql-space-xs, 4px);
        color: var(--ql-ink-muted, #736d63);
      }
      .volume-value {
        min-width: 2ch;
        text-align: center;
        font-variant-numeric: tabular-nums;
        ${TYPE.body}
      }

      /* Round icon buttons. The painted disc is smaller than the hit area: an
         invisible ::after claims the 56px touch floor, and discs are spaced so
         neighbouring hit areas meet without overlapping. */
      button.disc {
        position: relative;
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        padding: 0;
        border: 1px solid var(--ql-surface-border, #e4dccb);
        border-radius: var(--ql-radius-chip, 999px);
        background: var(--ql-surface-inset, #fdfbf6);
        color: var(--ql-ink-primary, #2b2620);
        cursor: pointer;
        transition:
          background 200ms ease,
          color 200ms ease,
          border-color 200ms ease;
      }
      button.disc::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: var(--ql-touch-min, 56px);
        height: var(--ql-touch-min, 56px);
        transform: translate(-50%, -50%);
      }
      button.disc:hover:not(:disabled) {
        border-color: var(--ql-accent-champagne, #b08d57);
      }
      button.disc:focus-visible,
      button.clear:focus-visible {
        outline: 2px solid var(--ql-accent-champagne, #b08d57);
        outline-offset: 2px;
      }
      button.disc:disabled {
        opacity: 0.5;
        cursor: default;
      }
      button.disc.solid {
        background: var(--ql-ink-primary, #2b2620);
        border-color: transparent;
        color: var(--ql-bg-base, #f4f0e8);
      }
      /* The one filled action: champagne with ink on it, 4.85:1 in light. */
      button.disc.primary {
        background: var(--ql-accent-champagne, #b08d57);
        border-color: transparent;
        color: var(--ql-on-accent, #2b2620);
      }
      /* Secondary actions are the icon alone, in the same 40px slot. */
      button.disc.plain {
        background: transparent;
        border-color: transparent;
      }
      /* The 1.5s acknowledgement changes the whole button's tone, not only its
         glyph: an ink ring on the card surface, no fill. */
      button.disc.confirmed {
        background: transparent;
        border-color: var(--ql-ink-primary, #2b2620);
        color: var(--ql-ink-primary, #2b2620);
      }

      /* Search field. Hand-rolled like the room card's text field: native
         search chrome off, the champagne ring on. */
      .search {
        position: relative;
      }
      .search-input {
        box-sizing: border-box;
        width: 100%;
        min-height: var(--ql-touch-min, 56px);
        padding: 0 56px 0 48px;
        border: 1px solid var(--ql-surface-border, #e4dccb);
        border-radius: var(--ql-radius-thumb, 12px);
        background: var(--ql-bg-base, #f4f0e8);
        color: var(--ql-ink-primary, #2b2620);
        ${TYPE.body}
        text-overflow: ellipsis;
        appearance: none;
        -webkit-appearance: none;
      }
      .search-input::placeholder {
        color: var(--ql-ink-muted, #736d63);
        opacity: 1;
        text-overflow: ellipsis;
      }
      .search-input::-webkit-search-cancel-button,
      .search-input::-webkit-search-decoration {
        -webkit-appearance: none;
        appearance: none;
        display: none;
      }
      .search-input:focus-visible {
        outline: 2px solid var(--ql-accent-champagne, #b08d57);
        outline-offset: 2px;
      }
      .search-icon {
        position: absolute;
        top: 50%;
        left: var(--ql-space-l, 16px);
        display: flex;
        transform: translateY(-50%);
        color: var(--ql-ink-muted, #736d63);
        pointer-events: none;
      }
      button.clear {
        position: absolute;
        top: 50%;
        right: var(--ql-space-s, 8px);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        padding: 0;
        border: 0;
        border-radius: var(--ql-radius-chip, 999px);
        background: transparent;
        color: var(--ql-ink-muted, #736d63);
        cursor: pointer;
        transform: translateY(-50%);
      }
      button.clear::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: var(--ql-touch-min, 56px);
        height: var(--ql-touch-min, 56px);
        transform: translate(-50%, -50%);
      }

      /* One row of language chips. It scrolls sideways rather than wrapping.
         On the phone it bleeds into the card padding, so the clip lands on the
         card edge, not 16px inside it; the padding puts the first chip back on
         the text edge. Vertical padding is the room the chips' own 56px hit
         areas need, since overflow would otherwise clip them. */
      .chips {
        display: flex;
        gap: var(--ql-space-s, 8px);
        margin: -14px calc(-1 * var(--ql-space-l, 16px));
        padding: 14px var(--ql-space-l, 16px);
        overflow-x: auto;
        scroll-snap-type: x proximity;
        scroll-padding-inline: var(--ql-space-l, 16px);
        scrollbar-width: none;
      }
      .chips::-webkit-scrollbar {
        display: none;
      }
      .chips[data-fade] {
        -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
        mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
      }
      .chips ql-chip {
        flex: none;
        scroll-snap-align: start;
      }

      /* Both lists open the same way: a 24px gap above, then an eyebrow with
         its count at the end, then 8px to the first row. */
      .results,
      .queue {
        margin-top: var(--ql-space-m, 12px);
      }
      /* A fixed height, so swapping the count for the "Removed … Add back"
         offer never moves the list under the finger. */
      .list-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ql-space-s, 8px);
        min-height: 20px;
        margin-bottom: var(--ql-space-s, 8px);
      }
      .list-head > .eyebrow {
        flex: none;
      }
      .list-head:focus-visible {
        outline: 2px solid var(--ql-accent-champagne, #b08d57);
        outline-offset: 2px;
      }
      .head-end {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--ql-space-xs, 4px);
        min-width: 0;
        color: var(--ql-ink-muted, #736d63);
        ${TYPE.caption}
      }
      .removed-text {
        flex: 0 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      button.add-back {
        position: relative;
        flex: none;
        padding: 0 var(--ql-space-xs, 4px);
        border: 0;
        background: transparent;
        color: var(--ql-accent-champagne-text, #846a41);
        font: inherit;
        font-weight: 500;
        white-space: nowrap;
        cursor: pointer;
      }
      button.add-back::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: var(--ql-touch-min, 56px);
        transform: translateY(-50%);
      }
      button.add-back:focus-visible {
        outline: 2px solid var(--ql-accent-champagne, #b08d57);
        outline-offset: 2px;
      }

      /* Result and queue rows share one shape: text, then the actions. */
      .list {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .song {
        display: flex;
        align-items: center;
        gap: var(--ql-space-m, 12px);
        min-height: var(--ql-touch-min, 56px);
        min-width: 0;
      }
      .song + .song {
        border-top: 1px solid var(--ql-surface-border, #e4dccb);
      }
      /* Removal sent, queue not yet updated: the row is on its way out. */
      .song.pending {
        opacity: 0.5;
      }
      .position {
        flex: none;
        min-width: 2ch;
        color: var(--ql-ink-muted, #736d63);
        font-variant-numeric: tabular-nums;
        ${TYPE.caption}
      }
      .song-text {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .song-title {
        ${TYPE.body}
      }
      .song-meta {
        display: flex;
        align-items: baseline;
        gap: var(--ql-space-s, 8px);
        min-width: 0;
        color: var(--ql-ink-muted, #736d63);
        ${TYPE.caption}
      }
      /* The singer line gives way, with an ellipsis, so the status after it
         always sits right next to what it is about. */
      .song-meta .singers {
        flex: 0 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      /* What the box itself says about this song: playing now, or queued at a
         position. Accent text, not an accent fill. */
      .song-meta .status {
        flex: none;
        white-space: nowrap;
        color: var(--ql-accent-champagne-text, #846a41);
        font-weight: 500;
      }
      .song-actions {
        flex: none;
        display: flex;
        align-items: center;
        gap: var(--ql-space-l, 16px);
      }

      .status-line {
        margin: 0 0 var(--ql-space-xs, 4px);
        color: var(--ql-ink-muted, #736d63);
        ${TYPE.caption}
        letter-spacing: 0.02em;
      }
      /* A state with nothing to list is a calm sentence, never a collapsed
         region. */
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--ql-space-s, 8px);
        margin: 0;
        padding: var(--ql-space-xl, 24px) 0;
        color: var(--ql-ink-muted, #736d63);
        ${TYPE.caption}
        letter-spacing: 0.02em;
        text-align: center;
      }
      .empty.start,
      .empty.hint {
        align-items: flex-start;
        text-align: start;
      }
      .empty.hint {
        padding-top: var(--ql-space-s, 8px);
      }
      .command-error {
        margin: 0 0 var(--ql-space-m, 12px);
        color: var(--ql-status-alert, #a85b4e);
        ${TYPE.caption}
      }
      /* Present all the time so screen readers track it; never painted. */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      .skeleton {
        display: flex;
        flex-direction: column;
        gap: var(--ql-space-s, 8px);
        padding: var(--ql-space-m, 12px) 0;
      }
      .skeleton span {
        height: 12px;
        border-radius: var(--ql-radius-chip, 999px);
        background: var(--ql-surface-border, #e4dccb);
        animation: ktv-pulse 1.2s ease-in-out infinite;
      }
      .skeleton span:first-child {
        width: 60%;
      }
      .skeleton span:last-child {
        width: 35%;
      }
      @keyframes ktv-pulse {
        50% {
          opacity: 0.45;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        button.disc,
        .skeleton span {
          transition: none;
          animation: none;
        }
      }

      /* Wide: search and results on the left (60%, capped at 640px so a title
         is never far from its button), now playing and the queue on the right.
         Now playing spans the flexible row, so its height never stretches the
         search field or chips. */
      @container ktv (min-width: 700px) {
        .layout {
          /* Search and queue stay within reach of their buttons however wide
             the card is: left column 640 at most, the whole block 1200. */
          max-inline-size: 1200px;
          grid-template-columns: minmax(0, min(60%, 640px)) minmax(0, 1fr);
          grid-template-rows: auto auto 1fr auto;
          column-gap: var(--ql-space-xl, 24px);
          align-items: start;
        }
        .layout:not(.searching) .results,
        .layout.searching .queue {
          display: block;
        }
        .search {
          grid-column: 1;
          grid-row: 1;
        }
        .chips {
          grid-column: 1;
          grid-row: 2;
          /* Inside its column the row has no card edge to bleed to. */
          margin-inline: 0;
          padding-inline: 0;
          scroll-padding-inline: 0;
        }
        .results {
          grid-column: 1;
          grid-row: 3 / span 2;
        }
        .now {
          grid-column: 2;
          grid-row: 1 / span 3;
          margin-bottom: 0;
        }
        .queue {
          grid-column: 2;
          grid-row: 4;
        }
        /* Same style and x-position as the "Up next" eyebrow, 8px above the strip. */
        .now-eyebrow {
          display: block;
          margin-bottom: calc(-1 * var(--ql-space-s, 8px));
        }
        button.disc.transport-button {
          width: 52px;
          height: 52px;
        }
        .transport {
          gap: var(--ql-space-s, 8px);
        }
      }
    `,
  ];

  // ---- render --------------------------------------------------------------

  private discButton(options: {
    readonly className: string;
    readonly label: string;
    readonly glyph: TemplateResult;
    readonly disabled: boolean;
    readonly onClick: () => void;
  }): TemplateResult {
    return html`
      <button
        type="button"
        class="disc ${options.className}"
        aria-label=${options.label}
        ?disabled=${options.disabled}
        @click=${options.onClick}
      >
        ${options.glyph}
      </button>
    `;
  }

  private renderNow(
    locale: Locale,
    offline: boolean,
    playing: boolean,
    nowPlaying: BoxSong | undefined,
    vocal: string,
    volume: number | undefined,
  ): TemplateResult {
    if (offline) {
      // No transport, vocal or volume: a box that is off cannot act on them, so
      // they are not drawn at all rather than drawn ghosted.
      return html`
        <section class="now" aria-label=${t(locale, 'ktv.now_playing')}>
          <div class="now-text">
            <p class="now-title ql-clamp-1">${t(locale, 'ktv.box_off')}</p>
            <p class="now-hint">${t(locale, 'ktv.box_off_hint')}</p>
          </div>
        </section>
      `;
    }
    const vocalOptions: ReadonlyArray<QlSegmentOption> = [
      { value: 'original', label: t(locale, 'ktv.vocal_original') },
      { value: 'backing', label: t(locale, 'ktv.vocal_backing') },
    ];
    return html`
      <section class="now" aria-label=${t(locale, 'ktv.now_playing')}>
        <span class="eyebrow now-eyebrow" aria-hidden="true">${t(locale, 'ktv.now_playing')}</span>
        <div class="now-head">
          <div class="now-text">
            <p class="now-title ql-clamp-1 ${nowPlaying === undefined ? 'muted' : ''}">
              ${nowPlaying === undefined ? t(locale, 'media.idle') : displayTitle(nowPlaying, locale)}
            </p>
            ${nowPlaying === undefined || nowPlaying.singer === ''
              ? nothing
              : html`<p class="now-singer ql-clamp-1">${nowPlaying.singer}</p>`}
          </div>
          <div class="transport">
            ${this.discButton({
              className: 'solid transport-button',
              label: playing ? t(locale, 'media.pause') : t(locale, 'media.play'),
              glyph: playing ? pauseGlyph(20) : playGlyph(20),
              disabled: false,
              onClick: (): void => {
                void this.onPlayPause(playing);
              },
            })}
            ${this.discButton({
              className: 'transport-button',
              label: t(locale, 'media.next'),
              glyph: nextGlyph(20),
              disabled: false,
              onClick: this.onNext,
            })}
          </div>
        </div>
        <div class="now-controls">
          <ql-segmented
            .options=${vocalOptions}
            .value=${live(vocal)}
            label=${t(locale, 'ktv.vocal')}
            @ql-change=${this.onVocalChange}
          ></ql-segmented>
          <div class="volume" role="group" aria-label=${t(locale, 'media.volume')}>
            <span class="volume-icon">${speakerGlyph(18)}</span>
            ${this.discButton({
              className: '',
              label: t(locale, 'ktv.volume_down'),
              glyph: minusGlyph(18),
              disabled: false,
              onClick: this.onVolumeDown,
            })}
            <span class="volume-value" aria-live="polite"
              >${volume === undefined ? '–' : formatInteger(volume, locale)}</span
            >
            ${this.discButton({
              className: '',
              label: t(locale, 'ktv.volume_up'),
              glyph: plusGlyph(18),
              disabled: false,
              onClick: this.onVolumeUp,
            })}
          </div>
        </div>
      </section>
    `;
  }

  private renderSearch(locale: Locale): TemplateResult {
    return html`
      <div class="search">
        <span class="search-icon">${searchGlyph(20)}</span>
        <input
          class="search-input"
          type="search"
          enterkeyhint="search"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          aria-label=${t(locale, 'ktv.search_label')}
          placeholder=${t(locale, 'ktv.search_placeholder')}
          .value=${this.query}
          @input=${this.onSearchInput}
          @compositionend=${this.onSearchCompositionEnd}
          @focus=${this.onSearchFocus}
          @keydown=${this.onSearchKeydown}
        />
        ${this.query === ''
          ? nothing
          : html`
              <button
                type="button"
                class="clear"
                aria-label=${t(locale, 'ktv.search_clear')}
                @click=${this.onClear}
              >
                ${removeGlyph(18)}
              </button>
            `}
      </div>
    `;
  }

  private renderChips(locale: Locale): TemplateResult {
    return html`
      <div
        class="chips"
        role="group"
        aria-label=${t(locale, 'ktv.lang_label')}
        @scroll=${this.syncChipFade}
      >
        ${LANG_FILTERS.map(
          (filter) => html`
            <ql-chip
              variant="device"
              ?active=${this.lang === filter}
              @click=${(): void => this.onLangChange(filter)}
              >${t(locale, LANG_FILTER_LABELS[filter])}</ql-chip
            >
          `,
        )}
      </div>
    `;
  }

  private renderResultRow(
    song: Song,
    locale: Locale,
    offline: boolean,
    nowPlayingNo: string | undefined,
    queuePositions: ReadonlyMap<string, number>,
  ): TemplateResult {
    const addDone = this.added.has(`add:${song.no}`);
    const topDone = this.added.has(`top:${song.no}`);
    const addLabel = t(locale, addDone ? 'ktv.added' : 'ktv.add');
    const topLabel = t(locale, topDone ? 'ktv.added' : 'ktv.add_to_top');
    // The language rides in the singer line, unless the filter already says it.
    // "Other" does not: it mixes Minnan, Japanese, Korean and Malay.
    const language =
      this.lang === 'all' || this.lang === 'other'
        ? t(locale, LANG_BADGE_LABELS[song.lang] ?? 'ktv.lang_other')
        : '';
    const meta = [singerLine(song), language].filter((part) => part !== '').join(' · ');
    // Straight from the box's sensor: nothing here is a guess about what a tap did.
    const position = queuePositions.get(song.no);
    const status =
      nowPlayingNo === song.no
        ? t(locale, 'ktv.playing')
        : position === undefined
          ? undefined
          : `${t(locale, 'ktv.queued')} #${formatInteger(position, locale)}`;
    return html`
      <li class="song">
        <div class="song-text">
          <span class="song-title ql-clamp-1">${displayTitle(song, locale)}</span>
          <span class="song-meta">
            <span class="singers">${meta}</span>
            ${status === undefined
              ? nothing
              : html`<span class="status">${status}</span>`}
          </span>
        </div>
        <div class="song-actions">
          ${this.discButton({
            className: topDone ? 'plain confirmed' : 'plain',
            label: `${displayTitle(song, locale)} — ${topLabel}`,
            glyph: topDone ? checkGlyph(18) : toTopGlyph(18),
            disabled: offline,
            onClick: (): void => {
              void this.onAddToTop(song);
            },
          })}
          ${this.discButton({
            className: addDone ? 'confirmed' : 'primary',
            label: `${displayTitle(song, locale)} — ${addLabel}`,
            glyph: addDone ? checkGlyph(20) : plusGlyph(20),
            disabled: offline,
            onClick: (): void => {
              void this.onAdd(song);
            },
          })}
        </div>
      </li>
    `;
  }

  private renderResults(
    locale: Locale,
    offline: boolean,
    nowPlayingNo: string | undefined,
    queuePositions: ReadonlyMap<string, number>,
  ): TemplateResult {
    return html`<section class="results">
      ${this.renderResultsBody(locale, offline, nowPlayingNo, queuePositions)}
    </section>`;
  }

  private renderResultsBody(
    locale: Locale,
    offline: boolean,
    nowPlayingNo: string | undefined,
    queuePositions: ReadonlyMap<string, number>,
  ): TemplateResult {
    if (normalise(this.query) === '') {
      return html`<p class="empty hint">${t(locale, 'ktv.search_hint')}</p>`;
    }
    if (this.catalogueState === 'error') {
      // A reason from the backend means a retry cannot help until it is fixed.
      const reason = this.backendCatalogueError();
      return html`
        <div class="empty">
          <span>${t(locale, 'ktv.load_failed')}</span>
          ${reason === undefined
            ? html`<ql-chip variant="scene" emphasis="primary" touch @click=${this.onRetry}
                >${t(locale, 'ktv.retry')}</ql-chip
              >`
            : html`<span>${reason}</span>`}
        </div>
      `;
    }
    if (this.catalogueState !== 'ready') {
      return html`
        <div>
          <p class="status-line">${t(locale, 'ktv.loading')}</p>
          <div class="skeleton" aria-hidden="true"><span></span><span></span></div>
        </div>
      `;
    }
    if (this.appliedQuery === '') {
      return html``;
    }
    if (this.results.length === 0) {
      return html`
        <div class="empty">
          <span>${t(locale, 'ktv.no_results')} “${this.appliedQuery}”</span>
          <span>${t(locale, 'ktv.no_results_hint')}</span>
        </div>
      `;
    }
    const count = formatInteger(this.results.length, locale);
    return html`
      <div class="list-head">
        <span class="eyebrow">${t(locale, 'ktv.results')}</span>
        <span class="eyebrow">${this.truncated ? `${count}+` : count}</span>
      </div>
      <ul class="list" role="list">
        ${this.results.map((song) =>
          this.renderResultRow(song, locale, offline, nowPlayingNo, queuePositions),
        )}
      </ul>
    `;
  }

  private renderQueueRow(song: BoxSong, index: number, locale: Locale): TemplateResult {
    // Removal sent but the box has not published the shorter queue yet.
    const pending = this.lastRemoved?.no === song.no;
    const name = displayTitle(song, locale);
    return html`
      <li class="song ${pending ? 'pending' : ''}">
        <span class="position" aria-hidden="true">${formatInteger(index + 1, locale)}</span>
        <div class="song-text">
          <span class="song-title ql-clamp-1">${name}</span>
          <span class="song-meta"><span class="singers">${singerLine(song)}</span></span>
        </div>
        <div class="song-actions">
          ${this.discButton({
            className: 'plain',
            label: `${name} — ${t(locale, 'ktv.move_to_top')}`,
            glyph: toTopGlyph(18),
            disabled: index === 0 || pending,
            onClick: (): void => {
              void this.onMoveToTop(song);
            },
          })}
          ${this.discButton({
            className: '',
            label: `${name} — ${t(locale, 'ktv.remove')}`,
            glyph: removeGlyph(18),
            disabled: pending,
            onClick: (): void => {
              void this.onRemove(song);
            },
          })}
        </div>
      </li>
    `;
  }

  /** The count, or for a few seconds after a removal the way to take it back. */
  private renderQueueHeadEnd(locale: Locale, count: number): TemplateResult {
    const removed = this.lastRemoved;
    if (removed === undefined) {
      return html`<span class="eyebrow">${formatInteger(count, locale)}</span>`;
    }
    return html`
      <span class="head-end">
        <span class="removed-text">${t(locale, 'ktv.removed')} ${displayTitle(removed, locale)}</span>
        <span aria-hidden="true">·</span>
        <button type="button" class="add-back" @click=${this.onAddBack}>
          ${t(locale, 'ktv.add_back')}
        </button>
      </span>
    `;
  }

  private renderQueue(
    locale: Locale,
    offline: boolean,
    queue: ReadonlyArray<BoxSong>,
    count: number,
  ): TemplateResult {
    if (offline) {
      return html`<section class="queue">
        <p class="empty start">${t(locale, 'ktv.queue_offline')}</p>
      </section>`;
    }
    return html`
      <section class="queue">
        <div class="list-head" tabindex="-1">
          <span class="eyebrow">${t(locale, 'ktv.up_next')}</span>
          ${this.renderQueueHeadEnd(locale, count)}
        </div>
        ${queue.length === 0
          ? html`<p class="empty">${t(locale, 'ktv.queue_empty')}</p>`
          : html`<ol class="list" role="list">
              ${queue.map((song, index) => this.renderQueueRow(song, index, locale))}
            </ol>`}
      </section>
    `;
  }

  protected override render(): TemplateResult {
    const config = this.config;
    if (config === undefined) {
      return html``;
    }
    const locale = this.locale();
    const entity = this.entity(this.entityId());
    const offline = entity === undefined || OFFLINE_STATES.includes(entity.state);
    const attributes = entity?.attributes ?? {};
    const nowPlaying = toBoxSong(attributes.now_playing);
    const queue = toBoxQueue(attributes.queue);
    const queueCount =
      typeof attributes.queue_count === 'number' ? attributes.queue_count : queue.length;
    const volume = typeof attributes.volume === 'number' ? attributes.volume : undefined;
    const vocal = typeof attributes.vocal === 'string' ? attributes.vocal : '';
    const searching = normalise(this.query) !== '';
    const queuePositions = new Map<string, number>();
    queue.forEach((song, index) => {
      if (!queuePositions.has(song.no)) {
        queuePositions.set(song.no, index + 1);
      }
    });
    return html`
      <div class="ql-card ${locale.startsWith('zh') ? 'cjk' : ''}">
        <div class="sr-only" aria-live="polite" aria-atomic="true">${this.announcement}</div>
        ${config.title === undefined || config.title === ''
          ? nothing
          : html`<p class="eyebrow heading">${config.title}</p>`}
        ${this.commandFailed
          ? html`<p class="command-error" role="alert">${t(locale, 'ktv.command_failed')}</p>`
          : nothing}
        <div class="layout ${searching ? 'searching' : ''}">
          ${this.renderNow(locale, offline, entity?.state === 'playing', nowPlaying, vocal, volume)}
          ${this.renderSearch(locale)} ${this.renderChips(locale)}
          ${this.renderResults(locale, offline, nowPlaying?.no, queuePositions)}
          ${this.renderQueue(locale, offline, queue, queueCount)}
        </div>
      </div>
    `;
  }
}

registerCard('quiet-luxe-ktv-card', QuietLuxeKtvCard, {
  name: 'Quiet Luxe KTV Card',
  description: 'Search the KTV box catalogue, queue songs, and control playback.',
});
