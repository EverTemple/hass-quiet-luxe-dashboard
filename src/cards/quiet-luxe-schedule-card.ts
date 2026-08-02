import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
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
  formatDue,
  isDueSoon,
  updateTodoItem,
  type AgendaItem,
  type HaTodoItem,
} from './schedule-data';

export type ScheduleCardView = 'schedule' | 'tasks';

export interface ScheduleCardConfig {
  readonly type: string;
  /** Calendar entity ids. Omitted/empty (per-home `calendar: none`) → tasks only. */
  readonly calendars?: ReadonlyArray<string>;
  readonly todo_entity?: string;
  /** Agenda window in days. */
  readonly days?: number;
  /** Which view opens first; ignored when that view has no source. */
  readonly default_view?: ScheduleCardView;
}

/**
 * Schedule card (Figma `card/schedule-v2`, 55:4706). One card, two views,
 * switched by a segmented control — it supersedes both the old schedule card
 * (which carried a dead agenda/day/week/month axis and duplicated task rows)
 * and the separate tasks card. The two used to be emitted side by side and
 * competed for the same slot.
 *
 * Only the views that have a source are offered, so a home with no calendar
 * integration opens straight on Tasks instead of a segment that can only ever
 * say "Nothing scheduled". With no source at all the card renders nothing and
 * the strategy omits the section.
 */
