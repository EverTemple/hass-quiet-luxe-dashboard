import {
  css,
  html,
  nothing,
  svg,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import { live } from 'lit/directives/live.js';
import '../elements/ql-status-dot';
import '../elements/ql-toggle';
import { t } from '../i18n/translate';
import { CAR_BODY_PATHS, CAR_VIEWBOX, CAR_WHEELS, type CarBrand } from './car-silhouettes';
import { contentGrid, COLUMNS_FULL, type QlGridOptions } from './grid-options';
import { QlBaseCard } from './ql-base-card';
import { CONFIRM_TIMEOUT_MS } from './quiet-luxe-climate-card';
import { registerCard } from './register';

const BRANDS: ReadonlyArray<CarBrand> = ['bmw', 'audi', 'liauto'];

export interface CarCardConfig {
  readonly type: string;
  readonly brand: CarBrand;
  readonly name?: string;
  readonly battery_entity?: string;
  readonly fuel_entity?: string;
  readonly range_entity?: string;
  /** binary_sensor device_class lock: on = unlocked, off = locked. */
  readonly lock_entity?: string;
  /** Switch entity; toggled with confirm-arm (spec §9 consequential action). */
  readonly precondition_entity?: string;
  readonly location_entity?: string;
}

/**
 * Car card (Figma `card/car`, brand=bmw|audi|liauto): inline SVG silhouette
 * hero, battery/fuel/range stats, lock state, confirm-armed precondition
 * toggle, location caption. Sections render only when configured.
 */
export class QuietLuxeCarCard extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
    armed: { state: true },
  };

  declare config?: CarCardConfig;
  declare armed: boolean;
  private disarmTimer?: number;

  constructor() {
    super();
    this.armed = false;
  }

  setConfig(config: CarCardConfig): void {
    if (!BRANDS.includes(config.brand)) {
      throw new Error(`quiet-luxe-car-card: brand must be one of ${BRANDS.join('|')}`);
    }
    this.config = config;
  }

  getCardSize(): number {
    return 3;
  }

  getGridOptions(): QlGridOptions {
    return contentGrid(COLUMNS_FULL);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.disarmTimer);
  }

  private percentValue(entityId: string | undefined): string | undefined {
    if (entityId === undefined) {
      return undefined;
    }
    if (this.availability(entityId) !== 'available') {
      return '—';
    }
    const value = Number(this.entity(entityId)?.state);
    return Number.isFinite(value) ? `${Math.round(value)}%` : '—';
  }

  private rangeValue(): string | undefined {
    const entityId = this.config?.range_entity;
    if (entityId === undefined) {
      return undefined;
    }
    if (this.availability(entityId) !== 'available') {
      return '—';
    }
    const entity = this.entity(entityId);
    const value = Number(entity?.state);
    const unit = (entity?.attributes.unit_of_measurement as string | undefined) ?? 'km';
    return Number.isFinite(value) ? `${Math.round(value)} ${unit}` : '—';
  }

  private onPreconditionToggle(): void {
    if (!this.armed) {
      this.armed = true;
      this.disarmTimer = window.setTimeout(() => {
        this.armed = false;
      }, CONFIRM_TIMEOUT_MS);
      return;
    }
    window.clearTimeout(this.disarmTimer);
    this.armed = false;
    const entityId = this.config?.precondition_entity;
    if (entityId === undefined || this.hass === undefined) {
      return;
    }
    const domain = entityId.split('.')[0] ?? 'switch';
    void this.hass.callService(domain, 'toggle', { entity_id: entityId });
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .eyebrow {
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      svg.hero {
        display: block;
        width: 100%;
        max-width: 260px;
        margin: var(--ql-space-m, 12px) auto;
        color: var(--ql-ink-primary, #2b2620);
        opacity: 0.85;
      }
      .stats {
        display: flex;
        gap: var(--ql-space-xl, 24px);
      }
      .stat p {
        margin: 0;
      }
      .stat .value {
        font: 300 26px/30px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.01em;
      }
      .stat .label {
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ql-space-s, 8px);
        margin-top: var(--ql-space-m, 12px);
      }
      .row .label {
        display: inline-flex;
        align-items: center;
        gap: var(--ql-space-s, 8px);
        font: 400 14px/20px var(--ql-font-body, Outfit, sans-serif);
      }
      .confirm {
        margin: var(--ql-space-xs, 4px) 0 0;
        color: var(--ql-status-warn, #c08552);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .caption {
        margin: var(--ql-space-s, 8px) 0 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
    `,
  ];

  private stat(value: string | undefined, label: string): TemplateResult | typeof nothing {
    if (value === undefined) {
      return nothing;
    }
    return html`
      <div class="stat">
        <p class="value">${value}</p>
        <p class="label">${label}</p>
      </div>
    `;
  }

  protected override render(): TemplateResult {
    const config = this.config;
    if (config === undefined) {
      return html``;
    }
    const locale = this.locale();
    const name = config.name ?? config.brand;
    const lockId = config.lock_entity;
    const lockAvailable = lockId !== undefined && this.availability(lockId) === 'available';
    const unlocked = lockAvailable && this.entity(lockId)?.state === 'on';
    const preconditionId = config.precondition_entity;
    const preconditionAvailable =
      preconditionId !== undefined && this.availability(preconditionId) === 'available';
    const preconditionOn =
      preconditionAvailable && this.entity(preconditionId)?.state === 'on';
    const locationId = config.location_entity;
    const location =
      locationId !== undefined && this.availability(locationId) === 'available'
        ? this.entity(locationId)?.state
        : undefined;
    return html`
      <div class="ql-card">
        <p class="eyebrow ql-clamp-2">${name}</p>
        <svg class="hero" viewBox=${CAR_VIEWBOX} role="img" aria-label=${name}>
          <path d=${CAR_BODY_PATHS[config.brand]} fill="currentColor"></path>
          ${CAR_WHEELS[config.brand].map(
            (wheel) =>
              svg`<circle cx=${wheel.cx} cy=${wheel.cy} r=${wheel.r} fill="currentColor"></circle>`,
          )}
        </svg>
        <div class="stats">
          ${this.stat(this.percentValue(config.battery_entity), t(locale, 'common.battery'))}
          ${this.stat(this.percentValue(config.fuel_entity), t(locale, 'car.fuel'))}
          ${this.stat(this.rangeValue(), t(locale, 'car.range'))}
        </div>
        ${lockId === undefined
          ? nothing
          : html`
              <div class="row ${lockAvailable ? '' : 'ql-unavailable'}">
                <span class="label">
                  <ql-status-dot status=${lockAvailable ? (unlocked ? 'warn' : 'good') : 'neutral'}>
                  </ql-status-dot>
                  ${lockAvailable
                    ? t(locale, unlocked ? 'car.unlocked' : 'car.locked')
                    : t(locale, 'common.unavailable')}
                </span>
              </div>
            `}
        ${preconditionId === undefined
          ? nothing
          : html`
              <div class="row ${preconditionAvailable ? '' : 'ql-unavailable'}">
                <span class="label">${t(locale, 'car.precondition')}</span>
                <ql-toggle
                  .checked=${live(preconditionOn)}
                  label=${t(locale, 'car.precondition')}
                  ?disabled=${!preconditionAvailable}
                  @ql-change=${this.onPreconditionToggle}
                ></ql-toggle>
              </div>
              ${this.armed
                ? html`<p class="confirm">${t(locale, 'common.tap_confirm')}</p>`
                : nothing}
            `}
        ${location === undefined
          ? nothing
          : html`<p class="caption">${t(locale, 'car.location')} · ${location}</p>`}
      </div>
    `;
  }
}

registerCard('quiet-luxe-car-card', QuietLuxeCarCard, {
  name: 'Quiet Luxe Car Card',
  description: 'Brand silhouette hero with battery/fuel/range, lock, precondition, location.',
});
