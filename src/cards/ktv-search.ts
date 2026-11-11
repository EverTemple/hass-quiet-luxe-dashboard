/**
 * Pure catalogue model and search for the KTV song picker card.
 *
 * The catalogue is a compact JSON file published by the backend (see
 * docs/superpowers/specs/2026-11-11-ktv-song-picker-design.md). About 56k rows
 * are searched in memory on every keystroke, so everything expensive (Unicode
 * normalisation, lower-casing) happens once in `parseCatalogue`, and `search`
 * is a single allocation-light pass that keeps only the best `limit` hits.
 */

/** Column order of the catalogue file. A different order means a different format. */
export const CATALOGUE_FIELDS = [
  'no',
  'title',
  'singer',
  'singer2',
  'lang',
  'ti',
  'si',
  'hot',
] as const;

export const DEFAULT_RESULT_LIMIT = 50;

/** Language codes of the box's catalogue that get a chip of their own. */
const LANG_MANDARIN = 1;
const LANG_CANTONESE = 2;
const LANG_ENGLISH = 4;

export type LangFilter = 'all' | 'mandarin' | 'cantonese' | 'english' | 'other';

export const LANG_FILTERS: ReadonlyArray<LangFilter> = [
  'all',
  'mandarin',
  'cantonese',
  'english',
  'other',
];

export interface Song {
  readonly no: string;
  readonly title: string;
  readonly singer: string;
  readonly singer2: string;
  readonly lang: number;
  /** Lower-case pinyin initials of the title (first letter of each word for Latin text). */
  readonly ti: string;
  /** Lower-case pinyin initials of the singer. */
  readonly si: string;
  /** Singer popularity, higher is more popular. */
  readonly hot: number;
  /** Normalised copies the matcher compares against. */
  readonly titleKey: string;
  readonly singerKey: string;
  readonly singer2Key: string;
}

export interface Catalogue {
  readonly version: string;
  readonly built: string;
  readonly langs: Readonly<Record<string, string>>;
  readonly songs: ReadonlyArray<Song>;
}

export class CatalogueFormatError extends Error {
  constructor(message: string) {
    super(`ktv catalogue: ${message}`);
    this.name = 'CatalogueFormatError';
  }
}

/** NFKC, lower-case, trimmed, runs of whitespace collapsed to one space. */
export function normalise(text: string): string {
  return text.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRow(row: unknown, index: number): Song {
  if (!Array.isArray(row) || row.length !== CATALOGUE_FIELDS.length) {
    throw new CatalogueFormatError(`row ${String(index)} is not a ${String(CATALOGUE_FIELDS.length)}-field array`);
  }
  const [no, title, singer, singer2, lang, ti, si, hot] = row as unknown[];
  if (
    typeof no !== 'string' ||
    typeof title !== 'string' ||
    typeof singer !== 'string' ||
    typeof singer2 !== 'string' ||
    typeof lang !== 'number' ||
    typeof ti !== 'string' ||
    typeof si !== 'string' ||
    typeof hot !== 'number'
  ) {
    throw new CatalogueFormatError(`row ${String(index)} has a field of the wrong type`);
  }
  return {
    no,
    title,
    singer,
    singer2,
    lang,
    // Defensive: the backend lower-cases initials, but a stray capital would
    // silently stop matching because the query is always lower-cased.
    ti: ti.toLowerCase(),
    si: si.toLowerCase(),
    hot,
    titleKey: normalise(title),
    singerKey: normalise(singer),
    singer2Key: normalise(singer2),
  };
}

/** Validates the wire format and builds the search index. Throws `CatalogueFormatError`. */
export function parseCatalogue(raw: unknown): Catalogue {
  if (!isRecord(raw)) {
    throw new CatalogueFormatError('not an object');
  }
  const { v, built, langs, fields, rows } = raw;
  if (typeof v !== 'string' || v === '') {
    throw new CatalogueFormatError('"v" must be a non-empty string');
  }
  if (
    !Array.isArray(fields) ||
    fields.length !== CATALOGUE_FIELDS.length ||
    fields.some((field, index) => field !== CATALOGUE_FIELDS[index])
  ) {
    throw new CatalogueFormatError(`"fields" must be ${CATALOGUE_FIELDS.join(',')}`);
  }
  if (!Array.isArray(rows)) {
    throw new CatalogueFormatError('"rows" must be an array');
  }
  const langNames: Record<string, string> = {};
  if (isRecord(langs)) {
    for (const [code, name] of Object.entries(langs)) {
      if (typeof name === 'string') {
        langNames[code] = name;
      }
    }
  }
  return {
    version: v,
    built: typeof built === 'string' ? built : '',
    langs: langNames,
    songs: rows.map(parseRow),
  };
}

function matchesLang(lang: number, filter: LangFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'mandarin':
      return lang === LANG_MANDARIN;
    case 'cantonese':
      return lang === LANG_CANTONESE;
    case 'english':
      return lang === LANG_ENGLISH;
    case 'other':
      return lang !== LANG_MANDARIN && lang !== LANG_CANTONESE && lang !== LANG_ENGLISH;
  }
}

