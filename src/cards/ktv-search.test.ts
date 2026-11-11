import { describe, expect, it } from 'vitest';
import {
  CATALOGUE_FIELDS,
  CatalogueFormatError,
  normalise,
  parseCatalogue,
  search,
  type Catalogue,
  type LangFilter,
  type Song,
} from './ktv-search';

type RawRow = [string, string, string, string, number, string, string, number];

function wire(rows: ReadonlyArray<RawRow>): Record<string, unknown> {
  return {
    v: 'test-1',
    built: '2026-11-11T00:00:00.000Z',
    langs: { '1': 'Mandarin', '2': 'Cantonese', '4': 'English' },
    fields: [...CATALOGUE_FIELDS],
    rows,
  };
}

function build(rows: ReadonlyArray<RawRow>): Catalogue {
  return parseCatalogue(wire(rows));
}

const SAMPLE: ReadonlyArray<RawRow> = [
  ['1', '月亮代表我的心', '邓丽君', '', 1, 'yldbwdx', 'dlj', 999000],
  ['2', '月亮', '王菲', '', 1, 'yl', 'wf', 999500],
  ['3', '月亮之上', '凤凰传奇', '', 1, 'ylzs', 'fhcq', 999700],
  ['4', '富士山下', '陈奕迅', '', 2, 'fssx', 'cyx', 999998],
  ['5', '十年', '陈奕迅', '', 2, 'sn', 'cyx', 999998],
  ['6', 'Yesterday', 'The Beatles', '', 4, 'y', 'tb', 999100],
  ['7', 'Moon River', 'Andy Williams', '', 4, 'mr', 'aw', 999200],
  ['8', 'ありがとう', '谷村新司', '', 5, 'adgt', 'gcxs', 998000],
  ['9', '我的心', '邓丽君', '', 1, 'wdx', 'dlj', 999000],
];

const CATALOGUE = build(SAMPLE);

/** Just the songs; the truncation flag has its own tests. */
function found(
  catalogue: Catalogue,
  query: string,
  lang: LangFilter = 'all',
  limit?: number,
): ReadonlyArray<Song> {
  return search(catalogue, query, lang, limit).songs;
}

function titles(songs: ReadonlyArray<{ readonly title: string }>): string[] {
  return songs.map((song) => song.title);
}

describe('normalise', () => {
  it('applies NFKC, lower-case, trim and whitespace collapse', () => {
    expect(normalise('  ＹＥＳ   Terday ')).toBe('yes terday');
    expect(normalise('Ａｂｃ')).toBe('abc');
    expect(normalise('')).toBe('');
  });
});

describe('parseCatalogue', () => {
  it('builds songs with normalised match keys', () => {
    expect(CATALOGUE.version).toBe('test-1');
    expect(CATALOGUE.songs).toHaveLength(SAMPLE.length);
    expect(CATALOGUE.songs[5]?.titleKey).toBe('yesterday');
    expect(CATALOGUE.songs[5]?.title).toBe('Yesterday');
    expect(CATALOGUE.langs['1']).toBe('Mandarin');
  });

  it('rejects a payload that is not an object', () => {
    expect(() => parseCatalogue(null)).toThrow(CatalogueFormatError);
    expect(() => parseCatalogue([])).toThrow(CatalogueFormatError);
    expect(() => parseCatalogue('x')).toThrow(CatalogueFormatError);
  });

  it('rejects a missing version', () => {
    expect(() => parseCatalogue({ ...wire([]), v: '' })).toThrow('"v"');
  });

  it('rejects fields in a different order', () => {
    const swapped = [...CATALOGUE_FIELDS];
    swapped[1] = 'singer';
    swapped[2] = 'title';
    expect(() => parseCatalogue({ ...wire([]), fields: swapped })).toThrow('"fields"');
    expect(() => parseCatalogue({ ...wire([]), fields: undefined })).toThrow('"fields"');
  });

  it('rejects rows that are not an array', () => {
    expect(() => parseCatalogue({ ...wire([]), rows: {} })).toThrow('"rows"');
  });

  it('rejects malformed rows', () => {
    expect(() => parseCatalogue({ ...wire([]), rows: [['1', 'a']] })).toThrow('row 0');
    expect(() =>
      parseCatalogue({ ...wire([]), rows: [[1, 'a', 'b', '', 1, 'a', 'b', 1]] }),
    ).toThrow('wrong type');
  });

  it('tolerates missing optional metadata', () => {
    const bare = wire([]);
    delete bare.built;
    delete bare.langs;
    const parsed = parseCatalogue(bare);
    expect(parsed.built).toBe('');
    expect(parsed.langs).toEqual({});
  });
});

