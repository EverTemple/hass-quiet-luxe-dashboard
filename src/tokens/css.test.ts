import { describe, expect, it } from 'vitest';
import { colorCssVariables, cssVariableBlock, dimensionCssVariables } from './css';

describe('colorCssVariables', () => {
  it('maps every light token to a --ql-* kebab-case variable with the exact value', () => {
    const vars = colorCssVariables('light');
    expect(vars['--ql-bg-base']).toBe('#F4F0E8');
    expect(vars['--ql-bg-glow-center']).toBe('#FFFDF4');
    expect(vars['--ql-surface-card']).toBe('#FDFBF6');
    expect(vars['--ql-ink-primary']).toBe('#2B2620');
    expect(vars['--ql-accent-champagne']).toBe('#B08D57');
    expect(Object.keys(vars)).toHaveLength(13);
  });

  it('maps dark tokens with the exact dark values', () => {
    const vars = colorCssVariables('dark');
    expect(vars['--ql-bg-glow-center']).toBe('#2E261A');
    expect(vars['--ql-surface-card']).toBe('rgba(255, 250, 240, 0.055)');
    expect(vars['--ql-status-alert']).toBe('#C07A6E');
  });
});

describe('dimensionCssVariables', () => {
  it('emits px-suffixed values', () => {
    const vars = dimensionCssVariables();
    expect(vars['--ql-radius-card']).toBe('18px');
    expect(vars['--ql-space-xl']).toBe('24px');
    expect(vars['--ql-touch-min']).toBe('56px');
    expect(Object.keys(vars)).toHaveLength(9);
  });
});

describe('cssVariableBlock', () => {
  it('renders declaration lines for a mode including dimensions', () => {
    const block = cssVariableBlock('light');
    expect(block).toContain('--ql-bg-base: #F4F0E8;');
    expect(block).toContain('--ql-radius-chip: 999px;');
  });
});