/** Between an exact singer match (4) and a title substring (5). */
const SINGER_INITIALS_PREFIX_SCORE = 4.5;

/** Lower is better. Returns 0 for no match. */
function scoreField(song: Song, query: string): number {
  const { titleKey, singerKey, singer2Key, ti, si } = song;
  if (titleKey === query) {
    return 1;
  }
  if (titleKey.startsWith(query)) {
    return 2;
  }
  if (ti.startsWith(query)) {
    return 3;
  }
  if (singerKey === query || singer2Key === query || si === query) {
    return 4;
  }
  // Typing a singer's initials (dl → 邓丽君) is the usual KTV search, far more
  // common than a Latin fragment of a title, so it outranks a title substring.
  if (si.startsWith(query)) {
    return SINGER_INITIALS_PREFIX_SCORE;
  }
  if (titleKey.includes(query)) {
    return 5;
  }
  if (singerKey.includes(query) || singer2Key.includes(query)) {
    return 6;
  }
  if (ti.includes(query) || si.includes(query)) {
    return 7;
  }
  return 0;
}

/** Every token scored after any whole-query match, so a phrase hit always wins. */
const TOKEN_MATCH_OFFSET = 7;

/**
 * The whole query as one phrase first (a title like "moon river" is one
 * thing). Failing that, a multi-word query matches when EVERY word matches some
 * field, so "邓丽君 月亮" finds 月亮代表我的心 by 邓丽君. Lower is better; 0 is no match.
 */
function scoreSong(song: Song, query: string, tokens: ReadonlyArray<string>): number {
  const whole = scoreField(song, query);
  if (whole !== 0 || tokens.length < 2) {
    return whole;
  }
  let worst = 0;
  for (const token of tokens) {
    const score = scoreField(song, token);
    if (score === 0) {
      return 0;
    }
    worst = Math.max(worst, score);
  }
  return TOKEN_MATCH_OFFSET + worst;
}

interface Hit {
  readonly song: Song;
  readonly score: number;
}

/** Best first: score, then singer popularity, then the shorter title. */
function compareHits(a: Hit, b: Hit): number {
  if (a.score !== b.score) {
    return a.score - b.score;
  }
  if (a.song.hot !== b.song.hot) {
    return b.song.hot - a.song.hot;
  }
  return a.song.title.length - b.song.title.length;
}

/** Inserts into an array kept sorted by `compareHits`, dropping the worst past `limit`. */
function insertHit(top: Hit[], hit: Hit, limit: number): void {
  if (top.length === limit && compareHits(hit, top[limit - 1] as Hit) >= 0) {
    return;
  }
  let low = 0;
  let high = top.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (compareHits(top[middle] as Hit, hit) <= 0) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  top.splice(low, 0, hit);
  if (top.length > limit) {
    top.pop();
  }
}

export interface SearchResult {
  readonly songs: ReadonlyArray<Song>;
  /** More songs matched than `limit` allowed, so the list is a cut-off. */
  readonly truncated: boolean;
}

const NO_RESULT: SearchResult = { songs: [], truncated: false };

/** The best `limit` songs for `query`, best first. A blank query matches nothing. */
export function search(
  catalogue: Catalogue,
  query: string,
  lang: LangFilter = 'all',
  limit: number = DEFAULT_RESULT_LIMIT,
): SearchResult {
  const needle = normalise(query);
  if (needle === '' || limit <= 0) {
    return NO_RESULT;
  }
  const tokens = needle.split(' ');
  // Keeping one extra hit tells "exactly limit matches" from "more than limit".
  const top: Hit[] = [];
  for (const song of catalogue.songs) {
    if (!matchesLang(song.lang, lang)) {
      continue;
    }
    const score = scoreSong(song, needle, tokens);
    if (score === 0) {
      continue;
    }
    insertHit(top, { song, score }, limit + 1);
  }
  return { songs: top.slice(0, limit).map((hit) => hit.song), truncated: top.length > limit };
}
