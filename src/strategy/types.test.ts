import { describe, expect, it } from 'vitest';
import { isSection, PATHS, roomPath } from './types';

describe('strategy types helpers', () => {
  it('builds room view paths from area ids', () => {
    expect(roomPath('main_living')).toBe('room-main_living');
  });

  it('exposes the fixed domain view paths', () => {
    expect(PATHS).toEqual({
      home: 'home',
      media: 'media',
      security: 'security',
      energy: 'energy',
      climates: 'climates',
      car: 'car',
      admin: 'admin',
      language: 'language',
    });
  });

  it('isSection narrows away nulls', () => {
    const sections = [{ type: 'grid' as const, cards: [] }, null].filter(isSection);
    expect(sections).toEqual([{ type: 'grid', cards: [] }]);
  });
});
