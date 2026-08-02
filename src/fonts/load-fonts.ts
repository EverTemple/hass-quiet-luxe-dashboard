const FONT_STYLESHEET_ID = 'quiet-luxe-fonts';

/**
 * HACS installs plugins as a flat directory under /hacsfiles/<repo>/ — release
 * assets only, no subdirectories — so the fonts tree cannot ship alongside the
 * bundle there. HACS installs therefore read fonts from the documented manual
 * location below (README "Install"); every other origin (manual /local install,
 * dev server) resolves the fonts tree relative to the bundle URL.
 */
const HACSFILES_PATH_PREFIX = '/hacsfiles/';
const LOCAL_FONT_STYLESHEET_PATH = '/local/quiet-luxe/fonts/fonts.css';
const RELATIVE_FONT_STYLESHEET = 'fonts/fonts.css';

export function resolveFontStylesheetHref(moduleUrl: string): string {
  const url = new URL(moduleUrl);
  if (url.pathname.startsWith(HACSFILES_PATH_PREFIX)) {
    return new URL(LOCAL_FONT_STYLESHEET_PATH, url).href;
  }
  return new URL(RELATIVE_FONT_STYLESHEET, url).href;
}

/**
 * Injects a <link> to the optional font stylesheet (see
 * resolveFontStylesheetHref for how the location is chosen).
 *
 * STRICTLY OPTIONAL: the Latin faces are inlined in the bundle
 * (src/fonts/inline-fonts.ts) and CJK falls back to system fonts, so this only
 * upgrades installs that copied the font tree to /config/www/quiet-luxe/fonts/.
 * `media="print"` keeps the request off the render-critical path until it
 * resolves, and a missing file removes the link again instead of leaving a
 * dead stylesheet in <head>.
 * Idempotent: safe to call on every bundle evaluation.
 */
export function injectFontStylesheet(doc: Document, moduleUrl: string): void {
  if (doc.getElementById(FONT_STYLESHEET_ID) !== null) {
    return;
  }
  const link = doc.createElement('link');
  link.id = FONT_STYLESHEET_ID;
  link.rel = 'stylesheet';
  link.media = 'print';
  link.addEventListener('load', () => {
    link.media = 'all';
  });
  link.addEventListener('error', () => {
    link.remove();
  });
  link.href = resolveFontStylesheetHref(moduleUrl);
  doc.head.append(link);
}
