export type ThemeMode = 'light' | 'dark';

export interface ColorTokens {
  readonly bgBase: string;
  readonly bgGlowCenter: string;
  readonly bgVignette: string;
  readonly surfaceCard: string;
  readonly surfaceBorder: string;
  readonly inkPrimary: string;
  readonly inkMuted: string;
  readonly accentChampagne: string;
  readonly statusGood: string;
  readonly statusWarn: string;
  readonly statusAlert: string;
  readonly glowLampInner: string;
  readonly glowLampOuter: string;
}

export interface DimensionTokens {
  readonly radiusCard: number;
  readonly radiusChip: number;
  readonly radiusThumb: number;
  readonly spaceXs: number;
  readonly spaceS: number;
  readonly spaceM: number;
  readonly spaceL: number;
  readonly spaceXl: number;
  readonly touchMin: number;
}
