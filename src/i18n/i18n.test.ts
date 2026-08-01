import { describe, expect, it } from 'vitest';
import { en } from './locales/en';
import { id } from './locales/id';
import { ms } from './locales/ms';
import { zhHans } from './locales/zh-hans';
import { zhHant } from './locales/zh-hant';
import { resolveLocale } from './resolve';
import { t } from './translate';
import { SUPPORTED_LOCALES } from './types';

const TABLES = { en, 'zh-Hant': zhHant, 'zh-Hans': zhHans, ms, id } as const;

describe('locale tables', () => {
  it('covers all five supported locales', () => {
    expect(Object.keys(TABLES).sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });

  it.each(Object.entries(TABLES))('locale %s has exact key parity with en', (_name, table) => {
    expect(Object.keys(table).sort()).toEqual(Object.keys(en).sort());
  });

  it.each(Object.entries(TABLES))('locale %s has no empty strings', (_name, table) => {
    for (const value of Object.values(table)) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('resolveLocale', () => {
  it('returns an exact supported tag', () => {
    expect(resolveLocale(['zh-Hant'])).toBe('zh-Hant');
    expect(resolveLocale(['ms'])).toBe('ms');
  });

  it('normalizes regional Chinese tags to script tags', () => {
    expect(resolveLocale(['zh-TW'])).toBe('zh-Hant');
    expect(resolveLocale(['zh-HK'])).toBe('zh-Hant');
    expect(resolveLocale(['zh-CN'])).toBe('zh-Hans');
    expect(resolveLocale(['zh'])).toBe('zh-Hans');
  });

  it('normalizes regional Latin tags to their base language', () => {
    expect(resolveLocale(['en-GB'])).toBe('en');
    expect(resolveLocale(['id-ID'])).toBe('id');
  });

  it('walks the candidate chain: user profile → kiosk default → en', () => {
    expect(resolveLocale(['de', 'ms'])).toBe('ms');
    expect(resolveLocale([undefined, 'zh-Hans'])).toBe('zh-Hans');
    expect(resolveLocale(['de', 'fr'])).toBe('en');
    expect(resolveLocale([])).toBe('en');
  });
});

describe('t', () => {
  it('translates a key in the requested locale', () => {
    expect(t('en', 'common.on')).toBe('On');
    expect(t('zh-Hant', 'common.unavailable')).toBe('無法使用');
    expect(t('id', 'section.rooms')).toBe('Ruangan');
  });
});
