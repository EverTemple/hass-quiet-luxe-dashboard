import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { INLINE_FONT_CSS, INLINE_FONT_STYLE_ID, injectInlineFonts } from './inline-fonts';

function freshDocument(): Document {
  return new Window().document as unknown as Document;
}

describe('INLINE_FONT_CSS', () => {
  it('inlines every required Latin face as a base64 woff2', () => {
    const faces = INLINE_FONT_CSS.match(/@font-face\{/g) ?? [];
    expect(faces.length).toBeGreaterThanOrEqual(8);
    expect(INLINE_FONT_CSS).toContain("font-family:'Marcellus'");
    expect(INLINE_FONT_CSS).toContain("font-family:'Outfit'");
    for (const weight of [300, 400, 500]) {
      expect(INLINE_FONT_CSS).toContain(`font-weight:${weight}`);
    }
    expect(INLINE_FONT_CSS).toContain('src:url(data:font/woff2;base64,');
  });

  it('never references an external or relative font file', () => {
    expect(INLINE_FONT_CSS).not.toContain('./files/');
    expect(INLINE_FONT_CSS).not.toContain('http');
  });

  it('keeps the unicode-range subsetting from @fontsource', () => {
    expect(INLINE_FONT_CSS).toContain('unicode-range:');
  });
});

describe('injectInlineFonts', () => {
  it('appends one style element carrying the faces', () => {
    const doc = freshDocument();
    injectInlineFonts(doc);
    const style = doc.getElementById(INLINE_FONT_STYLE_ID);
    expect(style).not.toBeNull();
    expect(style?.textContent).toContain('@font-face');
  });

  it('is idempotent', () => {
    const doc = freshDocument();
    injectInlineFonts(doc);
    injectInlineFonts(doc);
    expect(doc.querySelectorAll(`#${INLINE_FONT_STYLE_ID}`)).toHaveLength(1);
  });
});
