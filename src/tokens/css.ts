import { COLORS, DIMENSIONS } from './palette';
import type { ThemeMode } from './types';

function kebabCase(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

export function colorCssVariables(mode: ThemeMode): Record<string, string> {
  return Object.fromEntries(
    Object.entries(COLORS[mode]).map(([key, value]) => [`--ql-${kebabCase(key)}`, value]),
  );
}

export function dimensionCssVariables(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(DIMENSIONS).map(([key, value]) => [`--ql-${kebabCase(key)}`, `${value}px`]),
  );
}

export function cssVariableBlock(mode: ThemeMode): string {
  const vars = { ...colorCssVariables(mode), ...dimensionCssVariables() };
  return Object.entries(vars)
    .map(([name, value]) => `${name}: ${value};`)
    .join('\n');
}