describe('search', () => {
  it('returns nothing for a blank query', () => {
    expect(found(CATALOGUE, '')).toEqual([]);
    expect(found(CATALOGUE, '   ')).toEqual([]);
  });

  it('finds a song by title initials', () => {
    expect(found(CATALOGUE, 'yldb')[0]?.title).toBe('月亮代表我的心');
  });

  it('finds a song by title text', () => {
    expect(found(CATALOGUE, '月亮代表')[0]?.title).toBe('月亮代表我的心');
  });

  it('finds songs by singer name and singer initials', () => {
    expect(titles(found(CATALOGUE, '邓丽君'))).toEqual(['我的心', '月亮代表我的心']);
    expect(titles(found(CATALOGUE, 'dlj'))).toEqual(['我的心', '月亮代表我的心']);
  });

  it('finds songs by the second singer', () => {
    const duet = build([['1', '合唱', '甲', '乙', 1, 'hc', 'j', 999000]]);
    expect(titles(found(duet, '乙'))).toEqual(['合唱']);
  });

  it('is case and width insensitive', () => {
    expect(titles(found(CATALOGUE, 'YESTERDAY'))).toEqual(['Yesterday']);
    expect(titles(found(CATALOGUE, 'ｙｅｓｔ'))).toEqual(['Yesterday']);
  });

  it('ranks exact title, then prefix, then initials prefix, then singer, then substring', () => {
    const ranked = build([
      ['1', '我爱月', 'a', '', 1, 'wa', 'a', 1], // title substring (5)
      ['2', '月亮', 'a', '', 1, 'yl', 'a', 1], // exact title (1)
      ['3', '月亮河', 'a', '', 1, 'ylh', 'a', 1], // title prefix (2)
      ['4', '其他', '月', '', 1, 'qt', 'y', 1], // singer exact (4)
      ['5', '歌', '月光族', '', 1, 'g', 'ygz', 1], // singer substring/prefix (6)
      ['6', '歌二', 'x', '', 1, 'ge', 'x', 1], // no match
    ]);
    expect(titles(found(ranked, '月'))).toEqual(['月亮', '月亮河', '其他', '我爱月', '歌']);
    expect(titles(found(ranked, '月亮'))).toEqual(['月亮', '月亮河']);
  });

  it('ranks a title-initials prefix above a title substring, and initials substring last', () => {
    const ranked = build([
      ['1', '某月亮', 'a', '', 1, 'myl', 'q', 1], // initials substring (7)
      ['2', '看yl', 'a', '', 1, 'kyl', 'q', 1], // title substring (5)
      ['3', '月亮', 'a', '', 1, 'yl', 'q', 1], // initials prefix (3)
    ]);
    expect(titles(found(ranked, 'yl'))).toEqual(['月亮', '看yl', '某月亮']);
  });

  it('breaks ties by popularity, then by shorter title', () => {
    const ranked = build([
      ['1', '月亮长长', 'a', '', 1, 'ylcc', 'a', 100],
      ['2', '月亮长', 'a', '', 1, 'ylc', 'a', 100],
      ['3', '月亮一二三四', 'a', '', 1, 'yl', 'a', 500],
    ]);
    expect(titles(found(ranked, '月亮'))).toEqual(['月亮一二三四', '月亮长', '月亮长长']);
  });

  it('filters by language', () => {
    expect(titles(found(CATALOGUE, 'yester', 'english'))).toEqual(['Yesterday']);
    expect(titles(found(CATALOGUE, 'sn', 'cantonese'))).toEqual(['十年']);
    expect(titles(found(CATALOGUE, '月亮', 'cantonese'))).toEqual([]);
    expect(titles(found(CATALOGUE, '月亮', 'mandarin'))).toHaveLength(3);
    expect(titles(found(CATALOGUE, 'adgt', 'other'))).toEqual(['ありがとう']);
    expect(titles(found(CATALOGUE, 'adgt', 'mandarin'))).toEqual([]);
  });

  it('caps the result count and keeps the best hits', () => {
    const many = build(
      Array.from({ length: 200 }, (_, index): RawRow => [
        String(index),
        `歌${String(index)}`,
        '歌手',
        '',
        1,
        'g',
        'gs',
        index,
      ]),
    );
    const hits = found(many, '歌', 'all', 50);
    expect(hits).toHaveLength(50);
    expect(hits[0]?.hot).toBe(199);
    expect(hits[49]?.hot).toBe(150);
    expect(found(many, '歌', 'all', 0)).toEqual([]);
  });

  it('reports truncation only when more songs matched than the limit allowed', () => {
    const rows = (count: number): RawRow[] =>
      Array.from({ length: count }, (_, index): RawRow => [String(index), `歌${String(index)}`, '歌手', '', 1, 'g', 'gs', index]);
    expect(search(build(rows(51)), '歌', 'all', 50).truncated).toBe(true);
    expect(search(build(rows(50)), '歌', 'all', 50)).toMatchObject({ truncated: false });
    expect(search(build(rows(50)), '歌', 'all', 50).songs).toHaveLength(50);
    expect(search(build(rows(3)), '歌', 'all', 50).truncated).toBe(false);
    expect(search(build(rows(3)), '', 'all', 50)).toEqual({ songs: [], truncated: false });
  });

  it('requires every word of a multi-word query to match some field', () => {
    expect(titles(found(CATALOGUE, '邓丽君 月亮'))).toEqual(['月亮代表我的心']);
    expect(titles(found(CATALOGUE, '月亮 邓丽君'))).toEqual(['月亮代表我的心']);
    expect(titles(found(CATALOGUE, 'dlj yldb'))).toEqual(['月亮代表我的心']);
    expect(found(CATALOGUE, '邓丽君 十年')).toEqual([]);
  });

  it('still prefers a whole-phrase match over a per-word one', () => {
    const phrase = build([
      ['1', 'moon river', 'a', '', 4, 'mr', 'a', 1],
      ['2', 'river of the moon', 'moon river band', '', 4, 'rotm', 'mrb', 999999],
    ]);
    expect(titles(found(phrase, 'moon river'))[0]).toBe('moon river');
    // Word order is free once the phrase itself does not match.
    expect(titles(found(phrase, 'river moon'))).toEqual(['river of the moon', 'moon river']);
  });

  it('ranks a singer-initials prefix above a title substring, and above singer-name and initials substrings', () => {
    const ranked = build([
      ['1', 'Candlelight', 'Someone', '', 4, 'c', 's', 999999], // Latin title containing "dl" (5)
      ['2', 'Zzz', 'Handlebars', '', 4, 'z', 'h', 999999], // singer-name substring (6)
      ['3', 'Quux', 'Other', '', 4, 'xdl', 'o', 999999], // title-initials substring (7)
      ['4', '月亮代表我的心', '邓丽君', '', 1, 'yldbwdx', 'dlj', 1], // singer-initials prefix (4.5), lowest hot
    ]);
    expect(titles(found(ranked, 'dl'))).toEqual(['月亮代表我的心', 'Candlelight', 'Zzz', 'Quux']);
  });

  it('still ranks an exact singer or initials match above a singer-initials prefix', () => {
    const ranked = build([
      ['1', 'A', 'dl', '', 4, 'a', 'dl', 1], // singer exact (4)
      ['2', 'B', '邓丽君', '', 1, 'b', 'dlj', 999999], // singer-initials prefix (4.5)
    ]);
    expect(titles(found(ranked, 'dl'))).toEqual(['A', 'B']);
  });

  it('lower-cases stray capitals in the initials', () => {
    const shouting = build([['1', '月亮', '王菲', '', 1, 'YL', 'WF', 1]]);
    expect(shouting.songs[0]?.ti).toBe('yl');
    expect(titles(found(shouting, 'yl'))).toEqual(['月亮']);
    expect(titles(found(shouting, 'wf'))).toEqual(['月亮']);
  });

  it('returns nothing when no song matches', () => {
    expect(found(CATALOGUE, 'zzzz')).toEqual([]);
  });
});

