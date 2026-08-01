import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { injectFontStylesheet } from './load-fonts';

const MODULE_URL = 'http://ha.local/hacsfiles/quiet-luxe/quiet-luxe.js';

function freshDocument(): Document {
  return new Window().document as unknown as Document;
}

describe('injectFontStylesheet', () => {
  it('appends one stylesheet link resolved relative to the bundle URL', () => {
    const doc = freshDocument();
    injectFontStylesheet(doc, MODULE_URL);
    const link = doc.getElementById('quiet-luxe-fonts') as HTMLLinkElement | null;
    expect(link).not.toBeNull();
    expect(link?.getAttribute('rel')).toBe('stylesheet');
    expect(link?.getAttribute('href')).toBe(
      'http://ha.local/hacsfiles/quiet-luxe/fonts/fonts.css',
    );
  });

  it('is idempotent', () => {
    const doc = freshDocument();
    injectFontStylesheet(doc, MODULE_URL);
    injectFontStylesheet(doc, MODULE_URL);
    expect(doc.querySelectorAll('#quiet-luxe-fonts')).toHaveLength(1);
  });
});
