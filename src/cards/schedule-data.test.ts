import { describe, expect, it } from 'vitest';
import { makeMockHass } from '../testing/mock-hass';
import type { HomeAssistant } from '../types/home-assistant';
import {
  AGENDA_DEFAULT_DAYS,
  AGENDA_REFRESH_MS,
  fetchAgenda,
  fetchTodoItems,
  formatDue,
  formatAgendaTime,
  isDueSoon,
  updateTodoItem,
  type AgendaItem,
} from './schedule-data';

const START = new Date('2026-08-01T00:00:00.000Z');
const END = new Date('2026-08-08T00:00:00.000Z');

describe('fetchAgenda', () => {
  it('fetches each calendar with iso start/end, merges and sorts', async () => {
    const hass = makeMockHass([], {
      apiResponses: {
        'calendars/calendar.family?start=2026-08-01T00:00:00.000Z&end=2026-08-08T00:00:00.000Z': [
          {
            summary: 'Dentist',
            start: { dateTime: '2026-08-03T09:30:00+08:00' },
            end: { dateTime: '2026-08-03T10:30:00+08:00' },
          },
        ],
        'calendars/calendar.school?start=2026-08-01T00:00:00.000Z&end=2026-08-08T00:00:00.000Z': [
          {
            summary: 'Sports day',
            start: { date: '2026-08-02' },
            end: { date: '2026-08-03' },
          },
        ],
      },
    });
    const agenda = await fetchAgenda(hass, ['calendar.family', 'calendar.school'], START, END);
    expect(agenda.map((item) => item.title)).toEqual(['Sports day', 'Dentist']);
    expect(agenda[0]?.allDay).toBe(true);
    expect(agenda[0]?.calendarId).toBe('calendar.school');
    expect(agenda[1]?.allDay).toBe(false);
    expect(hass.apiCalls).toHaveLength(2);
  });

  it('throws loudly when callApi is unavailable', async () => {
    const bare: HomeAssistant = {
      states: {},
      language: 'en',
      callService: () => Promise.resolve(undefined),
    };
    await expect(fetchAgenda(bare, ['calendar.a'], START, END)).rejects.toThrow(
      'callApi unavailable',
    );
  });
});

describe('fetchTodoItems / updateTodoItem', () => {
  it('lists items over the todo/item/list websocket command', async () => {
    const hass = makeMockHass([], {
      wsResponses: {
        'todo/item/list': {
          items: [{ uid: 'a1', summary: 'Buy milk', status: 'needs_action' }],
        },
      },
    });
    const items = await fetchTodoItems(hass, 'todo.family');
    expect(items).toEqual([{ uid: 'a1', summary: 'Buy milk', status: 'needs_action' }]);
    expect(hass.wsCalls).toEqual([{ type: 'todo/item/list', entity_id: 'todo.family' }]);
  });

  it('throws loudly when callWS is unavailable', async () => {
    const bare: HomeAssistant = {
      states: {},
      language: 'en',
      callService: () => Promise.resolve(undefined),
    };
    await expect(fetchTodoItems(bare, 'todo.family')).rejects.toThrow('callWS unavailable');
  });

  it('updates an item through todo.update_item with uid + status', async () => {
    const hass = makeMockHass();
    await updateTodoItem(hass, 'todo.family', 'a1', true);
    await updateTodoItem(hass, 'todo.family', 'a1', false);
    expect(hass.calls).toEqual([
      {
        domain: 'todo',
        service: 'update_item',
        data: { entity_id: 'todo.family', item: 'a1', status: 'completed' },
      },
      {
        domain: 'todo',
        service: 'update_item',
        data: { entity_id: 'todo.family', item: 'a1', status: 'needs_action' },
      },
    ]);
  });
});

describe('formatAgendaTime', () => {
  const timed: AgendaItem = {
    title: 'Dentist',
    start: new Date(2026, 7, 1, 9, 30),
    allDay: false,
    calendarId: 'calendar.family',
  };
  const allDay: AgendaItem = { ...timed, allDay: true };

  it('formats weekday + 24h time per locale', () => {
    expect(formatAgendaTime(timed, 'en')).toBe('Sat 09:30');
    expect(formatAgendaTime(timed, 'zh-Hant')).toBe('週六 09:30');
  });

  it('localizes all-day events', () => {
    expect(formatAgendaTime(allDay, 'en')).toBe('All day');
    expect(formatAgendaTime(allDay, 'ms')).toBe('Sepanjang hari');
  });
});

describe('isDueSoon', () => {
  const now = new Date(2026, 7, 1, 12, 0);

  it('flags overdue and due-today items, not later ones', () => {
    expect(isDueSoon('2026-07-31', now)).toBe(true);
    expect(isDueSoon('2026-08-01', now)).toBe(true);
    expect(isDueSoon('2026-08-02', now)).toBe(false);
    expect(isDueSoon(undefined, now)).toBe(false);
  });
});

describe('constants', () => {
  it('locks the agenda defaults', () => {
    expect(AGENDA_DEFAULT_DAYS).toBe(7);
    expect(AGENDA_REFRESH_MS).toBe(900000);
  });
});

describe('formatDue', () => {
  const now = new Date(2026, 7, 1, 12, 0);

  it('names the two dates people plan around, then falls back to weekday and date', () => {
    expect(formatDue('2026-07-30', 'en', now)).toBe('Due today');
    expect(formatDue('2026-08-01', 'en', now)).toBe('Due today');
    expect(formatDue('2026-08-02', 'en', now)).toBe('Tomorrow');
    expect(formatDue('2026-08-05', 'en', now)).toBe('Wednesday');
    expect(formatDue('2026-09-20', 'en', now)).toBe('Sep 20');
  });

  it('is localized and safe on missing or unparseable dates', () => {
    expect(formatDue('2026-08-01', 'zh-Hant', now)).toBe('今天到期');
    expect(formatDue('2026-08-02', 'ms', now)).toBe('Esok');
    expect(formatDue(undefined, 'en', now)).toBeUndefined();
    expect(formatDue('not-a-date', 'en', now)).toBeUndefined();
  });
});

describe('due dates across timezones', () => {
  /**
   * A date-only due string parses as UTC midnight while every comparison here
   * is local, so west of Greenwich "2026-08-02" used to read as today. The
   * suite ran in UTC+8 and never saw it; these cases pin both hemispheres.
   */
  const inZone = <T>(zone: string, run: () => T): T => {
    const original = process.env.TZ;
    process.env.TZ = zone;
    try {
      return run();
    } finally {
      /* Assigning undefined would leave the literal string "undefined" behind
         and silently move every later test to UTC. */
      if (original === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = original;
      }
    }
  };

  for (const zone of ['America/Los_Angeles', 'America/New_York', 'UTC', 'Asia/Hong_Kong']) {
    it(`reads a date-only due date on the local calendar in ${zone}`, () => {
      inZone(zone, () => {
        const now = new Date(2026, 7, 1, 12, 0);
        expect(formatDue('2026-08-01', 'en', now)).toBe('Due today');
        expect(formatDue('2026-08-02', 'en', now)).toBe('Tomorrow');
        expect(formatDue('2026-08-05', 'en', now)).toBe('Wednesday');
        expect(isDueSoon('2026-08-01', now)).toBe(true);
        expect(isDueSoon('2026-08-02', now)).toBe(false);
      });
    });
  }
});
