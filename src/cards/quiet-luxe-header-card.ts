import { css, html, type CSSResultGroup, type TemplateResult } from 'lit';
import '../elements/ql-header-home';
import '../elements/ql-header-room';
import type { QlHeaderVariant } from '../elements/ql-header-home';
import { t } from '../i18n/translate';
import { contentGrid, type QlGridOptions } from './grid-options';
import { navigate } from './navigate';
import { QlBaseCard } from './ql-base-card';

export interface HeaderCardConfig {
  readonly type: string;
  readonly form: 'home' | 'room';
  readonly name: string;
  /** Strategy sets false for the guest tier — never a greeting on kiosks. */
  readonly show_greeting?: boolean;
  readonly weather_entity?: string;
  readonly aqi_entity?: string;
  readonly presence_entities?: ReadonlyArray<string>;
  readonly temperature_entity?: string;
  readonly humidity_entity?: string;
  readonly back_path?: string;
}

export const VARIANT_IPAD_MIN_PX = 768;
export const VARIANT_DESKTOP_MIN_PX = 1400;

export function variantForWidth(width: number): QlHeaderVariant {
  if (width < VARIANT_IPAD_MIN_PX) {
    return 'mobile';
  }
  if (width < VARIANT_DESKTOP_MIN_PX) {
    return 'ipad';
  }
  return 'desktop';
}

/**
 * Strategy-composed wrapper turning the Plan 3a header elements into a card
 * (D7). Define-only — the strategy is its only intended author, so it stays
 * out of the picker. Guest kiosks get show_greeting: false (belt) while
 * ql-header-home also ignores userName on ipad/desktop variants (braces).
 */
export class QuietLuxeHeaderCard extends QlBaseCard {
  static override properties = {
    config: { attribute: false },
    viewportWidth: { attribute: false },
  };

  declare config?: HeaderCardConfig;
  /** Width the header actually has, which is what decides whether a row fits. */
  declare viewportWidth: number;
  private observer?: ResizeObserver;

  constructor() {
    super();
    this.viewportWidth = window.innerWidth;
  }

  private readonly handleResize = (): void => {
    const own = this.getBoundingClientRect().width;
    this.viewportWidth = own > 0 ? own : window.innerWidth;
  };

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('resize', this.handleResize);
    // The card can be narrower than the window (sidebar, section span), and a
    // row that does not fit its own box is what made the header wrap.
    if (typeof ResizeObserver === 'function') {
      this.observer = new ResizeObserver(this.handleResize);
      this.observer.observe(this);
    }
    this.handleResize();
  }

  override disconnectedCallback(): void {
    window.removeEventListener('resize', this.handleResize);
    this.observer?.disconnect();
    this.observer = undefined;
    super.disconnectedCallback();
  }

  setConfig(config: HeaderCardConfig): void {
    if (config.form !== 'home' && config.form !== 'room') {
      throw new Error('quiet-luxe-header-card: "form" must be "home" or "room"');
    }
    if (typeof config.name !== 'string' || config.name === '') {
      throw new Error('quiet-luxe-header-card: "name" is required');
    }
    this.config = config;
  }

  getCardSize(): number {
    return 2;
  }

  /* The header owns its whole section, whatever that section spans. */
  getGridOptions(): QlGridOptions {
    return contentGrid('full');
  }

  meta(): string {
    const parts: string[] = [];
    const weatherId = this.config?.weather_entity;
    if (weatherId !== undefined && this.availability(weatherId) === 'available') {
      const temperature: unknown = this.entity(weatherId)?.attributes.temperature;
      if (typeof temperature === 'number') {
        parts.push(`${Math.round(temperature)}°`);
      }
    }
    const aqiId = this.config?.aqi_entity;
    if (aqiId !== undefined && this.availability(aqiId) === 'available') {
      parts.push(`AQI ${this.entity(aqiId)?.state ?? ''}`);
    }
    return parts.join(' · ');
  }

  presenceLine(): string {
    const persons = this.config?.presence_entities ?? [];
    if (persons.length === 0) {
      return '';
    }
    const names = persons
      .filter((id) => this.entity(id)?.state === 'home')
      .map((id) => this.nameOf(id));
    if (names.length === 0) {
      return t(this.locale(), 'header.nobody_home');
    }
    return `${names.join(' & ')} ${t(this.locale(), 'header.home_suffix')}`;
  }

  roomStats(): ReadonlyArray<string> {
    const config = this.config;
    if (config === undefined) {
      return [];
    }
    const stats: string[] = [];
    const push = (entityId: string | undefined, format: (state: string) => string): void => {
      if (entityId !== undefined && this.availability(entityId) === 'available') {
        stats.push(format(this.entity(entityId)?.state ?? ''));
      }
    };
    push(config.temperature_entity, (state) => `${state}°`);
    push(config.humidity_entity, (state) => `${state}%`);
    push(config.aqi_entity, (state) => `AQI ${state}`);
    return stats;
  }

  private readonly onBack = (): void => {
    const path = this.config?.back_path;
    if (path !== undefined) {
      navigate(path);
    }
  };

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  protected override render(): TemplateResult {
    const config = this.config;
    if (config === undefined) {
      return html``;
    }
    if (config.form === 'room') {
      return html`
        <ql-header-room
          .name=${config.name}
          .stats=${this.roomStats()}
          .locale=${this.locale()}
          @ql-back=${this.onBack}
        ></ql-header-room>
      `;
    }
    const greet = config.show_greeting !== false;
    return html`
      <ql-header-home
        .variant=${variantForWidth(this.viewportWidth)}
        .homeName=${config.name}
        .userName=${greet ? (this.hass?.user?.name ?? '') : ''}
        .meta=${this.meta()}
        .presence=${this.presenceLine()}
        .locale=${this.locale()}
      ></ql-header-home>
    `;
  }
}

customElements.define('quiet-luxe-header-card', QuietLuxeHeaderCard);
