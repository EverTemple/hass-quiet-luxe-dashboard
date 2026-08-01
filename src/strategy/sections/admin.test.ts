import { describe, expect, it } from 'vitest';
import { makeContext } from '../../testing/mock-registry';
import { adminSection } from './admin';

const adminHome = {
  admin_flows: [
    { entity: 'switch.nr_guest_wifi', name: 'Guest Wi-Fi', description: 'UniFi guest network' },
  ],
};

describe('adminSection', () => {
  it('emits one network-flow row per configured flow', () => {
    const section = adminSection(makeContext({ home: adminHome }));
    expect(section?.cards[1]).toEqual({
      type: 'custom:ql-row-network-flow',
      entity: 'switch.nr_guest_wifi',
      name: 'Guest Wi-Fi',
      description: 'UniFi guest network',
    });
  });

  it('returns null without configured flows', () => {
    expect(adminSection(makeContext({}))).toBeNull();
  });

  it('is admin-only regardless of config (defense-in-depth)', () => {
    expect(adminSection(makeContext({ home: adminHome, tier: 'family' }))).toBeNull();
    expect(adminSection(makeContext({ home: adminHome, tier: 'guest' }))).toBeNull();
  });
});
