import { describe, expect, it } from 'vitest';
import { makeEntity } from '../../testing/mock-hass';
import { makeContext, mockRegEntity } from '../../testing/mock-registry';
import { mediaSection, mediaViewSections, orderedPlayers, sonosGroupRows } from './media';

const snapshot = {
  areas: [],
  devices: [],
  entities: [
    mockRegEntity('media_player.bedroom_sonos', { platform: 'sonos' }),
    mockRegEntity('media_player.living_sonos', { platform: 'sonos' }),
    mockRegEntity('media_player.tv', { platform: 'samsungtv' }),
  ],
};
const entities = [
  makeEntity('media_player.bedroom_sonos', 'idle'),
  makeEntity('media_player.living_sonos', 'playing'),
  makeEntity('media_player.tv', 'off'),
];

describe('orderedPlayers / mediaSection', () => {
  it('puts playing players first and emits the collapsed bar for the hero', () => {
    const ctx = makeContext({ snapshot, entities });
    expect(orderedPlayers(ctx)[0]).toBe('media_player.living_sonos');
    const section = mediaSection(ctx);
    expect(section?.cards[1]).toEqual({
      type: 'custom:quiet-luxe-media-card',
      entity: 'media_player.living_sonos',
      form: 'bar',
    });
    expect(section?.cards[0]).toMatchObject({
      tap_action: { action: 'navigate', navigation_path: '/quiet-luxe/media' },
    });
  });

  it('returns null when the home has no media players', () => {
    expect(mediaSection(makeContext({}))).toBeNull();
  });
});

describe('sonosGroupRows / mediaViewSections', () => {
  it('builds group rows for every Sonos speaker with the hero as leader', () => {
    const ctx = makeContext({ home: { media_rich: true }, snapshot, entities });
    expect(sonosGroupRows(ctx)).toEqual([
      {
        type: 'custom:quiet-luxe-media-card',
        entity: 'media_player.living_sonos',
        form: 'group-row',
        leader: 'media_player.living_sonos',
      },
      {
        type: 'custom:quiet-luxe-media-card',
        entity: 'media_player.bedroom_sonos',
        form: 'group-row',
        leader: 'media_player.living_sonos',
      },
    ]);
  });

  it('media view: hero player + speakers; group builder only when media_rich', () => {
    const rich = mediaViewSections(makeContext({ home: { media_rich: true }, snapshot, entities }));
    expect(rich).toHaveLength(3);
    expect(rich[0]?.cards[1]).toMatchObject({ form: 'player' });
    const plain = mediaViewSections(makeContext({ snapshot, entities }));
    expect(plain).toHaveLength(2);
    expect(mediaViewSections(makeContext({}))).toEqual([]);
  });

  it('needs at least two Sonos speakers for group rows', () => {
    const ctx = makeContext({
      home: { media_rich: true },
      snapshot: { areas: [], devices: [], entities: [mockRegEntity('media_player.solo', { platform: 'sonos' })] },
      entities: [makeEntity('media_player.solo', 'idle')],
    });
    expect(sonosGroupRows(ctx)).toEqual([]);
  });
});
