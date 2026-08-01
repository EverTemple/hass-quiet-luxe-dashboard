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
  it('emits schedule + tasks cards from discovered calendar/todo entities', () => {
    const section = scheduleSection(makeContext({ home: { calendar: 'google' }, snapshot, entities }));
    expect(section?.cards[1]).toEqual({
      type: 'custom:quiet-luxe-schedule-card',
      calendars: ['calendar.family'],
      todo_entity: 'todo.family_tasks',
      days: 7,
    });
    expect(section?.cards[2]).toEqual({
      type: 'custom:quiet-luxe-tasks-card',
      entity: 'todo.family_tasks',
    });
  });

  it('omits the section entirely when calendar: none (Xiamen rule)', () => {
    expect(scheduleSection(makeContext({ home: { calendar: 'none' }, snapshot, entities }))).toBeNull();
  });

  it('omits the section when the integration is missing despite the flag', () => {
    expect(scheduleSection(makeContext({ home: { calendar: 'google' } }))).toBeNull();
  });
});
