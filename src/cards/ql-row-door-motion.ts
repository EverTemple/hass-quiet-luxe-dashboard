import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import '../elements/ql-status-dot';
import '../elements/ql-toggle';
import type { QlStatus } from '../elements/ql-status-dot';
import { t } from '../i18n/translate';
import { contentGrid, COLUMNS_FULL, type QlGridOptions } from './grid-options';
import { QlBaseCard } from './ql-base-card';

export type DoorMotionKind = 'door' | 'motion';

export interface DoorMotionRowConfig {
  readonly type: string;
  /** binary_sensor entity (device_class door/window or motion). */
  readonly entity: string;
  readonly name?: string;
  /** Defaults from device_class: 'motion' → motion, anything else → door. */
  readonly kind?: DoorMotionKind;
  /** Switch entity controlling motion detection (RBAC-gated by the strategy). */
  readonly toggle_entity?: string;
  readonly show_toggle?: boolean;
}

/**
 * Door/motion row (Figma `row/door-motion`): name + localized state +
 * status dot, optional detection toggle (showToggle boolean prop in Figma).
 * Registered define-only (plan D6).
 */
export class QlRowDoorMotion extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
  };

  declare config?: DoorMotionRowConfig;

  setConfig(config: DoorMotionRowConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('ql-row-door-motion: "entity" is required');
    }
    this.config = config;
  }

  getCardSize(): number {
    return 1;
  }

  getGridOptions(): QlGridOptions {
    return contentGrid(COLUMNS_FULL);
  }

  kind(): DoorMotionKind {
    if (this.config?.kind !== undefined) {
      return this.config.kind;
    }
    const deviceClass = this.entity(this.config?.entity ?? '')?.attributes.device_class;
    return deviceClass === 'motion' ? 'motion' : 'door';
  }

  private onToggle(): void {
    const toggleId = this.config?.toggle_entity;
    if (toggleId === undefined || this.hass === undefined) {
      return;
    }
    const domain = toggleId.split('.')[0] ?? 'switch';
    void this.hass.callService(domain, 'toggle', { entity_id: toggleId });
  }

  private stateInfo(): { text: string; dot: QlStatus } {
    const locale = this.locale();
    const entityId = this.config?.entity ?? '';
    if (this.availability(entityId) !== 'available') {
      return { text: t(locale, 'common.unavailable'), dot: 'neutral' };
    }
    const active = this.entity(entityId)?.state === 'on';
    if (this.kind() === 'motion') {
      return active
        ? { text: t(locale, 'motion.detected'), dot: 'warn' }
        : { text: t(locale, 'motion.clear'), dot: 'good' };
    }
    return active
      ? { text: t(locale, 'door.open'), dot: 'warn' }
      : { text: t(locale, 'door.closed'), dot: 'good' };
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .ql-card {
        display: flex;
        align-items: center;
        gap: var(--ql-space-m, 12px);
        padding: var(--ql-space-m, 12px) var(--ql-space-l, 16px);
      }
      .name {
        margin: 0;
        flex: 1 1 auto;
        min-width: 0;
        font: 400 14px/20px var(--ql-font-body, Outfit, sans-serif);
      }
      .state {
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
    const info = this.stateInfo();
    const toggleId = config.toggle_entity;
    const showToggle = config.show_toggle === true && toggleId !== undefined;
    const toggleOn = toggleId !== undefined && this.entity(toggleId)?.state === 'on';
    return html`
      <div class="ql-card ${availability === 'available' ? '' : 'ql-unavailable'}">
        <ql-status-dot status=${info.dot}></ql-status-dot>
        <p class="name ql-clamp-2">${name}</p>
        <p class="state">${info.text}</p>
        ${showToggle
          ? html`
              <ql-toggle
                .checked=${toggleOn}
                label=${t(locale, 'motion.toggle_label')}
                ?disabled=${toggleId !== undefined &&
                this.availability(toggleId) !== 'available'}
                @ql-change=${this.onToggle}
              ></ql-toggle>
            `
          : nothing}
      </div>
    `;
  }
}

customElements.define('ql-row-door-motion', QlRowDoorMotion);
