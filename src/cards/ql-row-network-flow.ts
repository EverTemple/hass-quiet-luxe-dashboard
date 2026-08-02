import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import { live } from 'lit/directives/live.js';
import '../elements/ql-toggle';
import { t } from '../i18n/translate';
import { QlBaseCard } from './ql-base-card';
import { CONFIRM_TIMEOUT_MS } from './quiet-luxe-climate-card';

export interface NetworkFlowRowConfig {
  readonly type: string;
  /** Switch entity backing the Node-RED/UniFi/pfSense flow. */
  readonly entity: string;
  readonly name?: string;
  readonly description?: string;
}

/**
 * Network-flow row (Figma `row/network-flow`): labeled toggle with the
 * climate-card confirm-arm pattern (spec §9 — consequential actions confirm
 * at every tier) and a persistent localized confirm-hint caption.
 * Registered define-only (plan D6).
 */
export class QlRowNetworkFlow extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
    armed: { state: true },
  };

  declare config?: NetworkFlowRowConfig;
  declare armed: boolean;
  private disarmTimer?: number;

  constructor() {
    super();
    this.armed = false;
  }

  setConfig(config: NetworkFlowRowConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('ql-row-network-flow: "entity" is required');
    }
    this.config = config;
  }

  getCardSize(): number {
    return 1;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.disarmTimer);
  }

  private onToggle(): void {
    if (!this.armed) {
      this.armed = true;
      this.disarmTimer = window.setTimeout(() => {
        this.armed = false;
      }, CONFIRM_TIMEOUT_MS);
      return;
    }
    window.clearTimeout(this.disarmTimer);
    this.armed = false;
    const entityId = this.config?.entity;
    if (entityId === undefined || this.hass === undefined) {
      return;
    }
    const domain = entityId.split('.')[0] ?? 'switch';
    void this.hass.callService(domain, 'toggle', { entity_id: entityId });
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .ql-card {
        padding: var(--ql-space-m, 12px) var(--ql-space-l, 16px);
      }
      .row {
        display: flex;
        align-items: center;
        gap: var(--ql-space-m, 12px);
      }
      .lines {
        flex: 1;
        min-width: 0;
      }
      .name {
        margin: 0;
        font: 400 14px/20px var(--ql-font-body, Outfit, sans-serif);
      }
      .description {
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .hint {
        margin: var(--ql-space-xs, 4px) 0 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .hint.armed {
        color: var(--ql-status-warn, #c08552);
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
    const unavailable = availability !== 'available';
    const name = this.nameOf(config.entity, config.name);
    const on = this.entity(config.entity)?.state === 'on';
    return html`
      <div class="ql-card ${unavailable ? 'ql-unavailable' : ''}">
        <div class="row">
          <div class="lines">
            <p class="name">${name}</p>
            ${config.description === undefined
              ? nothing
              : html`<p class="description">${config.description}</p>`}
          </div>
          <ql-toggle
            .checked=${live(!unavailable && on)}
            label=${name}
            ?disabled=${unavailable}
            @ql-change=${this.onToggle}
          ></ql-toggle>
        </div>
        <p class="hint ${this.armed ? 'armed' : ''}">
          ${this.armed ? t(locale, 'common.tap_confirm') : t(locale, 'flow.confirm_hint')}
        </p>
      </div>
    `;
  }
}

customElements.define('ql-row-network-flow', QlRowNetworkFlow);
