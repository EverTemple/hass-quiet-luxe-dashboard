import { describe, expect, it } from 'vitest';
import {
  FONT_BODY_STACK,
  FONT_BODY_STACK_HANS,
  FONT_DISPLAY_STACK,
  FONT_DISPLAY_STACK_HANS,
} from './font-stacks';

const STACKS = {
  FONT_DISPLAY_STACK,
  FONT_BODY_STACK,
  FONT_DISPLAY_STACK_HANS,
  FONT_BODY_STACK_HANS,
} as const;

describe('font stacks', () => {
  it('leads with the inlined Latin webfont', () => {
    expect(FONT_DISPLAY_STACK.startsWith('Marcellus,')).toBe(true);
    expect(FONT_DISPLAY_STACK_HANS.startsWith('Marcellus,')).toBe(true);
    expect(FONT_BODY_STACK.startsWith('Outfit,')).toBe(true);
    expect(FONT_BODY_STACK_HANS.startsWith('Outfit,')).toBe(true);
  });

  it('prefers the optional Noto CJK webfonts before system fonts', () => {
    expect(FONT_BODY_STACK.indexOf("'Noto Sans TC'")).toBeLessThan(
      FONT_BODY_STACK.indexOf("'PingFang TC'"),
    );
    expect(FONT_DISPLAY_STACK.indexOf("'Noto Serif TC'")).toBeLessThan(
      FONT_DISPLAY_STACK.indexOf("'Songti TC'"),
    );
  });

  it.each([
    [
      'FONT_BODY_STACK',
      // PingFang HK carries the Hong Kong character shapes (Tung Chung).
      ["'PingFang TC'", "'PingFang HK'", "'Microsoft JhengHei'", "'Noto Sans CJK TC'"],
    ],
    ['FONT_BODY_STACK_HANS', ["'PingFang SC'", "'Microsoft YaHei'", "'Noto Sans CJK SC'"]],
    ['FONT_DISPLAY_STACK', ["'Songti TC'", "'Noto Serif CJK TC'", "'PMingLiU'"]],
    ['FONT_DISPLAY_STACK_HANS', ["'Songti SC'", "'Noto Serif CJK SC'", "'SimSun'"]],
  ] as const)('names CJK system fonts in %s', (name, families) => {
    for (const family of families) {
      expect(STACKS[name]).toContain(family);
    }
  });

  it('covers both scripts in every stack and ends with a generic family', () => {
    for (const [name, stack] of Object.entries(STACKS)) {
      expect(stack, name).toContain('TC');
      expect(stack, name).toContain('SC');
      expect(stack.endsWith('serif') || stack.endsWith('sans-serif'), name).toBe(true);
    }
  });

  it('puts the matching script first in the Simplified variants', () => {
    expect(FONT_BODY_STACK_HANS.indexOf('SC')).toBeLessThan(FONT_BODY_STACK_HANS.indexOf('TC'));
    expect(FONT_DISPLAY_STACK_HANS.indexOf('SC')).toBeLessThan(
      FONT_DISPLAY_STACK_HANS.indexOf('TC'),
    );
  });
});
