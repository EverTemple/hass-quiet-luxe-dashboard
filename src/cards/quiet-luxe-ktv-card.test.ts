import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QlSegmentOption } from '../elements/ql-segmented';
import { DARK_MODE_ATTRIBUTE } from '../theme/inject-theme';
import { makeEntity, makeMockHass, type MockHass } from '../testing/mock-hass';
import { resetCatalogueCache } from './ktv-catalogue';
import { CATALOGUE_FIELDS } from './ktv-search';
import {
  KTV_ADDED_FEEDBACK_MS,
  KTV_FAILURE_MS,
  KTV_SEARCH_DEBOUNCE_MS,
  KTV_UNDO_MS,
  QuietLuxeKtvCard,
  type KtvCardConfig,
} from './quiet-luxe-ktv-card';

const CATALOGUE_URL = '/local/ktv/catalogue.json?v=abc';

const ROWS = [
  ['1087855', '富士山下', '陈奕迅', '', 2, 'fssx', 'cyx', 999998],
  ['1002001', '十年', '陈奕迅', '', 2, 'sn', 'cyx', 999998],
  ['1000011', '月亮代表我的心', '邓丽君', '', 1, 'yldbwdx', 'dlj', 999000],
  ['1000012', '月亮', '王菲', '', 1, 'yl', 'wf', 999500],
  ['1000013', 'Yesterday', 'The Beatles', '', 4, 'y', 'tb', 999100],
];

function catalogueBody(version = 'abc'): Record<string, unknown> {
  return {
    v: version,
    built: '2026-11-11T00:00:00.000Z',
    langs: { '1': 'Mandarin', '2': 'Cantonese', '4': 'English' },
    fields: [...CATALOGUE_FIELDS],
    rows: ROWS,
  };
}

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as unknown as Response;
}

const QUEUE = [
  { no: '1002001', title: '十年', singer: '陈奕迅' },
  { no: '1000011', title: '月亮代表我的心', singer: '邓丽君' },
  { no: '1000012', title: '月亮', singer: '王菲' },
];

function box(
  state = 'playing',
  attributes: Record<string, unknown> = {},
): ReturnType<typeof makeEntity> {
  return makeEntity('sensor.ktv_box', state, {
    volume: 14,
    vocal: 'backing',
    now_playing: { no: '1087855', title: '富士山下', singer: '陈奕迅' },
    queue: QUEUE,
    queue_count: QUEUE.length,
    catalogue_url: CATALOGUE_URL,
    catalogue_version: 'abc',
    catalogue_error: null,
    ...attributes,
  });
}

