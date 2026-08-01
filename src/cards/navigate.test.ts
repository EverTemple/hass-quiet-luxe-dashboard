import { afterEach, describe, expect, it, vi } from 'vitest';
import { navigate } from './navigate';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('navigate', () => {
  it('pushes the path and fires location-changed for the HA router', () => {
    const push = vi.spyOn(history, 'pushState').mockImplementation(() => undefined);
    let detail: unknown;
    const listener = (e: Event): void => {
      detail = (e as CustomEvent).detail;
    };
    window.addEventListener('location-changed', listener);
    navigate('/quiet-luxe/living');
    window.removeEventListener('location-changed', listener);
    expect(push).toHaveBeenCalledWith(null, '', '/quiet-luxe/living');
    expect(detail).toEqual({ replace: false });
  });
});
