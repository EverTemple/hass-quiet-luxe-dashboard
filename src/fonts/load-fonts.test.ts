import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { injectFontStylesheet, resolveFontStylesheetHref } from './load-fonts';

const HACS_MODULE_URL =
  'http://ha.local/hacsfiles/hass-quiet-luxe-dashboard/quiet-luxe.js?hacstag=123450101';
const LOCAL_MODULE_URL = 'http://ha.local/local/quiet-luxe/quiet-luxe.js';

function freshDocument(): Document {
  return new Window().document as unknown as Document;
}

describe('resolveFontStylesheetHref', () => {
  it('maps HACS installs to the documented /local fonts location', () => {
    expect(resolveFontStylesheetHref(HACS_MODULE_URL)).toBe(
      'http://ha.local/local/quiet-luxe/fonts/fonts.css',
    );
  });

  it('resolves relative to the bundle URL for manual /local installs', () => {
    expect(resolveFontStylesheetHref(LOCAL_MODULE_URL)).toBe(
      'http://ha.local/local/quiet-luxe/fonts/fonts.css',
    );
  });

  it('resolves relative to the bundle URL for any non-HACS origin', () => {
    expect(resolveFontStylesheetHref('http://localhost:5173/quiet-luxe.js')).toBe(
      'http://localhost:5173/fonts/fonts.css',
    );
  });
});

describe('injectFontStylesheet', () => {
  it('appends one stylesheet link', () => {
    const doc = freshDocument();
    injectFontStylesheet(doc, LOCAL_MODULE_URL);
    const link = doc.getElementById('quiet-luxe-fonts') as HTMLLinkElement | null;
    expect(link).not.toBeNull();
    expect(link?.getAttribute('rel')).toBe('stylesheet');
    expect(link?.getAttribute('href')).toBe(
      'http://ha.local/local/quiet-luxe/fonts/fonts.css',
    );
  });

  it('is idempotent', () => {
    const doc = freshDocument();
    injectFontStylesheet(doc, LOCAL_MODULE_URL);
    injectFontStylesheet(doc, LOCAL_MODULE_URL);
    expect(doc.querySelectorAll('#quiet-luxe-fonts')).toHaveLength(1);
  });
});