async function mount(
  hass: MockHass,
  config: Omit<KtvCardConfig, 'type'> = {},
): Promise<QuietLuxeKtvCard> {
  const card = document.createElement('quiet-luxe-ktv-card') as QuietLuxeKtvCard;
  card.setConfig({ type: 'custom:quiet-luxe-ktv-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

/**
 * Runs every promise continuation that is already due (fetch, parse, service
 * calls), without moving the fake clock, then waits for the re-render.
 */
async function settle(card: QuietLuxeKtvCard): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
  await card.updateComplete;
}

function shadow(card: QuietLuxeKtvCard): ShadowRoot {
  return card.shadowRoot as ShadowRoot;
}

function input(card: QuietLuxeKtvCard): HTMLInputElement {
  return shadow(card).querySelector('input.search-input') as HTMLInputElement;
}

async function type(card: QuietLuxeKtvCard, text: string): Promise<void> {
  const field = input(card);
  field.value = text;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  await card.updateComplete;
  await vi.advanceTimersByTimeAsync(KTV_SEARCH_DEBOUNCE_MS);
  await settle(card);
}

function button(card: QuietLuxeKtvCard, label: string): HTMLButtonElement {
  const found = [...shadow(card).querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.getAttribute('aria-label') === label,
  );
  if (found === undefined) {
    throw new Error(`no button labelled "${label}"`);
  }
  return found;
}

/** The card's one live region: what a screen reader is told. */
function liveText(card: QuietLuxeKtvCard): string {
  const regions = shadow(card).querySelectorAll('[aria-live]');
  expect(regions, 'exactly one live region').toHaveLength(1 + (shadow(card).querySelector('.volume-value') === null ? 0 : 1));
  return shadow(card).querySelector('.sr-only')?.textContent?.trim() ?? '';
}

function resultTitles(card: QuietLuxeKtvCard): string[] {
  return [...shadow(card).querySelectorAll('.results .song-title')].map(
    (node) => node.textContent?.trim() ?? '',
  );
}

function commandValues(hass: MockHass): string[] {
  return hass.calls.map((call) => String(call.data?.value));
}

describe('quiet-luxe-ktv-card', () => {
  let fetchStub: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetCatalogueCache();
    fetchStub = vi.fn().mockImplementation(() => Promise.resolve(okResponse(catalogueBody())));
    vi.stubGlobal('fetch', fetchStub);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetCatalogueCache();
    document.body.replaceChildren();
    document.documentElement.removeAttribute(DARK_MODE_ATTRIBUTE);
  });

  describe('registration and config', () => {
    it('is registered and listed in window.customCards', () => {
      expect(customElements.get('quiet-luxe-ktv-card')).toBe(QuietLuxeKtvCard);
      const entry = (window.customCards ?? []).find((c) => c.type === 'quiet-luxe-ktv-card');
      expect(entry?.name).toBe('Quiet Luxe KTV Card');
    });

    it('setConfig accepts an empty config and rejects non-string ids', () => {
      const card = new QuietLuxeKtvCard();
      expect(() => card.setConfig({ type: 'x' })).not.toThrow();
      expect(() => card.setConfig({ type: 'x', entity: 5 as unknown as string })).toThrow(
        'quiet-luxe-ktv-card: "entity"',
      );
      expect(() => card.setConfig({ type: 'x', entity: '' })).toThrow('"entity"');
      expect(() =>
        card.setConfig({ type: 'x', command_entity: 7 as unknown as string }),
      ).toThrow('"command_entity"');
      expect(() => card.setConfig({ type: 'x', title: 3 as unknown as string })).toThrow('"title"');
    });

    it('lets HA size the card by content, never by a row count', () => {
      const card = new QuietLuxeKtvCard();
      expect(card.getGridOptions()).toEqual({ columns: 12, rows: 'auto' });
      expect(card.getCardSize()).toBeGreaterThan(0);
    });

    it('renders its configured title', async () => {
      const card = await mount(makeMockHass([box()]), { title: 'Karaoke' });
      expect(shadow(card).querySelector('.heading')?.textContent).toBe('Karaoke');
    });

    it('keeps the dark-mode publication of the base class', async () => {
      const hass = makeMockHass([box()]);
      (hass as unknown as { themes: unknown }).themes = { darkMode: true };
      await mount(hass);
      expect(document.documentElement.getAttribute(DARK_MODE_ATTRIBUTE)).toBe('true');
    });
  });

  describe('now playing and transport', () => {
    it('shows the song, the singer, the volume and the vocal mode', async () => {
      const card = await mount(makeMockHass([box()]));
      const text = shadow(card).querySelector('.now')?.textContent ?? '';
      expect(text).toContain('富士山下');
      expect(text).toContain('陈奕迅');
      expect(shadow(card).querySelector('.volume-value')?.textContent).toBe('14');
      const segmented = shadow(card).querySelector('ql-segmented') as HTMLElement & {
        value: string;
        options: ReadonlyArray<QlSegmentOption>;
      };
      expect(segmented.value).toBe('backing');
      expect(segmented.options.map((option) => option.label)).toEqual(['Original', 'Backing']);
    });

    it('says nothing is playing when the box is on but idle', async () => {
      const card = await mount(
        makeMockHass([box('online', { now_playing: null, vocal: null, volume: undefined })]),
      );
      expect(shadow(card).querySelector('.now')?.textContent).toContain('Nothing playing');
      expect(shadow(card).querySelector('.volume-value')?.textContent).toBe('–');
      expect(shadow(card).querySelector('.ql-unavailable')).toBeNull();
    });

    it('pauses while playing and plays while paused', async () => {
      const playing = makeMockHass([box('playing')]);
      const playingCard = await mount(playing);
      button(playingCard, 'Pause').click();
      expect(playing.calls).toHaveLength(1);
      expect(playing.calls[0]).toMatchObject({
        domain: 'text',
        service: 'set_value',
        data: { entity_id: 'text.ktv_command' },
      });
      expect(commandValues(playing)[0]).toMatch(/^pause#[0-9a-z]+$/);

      const paused = makeMockHass([box('paused')]);
      const pausedCard = await mount(paused);
      button(pausedCard, 'Play').click();
      expect(commandValues(paused)[0]).toMatch(/^play#[0-9a-z]+$/);
    });

    it('sends next and the volume steps', async () => {
      const hass = makeMockHass([box()]);
      const card = await mount(hass);
      button(card, 'Next').click();
      button(card, 'Volume up').click();
      button(card, 'Volume down').click();
      expect(commandValues(hass).map((value) => value.split('#')[0])).toEqual([
        'next',
        'volup',
        'voldn',
      ]);
    });

    it('sends the explicit vocal command for the chosen segment', async () => {
      const hass = makeMockHass([box()]);
      const card = await mount(hass);
      const segmented = shadow(card).querySelector('ql-segmented') as HTMLElement;
      const choose = (value: string): void => {
        segmented.dispatchEvent(
          new CustomEvent('ql-change', { detail: { value }, bubbles: true, composed: true }),
        );
      };
      choose('original');
      choose('backing');
      expect(commandValues(hass).map((value) => value.split('#')[0])).toEqual([
        'yuanchang',
        'banchang',
      ]);
    });

    it('gives repeated identical commands different nonces', async () => {
      const hass = makeMockHass([box()]);
      const card = await mount(hass);
      button(card, 'Next').click();
      button(card, 'Next').click();
      const [first, second] = commandValues(hass);
      expect(first).not.toBe(second);
      expect(first?.split('#')[0]).toBe(second?.split('#')[0]);
    });

    it('honours custom entity ids', async () => {
      const hass = makeMockHass([
        makeEntity('sensor.other_box', 'playing', {
          now_playing: { no: '1', title: 'Other song', singer: 'X' },
        }),
      ]);
      const card = await mount(hass, {
        entity: 'sensor.other_box',
        command_entity: 'text.other_cmd',
      });
      expect(shadow(card).querySelector('.now')?.textContent).toContain('Other song');
      button(card, 'Next').click();
      expect(hass.calls[0]?.data?.entity_id).toBe('text.other_cmd');
    });

    it('sends nothing without hass', async () => {
      const card = await mount(makeMockHass([box()]));
      card.hass = undefined;
      await card.updateComplete;
      expect(() => (card as unknown as { onNext(): void }).onNext()).not.toThrow();
    });
  });

  describe('offline', () => {
    it.each(['offline', 'unknown', 'unavailable'])(
      'says the box is off, with a next step, when it is %s',
      async (state) => {
        const hass = makeMockHass([box(state)]);
        const card = await mount(hass);
        const now = shadow(card).querySelector('.now')?.textContent ?? '';
        expect(now).toContain('The KTV box is off');
        expect(now).toContain('Turn on KTV Mode to sing.');
        // Full-contrast ink: nothing on the card is faded.
        expect(shadow(card).querySelector('.ql-unavailable')).toBeNull();
        expect(shadow(card).querySelector('.now-title.muted')).toBeNull();
      },
    );

    it('hides transport, vocal, volume and the eyebrows instead of ghosting them', async () => {
      const hass = makeMockHass([box('offline')]);
      const card = await mount(hass);
      for (const label of ['Play', 'Pause', 'Next', 'Volume up', 'Volume down']) {
        expect(() => button(card, label), label).toThrow();
      }
      expect(shadow(card).querySelector('ql-segmented')).toBeNull();
      expect(shadow(card).querySelector('.volume')).toBeNull();
      expect(shadow(card).querySelector('.now-eyebrow')).toBeNull();
      expect(shadow(card).querySelector('.list-head')).toBeNull();
      expect(shadow(card).querySelector('.queue')?.textContent).toContain(
        'Queue unavailable while the box is off',
      );
      expect(shadow(card).querySelector('.queue .song')).toBeNull();
      expect(hass.calls).toEqual([]);
    });

    it('treats a missing sensor as offline', async () => {
      const card = await mount(makeMockHass([]));
      expect(shadow(card).querySelector('.now')?.textContent).toContain('The KTV box is off');
      expect(shadow(card).querySelector('ql-segmented')).toBeNull();
    });

    it('keeps search usable and disables only the result actions', async () => {
      const hass = makeMockHass([box('offline')]);
      const card = await mount(hass);
      expect(input(card).disabled).toBe(false);
      await type(card, 'yldb');
      expect(resultTitles(card)).toEqual(['月亮代表我的心']);
      const actions = [...shadow(card).querySelectorAll<HTMLButtonElement>('.results button.disc')];
      expect(actions).toHaveLength(2);
      expect(actions.every((action) => action.disabled)).toBe(true);
      actions[1]?.click();
      expect(hass.calls).toEqual([]);
      expect(shadow(card).querySelector('.results .song-title')?.closest('.ql-unavailable')).toBeNull();
    });
  });

  describe('search', () => {
    it('stays lazy until the search field is used', async () => {
      await mount(makeMockHass([box()]));
      expect(fetchStub).not.toHaveBeenCalled();
    });

    it('loads the catalogue on first focus', async () => {
      const card = await mount(makeMockHass([box()]));
      input(card).dispatchEvent(new Event('focus'));
      await settle(card);
      expect(fetchStub).toHaveBeenCalledTimes(1);
      expect(fetchStub.mock.calls[0]?.[0]).toBe(CATALOGUE_URL);
    });

    it('finds a song by pinyin initials after the debounce', async () => {
      const card = await mount(makeMockHass([box()]));
      const field = input(card);
      field.dispatchEvent(new Event('focus'));
      await settle(card);
      field.value = 'yldb';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      await settle(card);
      expect(resultTitles(card)).toEqual([]);
      await vi.advanceTimersByTimeAsync(KTV_SEARCH_DEBOUNCE_MS - 1);
      await card.updateComplete;
      expect(resultTitles(card)).toEqual([]);
      await vi.advanceTimersByTimeAsync(1);
      await settle(card);
      expect(resultTitles(card)).toEqual(['月亮代表我的心']);
      const head = shadow(card).querySelector('.results .list-head');
      expect(head?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Results 1');
      expect(shadow(card).querySelector('.results ul')?.getAttribute('role')).toBe('list');
      expect(liveText(card)).toBe('Results 1');
    });

    it('finds songs by title text and by singer', async () => {
      const card = await mount(makeMockHass([box()]));
      await type(card, '月亮');
      expect(resultTitles(card)).toEqual(['月亮', '月亮代表我的心']);
      await type(card, '陈奕迅');
      expect(resultTitles(card)).toEqual(['十年', '富士山下']);
    });

    it('puts the language in the singer line as text, with no pill', async () => {
      const card = await mount(makeMockHass([box()]));
      await type(card, 'yldb');
      const meta = shadow(card).querySelector('.results .song-meta .singers');
      expect(meta?.textContent?.trim()).toBe('邓丽君 · Mandarin');
      expect(shadow(card).querySelector('.results ql-badge')).toBeNull();
    });

    it('switches the result view in place of the queue while a query is present', async () => {
      const card = await mount(makeMockHass([box()]));
      const layout = shadow(card).querySelector('.layout') as HTMLElement;
      expect(layout.classList.contains('searching')).toBe(false);
      expect(shadow(card).querySelectorAll('.queue .song')).toHaveLength(3);
      await type(card, 'yl');
      expect(layout.classList.contains('searching')).toBe(true);
    });

    it('filters by language and drops the redundant badge', async () => {
      const card = await mount(makeMockHass([box()]));
      await type(card, 'y');
      expect(resultTitles(card).length).toBeGreaterThan(1);
      const chip = (label: string): HTMLElement =>
        [...shadow(card).querySelectorAll<HTMLElement>('.chips ql-chip')].find(
          (candidate) => candidate.textContent?.trim() === label,
        ) as HTMLElement;
      chip('English').click();
      await settle(card);
      expect(resultTitles(card)).toEqual(['Yesterday']);
      expect(shadow(card).querySelector('.results .singers')?.textContent?.trim()).toBe('The Beatles');
      expect(chip('English').hasAttribute('active')).toBe(true);
      expect(chip('All').hasAttribute('active')).toBe(false);
      chip('Cantonese').click();
      await settle(card);
      expect(resultTitles(card)).toEqual(['十年', '富士山下']);
    });

    it('keeps the language in the singer line under the Other filter, which mixes several', async () => {
      fetchStub.mockImplementation(() =>
        Promise.resolve(
          okResponse({
            ...catalogueBody(),
            rows: [
              ['1', 'ありがとう', '谷村新司', '', 5, 'adgt', 'gcxs', 1],
              ['2', '아리랑', '민요', '', 6, 'arr', 'my', 1],
            ],
          }),
        ),
      );
      const card = await mount(makeMockHass([box()]));
      await type(card, '谷村');
      const chip = [...shadow(card).querySelectorAll<HTMLElement>('.chips ql-chip')].find(
        (candidate) => candidate.textContent?.trim() === 'Other',
      ) as HTMLElement;
      chip.click();
      await settle(card);
      expect(shadow(card).querySelector('.results .singers')?.textContent?.trim()).toBe('谷村新司 · Japanese');
    });

    it('explains an empty result with a way forward', async () => {
      const card = await mount(makeMockHass([box()]));
      await type(card, 'qqqq');
      const text = shadow(card).querySelector('.results')?.textContent ?? '';
      expect(text).toContain('No songs match');
      expect(text).toContain('qqqq');
      expect(text).toContain('yldb');
      expect(shadow(card).querySelector('.results .song')).toBeNull();
    });

    it('shows a loading state while the catalogue downloads', async () => {
      let release: (response: Response) => void = () => undefined;
      fetchStub.mockImplementation(
        () => new Promise<Response>((resolve) => (release = resolve)),
      );
      const card = await mount(makeMockHass([box()]));
      await type(card, 'yl');
      expect(shadow(card).querySelector('.results')?.textContent).toContain(
        'Loading the song list',
      );
      expect(shadow(card).querySelector('.results .skeleton')).not.toBeNull();
      release(okResponse(catalogueBody()));
      await settle(card);
      expect(resultTitles(card)).toEqual(['月亮', '月亮代表我的心']);
    });

    it('shows an error with a retry that recovers', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      fetchStub.mockRejectedValueOnce(new TypeError('network down'));
      const card = await mount(makeMockHass([box()]));
      await type(card, 'yldb');
      expect(shadow(card).querySelector('.results')?.textContent).toContain(
        'Couldn’t load the song list.',
      );
      const retry = shadow(card).querySelector('.results ql-chip') as HTMLElement;
      expect(retry.textContent?.trim()).toBe('Try again');
      retry.click();
      await settle(card);
      expect(fetchStub).toHaveBeenCalledTimes(2);
      expect(resultTitles(card)).toEqual(['月亮代表我的心']);
    });

    it('reports a missing catalogue url instead of showing an empty list', async () => {
      const card = await mount(makeMockHass([box('playing', { catalogue_url: undefined })]));
      await type(card, 'yldb');
      expect(shadow(card).querySelector('.results')?.textContent).toContain(
        'Couldn’t load the song list.',
      );
      expect(shadow(card).querySelector('.results ql-chip')).not.toBeNull();
      expect(fetchStub).not.toHaveBeenCalled();
    });

    it('shows the backend’s own reason, without a Retry that cannot succeed', async () => {
      const card = await mount(
        makeMockHass([
          box('playing', { catalogue_url: undefined, catalogue_error: 'Index build failed: box unreachable' }),
        ]),
      );
      await type(card, 'yldb');
      const text = shadow(card).querySelector('.results')?.textContent ?? '';
      expect(text).toContain('Couldn’t load the song list.');
      expect(text).toContain('Index build failed: box unreachable');
      expect(shadow(card).querySelector('.results ql-chip')).toBeNull();
    });

    it('refuses a catalogue url on another origin', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const card = await mount(
        makeMockHass([box('playing', { catalogue_url: 'https://evil.example/c.json' })]),
      );
      await type(card, 'yldb');
      expect(fetchStub).not.toHaveBeenCalled();
      expect(shadow(card).querySelector('.results')?.textContent).toContain(
        'Couldn’t load the song list.',
      );
    });

    it('clears the query from the clear button and restores the queue', async () => {
      const card = await mount(makeMockHass([box()]));
      expect(shadow(card).querySelector('button.clear')).toBeNull();
      await type(card, 'yldb');
      button(card, 'Clear search').click();
      await card.updateComplete;
      expect(input(card).value).toBe('');
      expect(shadow(card).querySelector('.layout')?.classList.contains('searching')).toBe(false);
      expect(shadow(card).querySelector('button.clear')).toBeNull();
    });

    it('clears on Escape', async () => {
      const card = await mount(makeMockHass([box()]));
      await type(card, 'yldb');
      input(card).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await card.updateComplete;
      expect(input(card).value).toBe('');
    });

    it('refetches when the sensor publishes a new catalogue version', async () => {
      const card = await mount(makeMockHass([box()]));
      await type(card, 'yldb');
      expect(fetchStub).toHaveBeenCalledTimes(1);
      fetchStub.mockImplementation(() => Promise.resolve(okResponse(catalogueBody('def'))));
      card.hass = makeMockHass([
        box('playing', { catalogue_version: 'def', catalogue_url: '/local/ktv/catalogue.json?v=def' }),
      ]);
      await settle(card);
      expect(fetchStub).toHaveBeenCalledTimes(2);
      expect(fetchStub.mock.calls[1]?.[0]).toBe('/local/ktv/catalogue.json?v=def');
    });

    it('does not fetch a new version for a card that never searched', async () => {
      const card = await mount(makeMockHass([box()]));
      card.hass = makeMockHass([box('playing', { catalogue_version: 'def' })]);
      await settle(card);
      expect(fetchStub).not.toHaveBeenCalled();
    });
  });

  describe('results header', () => {
    it('reads "50+" when the list hits its cap', async () => {
      const many = Array.from({ length: 80 }, (_, index) => [
        String(2_000_000 + index),
        `歌${String(index)}`,
        '歌手',
        '',
        1,
        'g',
        'gs',
        999000 + index,
      ]);
      fetchStub.mockImplementation(() =>
        Promise.resolve(okResponse({ ...catalogueBody(), rows: many })),
      );
      const card = await mount(makeMockHass([box()]));
      await type(card, '歌');
      expect(shadow(card).querySelectorAll('.results .song')).toHaveLength(50);
      const head = shadow(card).querySelector('.results .list-head');
      expect(head?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Results 50+');
    });

    it('does not say 50+ when exactly the cap matched', async () => {
      const exactly = Array.from({ length: 50 }, (_, index) => [
        String(2_000_000 + index), `歌${String(index)}`, '歌手', '', 1, 'g', 'gs', 999000 + index,
      ]);
      fetchStub.mockImplementation(() =>
        Promise.resolve(okResponse({ ...catalogueBody(), rows: exactly })),
      );
      const card = await mount(makeMockHass([box()]));
      await type(card, '歌');
      const head = shadow(card).querySelector('.results .list-head');
      expect(head?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Results 50');
    });

    it('opens both lists with the same eyebrow header', async () => {
      const card = await mount(makeMockHass([box()]));
      await type(card, '月亮');
      const results = shadow(card).querySelector('.results .list-head');
      const queue = shadow(card).querySelector('.queue .list-head');
      expect(results?.children).toHaveLength(2);
      expect(queue?.children).toHaveLength(2);
      expect([...(results?.children ?? [])].every((node) => node.classList.contains('eyebrow'))).toBe(true);
      expect([...(queue?.children ?? [])].every((node) => node.classList.contains('eyebrow'))).toBe(true);
    });
  });

  describe('what the box says about a result', () => {
    function statusOf(card: QuietLuxeKtvCard, title: string): string | undefined {
      const row = [...shadow(card).querySelectorAll('.results .song')].find(
        (candidate) => candidate.querySelector('.song-title')?.textContent?.trim() === title,
      );
      return row?.querySelector('.status')?.textContent?.replace(/\s+/g, ' ').trim();
    }

    it('marks the song that is playing now', async () => {
      const card = await mount(makeMockHass([box()]));
      await type(card, '富士山下');
      expect(statusOf(card, '富士山下')).toBe('Playing');
    });

    it('marks a queued song with its position from the sensor queue', async () => {
      const card = await mount(makeMockHass([box()]));
      await type(card, '月亮');
      expect(statusOf(card, '月亮代表我的心')).toBe('Queued #2');
      expect(statusOf(card, '月亮')).toBe('Queued #3');
    });

    it('marks nothing for a song the box does not have', async () => {
      const card = await mount(makeMockHass([box()]));
      await type(card, 'yesterday');
      expect(statusOf(card, 'Yesterday')).toBeUndefined();
    });

    it('keeps Add enabled, and follows the sensor rather than the tap', async () => {
      const hass = makeMockHass([box()]);
      const card = await mount(hass);
      await type(card, 'yesterday');
      button(card, 'Yesterday — Add').click();
      await settle(card);
      expect(statusOf(card, 'Yesterday')).toBeUndefined();
      expect(button(card, 'Yesterday — Added').disabled).toBe(false);
      card.hass = makeMockHass([
        box('playing', {
          queue: [...QUEUE, { no: '1000013', title: 'Yesterday', singer: 'The Beatles' }],
        }),
      ]);
      await card.updateComplete;
      expect(statusOf(card, 'Yesterday')).toBe('Queued #4');
      expect(button(card, 'Yesterday — Add to top').disabled).toBe(false);
    });
  });

  describe('adding songs', () => {
    it('Add sends selectsong and shows a check for 1.5 s', async () => {
      const hass = makeMockHass([box()]);
      const card = await mount(hass);
      await type(card, 'yldb');
      button(card, '月亮代表我的心 — Add').click();
      await settle(card);
      expect(commandValues(hass)[0]).toMatch(/^selectsong:1000011#[0-9a-z]+$/);
      expect(liveText(card)).toBe('Added 月亮代表我的心');
      expect(button(card, '月亮代表我的心 — Added').querySelector('svg path')?.getAttribute('d')).toBe(
        'm4.5 10.5 4 4 7-8.5',
      );
      // The whole button changes tone, not just its glyph.
      expect(button(card, '月亮代表我的心 — Added').classList.contains('confirmed')).toBe(true);
      expect(button(card, '月亮代表我的心 — Added').classList.contains('primary')).toBe(false);
      await vi.advanceTimersByTimeAsync(KTV_ADDED_FEEDBACK_MS - 1);
      await card.updateComplete;
      expect(() => button(card, '月亮代表我的心 — Added')).not.toThrow();
      await vi.advanceTimersByTimeAsync(1);
      await card.updateComplete;
      expect(button(card, '月亮代表我的心 — Add').classList.contains('primary')).toBe(true);
    });

    it('Add to top sends insertsong', async () => {
      const hass = makeMockHass([box()]);
      const card = await mount(hass);
      await type(card, 'yldb');
      button(card, '月亮代表我的心 — Add to top').click();
      expect(commandValues(hass)[0]).toMatch(/^insertsong:1000011#[0-9a-z]+$/);
    });

    it('never adds to the queue itself: it only shows what the box reports', async () => {
      const hass = makeMockHass([box()]);
      const card = await mount(hass);
      await type(card, 'yldb');
      button(card, '月亮代表我的心 — Add').click();
      await settle(card);
      await type(card, '');
      expect(shadow(card).querySelectorAll('.queue .song')).toHaveLength(QUEUE.length);
      card.hass = makeMockHass([
        box('playing', { queue: [...QUEUE, { no: '1000013', title: 'Yesterday', singer: 'The Beatles' }] }),
      ]);
      await card.updateComplete;
      expect(shadow(card).querySelectorAll('.queue .song')).toHaveLength(QUEUE.length + 1);
    });
  });

  describe('queue', () => {
    it('lists the queue in order with a count and positions', async () => {
      const card = await mount(makeMockHass([box()]));
      const titles = [...shadow(card).querySelectorAll('.queue .song-title')].map((node) =>
        node.textContent?.trim(),
      );
      expect(titles).toEqual(['十年', '月亮代表我的心', '月亮']);
      const head = shadow(card).querySelector('.queue .list-head')?.textContent?.replace(/\s+/g, ' ');
      expect(head?.trim()).toBe('Up next 3');
      const positions = [...shadow(card).querySelectorAll('.queue .position')].map(
        (node) => node.textContent,
      );
      expect(positions).toEqual(['1', '2', '3']);
    });

    it('uses queue_count for the header when the list is capped', async () => {
      const card = await mount(makeMockHass([box('playing', { queue_count: 80 })]));
      expect(shadow(card).querySelector('.queue .list-head')?.textContent).toContain('80');
    });

    it('says so when nothing is queued', async () => {
      const card = await mount(makeMockHass([box('playing', { queue: [], queue_count: 0 })]));
      expect(shadow(card).querySelector('.queue')?.textContent).toContain(
        'Nothing queued. Search to add a song.',
      );
    });

    it('moves a queued song to the top and removes one', async () => {
      const hass = makeMockHass([box()]);
      const card = await mount(hass);
      button(card, '月亮代表我的心 — Move to top').click();
      button(card, '月亮 — Remove').click();
      await settle(card);
      expect(commandValues(hass).map((value) => value.split('#')[0])).toEqual([
        'insertorder:1000011',
        'delorder:1000012',
      ]);
    });

    it('disables Move to top for the song that is already next', async () => {
      const card = await mount(makeMockHass([box()]));
      expect(button(card, '十年 — Move to top').disabled).toBe(true);
      expect(button(card, '十年 — Remove').disabled).toBe(false);
    });

    it('refuses a song number that is not digits', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const hass = makeMockHass([
        box('playing', { queue: [{ no: '1;play', title: 'Odd', singer: 'X' }] }),
      ]);
      const card = await mount(hass);
      button(card, 'Odd — Remove').click();
      await settle(card);
      expect(hass.calls).toEqual([]);
      expect(error).toHaveBeenCalled();
    });

    function headText(card: QuietLuxeKtvCard): string {
      return (
        shadow(card).querySelector('.queue .list-head')?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      );
    }

    function addBack(card: QuietLuxeKtvCard): HTMLButtonElement {
      return shadow(card).querySelector('.queue button.add-back') as HTMLButtonElement;
    }

    it('swaps the count for "Removed … Add back" in the list head, for 5 s', async () => {
      const hass = makeMockHass([box()]);
      const card = await mount(hass);
      expect(headText(card)).toBe('Up next 3');
      button(card, '月亮 — Remove').click();
      await settle(card);
      expect(commandValues(hass)[0]).toMatch(/^delorder:1000012#/);
      expect(headText(card)).toBe('Up next Removed 月亮 · Add back');
      expect(liveText(card)).toBe('Removed 月亮');
      await vi.advanceTimersByTimeAsync(KTV_UNDO_MS - 1);
      await card.updateComplete;
      expect(addBack(card)).not.toBeNull();
      await vi.advanceTimersByTimeAsync(1);
      await card.updateComplete;
      expect(addBack(card)).toBeNull();
      expect(headText(card)).toBe('Up next 3');
      expect(hass.calls).toHaveLength(1);
    });

    it('never moves the list: the offer adds nothing above the first row', async () => {
      const card = await mount(makeMockHass([box()]));
      const before = [...shadow(card).querySelector('.queue')!.children].map((node) => node.tagName);
      button(card, '月亮 — Remove').click();
      await settle(card);
      const after = [...shadow(card).querySelector('.queue')!.children].map((node) => node.tagName);
      expect(after).toEqual(before);
    });

    it('Add back re-adds with selectsong (at the end) and closes the offer', async () => {
      const hass = makeMockHass([box()]);
      const card = await mount(hass);
      button(card, '月亮 — Remove').click();
      await settle(card);
      addBack(card).click();
      await settle(card);
      expect(commandValues(hass)[1]).toMatch(/^selectsong:1000012#/);
      expect(addBack(card)).toBeNull();
      expect(liveText(card)).toBe('Added 月亮');
    });

    it('dims the removed row and disables its actions until the queue drops it', async () => {
      const card = await mount(makeMockHass([box()]));
      button(card, '月亮 — Remove').click();
      await settle(card);
      const row = [...shadow(card).querySelectorAll('.queue .song')][2] as HTMLElement;
      expect(row.classList.contains('pending')).toBe(true);
      expect(button(card, '月亮 — Remove').disabled).toBe(true);
      expect(button(card, '月亮 — Move to top').disabled).toBe(true);
      // The other rows stay live, so a second tap cannot land on the wrong song.
      expect(button(card, '十年 — Remove').disabled).toBe(false);
      card.hass = makeMockHass([box('playing', { queue: QUEUE.slice(0, 2), queue_count: 2 })]);
      await settle(card);
      expect(shadow(card).querySelectorAll('.queue .song')).toHaveLength(2);
      expect(shadow(card).querySelector('.queue .pending')).toBeNull();
    });

    it('offers Add back only for the latest removal', async () => {
      const card = await mount(makeMockHass([box()]));
      button(card, '月亮 — Remove').click();
      await settle(card);
      button(card, '十年 — Remove').click();
      await settle(card);
      expect(headText(card)).toContain('Removed 十年');
      expect(headText(card)).not.toContain('月亮');
    });

    it('moves focus to the queue heading when the offer closes under the keyboard', async () => {
      const card = await mount(makeMockHass([box()]));
      button(card, '月亮 — Remove').click();
      await settle(card);
      addBack(card).focus();
      expect(shadow(card).activeElement).toBe(addBack(card));
      await vi.advanceTimersByTimeAsync(KTV_UNDO_MS);
      await settle(card);
      expect(shadow(card).activeElement).toBe(shadow(card).querySelector('.queue .list-head'));
    });

    it('lists the queue as an ordered list', async () => {
      const card = await mount(makeMockHass([box()]));
      expect(shadow(card).querySelector('.queue ol')).not.toBeNull();
    });

    it('ignores malformed queue entries', async () => {
      const card = await mount(
        makeMockHass([box('playing', { queue: [QUEUE[0], null, 'x', { title: 'No number' }] })]),
      );
      expect(shadow(card).querySelectorAll('.queue .song')).toHaveLength(1);
    });
  });

  describe('command contract', () => {
    // Copied verbatim from the backend's allow-list (.ai/isola-ktv-build.mjs,
    // the "KTV command" function node). The card may only emit what matches.
    const BACKEND_ALLOW =
      /^(play|pause|next|again|yuanchang|banchang|mute|unmute|volup|voldn|listorder|listplayed|refresh_catalogue|remote:([1-9]|1[0-2])|(selectsong|insertsong|insertorder|delorder):[0-9]{1,12})$/;
    const MAX_VALUE_LENGTH = 100;

    function driveEverything(card: QuietLuxeKtvCard, hass: MockHass, playing: boolean): void {
      (card as unknown as { nonceCounter: number }).nonceCounter = 2 ** 40;
      button(card, playing ? 'Pause' : 'Play').click();
      button(card, 'Next').click();
      button(card, 'Volume up').click();
      button(card, 'Volume down').click();
      const segmented = shadow(card).querySelector('ql-segmented') as HTMLElement;
      for (const value of ['original', 'backing']) {
        segmented.dispatchEvent(
          new CustomEvent('ql-change', { detail: { value }, bubbles: true, composed: true }),
        );
      }
      button(card, 'Zed — Add').click();
      button(card, 'Zed — Add to top').click();
      button(card, 'Second — Move to top').click();
      button(card, 'Second — Remove').click();
      expect(hass.calls.length).toBeGreaterThan(0);
    }

    it('only emits commands the backend allow-list accepts, within its length limit', async () => {
      fetchStub.mockImplementation(() =>
        Promise.resolve(
          okResponse({
            ...catalogueBody(),
            rows: [['999999999999', 'Zed', 'Q', '', 4, 'z', 'q', 1]],
          }),
        ),
      );
      const queue = [
        { no: '999999999998', title: 'First', singer: 'A' },
        { no: '999999999997', title: 'Second', singer: 'B' },
      ];
      const emitted: string[] = [];
      for (const playing of [true, false]) {
        const hass = makeMockHass([box(playing ? 'playing' : 'paused', { queue })]);
        const card = await mount(hass);
        await type(card, 'zed');
        driveEverything(card, hass, playing);
        await settle(card);
        emitted.push(...commandValues(hass));
      }
      const commands = emitted.map((value) => value.split('#')[0] ?? '');
      for (const value of emitted) {
        expect(value.length, value).toBeLessThanOrEqual(MAX_VALUE_LENGTH);
        expect(value.split('#'), value).toHaveLength(2);
      }
      for (const command of commands) {
        expect(command, command).toMatch(BACKEND_ALLOW);
      }
      expect(new Set(commands.map((command) => command.split(':')[0]))).toEqual(
        new Set([
          'play',
          'pause',
          'next',
          'volup',
          'voldn',
          'yuanchang',
          'banchang',
          'selectsong',
          'insertsong',
          'insertorder',
          'delorder',
        ]),
      );
    });

    it('the backend regex itself rejects what the card refuses to send', () => {
      expect('selectsong:1;play').not.toMatch(BACKEND_ALLOW);
      expect('selectsong:1234567890123').not.toMatch(BACKEND_ALLOW);
    });
  });

  describe('when a command cannot be delivered', () => {
    function failingHass(): MockHass {
      const hass = makeMockHass([box()]);
      (hass as { callService: unknown }).callService = (): Promise<unknown> =>
        Promise.reject(new Error('websocket closed'));
      return hass;
    }

    it('confirms nothing and says so for 4 s', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const card = await mount(failingHass());
      await type(card, 'yldb');
      button(card, '月亮代表我的心 — Add').click();
      await settle(card);
      expect(() => button(card, '月亮代表我的心 — Added')).toThrow();
      expect(button(card, '月亮代表我的心 — Add').classList.contains('primary')).toBe(true);
      const alert = shadow(card).querySelector('[role="alert"]');
      expect(alert?.textContent).toBe('Couldn’t reach the KTV box. Try again.');
      expect(error).toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(KTV_FAILURE_MS - 1);
      await card.updateComplete;
      expect(shadow(card).querySelector('[role="alert"]')).not.toBeNull();
      await vi.advanceTimersByTimeAsync(1);
      await card.updateComplete;
      expect(shadow(card).querySelector('[role="alert"]')).toBeNull();
    });

    it('does not offer Add back or dim the row when the removal was lost', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const card = await mount(failingHass());
      button(card, '月亮 — Remove').click();
      await settle(card);
      expect(shadow(card).querySelector('.queue button.add-back')).toBeNull();
      expect(shadow(card).querySelector('.queue .pending')).toBeNull();
      expect(button(card, '月亮 — Remove').disabled).toBe(false);
    });

    it('snaps the vocal toggle back to what the box reports', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const card = await mount(failingHass());
      const segmented = shadow(card).querySelector('ql-segmented') as HTMLElement & { value: string };
      expect(segmented.value).toBe('backing');
      segmented.value = 'original';
      segmented.dispatchEvent(
        new CustomEvent('ql-change', { detail: { value: 'original' }, bubbles: true, composed: true }),
      );
      await settle(card);
      expect(segmented.value).toBe('backing');
    });
  });

  describe('songs the sensor describes badly', () => {
    it('shows the number for a song with no title, in every place it appears', async () => {
      const card = await mount(
        makeMockHass([
          box('playing', {
            now_playing: { no: '1087855', title: null, singer: null },
            queue: [{ no: '1000012', title: null, singer: '王菲' }],
          }),
        ]),
      );
      expect(shadow(card).querySelector('.now-title')?.textContent?.trim()).toBe('Song #1087855');
      expect(shadow(card).querySelector('.now-singer')).toBeNull();
      expect(shadow(card).querySelector('.queue .song-title')?.textContent?.trim()).toBe('Song #1000012');
      expect(button(card, 'Song #1000012 — Remove')).toBeDefined();
      expect(button(card, 'Song #1000012 — Move to top').disabled).toBe(true);
      button(card, 'Song #1000012 — Remove').click();
      await settle(card);
      expect(shadow(card).querySelector('.queue .list-head')?.textContent).toContain(
        'Removed Song #1000012',
      );
    });

    it('draws a queue row with no singer without a blank line of text', async () => {
      const card = await mount(
        makeMockHass([box('playing', { queue: [{ no: '5', title: 'Solo', singer: null }] })]),
      );
      expect(shadow(card).querySelector('.queue .singers')?.textContent?.trim()).toBe('');
      expect(shadow(card).querySelector('.queue .song-title')?.textContent?.trim()).toBe('Solo');
    });
  });

  describe('accessibility', () => {
    it('keeps one live region from the start, and no role=status insertions', async () => {
      const card = await mount(makeMockHass([box()]));
      expect(shadow(card).querySelector('.sr-only[aria-live="polite"]')).not.toBeNull();
      await type(card, 'qqqq');
      expect(shadow(card).querySelector('[role="status"]')).toBeNull();
      expect(liveText(card)).toBe('No songs match “qqqq”');
    });

    it('waits for the IME to finish before searching', async () => {
      const card = await mount(makeMockHass([box()]));
      const field = input(card);
      field.dispatchEvent(new Event('focus'));
      await settle(card);
      field.value = 'yue';
      field.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
      await vi.advanceTimersByTimeAsync(KTV_SEARCH_DEBOUNCE_MS * 3);
      await settle(card);
      expect(liveText(card)).toBe('');
      expect(shadow(card).querySelector('.layout')?.classList.contains('searching')).toBe(false);
      field.value = '月亮';
      field.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
      await vi.advanceTimersByTimeAsync(KTV_SEARCH_DEBOUNCE_MS);
      await settle(card);
      expect(resultTitles(card)).toEqual(['月亮', '月亮代表我的心']);
    });
  });

  describe('lifecycle', () => {
    it('leaves no live ResizeObserver behind, and builds none while detached', async () => {
      const observers: Array<{ observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
      class FakeResizeObserver {
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
        constructor() {
          observers.push(this);
        }
      }
      vi.stubGlobal('ResizeObserver', FakeResizeObserver);
      const card = await mount(makeMockHass([box()]));
      expect(observers).toHaveLength(1);
      expect(observers[0]?.observe).toHaveBeenCalledTimes(1);
      await type(card, 'yldb');
      button(card, '月亮代表我的心 — Add').click();
      await settle(card);
      card.remove();
      await settle(card);
      await vi.advanceTimersByTimeAsync(KTV_ADDED_FEEDBACK_MS * 2);
      expect(observers).toHaveLength(1);
      expect(observers[0]?.disconnect).toHaveBeenCalled();
    });
  });

  describe('language row', () => {
    it('fades the trailing edge only while it overflows and is not at its end', async () => {
      const card = await mount(makeMockHass([box()]));
      const row = shadow(card).querySelector('.chips') as HTMLElement;
      expect(row.hasAttribute('data-fade')).toBe(false);
      Object.defineProperty(row, 'scrollWidth', { configurable: true, value: 500 });
      Object.defineProperty(row, 'clientWidth', { configurable: true, value: 300 });
      row.dispatchEvent(new Event('scroll'));
      expect(row.hasAttribute('data-fade')).toBe(true);
      row.scrollLeft = 200;
      row.dispatchEvent(new Event('scroll'));
      expect(row.hasAttribute('data-fade')).toBe(false);
    });
  });

  describe('locale', () => {
    it('renders natural KTV wording in Simplified Chinese', async () => {
      const card = await mount(makeMockHass([box()], 'zh-Hans'));
      const text = shadow(card).textContent ?? '';
      expect(text).toContain('已点');
      expect(text).toContain('正在播放');
      expect(text).toContain('国语');
      expect(text).toContain('粤语');
      const segmented = shadow(card).querySelector('ql-segmented') as HTMLElement & {
        options: ReadonlyArray<QlSegmentOption>;
      };
      expect(segmented.options.map((option) => option.label)).toEqual(['原唱', '伴唱']);
      await type(card, 'yldb');
      expect(() => button(card, '月亮代表我的心 — 点歌')).not.toThrow();
      expect(() => button(card, '月亮代表我的心 — 置顶点歌')).not.toThrow();
    });

    it('drops letter-spacing on eyebrows for Chinese locales only', async () => {
      const zh = await mount(makeMockHass([box()], 'zh-Hans'));
      expect(shadow(zh).querySelector('.ql-card')?.classList.contains('cjk')).toBe(true);
      const en = await mount(makeMockHass([box()], 'en'));
      expect(shadow(en).querySelector('.ql-card')?.classList.contains('cjk')).toBe(false);
    });

    it('follows a locale change on the next render', async () => {
      const card = await mount(makeMockHass([box()], 'en'));
      expect(shadow(card).textContent).toContain('Up next');
      card.hass = makeMockHass([box()], 'zh-Hant');
      await card.updateComplete;
      expect(shadow(card).textContent).toContain('已點');
      expect(shadow(card).textContent).not.toContain('Up next');
    });
  });
});