describe('search performance', () => {
  const SYLLABLES = '月亮代表我的心富士山下十年恋人知否红色高跟鞋相思风雨中陀飞轮'.split('');
  const LATIN = ['love', 'moon', 'river', 'night', 'dream', 'heart', 'fire', 'rain'];

  /** Deterministic LCG so the benchmark is the same on every run. */
  function makeRandom(seed: number): () => number {
    let state = seed;
    return (): number => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  function synthetic(count: number): Catalogue {
    const random = makeRandom(42);
    const pick = <T,>(items: ReadonlyArray<T>): T => items[Math.floor(random() * items.length)] as T;
    const rows: RawRow[] = [];
    for (let index = 0; index < count; index += 1) {
      const latin = random() < 0.2;
      const title = latin
        ? `${pick(LATIN)} ${pick(LATIN)} ${pick(LATIN)}`
        : Array.from({ length: 2 + Math.floor(random() * 5) }, () => pick(SYLLABLES)).join('');
      const initials = latin
        ? title
            .split(' ')
            .map((word) => word[0])
            .join('')
        : 'ab'.repeat(Math.ceil(title.length / 2)).slice(0, title.length);
      rows.push([
        String(1_000_000 + index),
        title,
        `${pick(SYLLABLES)}${pick(SYLLABLES)}${pick(SYLLABLES)}`,
        random() < 0.1 ? `${pick(SYLLABLES)}${pick(SYLLABLES)}` : '',
        pick([1, 1, 1, 2, 2, 3, 4, 4, 5, 6, 8, 19]),
        initials,
        'xyz',
        999000 + Math.floor(random() * 1000),
      ]);
    }
    return parseCatalogue(wire(rows));
  }

  it('answers a worst-case query over 56k songs in under 50 ms', () => {
    const catalogue = synthetic(56_000);
    expect(catalogue.songs).toHaveLength(56_000);
    // Single characters match the most rows, so they stress the top-N insertion.
    for (const query of ['月', 'a', 'love', '月亮', 'moon river', 'zzz']) {
      found(catalogue, query); // warm the JIT, as a second keystroke would
      const started = performance.now();
      const hits = found(catalogue, query);
      const elapsed = performance.now() - started;
      expect(hits.length, query).toBeLessThanOrEqual(50);
      expect(elapsed, `${query} took ${elapsed.toFixed(1)} ms`).toBeLessThan(50);
    }
  });
});
