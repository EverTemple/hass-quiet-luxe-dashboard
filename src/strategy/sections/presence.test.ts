import { describe, expect, it } from 'vitest';
import { makeEntity } from '../../testing/mock-hass';
import { makeContext, mockRegEntity } from '../../testing/mock-registry';
import { presenceSection } from './presence';

describe('presenceSection', () => {
  it('emits a single presence row over all person entities', () => {
    const ctx = makeContext({
      snapshot: {
        areas: [],
        devices: [],
        entities: [mockRegEntity('person.mei'), mockRegEntity('person.steven')],
      },
      entities: [makeEntity('person.mei', 'home'), makeEntity('person.steven', 'not_home')],
    });
    const section = presenceSection(ctx);
    expect(section?.cards[0]).toEqual({ type: 'heading', heading: 'Presence' });
    expect(section?.cards[1]).toEqual({
      type: 'custom:ql-row-presence',
      entities: ['person.mei', 'person.steven'],
    });
  });

  it('returns null when there are no person entities', () => {
    expect(presenceSection(makeContext({}))).toBeNull();
  });
});
