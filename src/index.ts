import { version } from '../package.json';
import { injectFontStylesheet } from './fonts/load-fonts';
import './elements/ql-canvas';

export { QlBaseCard, type EntityAvailability } from './cards/ql-base-card';
export { QlCanvas } from './elements/ql-canvas';
export * from './tokens/palette';
export { colorCssVariables, cssVariableBlock, dimensionCssVariables } from './tokens/css';
export { resolveLocale } from './i18n/resolve';
export { t } from './i18n/translate';
export { SUPPORTED_LOCALES, type Locale } from './i18n/types';
export type { HomeAssistant } from './types/home-assistant';

injectFontStylesheet(document, import.meta.url);

console.info(
  `%c QUIET LUXE %c v${version} `,
  'background:#B08D57;color:#FDFBF6;font-weight:500',
  'color:#8C8578',
);
