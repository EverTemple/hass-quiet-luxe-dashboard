import type { LovelaceCardConfig, LovelaceSectionConfig, StrategyContext } from '../types';
import { headingCard, sectionOf } from './heading';

const AGENDA_DAYS = 7;

/** Omitted entirely when calendar: none (Xiamen, spec §2) or nothing discovered. */
export function scheduleSection(ctx: StrategyContext): LovelaceSectionConfig | null {
  if (ctx.home.calendar === 'none') {
    return null;
  }
  const calendars = ctx.registry.all('calendar');
  const todo = ctx.registry.all('todo')[0];
  if (calendars.length === 0 && todo === undefined) {
    return null;
  }
  /* No calendars → no agenda to segment: the schedule card would be a header
     and a "coming soon" control over nothing. The tasks card carries the
     section on its own (spec §8). */
  const cards: LovelaceCardConfig[] =
    calendars.length === 0
      ? []
      : [{ type: 'custom:quiet-luxe-schedule-card', calendars, todo_entity: todo, days: AGENDA_DAYS }];
  if (todo !== undefined) {
    cards.push({ type: 'custom:quiet-luxe-tasks-card', entity: todo });
  }
  return sectionOf(headingCard(ctx.locale, 'section.schedule'), cards);
}
