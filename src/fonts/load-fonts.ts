const FONT_STYLESHEET_ID = 'quiet-luxe-fonts';

/**
 * Injects a <link> to the bundled font stylesheet, resolved relative to the
 * built bundle URL so it works from /hacsfiles/... and /local/... alike.
 * Idempotent: safe to call on every bundle evaluation.
 */
export function injectFontStylesheet(doc: Document, moduleUrl: string): void {
  if (doc.getElementById(FONT_STYLESHEET_ID) !== null) {
    return;
  }
  const link = doc.createElement('link');
  link.id = FONT_STYLESHEET_ID;
  link.rel = 'stylesheet';
  link.href = new URL('fonts/fonts.css', moduleUrl).href;
  doc.head.append(link);
}
