import { describe, expect, it } from 'vitest';
import { validateHomeConfig } from './config';
import { resolveTier, viewsForTier } from './rbac';
import type { LovelaceViewConfig } from './types';

const home = validateHomeConfig({
  name: 'X',
  users: { family: ['mei'], guests: ['kiosk'] },
});

describe('resolveTier', () => {
  it('is admin for HA admins regardless of lists', () => {
    expect(resolveTier({ id: 'u1', name: 'kiosk', is_admin: true }, home)).toBe('admin');
  });

  it('matches guest and family lists by name (case-insensitive) or id', () => {
    expect(resolveTier({ id: 'u2', name: 'Kiosk', is_admin: false }, home)).toBe('guest');
    expect(resolveTier({ id: 'u3', name: 'Mei', is_admin: false }, home)).toBe('family');
    expect(resolveTier({ id: 'mei', name: 'Other', is_admin: false }, home)).toBe('family');
  });

  it('defaults unknown non-admins and missing users to guest (least privilege, D5)', () => {
    expect(resolveTier({ id: 'u4', name: 'stranger', is_admin: false }, home)).toBe('guest');
    expect(resolveTier(undefined, home)).toBe('guest');
  });
});

describe('viewsForTier', () => {
  const views = ['home', 'media', 'car', 'admin', 'language'].map(
    (path): LovelaceViewConfig => ({
      title: path,
      path,
      type: 'sections',
      sections: [],
    }),
  );

  it('admin keeps everything', () => {
    expect(viewsForTier(views, 'admin').map((view) => view.path)).toEqual([
      'home',
      'media',
      'car',
      'admin',
      'language',
    ]);
  });

  it('family loses admin and car (spec §5, D4)', () => {
    expect(viewsForTier(views, 'family').map((view) => view.path)).toEqual([
      'home',
      'media',
      'language',
    ]);
  });

  it('guest loses admin and car too', () => {
    expect(viewsForTier(views, 'guest').map((view) => view.path)).toEqual([
      'home',
      'media',
      'language',
    ]);
  });
});