export class QuietLuxeScheduleCard extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
    view: { state: true },
    agenda: { state: true },
    tasks: { state: true },
    loadFailed: { state: true },
  };

  declare config?: ScheduleCardConfig;
  declare view: ScheduleCardView;
  declare agenda: ReadonlyArray<AgendaItem>;
  declare tasks: ReadonlyArray<HaTodoItem>;
  declare loadFailed: boolean;
  private started = false;
  private refreshTimer?: number;

  constructor() {
    super();
    this.view = 'schedule';
    this.agenda = [];
    this.tasks = [];
    this.loadFailed = false;
  }

  setConfig(config: ScheduleCardConfig): void {
    if (
      config.default_view !== undefined &&
      config.default_view !== 'schedule' &&
      config.default_view !== 'tasks'
    ) {
      throw new Error('quiet-luxe-schedule-card: "default_view" must be "schedule" or "tasks"');
    }
    this.config = config;
    this.view = this.initialView(config);
  }

  private initialView(config: ScheduleCardConfig): ScheduleCardView {
    const views = this.availableViews(config);
    const wanted = config.default_view;
    if (wanted !== undefined && views.includes(wanted)) {
      return wanted;
    }
    return views[0] ?? 'schedule';
  }

  /** The views this home can actually fill, in display order. */
  availableViews(config = this.config): ReadonlyArray<ScheduleCardView> {
    const views: ScheduleCardView[] = [];
    if ((config?.calendars?.length ?? 0) > 0) {
      views.push('schedule');
    }
    if (config?.todo_entity !== undefined) {
      views.push('tasks');
    }
    return views;
  }

  hasSources(): boolean {
    return this.availableViews().length > 0;
  }

  openTaskCount(): number {
    return this.tasks.filter((task) => task.status !== 'completed').length;
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
    if (config.todo_entity !== undefined && this.availability(config.todo_entity) === 'available') {
      try {
        this.tasks = await fetchTodoItems(hass, config.todo_entity);
      } catch (error) {
        console.error('quiet-luxe-schedule-card: to-do load failed', error);
      }
    }
  }

  private viewOptions(): ReadonlyArray<QlSegmentOption> {
    const locale = this.locale();
    const labels: Readonly<Record<ScheduleCardView, string>> = {
      schedule: t(locale, 'section.schedule'),
      tasks: t(locale, 'schedule.tasks'),
    };
    return this.availableViews().map((value) => ({ value, label: labels[value] }));
  }

  private readonly onViewChange = (event: Event): void => {
    const value = (event as CustomEvent<{ value: string }>).detail.value;
    if (value === 'schedule' || value === 'tasks') {
      this.view = value;
    }
  };

  private readonly onToggle = (item: HaTodoItem): void => {
    const hass = this.hass;
    const entityId = this.config?.todo_entity;
    if (hass === undefined || entityId === undefined) {
      return;
    }
    void updateTodoItem(hass, entityId, item.uid, item.status !== 'completed').then(() =>
      this.refresh(),
    );
  };

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .ql-card {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--ql-space-m, 12px);
      }
      .list {
        display: flex;
        flex-direction: column;
        gap: var(--ql-space-m, 12px);
        width: 100%;
        min-width: 0;
      }
      .event {
        display: flex;
        min-width: 0;
        gap: var(--ql-space-m, 12px);
      }
      .rule {
        flex: none;
        width: 2px;
        align-self: stretch;
        border-radius: var(--ql-radius-chip, 999px);
        background: var(--ql-surface-border, #e4dccb);
      }
      .event.next .rule {
        background: var(--ql-accent-champagne, #b08d57);
      }
      .event-text {
        display: flex;
        flex-direction: column;
        gap: var(--ql-space-xs, 4px);
        min-width: 0;
      }
      .title {
        margin: 0;
        color: var(--ql-ink-primary, #2b2620);
        font: 400 14px/20px var(--ql-font-body, Outfit, sans-serif);
      }
      .source {
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.02em;
      }
      .task {
        display: flex;
        align-items: center;
        gap: var(--ql-space-m, 12px);
        min-width: 0;
        /* A whole row is the target; the box only draws it. */
        min-height: 28px;
        cursor: pointer;
      }
      .task input {
        flex: none;
        width: 14px;
        height: 14px;
        margin: 0;
        accent-color: var(--ql-accent-champagne, #b08d57);
      }
      .summary {
        flex: 1 1 0;
        min-width: 0;
        color: var(--ql-ink-primary, #2b2620);
        font: 400 14px/20px var(--ql-font-body, Outfit, sans-serif);
      }
      .task.completed .summary {
        color: var(--ql-ink-muted, #8c8578);
        text-decoration: line-through;
      }
      .due {
        flex: none;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.02em;
      }
      .due.soon {
        color: var(--ql-status-warn, #c08552);
      }
      .footer {
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.02em;
      }
      /* A view with nothing in it is a calm sentence, never a collapsed card. */
      .empty {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: var(--ql-space-xl, 24px) 0;
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.02em;
        text-align: center;
      }
      .eyebrow {
        display: block;
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
    `,
  ];

  private renderAgenda(): TemplateResult {
    const locale = this.locale();
    if (this.loadFailed) {
      return html`<p class="empty">${t(locale, 'common.unavailable')}</p>`;
    }
    if (this.agenda.length === 0) {
      return html`<p class="empty">${t(locale, 'schedule.nothing_scheduled')}</p>`;
    }
    return html`
      <div class="list">
        ${this.agenda.map(
          (item, index) => html`
            <div class="event ${index === 0 ? 'next' : ''}">
              <span class="rule" aria-hidden="true"></span>
              <div class="event-text">
                <p class="title ql-clamp-2">
                  ${formatAgendaTime(item, locale)} · ${item.title}
                </p>
                <p class="source ql-clamp-1">${this.nameOf(item.calendarId)}</p>
              </div>
            </div>
          `,
        )}
      </div>
    `;
  }

  private renderTasks(): TemplateResult {
    const locale = this.locale();
    const entityId = this.config?.todo_entity ?? '';
    if (this.availability(entityId) !== 'available') {
      const name = this.nameOf(entityId);
      return html`
        <div class="list ql-unavailable">
          <button
            class="ql-info"
            type="button"
            data-ql-info=${entityId}
            aria-label=${`${name} — ${t(locale, 'common.show_details')}`}
            @click=${this.onMoreInfo}
          >
            <span class="eyebrow ql-clamp-2">${name}</span>
          </button>
          <p class="empty">${t(locale, 'common.unavailable')}</p>
        </div>
      `;
    }
    if (this.tasks.length === 0) {
      return html`<p class="empty">${t(locale, 'tasks.all_done')}</p>`;
    }
    const open = this.openTaskCount();
    return html`
      <div class="list">
        ${this.tasks.map((item) => {
          const completed = item.status === 'completed';
          const due = completed ? undefined : formatDue(item.due, locale);
          return html`
            <label class="task ${completed ? 'completed' : ''}">
              <input
                type="checkbox"
                .checked=${completed}
                @change=${(): void => this.onToggle(item)}
              />
              <span class="summary ql-clamp-2">${item.summary}</span>
              ${due === undefined
                ? nothing
                : html`<span class="due ${isDueSoon(item.due) ? 'soon' : ''}">${due}</span>`}
            </label>
          `;
        })}
      </div>
      <p class="footer">
        ${open > 0 ? `${open} ${t(locale, 'tasks.open')}` : t(locale, 'tasks.all_done')}
      </p>
    `;
  }

  protected override render(): TemplateResult {
    if (this.config === undefined || !this.hasSources()) {
      return html``;
    }
    const locale = this.locale();
    return html`
      <div class="ql-card">
        <ql-segmented
          .options=${this.viewOptions()}
          .value=${this.view}
          label=${t(locale, 'section.schedule')}
          @ql-change=${this.onViewChange}
        ></ql-segmented>
        ${this.view === 'schedule' ? this.renderAgenda() : this.renderTasks()}
      </div>
    `;
  }
}

registerCard('quiet-luxe-schedule-card', QuietLuxeScheduleCard, {
  name: 'Quiet Luxe Schedule Card',
  description: 'Calendar agenda and to-do list in one card, switched by a Schedule/Tasks toggle.',
});
