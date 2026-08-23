import {
  css,
  html,
  LitElement,
  nothing,
  unsafeCSS,
  type CSSResult,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import { DARK_COLORS } from '../tokens/palette';
import { TYPE } from '../tokens/type';

/**
 * iPad idle clock face (Figma `idle/clock-face`): centered oversized time,
 * date and weather lines on the dark radial. DARK-PINNED BY DESIGN — the
 * idle face is always a night-mode composition regardless of theme, so the
 * date/weather ink comes from `DARK_COLORS` directly (via `unsafeCSS`)
 * rather than the `--ql-ink-*` custom properties, which flip with the page
 * theme and would turn light in light mode. Importing the literal keeps this
 * one source of truth with the palette instead of a second hard-coded copy.
 * The radial gradient stops (`#262019`, `#100d0a`) are bespoke to this face
 * and have no token to draw from.
 */
export class QlIdleClock extends LitElement {
  static override properties: PropertyDeclarations = {
    time: { type: String },
    date: { type: String },
    weather: { type: String },
  };

  declare time: string;
  declare date: string;
  declare weather: string;

  constructor() {
    super();
    this.time = '';
    this.date = '';
    this.weather = '';
  }

  static override styles: CSSResult = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--ql-space-s, 8px);
      min-height: 100%;
      background: radial-gradient(circle at 50% 15%, #262019 0%, #100d0a 100%);
      color: ${unsafeCSS(DARK_COLORS.inkPrimary)};
    }
    .time {
      margin: 0;
      font: 300 96px/104px var(--ql-font-body, Outfit, sans-serif);
      letter-spacing: 0.01em;
      font-variant-numeric: tabular-nums;
    }
    .date {
      margin: 0;
      color: ${unsafeCSS(DARK_COLORS.inkMuted)};
      ${TYPE.body}
    }
    .weather {
      margin: 0;
      color: ${unsafeCSS(DARK_COLORS.inkMuted)};
      ${TYPE.caption}
      letter-spacing: 0.02em;
    }
  `;

  protected override render(): TemplateResult {
    return html`
      <p class="time">${this.time}</p>
      <p class="date">${this.date}</p>
      ${this.weather === '' ? nothing : html`<p class="weather">${this.weather}</p>`}
    `;
  }
}

customElements.define('ql-idle-clock', QlIdleClock);
