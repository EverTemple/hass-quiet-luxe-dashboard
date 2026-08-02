import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { t } from '../i18n/translate';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';
import {
  AGENDA_REFRESH_MS,
  fetchTodoItems,
  isDueSoon,
  updateTodoItem,
  type HaTodoItem,
} from './schedule-data';

export interface TasksCardConfig {
  readonly type: string;
  readonly entity: string;
  readonly name?: string;
}

/**
 * Tasks card (Figma `card/tasks`): interactive todo list. Items via the
 * todo/item/list WS command; checkbox → todo.update_item (plan D5);
 * "N open" footer.
 */
export class QuietLuxeTasksCard extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
    items: { state: true },
  };

  declare config?: TasksCardConfig;
  declare items: ReadonlyArray<HaTodoItem>;
  private started = false;
  private refreshTimer?: number;

  constructor() {
    super();
    this.items = [];
  }

  setConfig(config: TasksCardConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('quiet-luxe-tasks-card: "entity" is required');
    }
    this.config = config;
  }

  getCardSize(): number {
    return 3;
  }

  getGridOptions(): { rows: number; columns: number } {
    return { rows: 3, columns: 4 };
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.started && this.hass !== undefined && this.config !== undefined) {
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
    if (this.availability(config.entity) !== 'available') {
      return;
    }
    try {
      this.items = await fetchTodoItems(hass, config.entity);
    } catch (error) {
      console.error('quiet-luxe-tasks-card: to-do load failed', error);
    }
  }

  private onToggle(item: HaTodoItem): void {
    const hass = this.hass;
    const config = this.config;
    if (hass === undefined || config === undefined) {
      return;
    }
    void updateTodoItem(hass, config.entity, item.uid, item.status !== 'completed').then(() =>
      this.refresh(),
    );
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .eyebrow {
        margin: 0 0 var(--ql-space-s, 8px);
        color: var(--ql-ink-muted, #8c8578);
        font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .task {
        display: flex;
        align-items: baseline;
        gap: var(--ql-space-s, 8px);
        padding: 4px 0;
        font: 400 14px/20px var(--ql-font-body, Outfit, sans-serif);
      }
      .task input {
        accent-color: var(--ql-accent-champagne, #b08d57);
      }
      .task.completed span.summary {
        color: var(--ql-ink-muted, #8c8578);
        text-decoration: line-through;
      }
      .due {
        color: var(--ql-status-warn, #c08552);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .footer {
        margin: var(--ql-space-s, 8px) 0 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .empty {
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
    `,
  ];

  protected override render(): TemplateResult {
    const config = this.config;
    if (config === undefined) {
      return html``;
    }
    const locale = this.locale();
    const availability = this.availability(config.entity);
    const name = this.nameOf(config.entity, config.name);
    if (availability !== 'available') {
      return html`
        <div class="ql-card ql-unavailable">
          <p class="eyebrow">${name}</p>
          <p class="empty">${t(locale, 'common.unavailable')}</p>
        </div>
      `;
    }
    const openCount = this.items.filter((item) => item.status !== 'completed').length;
    return html`
      <div class="ql-card">
        <p class="eyebrow">${name}</p>
        ${this.items.map((item) => {
          const completed = item.status === 'completed';
          return html`
            <label class="task ${completed ? 'completed' : ''}">
              <input
                type="checkbox"
                .checked=${completed}
                @change=${(): void => this.onToggle(item)}
              />
              <span class="summary">${item.summary}</span>
              ${!completed && isDueSoon(item.due)
                ? html`<span class="due">${item.due}</span>`
                : nothing}
            </label>
          `;
        })}
        <p class="footer">
          ${openCount > 0 ? `${openCount} ${t(locale, 'tasks.open')}` : t(locale, 'tasks.all_done')}
        </p>
      </div>
    `;
  }
}

registerCard('quiet-luxe-tasks-card', QuietLuxeTasksCard, {
  name: 'Quiet Luxe Tasks Card',
  description: 'To-do list with completion checkboxes and an open-items footer.',
});
