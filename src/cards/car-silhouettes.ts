export type CarBrand = 'bmw' | 'audi' | 'liauto';

export const CAR_VIEWBOX = '0 0 240 84';

export interface CarWheel {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

/**
 * Hand-drawn side-profile silhouettes (Figma `card/car` cutout heroes),
 * ink-colored via currentColor. Left = front. Wheel arches are upward
 * semicircular arcs; wheels are solid circles beneath them.
 * bmw = low sedan, audi = sloped sportback, liauto = tall L7-style SUV.
 */
export const CAR_BODY_PATHS: Readonly<Record<CarBrand, string>> = {
  bmw: 'M16 63 C11 63 8 59 9 54 C10 47 18 44 30 42 L48 39 C62 27 80 21 102 21 L126 21 C148 21 164 27 178 38 L206 42 C221 45 231 49 231 56 C231 61 227 63 222 63 L204 63 A15 15 0 0 1 174 63 L84 63 A15 15 0 0 1 54 63 Z',
  audi: 'M16 63 C11 63 8 59 9 54 C10 47 18 44 32 42 L52 39 C66 26 86 20 106 20 L120 20 C146 20 168 29 184 41 L208 45 C222 47 231 51 231 57 C231 61 227 63 222 63 L204 63 A15 15 0 0 1 174 63 L84 63 A15 15 0 0 1 54 63 Z',
  liauto:
    'M14 64 C9 64 7 60 8 55 C9 48 16 45 28 43 L40 40 C50 24 68 16 94 15 L140 15 C164 15 180 23 194 37 L212 43 C225 46 232 50 232 57 C232 62 228 64 223 64 L205 64 A16 16 0 0 1 173 64 L85 64 A16 16 0 0 1 53 64 Z',
};

export const CAR_WHEELS: Readonly<Record<CarBrand, ReadonlyArray<CarWheel>>> = {
  bmw: [
    { cx: 69, cy: 63, r: 10 },
    { cx: 189, cy: 63, r: 10 },
  ],
  audi: [
    { cx: 69, cy: 63, r: 10 },
    { cx: 189, cy: 63, r: 10 },
  ],
  liauto: [
    { cx: 69, cy: 64, r: 11 },
    { cx: 189, cy: 64, r: 11 },
  ],
};
