import { describe, expect, it } from 'vitest';
import { COLORS, DARK_COLORS, DIMENSIONS, LIGHT_COLORS } from './palette';

describe('color palettes', () => {
  it('locks the exact light-mode values from the Figma token reference', () => {
    expect(LIGHT_COLORS).toEqual({
      bgBase: '#F4F0E8',
      bgGlowCenter: '#FFFDF4',
      bgVignette: 'rgba(26, 18, 9, 0.08)',
      surfaceCard: '#FDFBF6',
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
    });
  });

  it('locks the exact dark-mode values from the Figma token reference', () => {
    expect(DARK_COLORS).toEqual({
      bgBase: '#161310',
      bgGlowCenter: '#2E261A',
      bgVignette: 'rgba(26, 18, 9, 0.08)',
      surfaceCard: 'rgba(255, 250, 240, 0.055)',
      surfaceInset: '#23201C',
      surfaceBorder: 'rgba(237, 230, 216, 0.10)',
      inkPrimary: '#EDE6D8',
      inkMuted: '#A29C8E',
      accentChampagne: '#C9A86A',
      accentChampagneText: '#C9A86A',
      statusGood: '#93A183',
      statusGoodText: '#93A183',
      statusWarn: '#D09A6A',
      statusWarnText: '#D09A6A',
      statusAlert: '#C07A6E',
      glowLampInner: '#FFE3A6',
      glowLampOuter: '#C98F3E',
    });
  });

  it('has identical token keys in both modes (mode completeness)', () => {
    expect(Object.keys(COLORS.dark).sort()).toEqual(Object.keys(COLORS.light).sort());
  });

  it.each(['light', 'dark'] as const)(
    'resolves every contrast-remediation token in %s mode',
    (mode) => {
      const c = COLORS[mode];
      for (const key of [
        'surfaceInset',
        'accentChampagneText',
        'statusGoodText',
        'statusWarnText',
      ] as const) {
        expect(c[key]).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    },
  );

  it('keeps surfaceInset opaque in dark mode so nested surfaces stop compounding', () => {
    // surfaceCard is a translucent tint in dark: nesting it inside another card
    // renders lighter at every level, which is what dragged muted text under the
    // floor. surfaceInset is the opaque resolution of one card layer over bgBase.
    expect(DARK_COLORS.surfaceCard).toContain('rgba');
    expect(DARK_COLORS.surfaceInset).toBe('#23201C');
    // Light-mode cards are already opaque, so an inset surface is the same colour.
    expect(LIGHT_COLORS.surfaceInset).toBe(LIGHT_COLORS.surfaceCard);
  });

  it('gives each mode its own inkMuted', () => {
    expect(LIGHT_COLORS.inkMuted).not.toBe(DARK_COLORS.inkMuted);
  });

  it('darkens the text siblings in light mode and leaves them at the base hue in dark', () => {
    // Light: the base hues only clear 3:1, so the text siblings must differ.
    expect(LIGHT_COLORS.accentChampagneText).not.toBe(LIGHT_COLORS.accentChampagne);
    expect(LIGHT_COLORS.statusGoodText).not.toBe(LIGHT_COLORS.statusGood);
    expect(LIGHT_COLORS.statusWarnText).not.toBe(LIGHT_COLORS.statusWarn);
    // Dark: the base hues already clear 4.5:1, so the sibling is deliberately
    // identical — call sites never need a mode conditional.
    expect(DARK_COLORS.accentChampagneText).toBe(DARK_COLORS.accentChampagne);
    expect(DARK_COLORS.statusGoodText).toBe(DARK_COLORS.statusGood);
    expect(DARK_COLORS.statusWarnText).toBe(DARK_COLORS.statusWarn);
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
