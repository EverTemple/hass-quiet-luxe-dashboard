export const SUPPORTED_LOCALES = ['en', 'zh-Hant', 'zh-Hans', 'ms', 'id'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];
