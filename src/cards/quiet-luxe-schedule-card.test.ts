import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QlSegmentOption } from '../elements/ql-segmented';
import { makeEntity, makeMockHass, type MockHass } from '../testing/mock-hass';
import { QuietLuxeScheduleCard, type ScheduleCardConfig } from './quiet-luxe-schedule-card';

const CAL_STUB = {
  apiResponses: {
    'calendars/calendar.family': [
      {
        summary: 'Dentist',
        start: { dateTime: '2026-08-03T09:30:00+08:00' },
        end: { dateTime: '2026-08-03T10:30:00+08:00' },
      },
      {
        summary: 'Sports day',
        start: { date: '2026-08-02' },
        end: { date: '2026-08-03' },
      },
    ],
  },
  wsResponses: {
    'todo/item/list': {
      items: [
        { uid: 'a1', summary: 'Buy milk', status: 'needs_action', due: '2026-07-31' },
        { uid: 'a2', summary: 'Water plants', status: 'needs_action' },
        { uid: 'a3', summary: 'Done thing', status: 'completed' },
      ],
    },
  },
};

function todoEntity(state = '2'): ReturnType<typeof makeEntity> {
  return makeEntity('todo.family', state, { friendly_name: 'Family Tasks' });
}

function calendarEntity(): ReturnType<typeof makeEntity> {
  return makeEntity('calendar.family', 'on', { friendly_name: 'Family Calendar' });
}

