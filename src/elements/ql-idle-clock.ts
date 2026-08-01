import {
  css,
  html,
  LitElement,
  nothing,
  type CSSResult,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';

/**
 * iPad idle clock face (Figma `idle/clock-face`): centered oversized time,
 * date and weather lines on the dark radial. DARK-PINNED BY DESIGN — the
 * idle face is always a night-mode composition regardless of theme, so the
 * palette uses fixed dark literals (like the Plan 3a photo scrims), not
 * --ql-* variables. Hass-free: the strategy/harness feeds formatted strings.
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
      color: #ede6d8;
    }
    .time {
      margin: 0;
      font: 300 96px/104px var(--ql-font-body, Outfit, sans-serif);
      letter-spacing: 0.01em;
    }
    .date {
      margin: 0;
      color: #8a8172;
      font: 400 14px/20px var(--ql-font-body, Outfit, sans-serif);
    }
    .weather {
      margin: 0;
      color: #8a8172;
      font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
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
