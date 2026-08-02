import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import '../elements/ql-section-eyebrow';
import '../elements/ql-segmented';
import type { QlSegmentOption } from '../elements/ql-segmented';
import { t } from '../i18n/translate';
import { contentGrid, COLUMNS_FULL, type QlGridOptions } from './grid-options';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';
import {
  AGENDA_DEFAULT_DAYS,
  AGENDA_REFRESH_MS,
  fetchAgenda,
  fetchTodoItems,
  formatAgendaTime,
  isDueSoon,
  type AgendaItem,
  type HaTodoItem,
} from './schedule-data';

export interface ScheduleCardConfig {
  readonly type: string;
  /** Calendar entity ids. Omitted/empty (per-home `calendar: none`) + no todo → renders nothing. */
  readonly calendars?: ReadonlyArray<string>;
  readonly todo_entity?: string;
  /** Agenda window in days. */
  readonly days?: number;
}

/**
 * Schedule card (Figma `card/schedule`), agenda view only — day/week/month
 * are Figma visual targets, surfaced as disabled segments with a localized
 * "coming soon" hint (plan scope). Task rows here are display-only glance
 * rows; quiet-luxe-tasks-card is the interactive surface.
 */
export class QuietLuxeScheduleCard extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
    agenda: { state: true },
    tasks: { state: true },
    loadFailed: { state: true },
  };

  declare config?: ScheduleCardConfig;
  declare agenda: ReadonlyArray<AgendaItem>;
  declare tasks: ReadonlyArray<HaTodoItem>;
  declare loadFailed: boolean;
  private started = false;
  private refreshTimer?: number;

  constructor() {
    super();
    this.agenda = [];
    this.tasks = [];
    this.loadFailed = false;
  }

  setConfig(config: ScheduleCardConfig): void {
    this.config = config;
  }

  hasSources(): boolean {
    return (this.config?.calendars?.length ?? 0) > 0 || this.config?.todo_entity !== undefined;
  }

  getCardSize(): number {
    return this.hasSources() ? 4 : 0;
  }

  getGridOptions(): QlGridOptions {
    return contentGrid(COLUMNS_FULL);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.started && this.hass !== undefined && this.config !== undefined && this.hasSources()) {
      this.started = true;
      void this.refresh();
      this.refreshTimer = window.setInterval(() => {
        void this.refresh();
      }, AGENDA_REFRESH_MS);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.refreshTimer);
    this.refreshTimer = undefined;
    this.started = false;
  }

  /** Public for tests and the strategy; safe to call repeatedly. */
  async refresh(): Promise<void> {
    const hass = this.hass;
    const config = this.config;
    if (hass === undefined || config === undefined) {
      return;
    }
    const calendars = config.calendars ?? [];
    if (calendars.length > 0) {
      try {
        const start = new Date();
        const end = new Date(
          start.getTime() + (config.days ?? AGENDA_DEFAULT_DAYS) * 24 * 60 * 60 * 1000,
        );
        this.agenda = await fetchAgenda(hass, calendars, start, end);
        this.loadFailed = false;
      } catch (error) {
        this.loadFailed = true;
        console.error('quiet-luxe-schedule-card: calendar load failed', error);
      }
    }
    if (config.todo_entity !== undefined) {
      try {
        this.tasks = await fetchTodoItems(hass, config.todo_entity);
      } catch (error) {
        console.error('quiet-luxe-schedule-card: to-do load failed', error);
      }
    }
  }

  private viewOptions(): ReadonlyArray<QlSegmentOption> {
    const locale = this.locale();
    const soon = t(locale, 'schedule.view_soon');
    return [
      { value: 'agenda', label: t(locale, 'schedule.agenda') },
      { value: 'day', label: t(locale, 'schedule.day'), disabled: true, hint: soon },
      { value: 'week', label: t(locale, 'schedule.week'), disabled: true, hint: soon },
      { value: 'month', label: t(locale, 'schedule.month'), disabled: true, hint: soon },
    ];
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--ql-space-s, 8px);
        margin-bottom: var(--ql-space-m, 12px);
      }
      .event {
        display: flex;
        min-width: 0;
        gap: var(--ql-space-m, 12px);
        padding: var(--ql-space-s, 8px) 0 var(--ql-space-s, 8px) var(--ql-space-m, 12px);
        border-left: 2px solid var(--ql-surface-border, #e4dccb);
      }
      .event.next {
        border-left-color: var(--ql-accent-champagne, #b08d57);
      }
      .time {
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/20px var(--ql-font-body, Outfit, sans-serif);
        white-space: nowrap;
      }
      .title {
        margin: 0;
        font: 400 14px/20px var(--ql-font-body, Outfit, sans-serif);
      }
      .empty {
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .divider {
        border: 0;
        border-top: 1px solid var(--ql-surface-border, #e4dccb);
        margin: var(--ql-space-m, 12px) 0;
      }
      .task {
        display: flex;
        align-items: baseline;
        min-width: 0;
        gap: var(--ql-space-s, 8px);
        padding: 2px 0;
        font: 400 14px/20px var(--ql-font-body, Outfit, sans-serif);
      }
      .box {
        color: var(--ql-ink-muted, #8c8578);
      }
      .due {
        color: var(--ql-status-warn, #c08552);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
    `,
  ];

  protected override render(): TemplateResult {
    if (this.config === undefined || !this.hasSources()) {
      return html``;
    }
    const locale = this.locale();
    const openTasks = this.tasks.filter((task) => task.status !== 'completed');
    const calendarsConfigured = (this.config.calendars?.length ?? 0) > 0;
    return html`
      <div class="ql-card">
        <div class="head">
          <ql-section-eyebrow label=${t(locale, 'section.schedule')}></ql-section-eyebrow>
          <ql-segmented
            .options=${this.viewOptions()}
            value="agenda"
            label=${t(locale, 'section.schedule')}
          ></ql-segmented>
        </div>
        ${calendarsConfigured
          ? this.loadFailed
            ? html`<p class="empty">${t(locale, 'common.unavailable')}</p>`
            : this.agenda.length === 0
              ? html`<p class="empty">${t(locale, 'schedule.no_events')}</p>`
              : this.agenda.map(
                  (item, index) => html`
                    <div class="event ${index === 0 ? 'next' : ''}">
                      <p class="time">${formatAgendaTime(item, locale)}</p>
                      <p class="title ql-clamp-2">${item.title}</p>
                    </div>
                  `,
                )
          : nothing}
        ${openTasks.length > 0
          ? html`
              <hr class="divider" />
              ${openTasks.map(
                (task) => html`
                  <div class="task">
                    <span class="box" aria-hidden="true">☐</span>
                    <span class="ql-clamp-2">${task.summary}</span>
                    ${isDueSoon(task.due) ? html`<span class="due">${task.due}</span>` : nothing}
                  </div>
                `,
              )}
            `
          : nothing}
      </div>
    `;
  }
}

registerCard('quiet-luxe-schedule-card', QuietLuxeScheduleCard, {
  name: 'Quiet Luxe Schedule Card',
  description: 'Calendar agenda with to-do glance rows. Renders nothing without sources.',
});