async function mount(
  config: Omit<ScheduleCardConfig, 'type'>,
  hass: MockHass,
): Promise<QuietLuxeScheduleCard> {
  const card = document.createElement('quiet-luxe-schedule-card') as QuietLuxeScheduleCard;
  card.setConfig({ type: 'custom:quiet-luxe-schedule-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  await card.refresh();
  await card.updateComplete;
  return card;
}

type SegmentedElement = HTMLElement & {
  options: ReadonlyArray<QlSegmentOption>;
  value: string;
};

function segmented(card: QuietLuxeScheduleCard): SegmentedElement | null {
  return (card.shadowRoot?.querySelector('ql-segmented') as SegmentedElement | null) ?? null;
}

describe('quiet-luxe-schedule-card', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('is registered and self-hides when no calendar and no todo are configured', async () => {
    expect(customElements.get('quiet-luxe-schedule-card')).toBe(QuietLuxeScheduleCard);
    const card = await mount({}, makeMockHass());
    expect(card.hasSources()).toBe(false);
    expect(card.getCardSize()).toBe(0);
    expect(card.shadowRoot?.querySelector('.ql-card')).toBeNull();
  });

  it('rejects a default_view outside the two views', () => {
    const card = new QuietLuxeScheduleCard();
    expect(() => card.setConfig({ type: 'x', default_view: 'agenda' as 'tasks' })).toThrow(
      /"default_view"/,
    );
  });

  /* The two cards used to be emitted side by side and overlapped; one card
     with one toggle replaces them. */
  it('offers exactly two segments when both sources exist and starts on Schedule', async () => {
    const card = await mount(
      { calendars: ['calendar.family'], todo_entity: 'todo.family' },
      makeMockHass([calendarEntity(), todoEntity()], CAL_STUB),
    );
    expect(card.availableViews()).toEqual(['schedule', 'tasks']);
    expect(segmented(card)?.options.map((option) => option.label)).toEqual(['Schedule', 'Tasks']);
    expect(card.view).toBe('schedule');
    expect(card.shadowRoot?.querySelectorAll('.event')).toHaveLength(2);
    expect(card.shadowRoot?.querySelectorAll("input[type='checkbox']")).toHaveLength(0);
  });

  it('the toggle swaps the card between agenda rows and task rows', async () => {
    const card = await mount(
      { calendars: ['calendar.family'], todo_entity: 'todo.family' },
      makeMockHass([calendarEntity(), todoEntity()], CAL_STUB),
    );
    segmented(card)?.dispatchEvent(
      new CustomEvent('ql-change', { detail: { value: 'tasks' }, bubbles: true, composed: true }),
    );
    await card.updateComplete;
    expect(card.view).toBe('tasks');
    expect(card.shadowRoot?.querySelectorAll('.event')).toHaveLength(0);
    expect(card.shadowRoot?.querySelectorAll("input[type='checkbox']")).toHaveLength(3);
    expect(card.shadowRoot?.querySelector('.footer')?.textContent?.trim()).toBe('2 open');
  });

  it('renders sorted agenda rows with the time, title and source calendar', async () => {
    const card = await mount(
      { calendars: ['calendar.family'] },
      makeMockHass([calendarEntity()], CAL_STUB),
    );
    const rows = [...(card.shadowRoot?.querySelectorAll('.event') ?? [])];
    expect(rows.map((row) => row.textContent?.includes('Sports day'))).toEqual([true, false]);
    expect(rows[0]?.classList.contains('next')).toBe(true);
    expect(rows[0]?.querySelector('.title')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'All day · Sports day',
    );
    expect(rows[0]?.querySelector('.source')?.textContent).toBe('Family Calendar');
  });

  /* Tung Chung has no calendar integration: the card must open on Tasks
     rather than on a segment that can only say "Nothing scheduled". */
  it('a home with no calendar opens on Tasks and offers no Schedule segment', async () => {
    const card = await mount({ todo_entity: 'todo.family' }, makeMockHass([todoEntity()], CAL_STUB));
    expect(card.availableViews()).toEqual(['tasks']);
    expect(card.view).toBe('tasks');
    expect(segmented(card)?.options.map((option) => option.value)).toEqual(['tasks']);
    expect(card.shadowRoot?.querySelectorAll("input[type='checkbox']")).toHaveLength(3);
  });

  it('a home with no to-do list offers no Tasks segment', async () => {
    const card = await mount(
      { calendars: ['calendar.family'], default_view: 'tasks' },
      makeMockHass([calendarEntity()], CAL_STUB),
    );
    expect(card.availableViews()).toEqual(['schedule']);
    expect(card.view).toBe('schedule');
  });

  it('honours default_view when that view has a source', async () => {
    const card = await mount(
      { calendars: ['calendar.family'], todo_entity: 'todo.family', default_view: 'tasks' },
      makeMockHass([calendarEntity(), todoEntity()], CAL_STUB),
    );
    expect(card.view).toBe('tasks');
  });

  it('checkbox change calls todo.update_item with the item uid', async () => {
    const hass = makeMockHass([todoEntity()], CAL_STUB);
    const card = await mount({ todo_entity: 'todo.family' }, hass);
    const first = card.shadowRoot?.querySelector<HTMLInputElement>("input[type='checkbox']");
    if (first === null || first === undefined) {
      throw new Error('checkbox missing');
    }
    first.checked = true;
    first.dispatchEvent(new Event('change'));
    expect(hass.calls).toEqual([
      {
        domain: 'todo',
        service: 'update_item',
        data: { entity_id: 'todo.family', item: 'a1', status: 'completed' },
      },
    ]);
  });

  it('shows human due labels, warn-toned only when due today or overdue', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T09:00:00'));
    const card = await mount(
      { todo_entity: 'todo.family' },
      makeMockHass([todoEntity()], {
        wsResponses: {
          'todo/item/list': {
            items: [
              { uid: 'a1', summary: 'Overdue', status: 'needs_action', due: '2026-07-31' },
              { uid: 'a2', summary: 'Later', status: 'needs_action', due: '2026-08-02' },
            ],
          },
        },
      }),
    );
    const dues = [...(card.shadowRoot?.querySelectorAll('.due') ?? [])];
    expect(dues[0]?.textContent).toBe('Due today');
    expect(dues[0]?.classList.contains('soon')).toBe(true);
    expect(dues[1]?.textContent).toBe('Tomorrow');
    expect(dues[1]?.classList.contains('soon')).toBe(false);
  });

  it('gives each view a calm empty state instead of a collapsed card', async () => {
    const noEvents = await mount(
      { calendars: ['calendar.family'] },
      makeMockHass([calendarEntity()], { apiResponses: { 'calendars/calendar.family': [] } }),
    );
    expect(noEvents.shadowRoot?.querySelector('.empty')?.textContent?.trim()).toBe(
      'Nothing scheduled',
    );

    const noTasks = await mount(
      { todo_entity: 'todo.family' },
      makeMockHass([todoEntity('0')], { wsResponses: { 'todo/item/list': { items: [] } } }),
    );
    expect(noTasks.shadowRoot?.querySelector('.empty')?.textContent?.trim()).toBe('All done');
  });

  it('localizes the footer', async () => {
    const card = await mount(
      { todo_entity: 'todo.family' },
      makeMockHass([todoEntity()], { ...CAL_STUB, language: 'zh-Hant' }),
    );
    expect(card.shadowRoot?.querySelector('.footer')?.textContent?.trim()).toBe('2 項未完成');
  });

  it('degrades muted with a console error when the calendar API fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const card = await mount({ calendars: ['calendar.family'] }, makeMockHass([calendarEntity()]));
    expect(errorSpy).toHaveBeenCalled();
    expect(card.shadowRoot?.querySelector('.empty')?.textContent?.trim()).toBe('Unavailable');
  });

  it('keeps the more-info region when the to-do list is unavailable', async () => {
    const card = await mount(
      { todo_entity: 'todo.family' },
      makeMockHass([makeEntity('todo.family', 'unavailable')], CAL_STUB),
    );
    expect(card.shadowRoot?.querySelector('.ql-unavailable')).not.toBeNull();
    expect(card.shadowRoot?.querySelectorAll("input[type='checkbox']")).toHaveLength(0);
    const seen: string[] = [];
    const record = (event: Event): void => {
      seen.push((event as CustomEvent<{ entityId: string }>).detail.entityId);
    };
    document.body.addEventListener('hass-more-info', record);
    card.shadowRoot?.querySelector<HTMLButtonElement>('.ql-info')?.click();
    document.body.removeEventListener('hass-more-info', record);
    expect(seen).toEqual(['todo.family']);
  });
});
