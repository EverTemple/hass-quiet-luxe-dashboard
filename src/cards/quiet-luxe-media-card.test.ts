import { describe, expect, it } from 'vitest';
import { makeEntity, makeMockHass, type MockHass } from '../testing/mock-hass';
import { QuietLuxeMediaCard, type MediaCardConfig } from './quiet-luxe-media-card';

function playingSonos(): ReturnType<typeof makeEntity> {
  return makeEntity('media_player.living', 'playing', {
    friendly_name: 'Living Sonos',
    media_title: 'So What',
    media_artist: 'Miles Davis',
    media_album_name: 'Kind of Blue',
    source: 'Spotify',
    volume_level: 0.34,
    entity_picture: '/api/media_player_proxy/media_player.living?token=art',
    group_members: ['media_player.living', 'media_player.kitchen'],
  });
}

async function mount(
  config: Omit<MediaCardConfig, 'type'>,
  hass: MockHass,
): Promise<QuietLuxeMediaCard> {
  const card = document.createElement('quiet-luxe-media-card') as QuietLuxeMediaCard;
  card.setConfig({ type: 'custom:quiet-luxe-media-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

describe('quiet-luxe-media-card', () => {
  it('is registered and listed in window.customCards', () => {
    expect(customElements.get('quiet-luxe-media-card')).toBe(QuietLuxeMediaCard);
    const entry = (window.customCards ?? []).find((c) => c.type === 'quiet-luxe-media-card');
    expect(entry?.name).toBe('Quiet Luxe Media Card');
  });

  it('setConfig validates entity and group-row leader', () => {
    const card = new QuietLuxeMediaCard();
    expect(() => card.setConfig({ type: 'x', entity: '' })).toThrow('"entity" is required');
    expect(() =>
      card.setConfig({ type: 'x', entity: 'media_player.kitchen', form: 'group-row' }),
    ).toThrow('group-row requires "leader"');
  });

  it('player form renders track, artist line, source and artwork', async () => {
    const card = await mount({ entity: 'media_player.living' }, makeMockHass([playingSonos()]));
    const text = card.shadowRoot?.textContent ?? '';
    expect(text).toContain('So What');
    expect(text).toContain('Miles Davis — Kind of Blue');
    expect(text).toContain('Spotify');
    expect(card.shadowRoot?.querySelector('img.art')?.getAttribute('src')).toBe(
      '/api/media_player_proxy/media_player.living?token=art',
    );
    card.remove();
  });

  it('shows the localized idle line when nothing is playing', async () => {
    const idle = makeEntity('media_player.living', 'idle', { friendly_name: 'Living Sonos' });
    const en = await mount({ entity: 'media_player.living', form: 'bar' }, makeMockHass([idle]));
    expect(en.shadowRoot?.textContent).toContain('Nothing playing');
    en.remove();
    const zh = await mount(
      { entity: 'media_player.living', form: 'bar' },
      makeMockHass([idle], 'zh-Hant'),
    );
    expect(zh.shadowRoot?.textContent).toContain('未在播放');
    zh.remove();
  });

  it('transport buttons call media_player services', async () => {
    const hass = makeMockHass([playingSonos()]);
    const card = await mount({ entity: 'media_player.living' }, hass);
    card.shadowRoot?.querySelector<HTMLButtonElement>('button.play')?.click();
    card.shadowRoot?.querySelector<HTMLButtonElement>('button.next')?.click();
    card.shadowRoot?.querySelector<HTMLButtonElement>('button.previous')?.click();
    expect(hass.calls).toEqual([
      {
        domain: 'media_player',
        service: 'media_play_pause',
        data: { entity_id: 'media_player.living' },
      },
      {
        domain: 'media_player',
        service: 'media_next_track',
        data: { entity_id: 'media_player.living' },
      },
      {
        domain: 'media_player',
        service: 'media_previous_track',
        data: { entity_id: 'media_player.living' },
      },
    ]);
    card.remove();
  });

  it('volume slider commit calls volume_set with a 0..1 level', async () => {
    const hass = makeMockHass([playingSonos()]);
    const card = await mount({ entity: 'media_player.living' }, hass);
    card.shadowRoot
      ?.querySelector('ql-slider')
      ?.dispatchEvent(
        new CustomEvent('ql-change', { detail: { value: 60 }, bubbles: true, composed: true }),
      );
    expect(hass.calls).toEqual([
      {
        domain: 'media_player',
        service: 'volume_set',
        data: { entity_id: 'media_player.living', volume_level: 0.6 },
      },
    ]);
    card.remove();
  });

  it('group-row join toggle calls join on the leader and unjoin on the speaker', async () => {
    const hass = makeMockHass([
      playingSonos(),
      makeEntity('media_player.kitchen', 'playing', { friendly_name: 'Kitchen Sonos' }),
      makeEntity('media_player.study', 'idle', { friendly_name: 'Study Sonos' }),
    ]);
    const joined = await mount(
      { entity: 'media_player.kitchen', form: 'group-row', leader: 'media_player.living' },
      hass,
    );
    const joinedToggle = joined.shadowRoot?.querySelector<
      HTMLElement & { checked: boolean }
    >('ql-toggle');
    expect(joinedToggle?.checked).toBe(true);
    joinedToggle?.dispatchEvent(
      new CustomEvent('ql-change', { detail: { checked: false }, bubbles: true, composed: true }),
    );
    const unjoined = await mount(
      { entity: 'media_player.study', form: 'group-row', leader: 'media_player.living' },
      hass,
    );
    const unjoinedToggle = unjoined.shadowRoot?.querySelector<
      HTMLElement & { checked: boolean }
    >('ql-toggle');
    expect(unjoinedToggle?.checked).toBe(false);
    unjoinedToggle?.dispatchEvent(
      new CustomEvent('ql-change', { detail: { checked: true }, bubbles: true, composed: true }),
    );
    expect(hass.calls).toEqual([
      { domain: 'media_player', service: 'unjoin', data: { entity_id: 'media_player.kitchen' } },
      {
        domain: 'media_player',
        service: 'join',
        data: { entity_id: 'media_player.living', group_members: ['media_player.study'] },
      },
    ]);
    joined.remove();
    unjoined.remove();
  });

  it('unavailable entity renders muted with disabled transport', async () => {
    const hass = makeMockHass([makeEntity('media_player.living', 'unavailable')]);
    const card = await mount({ entity: 'media_player.living' }, hass);
    expect(card.shadowRoot?.querySelector('.ql-unavailable')).not.toBeNull();
    expect(card.shadowRoot?.textContent).toContain('Unavailable');
    expect(card.shadowRoot?.querySelector<HTMLButtonElement>('button.play')?.disabled).toBe(true);
    card.remove();
  });

  it('player track lines open HA’s more-info dialog for the player', async () => {
    const card = await mount({ entity: 'media_player.living' }, makeMockHass([playingSonos()]));
    const seen: Array<CustomEvent<{ entityId: string }>> = [];
    const record = (event: Event): void => {
      seen.push(event as CustomEvent<{ entityId: string }>);
    };
    document.body.addEventListener('hass-more-info', record);
    card.shadowRoot?.querySelector<HTMLButtonElement>('.ql-info')?.click();
    document.body.removeEventListener('hass-more-info', record);
    expect(seen.map((event) => event.detail.entityId)).toEqual(['media_player.living']);
    expect(seen[0]?.bubbles).toBe(true);
    expect(seen[0]?.composed).toBe(true);
    card.remove();
  });

  it('group-row name opens more-info for the speaker, not the leader', async () => {
    const hass = makeMockHass([
      playingSonos(),
      makeEntity('media_player.kitchen', 'playing', { friendly_name: 'Kitchen Sonos' }),
    ]);
    const row = await mount(
      { entity: 'media_player.kitchen', form: 'group-row', leader: 'media_player.living' },
      hass,
    );
    const seen: string[] = [];
    const record = (event: Event): void => {
      seen.push((event as CustomEvent<{ entityId: string }>).detail.entityId);
    };
    document.body.addEventListener('hass-more-info', record);
    row.shadowRoot?.querySelector<HTMLButtonElement>('.ql-info')?.click();
    document.body.removeEventListener('hass-more-info', record);
    expect(seen).toEqual(['media_player.kitchen']);
    expect(hass.calls).toEqual([]);
    row.remove();
  });
});
