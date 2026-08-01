import type { ColorTokens, DimensionTokens, ThemeMode } from './types';

export const LIGHT_COLORS: ColorTokens = {
  bgBase: '#F4F0E8',
  bgGlowCenter: '#FFFDF4',
  bgVignette: 'rgba(26, 18, 9, 0.08)',
  surfaceCard: '#FDFBF6',
  surfaceBorder: '#E4DCCB',
  inkPrimary: '#2B2620',
  inkMuted: '#8C8578',
  accentChampagne: '#B08D57',
  statusGood: '#7E8B6F',
  statusWarn: '#C08552',
  statusAlert: '#A85B4E',
  glowLampInner: '#FFD98A',
  glowLampOuter: '#E0B263',
};

export const DARK_COLORS: ColorTokens = {
  bgBase: '#161310',
  bgGlowCenter: '#2E261A',
  bgVignette: 'rgba(26, 18, 9, 0.08)',
  surfaceCard: 'rgba(255, 250, 240, 0.055)',
  surfaceBorder: 'rgba(237, 230, 216, 0.10)',
  inkPrimary: '#EDE6D8',
  inkMuted: '#8A8172',
  accentChampagne: '#C9A86A',
  statusGood: '#93A183',
  statusWarn: '#D09A6A',
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
