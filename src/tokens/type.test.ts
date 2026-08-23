import { describe, expect, it } from 'vitest';
import { TYPE } from './type';

describe('TYPE', () => {
  it('locks the caption role — secondary/meta text, ~40 call sites', () => {
    expect(TYPE.caption.cssText).toBe('font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);');
  });

  it('locks the eyebrow role — uppercase section/field labels', () => {
    expect(TYPE.eyebrow.cssText).toBe('font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);');
  });

  it('locks the body role — primary body copy', () => {
    expect(TYPE.body.cssText).toBe('font: 400 14px/20px var(--ql-font-body, Outfit, sans-serif);');
  });

  it('locks the title role — card/section titles', () => {
    expect(TYPE.title.cssText).toBe('font: 500 16px/22px var(--ql-font-body, Outfit, sans-serif);');
  });

  it('locks the numeral role — base dial/value numeral', () => {
    expect(TYPE.numeral.cssText).toBe('font: 300 26px/30px var(--ql-font-body, Outfit, sans-serif);');
  });

  it('locks the numeralXl role — larger numeral tier', () => {
    expect(TYPE.numeralXl.cssText).toBe('font: 300 44px/48px var(--ql-font-body, Outfit, sans-serif);');
  });

  it('locks the numeralXxl role — largest numeral tier', () => {
    expect(TYPE.numeralXxl.cssText).toBe('font: 200 56px/60px var(--ql-font-body, Outfit, sans-serif);');
  });

  it('locks the display role — Marcellus display heading', () => {
    expect(TYPE.display.cssText).toBe('font: 400 34px/40px var(--ql-font-display, Marcellus, serif);');
  });

  it('locks the displaySmall role — smaller Marcellus display heading', () => {
    expect(TYPE.displaySmall.cssText).toBe('font: 400 24px/30px var(--ql-font-display, Marcellus, serif);');
  });

  it('exposes every role as a Lit CSSResult, not a raw string', () => {
    for (const value of Object.values(TYPE)) {
      expect(typeof value.cssText).toBe('string');
      expect(value.toString()).toBe(value.cssText);
    }
  });
});
