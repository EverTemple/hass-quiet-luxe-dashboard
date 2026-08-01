import { describe, expect, it } from 'vitest';
import { COLORS, DARK_COLORS, DIMENSIONS, LIGHT_COLORS } from './palette';

describe('color palettes', () => {
  it('locks the exact light-mode values from the Figma token reference', () => {
    expect(LIGHT_COLORS).toEqual({
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
    });
  });

  it('locks the exact dark-mode values from the Figma token reference', () => {
    expect(DARK_COLORS).toEqual({
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
    });
  });

  it('has identical token keys in both modes (mode completeness)', () => {
    expect(Object.keys(COLORS.dark).sort()).toEqual(Object.keys(COLORS.light).sort());
  });
});

describe('dimension tokens', () => {
  it('locks the exact dimension values', () => {
    expect(DIMENSIONS).toEqual({
      radiusCard: 18,
      radiusChip: 999,
      radiusThumb: 12,
      spaceXs: 4,
      spaceS: 8,
      spaceM: 12,
      spaceL: 16,
      spaceXl: 24,
      touchMin: 56,
    });
  });
});
