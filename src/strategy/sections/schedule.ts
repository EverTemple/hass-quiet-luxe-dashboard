import type { LovelaceCardConfig, LovelaceSectionConfig, StrategyContext } from '../types';
import { headingCard, sectionOf } from './heading';

const AGENDA_DAYS = 7;

/**
 * One schedule card, never two. The card carries its own Schedule/Tasks
 * toggle (Figma `card/schedule-v2`), so emitting a schedule card and a tasks
 * card side by side — which is what made them overlap — is no longer possible.
 *
 * Omitted entirely when calendar: none (Xiamen, spec §2) or nothing was
 * discovered. With a to-do list but no calendar (Tung Chung) the card opens on
 * Tasks and offers no Schedule segment.
 */
export function scheduleSection(ctx: StrategyContext): LovelaceSectionConfig | null {
  if (ctx.home.calendar === 'none') {
    return null;
  }
  const calendars = ctx.registry.all('calendar');
  const todo = ctx.registry.all('todo')[0];
  if (calendars.length === 0 && todo === undefined) {
    return null;
  }
  const card: LovelaceCardConfig = {
    type: 'custom:quiet-luxe-schedule-card',
    ...(calendars.length === 0 ? {} : { calendars, days: AGENDA_DAYS }),
    ...(todo === undefined ? {} : { todo_entity: todo }),
  };
  return sectionOf(headingCard(ctx.locale, 'section.schedule'), [card]);
}
