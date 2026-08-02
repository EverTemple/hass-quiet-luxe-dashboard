import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';
import '../elements/ql-air-quality';
import '../elements/ql-dial-button';
import '../elements/ql-preset-row';
import '../elements/ql-sheet';
import '../elements/ql-sheet-button';
import '../elements/ql-sweep-dial';
import '../elements/ql-timer-dial';
import '../elements/ql-toggle';
import { dysonIcon } from '../elements/dyson-icons';
import type { QlPresetOption } from '../elements/ql-preset-row';
import { t } from '../i18n/translate';
import type { Locale } from '../i18n/types';
import type { HassEntity } from '../types/home-assistant';
import {
  airReadings,
  BAND_KEYS,
  resolveThresholds,
  summaryBand,
  type AirQualityThresholdOverride,
  type AirReading,
} from './air-quality';
import type { ServiceCall } from './device-controls';
import {
  ANGLE_SPANS,
  angleForSpan,
  fanOscillationAngle,
  nearestSpan,
  type OscillationAngle,
} from './supported-features';
import {
  MIN_SWEEP,
  TIMER_PRESETS,
  airflowCall,
  autoPresetOf,
  dialButtonsFor,
  fanCapabilities,
  fanSpeedStep,
  hvacCall,
  isMinSweep,
  nightModeCall,
  normaliseSweep,
  oscillationCall,
  powerCall,
  presetCall,
  speedCall,
  sweepFromFront,
  timerCall,
  timerLabel,
  type AirflowDirection,
  type DialId,
  type FanCapabilities,
  type FanCardForm,
  type FanEntities,
  type ServiceRegistry,
} from './fan-capabilities';
import { COLUMNS_FULL, contentGrid, type QlGridOptions } from './grid-options';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';
import { formatSensorValue } from './sensor-format';

export interface FanCardConfig {
  readonly type: string;
  /** The `fan` entity. Everything else is a companion the strategy resolves. */
  readonly entity: string;
  readonly climate_entity?: string;
  readonly night_mode_entity?: string;
  readonly temperature_entity?: string;
  /** The air sensors this device publishes; each is drawn only if present. */
  readonly pm25_entity?: string;
  readonly pm10_entity?: string;
  readonly voc_entity?: string;
  readonly no2_entity?: string;
  /**
   * Per-home band boundaries. Dyson publishes none, so the defaults in
   * `air-quality.ts` are corroborated or community-derived and every one of
   * them is stated there with its confidence. A home that prefers WHO guideline
   * values, or its own local standard, says so here.
   */
  readonly air_quality_thresholds?: AirQualityThresholdOverride;
  readonly name?: string;
  readonly area?: string;
  readonly form?: FanCardForm;
  /**
   * The integration behind the fan entity, from the registry. It is what makes
   * an integration-specific service (the sleep timer) provably this device's.
   */
  readonly platform?: string;
}

type SheetId = 'more' | 'oscillation' | 'timer' | 'airflow' | 'speed';

const DIAL_ICON: Readonly<Record<DialId, Parameters<typeof dysonIcon>[0]>> = {
  power: 'power',
  cooling: 'cooling',
  auto: 'auto',
  speed: 'speed',
  heating: 'heating',
  oscillation: 'oscillation',
  timer: 'timer',
  night: 'night',
  direction: 'direction',
  more: 'more',
};

/**
 * Dyson-style fan / purifier card (Figma `card/device-dyson`).
 *
 * Every dial is gated on a capability the device itself reports — the fan's
 * `supported_features` mask, the presets it lists, whether a `climate` sibling
 * offers the mode, whether a night-mode switch exists, and whether the
 * integration registered the timer service. A capability that is absent loses
 * its dial rather than rendering a control that does nothing.
 *
 * `form: 'compact'` is the dashboard card — header plus the three most-reached-for
 * dials and a More button that opens the complete grid in a sheet. `form: 'full'`
 * draws the whole grid inline.
 */
export class QuietLuxeFanCard extends QlBaseCard {
  static override properties = {
    ...QlBaseCard.properties,
    config: { state: true },
    sheet: { state: true },
    draftAngle: { state: true },
    draftMinutes: { state: true },
    draftDirection: { state: true },
    draftStep: { state: true },
    draftAuto: { state: true },
    timerMinutes: { state: true },
    sweepDrag: { state: true },
  };

