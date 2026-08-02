import { t } from '../i18n/translate';
import type { Locale } from '../i18n/types';
import type { HomeAssistant } from '../types/home-assistant';

export const AGENDA_DEFAULT_DAYS = 7;
export const AGENDA_REFRESH_MS = 15 * 60 * 1000;

/** Event shape from GET /api/calendars/<id> (HA REST API, verified 2026-08-01). */
export interface HaCalendarEvent {
  readonly summary: string;
  readonly start: { readonly dateTime?: string; readonly date?: string };
  readonly end: { readonly dateTime?: string; readonly date?: string };
}

export interface AgendaItem {
  readonly title: string;
  readonly start: Date;
  readonly allDay: boolean;
  readonly calendarId: string;
}

/** Item shape from the todo/item/list WS command (HA frontend data/todo.ts). */
export interface HaTodoItem {
  readonly uid: string;
  readonly summary: string;
  readonly status: 'needs_action' | 'completed';
  readonly due?: string;
}

function toAgendaItem(event: HaCalendarEvent, calendarId: string): AgendaItem {
  const allDay = event.start.dateTime === undefined;
  const startIso = event.start.dateTime ?? `${event.start.date ?? ''}T00:00:00`;
  return { title: event.summary, start: new Date(startIso), allDay, calendarId };
}

/**
 * Merged, time-sorted agenda across calendars. Both HA's callApi and the mock
 * are closures, so calling the extracted reference unbound is safe.
 */
export async function fetchAgenda(
  hass: HomeAssistant,
  calendarIds: ReadonlyArray<string>,
  start: Date,
  end: Date,
): Promise<AgendaItem[]> {
  const callApi = hass.callApi;
  if (callApi === undefined) {
    throw new Error('quiet-luxe: hass.callApi unavailable — cannot load calendar events');
  }
  const perCalendar = await Promise.all(
    calendarIds.map(async (calendarId) => {
      const path = `calendars/${calendarId}?start=${start.toISOString()}&end=${end.toISOString()}`;
      const events = await callApi<ReadonlyArray<HaCalendarEvent>>('GET', path);
      return events.map((event) => toAgendaItem(event, calendarId));
    }),
  );
  return perCalendar.flat().sort((a, b) => a.start.getTime() - b.start.getTime());
}

export async function fetchTodoItems(
  hass: HomeAssistant,
  entityId: string,
): Promise<ReadonlyArray<HaTodoItem>> {
  const callWS = hass.callWS;
  if (callWS === undefined) {
    throw new Error('quiet-luxe: hass.callWS unavailable — cannot load to-do items');
  }
  const response = await callWS<{ readonly items: ReadonlyArray<HaTodoItem> }>({
    type: 'todo/item/list',
    entity_id: entityId,
  });
  return response.items;
}

/** todo.update_item with uid + status (verified 2026-08-01, plan D5). */
export function updateTodoItem(
  hass: HomeAssistant,
  entityId: string,
  uid: string,
  completed: boolean,
): Promise<unknown> {
  return hass.callService('todo', 'update_item', {
    entity_id: entityId,
    item: uid,
    status: completed ? 'completed' : 'needs_action',
  });
}

/**
 * Deterministic agenda time: localized short weekday (Intl) + 24h HH:MM.
 * All-day events use the localized schedule.all_day string.
 */
export function formatAgendaTime(item: AgendaItem, locale: Locale): string {
  if (item.allDay) {
    return t(locale, 'schedule.all_day');
  }
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(item.start);
  const hours = String(item.start.getHours()).padStart(2, '0');
  const minutes = String(item.start.getMinutes()).padStart(2, '0');
  return `${weekday} ${hours}:${minutes}`;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A to-do due date is usually date-only, and JS parses that form as UTC
 * midnight while every comparison below is local — so west of Greenwich every
 * due date landed a day early ("Tomorrow" rendered as "Due today"). Date-only
 * values are therefore parsed as local midnight; timestamps keep their offset.
 */
function parseDue(due: string): Date {
  const match = DATE_ONLY.exec(due);
  if (match === null) {
    return new Date(due);
  }
  const [year, month, day] = due.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

/**
 * Human due label for a task row (Figma `card/schedule-v2` tasks view):
 * "Due today" / "Tomorrow" for the two dates people actually plan around, a
 * localized short weekday inside the coming week, and a localized date beyond
 * it. Returns undefined when the item has no due date, so the row shows none.
 */
export function formatDue(
  due: string | undefined,
  locale: Locale,
  now: Date = new Date(),
): string | undefined {
  if (due === undefined) {
    return undefined;
  }
  const dueDate = parseDue(due);
  if (Number.isNaN(dueDate.getTime())) {
    return undefined;
  }
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDue = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const days = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86_400_000);
  if (days <= 0) {
    return t(locale, 'tasks.due_today');
  }
  if (days === 1) {
    return t(locale, 'tasks.due_tomorrow');
  }
  if (days < 7) {
    return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(dueDate);
  }
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(dueDate);
}

/** Due highlight rule: overdue or due today (spec §6 "due highlights"). */
export function isDueSoon(due: string | undefined, now: Date = new Date()): boolean {
  if (due === undefined) {
    return false;
  }
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return parseDue(due).getTime() < endOfToday.getTime();
}
