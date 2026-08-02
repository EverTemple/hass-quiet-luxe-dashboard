import inlineFontCss from 'virtual:quiet-luxe-inline-fonts';

export const INLINE_FONT_STYLE_ID = 'quiet-luxe-inline-fonts';

/**
 * Marcellus + Outfit (Latin) as @font-face rules with base64 woff2 payloads,
 * generated at build time from the installed @fontsource packages
 * (scripts/inline-fonts-plugin.ts). Shipping them inside the bundle is what
 * makes a HACS-only install render correctly: HACS plugin directories are flat,
 * so no font tree can be served next to the bundle.
 */
export const INLINE_FONT_CSS: string = inlineFontCss;

/**
 * Injects the inlined faces into the document. @font-face is ignored inside
 * shadow roots, so this must live in the document. Idempotent.
 */
export function injectInlineFonts(doc: Document): void {
  if (doc.getElementById(INLINE_FONT_STYLE_ID) !== null) {
    return;
  }
  const style = doc.createElement('style');
  style.id = INLINE_FONT_STYLE_ID;
  style.textContent = INLINE_FONT_CSS;
  doc.head.append(style);
}