  declare config?: FanCardConfig;
  private sheet?: SheetId;
  private draftAngle?: OscillationAngle;
  private draftMinutes = 0;
  private draftDirection: AirflowDirection = 'front';
  private draftStep = 0;
  private draftAuto = false;
  /** Which part of the sweep dial is under a finger, if any. */
  private sweepDrag?: string;
  /**
   * The timer is write-only: `dyson_local.set_timer` sets it, and no entity or
   * attribute reports what is left. What the card knows is what this session
   * set, so the dial shows Off until the user sets one.
   */
  private timerMinutes = 0;

  setConfig(config: FanCardConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('quiet-luxe-fan-card: "entity" is required');
    }
    if (!config.entity.startsWith('fan.')) {
      throw new Error('quiet-luxe-fan-card: "entity" must be a fan entity');
    }
    this.config = config;
  }

  form(): FanCardForm {
    return this.config?.form ?? 'compact';
  }

  getCardSize(): number {
    return this.form() === 'full' ? 4 : 2;
  }

  /**
   * Both forms take a whole view column.
   *
   * A dial is a fixed 64px thumb target, so three across need 208px of content
   * box and four need 272px. Half a view column is about 171px, which leaves
   * 139px inside the card's padding — not enough for two dials, let alone
   * three, so the grid collapsed to a single column and the card grew to nine
   * rows tall. That is the dead space beside the Climate section: a 800px
   * ladder of dials standing next to a 440px thermostat. The container queries
   * below still do the reflowing; this just stops the card being handed a box
   * no arrangement of thumb targets can fit.
   */
  getGridOptions(): QlGridOptions {
    return contentGrid(COLUMNS_FULL);
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .ql-card {
        display: flex;
        flex-direction: column;
        gap: var(--ql-space-l, 16px);
        /* The dial grid has to answer to the card's own width, not the
           viewport's: a half-width card on a phone and a half-width card on a
           desktop are very different, and HA decides which one this is. */
        container-type: inline-size;
      }
      .header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--ql-space-s, 8px);
        min-width: 0;
      }
      .reading {
        display: flex;
        flex-direction: column;
        gap: var(--ql-space-xs, 4px);
        min-width: 0;
      }
      /* The readout owns its own layout, including how it re-aligns when the
         card is narrow; the card only says how much room it may take. */
      .air {
        flex: 0 0 auto;
        min-width: 0;
      }
      .eyebrow {
        color: var(--ql-ink-muted, #8c8578);
        font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .numeral {
        color: var(--ql-ink-primary, #2b2620);
        font: 300 26px/30px var(--ql-font-display, Outfit, sans-serif);
        letter-spacing: 0.01em;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .numeral-xl {
        color: var(--ql-ink-primary, #2b2620);
        font: 300 44px/48px var(--ql-font-display, Outfit, sans-serif);
        letter-spacing: 0.01em;
        font-variant-numeric: tabular-nums;
      }
      /* The dials sit on a fluid track rather than fixed 92/72px columns so a
         narrow phone column and a wide desktop card both distribute evenly.

         The nine dials of the full grid read 3 across and 3 down. That is the
         shape the design draws and the shape that keeps the card square-ish; a
         single 9-tall column is what produced the dead space beside the Climate
         section, because a 88px-tall dial stacked nine times is 800px of card
         next to a 440px thermostat. The row gap is tighter than the column gap
         because a dial and its label are already a vertical unit. */
      .grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        column-gap: var(--ql-space-l, 16px);
        row-gap: var(--ql-space-m, 12px);
        justify-items: center;
      }
      .grid.compact {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      /* A dial is a fixed 64px because it is a thumb target, so it cannot be
         squeezed — the row wraps instead. The query measures the card's own
         content box, never the viewport, so the same card reflows correctly in
         a phone column and in a desktop one. The column gap closes to 8px
         before a column is dropped, which is what lets three dials survive down
         to 3*64 + 2*8 = 208px instead of giving up at 224. */
      @container (max-width: 303px) {
        .grid.compact {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @container (max-width: 255px) {
        .grid,
        .grid.compact {
          column-gap: var(--ql-space-s, 8px);
        }
        /* The AIR QUALITY readout cannot shrink, so sharing a row with it
           clamped the device name down to one letter ("T…") in a desktop grid
           column. Below this width the two readings stack instead. */
        .header {
          flex-direction: column;
          align-items: flex-start;
        }
      }
      @container (max-width: 207px) {
        .grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @container (max-width: 135px) {
        .grid,
        .grid.compact {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .caption {
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.02em;
      }
      /* The floor is the one moment the readout stops answering the finger, so
         it says so in the accent rather than going quiet. */
      .numeral.locked,
      .caption.locked {
        color: var(--ql-accent-champagne, #b08d57);
      }
      .readout {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--ql-space-xs, 4px);
        text-align: center;
      }
      .tiles {
        display: flex;
        align-items: stretch;
        gap: var(--ql-space-m, 12px);
      }
      .tile {
        position: relative;
        display: flex;
        flex: 1 1 0;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--ql-space-s, 8px);
        min-width: 0;
        min-height: 168px;
        padding: var(--ql-space-xl, 24px) var(--ql-space-l, 16px);
        border: 1px solid var(--ql-surface-border, #e4dccb);
        border-radius: var(--ql-radius-card, 18px);
        background: var(--ql-surface-card, #fdfbf6);
        color: var(--ql-ink-muted, #8c8578);
        font: 500 16px/22px var(--ql-font-body, Outfit, sans-serif);
        cursor: pointer;
      }
      .tile[aria-pressed='true'] {
        border: 1.5px solid var(--ql-accent-champagne, #b08d57);
        color: var(--ql-accent-champagne, #b08d57);
      }
      /* A separate tint layer keeps the 10% wash off the text and the border. */
      .tile[aria-pressed='true']::before {
        content: '';
        position: absolute;
        inset: -1.5px;
        border-radius: var(--ql-radius-card, 18px);
        background: var(--ql-accent-champagne, #b08d57);
        opacity: 0.1;
        pointer-events: none;
      }
      .tile-name {
        color: var(--ql-ink-primary, #2b2620);
      }
      .tile .caption {
        overflow-wrap: anywhere;
      }
      .tile:focus-visible {
        outline: 2px solid var(--ql-accent-champagne, #b08d57);
        outline-offset: 2px;
      }
      /* Ten bottom-aligned bars, 24px rising to 58px, per Figma modal/fan-speed. */
      .steps {
        display: flex;
        align-items: flex-end;
        gap: var(--ql-space-xs, 4px);
        height: 58px;
      }
      .step {
        flex: 1 1 0;
        min-width: 0;
        padding: 0;
        border: 0;
        border-radius: var(--ql-radius-thumb, 12px);
        background: var(--ql-ink-muted, #8c8578);
        opacity: 0.28;
        cursor: pointer;
        transition:
          background 200ms ease,
          opacity 200ms ease;
      }
      .step.active {
        background: var(--ql-accent-champagne, #b08d57);
        opacity: 1;
      }
      .step:focus-visible {
        outline: 2px solid var(--ql-accent-champagne, #b08d57);
        outline-offset: 2px;
      }
      .auto-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ql-space-m, 12px);
        padding-top: var(--ql-space-l, 16px);
      }
      .auto-label {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .auto-name {
        color: var(--ql-ink-primary, #2b2620);
        font: 500 16px/22px var(--ql-font-body, Outfit, sans-serif);
      }
      @media (prefers-reduced-motion: reduce) {
        .step {
          transition: none;
        }
      }
    `,
  ];

  private fanEntity(): HassEntity | undefined {
    return this.config === undefined ? undefined : this.entity(this.config.entity);
  }

  private companions(): FanEntities {
    const { climate_entity: climateId, night_mode_entity: nightId } = this.config ?? {};
    return {
      fan: this.fanEntity(),
      climate: climateId === undefined ? undefined : this.entity(climateId),
      nightMode: nightId === undefined ? undefined : this.entity(nightId),
      services: (this.hass as { services?: ServiceRegistry } | undefined)?.services,
      platform: this.config?.platform,
    };
  }

  private capabilities(): FanCapabilities {
    return fanCapabilities(this.companions());
  }

  private call(...calls: ReadonlyArray<ServiceCall>): void {
    const hass = this.hass;
    if (hass === undefined) {
      return;
    }
    for (const { domain, service, data } of calls) {
      void hass.callService(domain, service, data);
    }
  }

  private liveAngle(): OscillationAngle {
    return fanOscillationAngle(this.fanEntity()) ?? { low: 135, high: 225, span: 90 };
  }

  private openSheet(sheet: SheetId): void {
    const fan = this.fanEntity();
    this.draftAngle = this.liveAngle();
    this.draftMinutes = this.timerMinutes;
    this.draftDirection = fan?.attributes.direction === 'reverse' ? 'back' : 'front';
    this.draftStep = fanSpeedStep(fan).step;
    this.draftAuto = autoPresetOf(fan)?.auto === fan?.attributes.preset_mode;
    this.sheet = sheet;
  }

  private readonly closeSheet = (): void => {
    this.sheet = undefined;
  };

  private onDial(id: DialId): void {
    const config = this.config;
    const fan = this.fanEntity();
    if (config === undefined || fan === undefined) {
      return;
    }
    switch (id) {
      case 'power':
        this.call(powerCall(config.entity, fan.state !== 'on'));
        return;
      case 'auto': {
        const presets = autoPresetOf(fan);
        if (presets === undefined) {
          return;
        }
        const isAuto = fan.attributes.preset_mode === presets.auto;
        this.call(presetCall(config.entity, isAuto ? presets.manual : presets.auto));
        return;
      }
      case 'cooling':
      case 'heating': {
        const climateId = config.climate_entity;
        if (climateId === undefined) {
          return;
        }
        const mode = id === 'cooling' ? 'cool' : 'heat';
        this.call(hvacCall(climateId, mode, this.entity(climateId)?.state === mode));
        return;
      }
      case 'night': {
        const nightId = config.night_mode_entity;
        if (nightId === undefined) {
          return;
        }
        this.call(nightModeCall(nightId, this.entity(nightId)?.state !== 'on'));
        return;
      }
      case 'oscillation':
        this.openSheet('oscillation');
        return;
      case 'timer':
        this.openSheet('timer');
        return;
      case 'direction':
        this.openSheet('airflow');
        return;
      case 'speed':
        this.openSheet('speed');
        return;
      case 'more':
        this.openSheet('more');
    }
  }

  private dialState(id: DialId): 'off' | 'on' | 'auto' {
    const config = this.config;
    const fan = this.fanEntity();
    if (config === undefined || fan === undefined) {
      return 'off';
    }
    switch (id) {
      case 'power':
        return fan.state === 'on' ? 'on' : 'off';
      case 'auto':
        return fan.attributes.preset_mode === autoPresetOf(fan)?.auto ? 'auto' : 'off';
      case 'cooling':
        return this.entity(config.climate_entity ?? '')?.state === 'cool' ? 'on' : 'off';
      case 'heating':
        return this.entity(config.climate_entity ?? '')?.state === 'heat' ? 'on' : 'off';
      case 'night':
        return this.entity(config.night_mode_entity ?? '')?.state === 'on' ? 'on' : 'off';
      case 'oscillation':
        return fan.attributes.oscillating === true ? 'on' : 'off';
      case 'speed':
        return fanSpeedStep(fan).step > 0 ? 'on' : 'off';
      case 'direction':
        return 'on';
      case 'timer':
        return this.timerMinutes > 0 ? 'on' : 'off';
      case 'more':
        return 'off';
    }
  }

  private dialWord(id: DialId, locale: Locale): string {
    const fan = this.fanEntity();
    const off = t(locale, 'common.off').toUpperCase();
    const on = t(locale, 'common.on').toUpperCase();
    switch (id) {
      case 'oscillation': {
        if (fan?.attributes.oscillating !== true) {
          return off;
        }
        return `${String(this.liveAngle().span)}°`;
      }
      case 'speed': {
        const { step } = fanSpeedStep(fan);
        return step > 0 ? String(step) : off;
      }
      case 'direction':
        return (
          fan?.attributes.direction === 'reverse'
            ? t(locale, 'fan.reverse')
            : t(locale, 'fan.forward')
        ).toUpperCase();
      case 'timer':
        return timerLabel(this.timerMinutes) ?? off;
      case 'auto':
        /* Every other dial reads OFF when it is off. A dial that says AUTO
           while the device is on its manual preset reads as "auto is on". */
        return this.dialState('auto') === 'auto' ? t(locale, 'hvac.auto').toUpperCase() : off;
      case 'more':
        return '';
      default:
        return this.dialState(id) === 'on' ? on : off;
    }
  }

  private dialLabel(id: DialId, locale: Locale): string {
    switch (id) {
      case 'power':
        return t(locale, 'common.power');
      case 'cooling':
        return t(locale, 'fan.cooling');
      case 'auto':
        return t(locale, 'hvac.auto');
      case 'speed':
        return t(locale, 'control.speed');
      case 'heating':
        return t(locale, 'fan.heating');
      case 'oscillation':
        return t(locale, 'fan.oscillation');
      case 'timer':
        return t(locale, 'fan.timer');
      case 'night':
        return t(locale, 'fan.night');
      case 'direction':
        return t(locale, 'fan.direction');
      case 'more':
        return t(locale, 'fan.more');
    }
  }

  private renderGrid(form: FanCardForm, locale: Locale, disabled: boolean): TemplateResult {
    const dials = dialButtonsFor(this.capabilities(), form);
    return html`
      <div class="grid ${form === 'compact' ? 'compact' : ''}">
        ${dials.map(
          (id) => html`
            <ql-dial-button
              .icon=${DIAL_ICON[id]}
              .label=${this.dialLabel(id, locale)}
              .stateWord=${this.dialWord(id, locale)}
              .state=${this.dialState(id)}
              ?disabled=${disabled}
              @ql-change=${(): void => this.onDial(id)}
            ></ql-dial-button>
          `,
        )}
      </div>
    `;
  }

  private renderFooter(locale: Locale, confirmKey: 'common.done' | 'common.set', commit: () => void): TemplateResult {
    return html`
      <ql-sheet-button slot="footer" emphasis="secondary" @click=${this.closeSheet}>
        ${t(locale, 'common.cancel')}
      </ql-sheet-button>
      <ql-sheet-button slot="footer" emphasis="primary" @click=${commit}>
        ${t(locale, confirmKey)}
      </ql-sheet-button>
    `;
  }

  private commitOscillation = (): void => {
    const config = this.config;
    if (config !== undefined && this.draftAngle !== undefined) {
      this.call(...oscillationCall(config.entity, this.draftAngle));
    }
    this.closeSheet();
  };

  /**
   * The readout over the dial, which says three different things.
   *
   * At rest it states the sweep's two edges. While the wedge is being aimed the
   * edges are moving together and naming them is noise, so it says what the
   * gesture is doing and that the span is being held. On the floor it says why
   * the number has stopped changing — otherwise a handle that refuses to move
   * reads as a control that has broken.
   */
  private oscillationCaption(locale: Locale, angle: OscillationAngle): string {
    if (this.sweepDrag !== undefined && isMinSweep(angle)) {
      return `${t(locale, 'fan.min_span')} ${String(MIN_SWEEP)}° · ${t(locale, 'fan.release_to_set')}`;
    }
    if (this.sweepDrag === 'aim') {
      return `${t(locale, 'fan.aim_hint')} · ${t(locale, 'fan.span_held')} ${String(angle.span)}°`;
    }
    const { start, end } = sweepFromFront(angle);
    const signed = (value: number): string => `${value > 0 ? '+' : ''}${String(value)}°`;
    return `${t(locale, 'fan.start_short')} ${signed(start)} · ${t(locale, 'fan.end_short')} ${signed(end)} ${t(locale, 'fan.from_front')}`;
  }

  private renderOscillationSheet(locale: Locale): TemplateResult {
    const angle = normaliseSweep(this.draftAngle ?? this.liveAngle());
    const presets: ReadonlyArray<QlPresetOption> = [
      { value: 'off', label: t(locale, 'common.off') },
      ...ANGLE_SPANS.map((span) => ({ value: String(span), label: `${String(span)}°` })),
    ];
    const selected =
      this.fanEntity()?.attributes.oscillating === true
        ? (nearestSpan(angle)?.toString() ?? '')
        : 'off';
    const locked = this.sweepDrag !== undefined && isMinSweep(angle);
    const onSweep = (event: CustomEvent<{ angle: OscillationAngle; drag?: string }>): void => {
      this.draftAngle = event.detail.angle;
      this.sweepDrag = event.type === 'ql-change' ? undefined : event.detail.drag;
    };
    return html`
      <ql-sheet
        .open=${true}
        .heading=${t(locale, 'fan.oscillation')}
        .closeLabel=${t(locale, 'common.close')}
        @ql-sheet-close=${this.closeSheet}
      >
        <div class="readout">
          <span class="numeral ${locked ? 'locked' : ''}">${String(angle.span)}°</span>
          <span class="caption ${locked ? 'locked' : ''}">
            ${this.oscillationCaption(locale, angle)}
          </span>
        </div>
        <ql-sweep-dial
          .angle=${angle}
          .frontLabel=${t(locale, 'fan.forward')}
          .startLabel=${t(locale, 'fan.sweep_start')}
          .endLabel=${t(locale, 'fan.sweep_end')}
          .aimLabel=${t(locale, 'fan.sweep_aim')}
          @ql-input=${onSweep}
          @ql-change=${onSweep}
        ></ql-sweep-dial>
        <ql-preset-row
          .options=${presets}
          .value=${selected}
          .label=${t(locale, 'fan.oscillation')}
          @ql-change=${(e: CustomEvent<{ value: string }>): void => {
            const config = this.config;
            if (config === undefined) {
              return;
            }
            if (e.detail.value === 'off') {
              this.call(...oscillationCall(config.entity, undefined));
              this.closeSheet();
              return;
            }
            this.draftAngle = angleForSpan(angle, Number(e.detail.value));
          }}
        ></ql-preset-row>
        ${this.renderFooter(locale, 'common.done', this.commitOscillation)}
      </ql-sheet>
    `;
  }

  private commitTimer = (): void => {
    const config = this.config;
    if (config !== undefined) {
      this.call(timerCall(config.entity, this.draftMinutes, config.platform));
      this.timerMinutes = this.draftMinutes;
    }
    this.closeSheet();
  };

  private renderTimerSheet(locale: Locale): TemplateResult {
    const minutes = this.draftMinutes;
    const hours = minutes / 60;
    const presets: ReadonlyArray<QlPresetOption> = TIMER_PRESETS.map((preset) => ({
      value: String(preset),
      label: timerLabel(preset) ?? t(locale, 'common.off'),
    }));
    const reading = minutes === 0 ? t(locale, 'common.off') : minutes < 60 ? String(minutes) : String(Number(hours.toFixed(1)));
    const caption = minutes === 0 ? '' : minutes < 60 ? t(locale, 'fan.minutes') : t(locale, 'fan.hours');
    return html`
      <ql-sheet
        .open=${true}
        .heading=${t(locale, 'fan.timer')}
        .closeLabel=${t(locale, 'common.close')}
        @ql-sheet-close=${this.closeSheet}
      >
        <ql-timer-dial
          .minutes=${minutes}
          .max=${480}
          .step=${15}
          .label=${t(locale, 'fan.timer')}
          .valueText=${timerLabel(minutes) ?? t(locale, 'common.off')}
          .reading=${reading}
          .caption=${caption}
          @ql-input=${(e: CustomEvent<{ minutes: number }>): void => {
            this.draftMinutes = e.detail.minutes;
          }}
          @ql-change=${(e: CustomEvent<{ minutes: number }>): void => {
            this.draftMinutes = e.detail.minutes;
          }}
        ></ql-timer-dial>
        <ql-preset-row
          .options=${presets}
          .value=${String(minutes)}
          .label=${t(locale, 'fan.timer')}
          @ql-change=${(e: CustomEvent<{ value: string }>): void => {
            this.draftMinutes = Number(e.detail.value);
          }}
        ></ql-preset-row>
        ${this.renderFooter(locale, 'common.set', this.commitTimer)}
      </ql-sheet>
    `;
  }

  private commitAirflow = (): void => {
    const config = this.config;
    if (config !== undefined) {
      this.call(airflowCall(config.entity, this.draftDirection));
    }
    this.closeSheet();
  };

  private renderAirflowSheet(locale: Locale): TemplateResult {
    const tile = (
      direction: AirflowDirection,
      nameKey: 'fan.forward' | 'fan.reverse',
      hintKey: 'fan.front_hint' | 'fan.back_hint',
    ): TemplateResult => html`
      <button
        class="tile"
        type="button"
        aria-pressed=${String(this.draftDirection === direction)}
        @click=${(): void => {
          this.draftDirection = direction;
        }}
      >
        ${dysonIcon(direction === 'front' ? 'arrow-front' : 'arrow-back', 32)}
        <span class="tile-name">${t(locale, nameKey)}</span>
        <span class="caption">${t(locale, hintKey)}</span>
      </button>
    `;
    return html`
      <ql-sheet
        .open=${true}
        .heading=${t(locale, 'fan.airflow_direction')}
        .closeLabel=${t(locale, 'common.close')}
        @ql-sheet-close=${this.closeSheet}
      >
        <div class="tiles">
          ${tile('front', 'fan.forward', 'fan.front_hint')}
          ${tile('back', 'fan.reverse', 'fan.back_hint')}
        </div>
        ${this.renderFooter(locale, 'common.set', this.commitAirflow)}
      </ql-sheet>
    `;
  }

  private commitSpeed = (): void => {
    const config = this.config;
    const fan = this.fanEntity();
    if (config === undefined || fan === undefined) {
      this.closeSheet();
      return;
    }
    const presets = autoPresetOf(fan);
    if (this.draftAuto && presets !== undefined) {
      this.call(presetCall(config.entity, presets.auto));
      this.closeSheet();
      return;
    }
    const wasAuto = fan.attributes.preset_mode === presets?.auto;
    const { steps } = fanSpeedStep(fan);
    // Leaving auto first, or the device overrides the percentage we just set.
    const calls = wasAuto && presets !== undefined ? [presetCall(config.entity, presets.manual)] : [];
    this.call(...calls, speedCall(config.entity, this.draftStep, steps));
    this.closeSheet();
  };

  private renderSpeedSheet(locale: Locale): TemplateResult {
    const { steps } = fanSpeedStep(this.fanEntity());
    const bars = Array.from({ length: steps }, (_unused, index) => index + 1);
    const hasAuto = autoPresetOf(this.fanEntity()) !== undefined;
    return html`
      <ql-sheet
        .open=${true}
        .heading=${t(locale, 'control.fan_speed')}
        .closeLabel=${t(locale, 'common.close')}
        @ql-sheet-close=${this.closeSheet}
      >
        <div class="readout">
          <span class="numeral-xl">${String(this.draftStep)}</span>
          <span class="caption">${t(locale, 'fan.of')} ${String(steps)}</span>
        </div>
        <div class="steps" role="group" aria-label=${t(locale, 'control.fan_speed')}>
          ${bars.map(
            (step) => html`
              <button
                class="step ${!this.draftAuto && step <= this.draftStep ? 'active' : ''}"
                type="button"
                style=${`height:${String(24 + (step - 1) * 3.8)}px`}
                aria-label=${`${t(locale, 'control.speed')} ${String(step)}`}
                aria-pressed=${String(!this.draftAuto && step <= this.draftStep)}
                @click=${(): void => {
                  this.draftStep = step;
                  this.draftAuto = false;
                }}
              ></button>
            `,
          )}
        </div>
        ${hasAuto
          ? html`
              <div class="auto-row">
                <span class="auto-label">
                  <span class="auto-name">${t(locale, 'hvac.auto')}</span>
                  <span class="caption">${t(locale, 'fan.auto_speed_hint')}</span>
                </span>
                <ql-toggle
                  .checked=${this.draftAuto}
                  .label=${t(locale, 'hvac.auto')}
                  @ql-change=${(e: CustomEvent<{ checked: boolean }>): void => {
                    this.draftAuto = e.detail.checked;
                  }}
                ></ql-toggle>
              </div>
            `
          : nothing}
        ${this.renderFooter(locale, 'common.set', this.commitSpeed)}
      </ql-sheet>
    `;
  }

  private renderMoreSheet(locale: Locale, disabled: boolean): TemplateResult {
    return html`
      <ql-sheet
        .open=${true}
        .heading=${t(locale, 'fan.controls')}
        .closeLabel=${t(locale, 'common.close')}
        @ql-sheet-close=${this.closeSheet}
      >
        ${this.renderGrid('full', locale, disabled)}
        <ql-sheet-button slot="footer" emphasis="primary" @click=${this.closeSheet}>
          ${t(locale, 'common.done')}
        </ql-sheet-button>
      </ql-sheet>
    `;
  }

  private renderSheet(locale: Locale, disabled: boolean): TemplateResult | typeof nothing {
    switch (this.sheet) {
      case 'oscillation':
        return this.renderOscillationSheet(locale);
      case 'timer':
        return this.renderTimerSheet(locale);
      case 'airflow':
        return this.renderAirflowSheet(locale);
      case 'speed':
        return this.renderSpeedSheet(locale);
      case 'more':
        return this.renderMoreSheet(locale, disabled);
      default:
        return nothing;
    }
  }

  private renderHeader(locale: Locale): TemplateResult {
    const config = this.config;
    if (config === undefined) {
      return html``;
    }
    const name = this.nameOf(config.entity, config.name);
    const eyebrow = config.area === undefined ? name : `${name} · ${config.area}`;
    const temperature =
      config.temperature_entity !== undefined
        ? this.entity(config.temperature_entity)?.state
        : this.entity(config.climate_entity ?? '')?.attributes.current_temperature?.toString();
    const readings = this.airReadings();
    const band = summaryBand(readings);
    return html`
      <div class="header">
        <button
          class="ql-info reading"
          type="button"
          data-ql-info=${config.entity}
          aria-label=${`${name} — ${t(locale, 'common.show_details')}`}
          @click=${this.onMoreInfo}
        >
          <span class="eyebrow ql-clamp-1">${eyebrow}</span>
          <span class="numeral">${formatSensorValue('temp', temperature)}</span>
        </button>
        ${readings.length === 0
          ? nothing
          : html`
              <ql-air-quality
                class="air"
                .readings=${readings}
                .bandLabel=${band === undefined ? '' : t(locale, BAND_KEYS[band])}
                .groupLabel=${t(locale, 'fan.air_quality')}
              ></ql-air-quality>
            `}
      </div>
    `;
  }

  /**
   * What the device actually publishes about the air, banded.
   *
   * The card used to show one big AQI numeral, which said less than the device
   * knows: a purifier reporting clean particulates and a VOC spike reads as a
   * single number that is true of neither. Each sensor the device has is drawn;
   * each sensor it does not have is absent rather than blank.
   */
  private airReadings(): ReadonlyArray<AirReading> {
    const config = this.config;
    if (config === undefined) {
      return [];
    }
    return airReadings(
      {
        pm25: config.pm25_entity,
        pm10: config.pm10_entity,
        voc: config.voc_entity,
        no2: config.no2_entity,
      },
      (entityId) => this.entity(entityId),
      resolveThresholds(config.air_quality_thresholds),
    );
  }

  protected override render(): TemplateResult {
    const config = this.config;
    if (config === undefined) {
      return html``;
    }
    const locale = this.locale();
    const available = this.availability(config.entity) === 'available';
    return html`
      <div class="ql-card ${available ? '' : 'ql-unavailable'}">
        ${this.renderHeader(locale)}
        ${available
          ? this.renderGrid(this.form(), locale, false)
          : html`<span class="caption">${t(locale, 'common.offline')}</span>`}
      </div>
      ${this.renderSheet(locale, !available)}
    `;
  }
}

registerCard('quiet-luxe-fan-card', QuietLuxeFanCard, {
  name: 'Quiet Luxe Fan Card',
  description: 'Fan and purifier card with oscillation, timer, airflow and speed sheets.',
});
