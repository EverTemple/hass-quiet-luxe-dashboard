import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QlSegmentOption } from '../elements/ql-segmented';
import { makeMockHass, type MockHass } from '../testing/mock-hass';
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
        { uid: 'a2', summary: 'Done thing', status: 'completed' },
      ],
    },
  },
};

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

describe('quiet-luxe-schedule-card', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is registered and self-hides when no calendar and no todo are configured', async () => {
    expect(customElements.get('quiet-luxe-schedule-card')).toBe(QuietLuxeScheduleCard);
    const card = document.createElement('quiet-luxe-schedule-card') as QuietLuxeScheduleCard;
    card.setConfig({ type: 'custom:quiet-luxe-schedule-card' });
    card.hass = makeMockHass();
    document.body.append(card);
    await card.updateComplete;
    expect(card.getCardSize()).toBe(0);
    expect(card.shadowRoot?.querySelector('.ql-card')).toBeNull();
    card.remove();
  });

  it('renders sorted agenda rows with localized times and marks the first as next', async () => {
    const card = await mount(
      { calendars: ['calendar.family'], todo_entity: 'todo.family' },
      makeMockHass([], CAL_STUB),
    );
    const rows = [...(card.shadowRoot?.querySelectorAll('.event') ?? [])];
    expect(rows.map((row) => row.textContent?.includes('Sports day'))).toEqual([true, false]);
    expect(rows[0]?.classList.contains('next')).toBe(true);
    expect(rows[0]?.textContent).toContain('All day');
    card.remove();
  });

  it('offers agenda enabled and day/week/month disabled with a localized hint', async () => {
    const card = await mount(
      { calendars: ['calendar.family'] },
      makeMockHass([], { ...CAL_STUB, language: 'zh-Hant' }),
    );
    const segmented = card.shadowRoot?.querySelector('ql-segmented') as
      | (HTMLElement & { options: ReadonlyArray<QlSegmentOption>; value: string })
      | null;
    expect(segmented?.value).toBe('agenda');
    expect(segmented?.options.map((o) => o.disabled === true)).toEqual([
      false,
      true,
      true,
      true,
    ]);
    expect(segmented?.options[1]?.hint).toBe('即將推出');
    card.remove();
  });

  it('shows open todo glance rows with due highlight', async () => {
    const card = await mount(
      { calendars: ['calendar.family'], todo_entity: 'todo.family' },
      makeMockHass([], CAL_STUB),
    );
    const tasks = [...(card.shadowRoot?.querySelectorAll('.task') ?? [])];
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.textContent).toContain('Buy milk');
    expect(tasks[0]?.querySelector('.due')).not.toBeNull();
    card.remove();
  });

  it('renders the empty state when the window has no events', async () => {
    const card = await mount(
      { calendars: ['calendar.family'] },
      makeMockHass([], { apiResponses: { 'calendars/calendar.family': [] } }),
    );
    expect(card.shadowRoot?.textContent).toContain('No upcoming events');
    card.remove();
  });

  it('degrades muted with a console error when the calendar API fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const card = await mount({ calendars: ['calendar.family'] }, makeMockHass());
    expect(errorSpy).toHaveBeenCalled();
    expect(card.shadowRoot?.textContent).toContain('Unavailable');
    card.remove();
  });
});
