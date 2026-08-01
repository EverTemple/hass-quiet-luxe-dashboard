import { describe, expect, it } from 'vitest';

describe('toolchain smoke', () => {
  it('runs TypeScript tests under happy-dom', () => {
    const el: HTMLDivElement = document.createElement('div');
    el.textContent = 'quiet-luxe';
    expect(el.textContent).toBe('quiet-luxe');
  });
});
