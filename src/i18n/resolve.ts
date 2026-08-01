import { SUPPORTED_LOCALES, type Locale } from './types';

const ALIASES: Readonly<Record<string, Locale>> = {
  'zh-tw': 'zh-Hant',
  'zh-hk': 'zh-Hant',
  'zh-mo': 'zh-Hant',
  'zh-cn': 'zh-Hans',
  'zh-sg': 'zh-Hans',
  zh: 'zh-Hans',
};

function normalize(tag: string): Locale | undefined {
  const lower = tag.toLowerCase();
  const exact = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === lower);
  if (exact !== undefined) {
    return exact;
  }
  const alias = ALIASES[lower];
  if (alias !== undefined) {
    return alias;
  }
  const base = lower.split('-')[0];
  return SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === base);
}

/**
 * Resolves the first supported locale from an ordered candidate chain
 * (HA user profile language, then per-home kiosk default), falling back to en.
 * Spec §10.
 */
export function resolveLocale(candidates: ReadonlyArray<string | undefined>): Locale {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === '') {
      continue;
    }
    const resolved = normalize(candidate);
    if (resolved !== undefined) {
      return resolved;
    }
  }
  return 'en';
}
