import { en, type TranslationKey, type TranslationTable } from './locales/en';
import { id } from './locales/id';
import { ms } from './locales/ms';
import { zhHans } from './locales/zh-hans';
import { zhHant } from './locales/zh-hant';
import type { Locale } from './types';

const TABLES: Readonly<Record<Locale, TranslationTable>> = {
  en,
  'zh-Hant': zhHant,
  'zh-Hans': zhHans,
  ms,
  id,
};

/** Typed lookup; the type system guarantees key completeness per table. */
export function t(locale: Locale, key: TranslationKey): string {
  return TABLES[locale][key];
}
