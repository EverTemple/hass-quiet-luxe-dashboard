import type { ColorTokens, DimensionTokens, ThemeMode } from './types';

// Text-only siblings (`*Text`) exist because the accent and status hues clear the
// 3:1 non-text floor as fills and borders but not the 4.5:1 floor as small text.
// Fills keep the base hue; only text switches to the darker/lighter sibling.
export const LIGHT_COLORS: ColorTokens = {
  bgBase: '#F4F0E8',
  bgGlowCenter: '#FFFDF4',
  bgVignette: 'rgba(26, 18, 9, 0.08)',
  surfaceCard: '#FDFBF6',
  // Identical to surfaceCard in light mode: the card is already opaque, so nesting
  // one surface inside another does not change the rendered backdrop.
  surfaceInset: '#FDFBF6',
  surfaceBorder: '#E4DCCB',
  inkPrimary: '#2B2620',
  inkMuted: '#736D63',
  accentChampagne: '#B08D57',
  accentChampagneText: '#846A41',
  statusGood: '#7E8B6F',
  statusGoodText: '#67715B',
  statusWarn: '#C08552',
  statusWarnText: '#91643E',
  statusAlert: '#A85B4E',
  glowLampInner: '#FFD98A',
  glowLampOuter: '#E0B263',
};

export const DARK_COLORS: ColorTokens = {
  bgBase: '#161310',
  bgGlowCenter: '#2E261A',
  bgVignette: 'rgba(26, 18, 9, 0.08)',
  surfaceCard: 'rgba(255, 250, 240, 0.055)',
  // Opaque on purpose: surfaceCard is a translucent tint, so nesting one card
  // inside another compounds the tints and each level renders lighter, dragging
  // muted text below the contrast floor. This is the value one surfaceCard layer
  // over bgBase resolves to, so an inset surface reads identically without
  // compounding when it nests.
  surfaceInset: '#23201C',
  surfaceBorder: 'rgba(237, 230, 216, 0.10)',
  inkPrimary: '#EDE6D8',
  inkMuted: '#A29C8E',
  accentChampagne: '#C9A86A',
  // The dark text variants deliberately equal their base hue: those already clear
  // 4.5:1 against the dark surfaces. Keeping the token means call sites never need
  // a mode conditional.
  accentChampagneText: '#C9A86A',
  statusGood: '#93A183',
  statusGoodText: '#93A183',
  statusWarn: '#D09A6A',
  statusWarnText: '#D09A6A',
  statusAlert: '#C07A6E',
  glowLampInner: '#FFE3A6',
  glowLampOuter: '#C98F3E',
};

export const COLORS: Readonly<Record<ThemeMode, ColorTokens>> = {
  light: LIGHT_COLORS,
  dark: DARK_COLORS,
};

export const DIMENSIONS: DimensionTokens = {
  radiusCard: 18,
  radiusChip: 999,
  radiusThumb: 12,
  spaceXs: 4,
  spaceS: 8,
  spaceM: 12,
  spaceL: 16,
  spaceXl: 24,
  touchMin: 56,
};

export const SHADOW_CARD_LIGHT = '0 1px 6px rgba(80, 65, 40, 0.08)';
