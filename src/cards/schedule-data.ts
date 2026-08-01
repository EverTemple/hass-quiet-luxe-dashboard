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

/** Due highlight rule: overdue or due today (spec §6 "due highlights"). */
export function isDueSoon(due: string | undefined, now: Date = new Date()): boolean {
  if (due === undefined) {
    return false;
  }
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return new Date(due).getTime() < endOfToday.getTime();
}
