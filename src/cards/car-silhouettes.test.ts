import { describe, expect, it } from 'vitest';
import { CAR_BODY_PATHS, CAR_VIEWBOX, CAR_WHEELS, type CarBrand } from './car-silhouettes';

const BRANDS: ReadonlyArray<CarBrand> = ['bmw', 'audi', 'liauto'];

describe('car silhouettes', () => {
  it('provides a closed path and two wheels per brand in the shared viewBox', () => {
    expect(CAR_VIEWBOX).toBe('0 0 240 84');
    for (const brand of BRANDS) {
      expect(CAR_BODY_PATHS[brand].startsWith('M')).toBe(true);
      expect(CAR_BODY_PATHS[brand].endsWith('Z')).toBe(true);
      expect(CAR_WHEELS[brand]).toHaveLength(2);
    }
  });

  it('keeps the three silhouettes distinct', () => {
    expect(new Set(BRANDS.map((brand) => CAR_BODY_PATHS[brand])).size).toBe(3);
  });
});
