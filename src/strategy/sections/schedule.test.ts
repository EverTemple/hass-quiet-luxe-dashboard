import { describe, expect, it } from 'vitest';
import { makeEntity } from '../../testing/mock-hass';
import { makeContext, mockRegEntity } from '../../testing/mock-registry';
import { scheduleSection } from './schedule';

const snapshot = {
  areas: [],
  devices: [],
  entities: [
    mockRegEntity('calendar.family', { platform: 'google_calendar' }),
    mockRegEntity('todo.family_tasks', { platform: 'google_tasks' }),
  ],
};
const entities = [makeEntity('calendar.family', 'off'), makeEntity('todo.family_tasks', '3')];

describe('scheduleSection', () => {
  /* ONE card. The schedule card and the tasks card used to be emitted side
     by side into the same section, where they overlapped. */
  it('emits a single schedule card carrying both sources', () => {
    const section = scheduleSection(makeContext({ home: { calendar: 'google' }, snapshot, entities }));
    expect(section?.cards).toHaveLength(2);
    expect(section?.cards[1]).toEqual({
      type: 'custom:quiet-luxe-schedule-card',
      calendars: ['calendar.family'],
      days: 7,
      todo_entity: 'todo.family_tasks',
    });
  });

  it('omits the section entirely when calendar: none (Xiamen rule)', () => {
    expect(scheduleSection(makeContext({ home: { calendar: 'none' }, snapshot, entities }))).toBeNull();
  });

  it('omits the section when the integration is missing despite the flag', () => {
    expect(scheduleSection(makeContext({ home: { calendar: 'google' } }))).toBeNull();
  });

  /* Tung Chung: a to-do list and no calendar integration. The card opens on
     Tasks and offers no Schedule segment. */
  it('emits a todo-only schedule card when the home has no calendars', () => {
    const ctx = makeContext({
      home: { calendar: 'google' },
      snapshot: { areas: [], devices: [], entities: [mockRegEntity('todo.shopping_list')] },
      entities: [makeEntity('todo.shopping_list', '0')],
    });
    const section = scheduleSection(ctx);
    expect(section?.cards).toEqual([
      { type: 'heading', heading: 'Schedule' },
      { type: 'custom:quiet-luxe-schedule-card', todo_entity: 'todo.shopping_list' },
    ]);
  });
});
