import { css, html, LitElement, nothing, type CSSResult, type TemplateResult } from 'lit';
import type { AirBand, AirReading } from '../cards/air-quality';
import { summaryBand } from '../cards/air-quality';
import { TYPE } from '../tokens/type';

/**
 * Chrome-free multi-sensor air-quality readout (Figma `readout/air-quality`,
 * 108:9844).
 *
 * The Dyson card used to shout one big AQI numeral, which said less than the
 * device knows: a purifier reporting clean particulates and a VOC spike is not
 * "18". This shows every pollutant the device actually reports as a label/value
 * pair in the caption face, with the value — and only the value — carrying the
 * colour. No box, no background, no radius: the card's own surface is the only
 * surface, so the readout reads as part of the header rather than a widget
 * pasted onto it.
 *
 * Colour rises with severity so salience follows the problem: good is the sage
 * `status/good`, fair is plain `ink/muted` (nothing to report), poor is
 * `status/warn`, very poor is `status/alert`. Fair is deliberately not
 * champagne — champagne and `status/warn` sit about 18/255 apart in RGB and
 * were indistinguishable side by side.
 *
 * Purely presentational: it is handed readings, and never reads hass itself.
 */
export class QlAirQuality extends LitElement {
  static override properties = {
    readings: { attribute: false },
    bandLabel: { attribute: 'band-label', type: String },
    groupLabel: { attribute: 'group-label', type: String },
  };

  declare readings: ReadonlyArray<AirReading>;
  /** The word for the summary band, already translated by the card. */
  declare bandLabel: string;
  /** The accessible name for the whole readout ("Air quality"). */
  declare groupLabel: string;

  constructor() {
    super();
    this.readings = [];
    this.bandLabel = '';
    this.groupLabel = '';
  }

  static override styles: CSSResult = css`
    :host {
      display: block;
      min-width: 0;
    }
    .readout {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--ql-space-xs, 4px);
      min-width: 0;
    }
    .summary {
      display: flex;
      align-items: center;
      gap: var(--ql-space-xs, 4px);
      white-space: nowrap;
    }
    .dot {
      flex: 0 0 auto;
      width: 8px;
      height: 8px;
      border-radius: var(--ql-radius-chip, 999px);
      background: var(--ql-air-band, var(--ql-ink-muted, #736d63));
    }
    .band {
      color: var(--ql-air-band-text, var(--ql-ink-muted, #736d63));
    }
    /* Two cells across while there is room, one when there is not. Each cell is
       a fixed 78px so the values line up into a column even when the labels
       differ in width. */
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 78px);
      gap: var(--ql-space-xs, 4px) var(--ql-space-m, 12px);
    }
    .grid.single {
      grid-template-columns: 78px;
    }
    .cell {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ql-space-xs, 4px);
    }
    .band,
    .cell {
      ${TYPE.caption}
      letter-spacing: 0.02em;
    }
    .name {
      color: var(--ql-ink-muted, #736d63);
    }
    .value {
      color: var(--ql-air-band-text, var(--ql-ink-muted, #736d63));
      font-variant-numeric: tabular-nums;
    }
    @container (max-width: 223px) {
      .readout {
        align-items: flex-start;
      }
    }
  `;

  /**
   * The band colours. `fair` resolves to nothing so the cell falls back to
   * `ink/muted` — the absence of a colour is the statement.
   */
  private static tint(band: AirBand): string {
    switch (band) {
      case 'good':
        return 'var(--ql-status-good, #7e8b6f)';
      case 'poor':
        return 'var(--ql-status-warn, #c08552)';
      case 'very-poor':
        return 'var(--ql-status-alert, #a85b4e)';
      case 'fair':
        return 'var(--ql-ink-muted, #736d63)';
    }
  }

  /**
   * The same bands as text. The dot only has to clear the 3:1 non-text floor and
   * keeps the base hue; the band word and the values are small text and need
   * 4.5:1, which is what the `*-text` siblings carry. `alert` has no sibling —
   * it already clears the text floor in both modes.
   */
  private static tintText(band: AirBand): string {
    switch (band) {
      case 'good':
        return 'var(--ql-status-good-text, #67715b)';
      case 'poor':
        return 'var(--ql-status-warn-text, #91643e)';
      case 'very-poor':
        return 'var(--ql-status-alert, #a85b4e)';
      case 'fair':
        return 'var(--ql-ink-muted, #736d63)';
    }
  }

  protected override render(): TemplateResult | typeof nothing {
    const readings = this.readings;
    if (readings.length === 0) {
      return nothing;
    }
    const overall = summaryBand(readings);
    return html`
      <div
        class="readout"
        role="group"
        aria-label=${this.groupLabel === '' ? nothing : this.groupLabel}
      >
        ${overall === undefined
          ? nothing
          : html`
              <span
                class="summary"
                style=${`--ql-air-band:${QlAirQuality.tint(overall)};--ql-air-band-text:${QlAirQuality.tintText(overall)}`}
              >
                <span class="dot" aria-hidden="true"></span>
                <span class="band" data-band=${overall}>${this.bandLabel}</span>
              </span>
            `}
        <div class="grid ${readings.length === 1 ? 'single' : ''}">
          ${readings.map(
            (reading) => html`
              <span class="cell" data-pollutant=${reading.id}>
                <span class="name">${reading.label}</span>
                <span
                  class="value"
                  style=${`--ql-air-band-text:${QlAirQuality.tintText(reading.band)}`}
                  >${reading.text}</span
                >
              </span>
            `,
          )}
        </div>
      </div>
    `;
  }
}

customElements.define('ql-air-quality', QlAirQuality);
