import { render } from 'lit';
import { describe, expect, it } from 'vitest';
import {
  checkGlyph,
  minusGlyph,
  nextGlyph,
  pauseGlyph,
  playGlyph,
  plusGlyph,
  removeGlyph,
  searchGlyph,
  speakerGlyph,
  toTopGlyph,
} from './ql-glyphs';

const KTV_GLYPHS = {
  play: playGlyph,
  pause: pauseGlyph,
  next: nextGlyph,
  plus: plusGlyph,
  minus: minusGlyph,
  toTop: toTopGlyph,
  remove: removeGlyph,
  search: searchGlyph,
  check: checkGlyph,
  speaker: speakerGlyph,
} as const;

describe('KTV glyphs', () => {
  it.each(Object.entries(KTV_GLYPHS))('%s draws a decorative currentColor svg', (_name, glyph) => {
    const host = document.createElement('div');
    render(glyph(20), host);
    const svgElement = host.querySelector('svg');
    expect(svgElement).not.toBeNull();
    expect(svgElement?.getAttribute('aria-hidden')).toBe('true');
    expect(svgElement?.getAttribute('focusable')).toBe('false');
    expect(svgElement?.getAttribute('width')).toBe('20');
    expect(svgElement?.getAttribute('viewBox')).toBe('0 0 20 20');
    expect(svgElement?.outerHTML).toContain('currentColor');
    expect(svgElement?.querySelector('path, circle, rect')).not.toBeNull();
  });
});
