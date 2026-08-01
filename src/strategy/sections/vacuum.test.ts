import { describe, expect, it } from 'vitest';
import { makeEntity } from '../../testing/mock-hass';
import { makeContext, mockRegEntity } from '../../testing/mock-registry';
import { vacuumSection } from './vacuum';

const snapshot = {
  areas: [],
  devices: [],
  entities: [mockRegEntity('vacuum.dreame_x30', { platform: 'dreame_vacuum' })],
};
const entities = [makeEntity('vacuum.dreame_x30', 'docked')];

describe('vacuumSection', () => {
  it('emits the vacuum card when the flag is on and a vacuum exists', () => {
    const section = vacuumSection(makeContext({ home: { vacuum: true }, snapshot, entities }));
    expect(section?.cards[1]).toEqual({
      type: 'custom:quiet-luxe-vacuum-card',
      entity: 'vacuum.dreame_x30',
    });
  });

  it('returns null when the flag is off', () => {
    expect(vacuumSection(makeContext({ snapshot, entities }))).toBeNull();
  });

  it('returns null when the flag is on but no vacuum entity exists (spec §8)', () => {
    expect(vacuumSection(makeContext({ home: { vacuum: true } }))).toBeNull();
  });
});
