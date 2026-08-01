# Quiet Luxe Card Library Core Implementation Plan (Plan 3a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Series note:** This is **Plan 3a** — card library core (primitives, structure elements, room/climate/light/cover/sensor cards, mock-hass helper, dev harness). **Plan 3b** (media/camera/energy/schedule/car/vacuum/rows + language page + idle face) will be written after 3a executes. Plan 2 (theme + tokens + i18n + base card) is merged on `main`.
>
> **Execution branch:** `feat/card-library` (created in Task 1 Step 1).
>
> **Design source of truth:** Figma file `vaDrJjhYuziE1lVvNvJqwP` (<https://www.figma.com/design/vaDrJjhYuziE1lVvNvJqwP/>), pages `00 Foundations` / `01 Components`. Component anatomy/variants below mirror `docs/superpowers/plans/2026-08-01-figma-design-system.md` Tasks 3–6 and spec §6/§7.

**Goal:** Implement the core Quiet Luxe element/card library as tested Lit components — 6 primitives, 3 structure elements, 5 dashboard cards — plus a typed mock-hass test helper and a light/dark dev harness, all exported from the single bundle.

**Architecture:** Internal primitives (`ql-*`) are plain Lit elements that emit `ql-change`/`ql-input`/`ql-back` custom events and never touch hass. Dashboard cards (`quiet-luxe-*`) extend `QlBaseCard`, implement the HA card contract (`setConfig`, reactive `hass`, `getCardSize`, `getGridOptions`), translate events into `hass.callService` calls, and register via a shared `registerCard` helper (customElements + `window.customCards`). All styling reads `--ql-*` CSS variables (from the quiet-luxe theme) with locked light-mode fallbacks, matching `QlBaseCard.qlCardStyles`.

**Tech Stack:** TypeScript 6 strict (no decorators, `static override properties`, `declare` fields, `useDefineForClassFields: false`), Lit 3, Vitest 4.1 + happy-dom (colocated `*.test.ts`, exact-value assertions), ESLint 10 flat, Vite 8 lib build (single-file ES bundle `dist/quiet-luxe.js`). **No new dependencies.**

**Source spec:** `docs/superpowers/specs/2026-08-01-ha-dashboard-redesign-design.md` §4, §6–§8, §10, §12.

---

## Conventions (apply to every task)

1. **TDD:** every task = failing test → minimal implementation → green → commit. Run targeted tests with `npx vitest run <file>`; full suite `npm test`.
2. **Commit footers** — every commit body ends with:

   ```
   Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
   Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
   ```

3. **i18n:** every user-visible string goes through `t(locale, key)`. New keys are added to **all five** locale files (`en`, `zh-hant`, `zh-hans`, `ms`, `id`) **in the same task** that first uses them. `TranslationTable` typing + the existing parity test (`src/i18n/i18n.test.ts`) enforce completeness — `npm run typecheck` fails until all five files carry the key.
4. **Availability semantics** (spec §8/§12, `QlBaseCard`): `unavailable` → muted rendering (`ql-unavailable` class, `t('common.unavailable')`), interactive controls disabled; `missing` → defined placeholder (`—` value, muted, same label treatment); **never** an error box or thrown exception at render time. `setConfig` MAY throw on malformed config (developer error — HA shows its own config-error card; spec §8's diagnostic-card rule applies to the strategy, Plan 4).
5. **Styling:** only `var(--ql-*, <light fallback>)` — no new hardcoded colors except the photo scrims (Figma-locked rgba values, mode-independent by design) and white-on-photo text.
6. **Events:** primitives dispatch `CustomEvent` with `bubbles: true, composed: true`. Primitives never call `hass` — cards own service calls, verified via the mock-hass spy.
7. **Keyboard access:** every interactive primitive is a native `<button>` (Space/Enter free) or native `<input type="range">` (arrow keys free); `ql-segmented` implements roving-tabindex arrow-key radio semantics; the room card root is `role="button"` with an explicit Enter/Space handler.
8. `window.customCards` descriptions are intentionally English-only (read once at bundle load, before any locale is known; HA card-picker metadata, not dashboard UI).

## File structure

```
src/testing/mock-hass.ts                 typed entity factories + service-call spy (test/dev only, NOT exported from index)
src/elements/ql-status-dot.ts            8px status dot (good/warn/alert/neutral)
src/elements/ql-badge.ts                 caption pill badge (slotted content)
src/elements/ql-chip.ts                  device/scene chip (emphasis, active, touch variants)
src/elements/ql-toggle.ts                44×26 switch, role="switch"
src/elements/ql-slider.ts                styled native range, ql-input/ql-change
src/elements/ql-segmented.ts             radiogroup segmented control
src/elements/ql-section-eyebrow.ts       uppercase micro-label + link slot
src/elements/ql-header-home.ts           mobile/ipad/desktop variants; greeting mobile-only
src/elements/ql-header-room.ts           room name + micro-stats + back button
src/cards/register.ts                    registerCard helper + window.customCards typing
src/cards/navigate.ts                    HA navigation helper (pushState + location-changed)
src/cards/climate-device-type.ts         pure fns: detectClimateDeviceType, climateActivity
src/cards/sensor-format.ts               pure fns: formatSensorValue, sensorStatus
src/cards/quiet-luxe-room-card.ts        photo + scrims + chips + glow dot + navigate
src/cards/quiet-luxe-climate-card.ts     ac|purifier|dehumidifier|fan|exhaust, confirm-optional
src/cards/quiet-luxe-light-card.ts       brightness slider + glow
src/cards/quiet-luxe-cover-card.ts       position slider + open/stop/close
src/cards/quiet-luxe-sensor-tile.ts      aqi|temp|humidity|uv|rain + status dot
dev/index.html + dev/main.ts             light/dark visual harness (excluded from dist)
```

Modified: `src/cards/ql-base-card.ts` (adds `locale()`), `src/i18n/locales/*.ts` (×5, per-task keys), `src/index.ts`, `tsconfig.json` (add `dev`), `package.json` (add `dev` script). Each `.ts` above gets a colocated `.test.ts` (except dev/).

## New i18n keys (full table — added task-by-task, never all at once)

| Key | Task | en | zh-Hant | zh-Hans | ms | id |
| --- | --- | --- | --- | --- | --- | --- |
| `greeting.morning` | 9 | Good morning | 早安 | 早上好 | Selamat pagi | Selamat pagi |
| `greeting.afternoon` | 9 | Good afternoon | 午安 | 下午好 | Selamat tengah hari | Selamat siang |
| `greeting.evening` | 9 | Good evening | 晚安 | 晚上好 | Selamat petang | Selamat malam |
| `common.back` | 10 | Back | 返回 | 返回 | Kembali | Kembali |
| `room.lights_on` | 12 | Lights on | 燈已開 | 灯已开 | Lampu hidup | Lampu menyala |
| `state.active` | 14 | Active | 運作中 | 运行中 | Aktif | Aktif |
| `state.idle` | 14 | Idle | 待機 | 待机 | Sedia | Siaga |
| `common.power` | 14 | Power | 電源 | 电源 | Kuasa | Daya |
| `common.tap_confirm` | 14 | Tap again to confirm | 再點一次以確認 | 再点一次以确认 | Ketik sekali lagi untuk mengesahkan | Ketuk sekali lagi untuk konfirmasi |
| `light.brightness` | 15 | Brightness | 亮度 | 亮度 | Kecerahan | Kecerahan |
| `cover.open` | 16 | Open | 開啟 | 开启 | Buka | Buka |
| `cover.stop` | 16 | Stop | 停止 | 停止 | Berhenti | Berhenti |
| `cover.close` | 16 | Close | 關閉 | 关闭 | Tutup | Tutup |
| `sensor.aqi` | 17 | AQI | 空氣品質 | 空气质量 | AQI | AQI |
| `sensor.temp` | 17 | Temperature | 溫度 | 温度 | Suhu | Suhu |
| `sensor.humidity` | 17 | Humidity | 濕度 | 湿度 | Kelembapan | Kelembapan |
| `sensor.uv` | 17 | UV | 紫外線 | 紫外线 | UV | UV |
| `sensor.rain` | 17 | Rain | 降雨 | 降雨 | Hujan | Hujan |

---

### Task 1: Mock-hass test helper

**Files:**
- Create: `src/testing/mock-hass.ts`
- Test: `src/testing/mock-hass.test.ts`

- [ ] **Step 1: Create the execution branch**

```bash
cd /Users/evertemple/Documents/Projects/home_assistant_dashboard_redesign && git checkout -b feat/card-library
```

- [ ] **Step 2: Write the failing test**

Create `src/testing/mock-hass.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  climateEntity,
  coverEntity,
  lightEntity,
  makeEntity,
  makeMockHass,
  sensorEntity,
} from './mock-hass';

describe('makeEntity', () => {
  it('builds a fully-populated HassEntity', () => {
    const entity = makeEntity('light.desk', 'on', { brightness: 128 });
    expect(entity.entity_id).toBe('light.desk');
    expect(entity.state).toBe('on');
    expect(entity.attributes).toEqual({ brightness: 128 });
    expect(entity.context.user_id).toBeNull();
  });
});

describe('typed factories', () => {
  it('lightEntity carries brightness only when on', () => {
    expect(lightEntity('light.a', 'on', 178).attributes).toEqual({ brightness: 178 });
    expect(lightEntity('light.a', 'off').attributes).toEqual({});
  });

  it('climateEntity defaults current_temperature and merges attributes', () => {
    const entity = climateEntity('climate.ac', 'cool', { hvac_action: 'cooling' });
    expect(entity.attributes).toEqual({ current_temperature: 24.5, hvac_action: 'cooling' });
  });

  it('coverEntity derives state from position', () => {
    expect(coverEntity('cover.c', 65).state).toBe('open');
    expect(coverEntity('cover.c', 65).attributes.current_position).toBe(65);
    expect(coverEntity('cover.c', 0).state).toBe('closed');
  });

  it('sensorEntity passes state and attributes through', () => {
    const entity = sensorEntity('sensor.aqi', '18', { device_class: 'aqi' });
    expect(entity.state).toBe('18');
    expect(entity.attributes.device_class).toBe('aqi');
  });
});

describe('makeMockHass', () => {
  it('keys states by entity_id and exposes locale/language', () => {
    const hass = makeMockHass([lightEntity('light.a', 'on')], 'zh-Hant');
    expect(hass.states['light.a']?.state).toBe('on');
    expect(hass.language).toBe('zh-Hant');
    expect(hass.locale?.language).toBe('zh-Hant');
  });

  it('records every service call in order', async () => {
    const hass = makeMockHass();
    await hass.callService('light', 'turn_on', { entity_id: 'light.a', brightness_pct: 60 });
    await hass.callService('cover', 'stop_cover', { entity_id: 'cover.c' });
    expect(hass.calls).toEqual([
      { domain: 'light', service: 'turn_on', data: { entity_id: 'light.a', brightness_pct: 60 } },
      { domain: 'cover', service: 'stop_cover', data: { entity_id: 'cover.c' } },
    ]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/testing/mock-hass.test.ts`
Expected: FAIL — "Cannot find module './mock-hass'" (or equivalent resolve error).

- [ ] **Step 4: Write the implementation**

Create `src/testing/mock-hass.ts`:

```ts
import type { HassEntity, HomeAssistant } from '../types/home-assistant';

export interface RecordedServiceCall {
  readonly domain: string;
  readonly service: string;
  readonly data?: Record<string, unknown>;
}

/** HomeAssistant double with a service-call spy. Test/dev-harness use only. */
export interface MockHass extends HomeAssistant {
  readonly calls: ReadonlyArray<RecordedServiceCall>;
}

const ENTITY_DEFAULTS = {
  last_changed: '2026-08-01T00:00:00+00:00',
  last_updated: '2026-08-01T00:00:00+00:00',
  context: { id: 'mock-context', user_id: null, parent_id: null },
} as const;

export function makeEntity(
  entityId: string,
  state: string,
  attributes: Record<string, unknown> = {},
): HassEntity {
  return { entity_id: entityId, state, attributes, ...ENTITY_DEFAULTS };
}

export function lightEntity(
  entityId: string,
  state: 'on' | 'off' | 'unavailable' = 'on',
  brightness = 255,
): HassEntity {
  return makeEntity(entityId, state, state === 'on' ? { brightness } : {});
}

export function climateEntity(
  entityId: string,
  state = 'cool',
  attributes: Record<string, unknown> = {},
): HassEntity {
  return makeEntity(entityId, state, { current_temperature: 24.5, ...attributes });
}

export function coverEntity(
  entityId: string,
  position = 100,
  attributes: Record<string, unknown> = {},
): HassEntity {
  return makeEntity(entityId, position > 0 ? 'open' : 'closed', {
    current_position: position,
    ...attributes,
  });
}

export function sensorEntity(
  entityId: string,
  state: string,
  attributes: Record<string, unknown> = {},
): HassEntity {
  return makeEntity(entityId, state, attributes);
}

export function makeMockHass(
  entities: ReadonlyArray<HassEntity> = [],
  language = 'en',
): MockHass {
  const calls: RecordedServiceCall[] = [];
  return {
    states: Object.fromEntries(entities.map((entity) => [entity.entity_id, entity])),
    language,
    locale: { language },
    calls,
    callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown> {
      calls.push({ domain, service, data });
      return Promise.resolve(undefined);
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/testing/mock-hass.test.ts`
Expected: PASS (7 tests). Also run `npm run typecheck` — clean.

- [ ] **Step 6: Commit**

```bash
git add src/testing/mock-hass.ts src/testing/mock-hass.test.ts
git commit -m "$(cat <<'EOF'
test(cards): add typed mock-hass helper with service-call spy

- makeEntity + light/climate/cover/sensor factories with exact defaults
- makeMockHass records callService invocations for card behavior tests
- Foundation for all Plan 3a card tests; not exported from the bundle

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 2: QlBaseCard locale helper

**Files:**
- Modify: `src/cards/ql-base-card.ts`
- Test: `src/cards/ql-base-card.test.ts` (extend existing)

- [ ] **Step 1: Write the failing test**

Append to `src/cards/ql-base-card.test.ts` (after the existing `describe` block):

```ts
describe('QlBaseCard locale', () => {
  it('resolves the hass locale through resolveLocale (zh-TW → zh-Hant)', () => {
    const card = new QlTestCard();
    card.hass = { ...makeHass({}), language: 'en', locale: { language: 'zh-TW' } };
    expect(card.locale()).toBe('zh-Hant');
  });

  it('falls back to hass.language, then en', () => {
    const card = new QlTestCard();
    card.hass = { ...makeHass({}), language: 'ms', locale: undefined };
    expect(card.locale()).toBe('ms');
    card.hass = undefined;
    expect(card.locale()).toBe('en');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/cards/ql-base-card.test.ts`
Expected: FAIL — `card.locale is not a function`.

- [ ] **Step 3: Implement**

In `src/cards/ql-base-card.ts`, add imports after the existing ones:

```ts
import { resolveLocale } from '../i18n/resolve';
import type { Locale } from '../i18n/types';
```

Add this method to `QlBaseCard`, directly after `availabilityOf`:

```ts
  /** Session locale per spec §10: HA user profile language → hass.language → en. */
  locale(): Locale {
    return resolveLocale([this.hass?.locale?.language, this.hass?.language]);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/cards/ql-base-card.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/cards/ql-base-card.ts src/cards/ql-base-card.test.ts
git commit -m "$(cat <<'EOF'
feat(cards): add locale() resolution to QlBaseCard

- Resolves hass.locale.language → hass.language → en via resolveLocale
- Single locale seam for every card's t() calls in Plan 3a

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 3: ql-status-dot and ql-badge primitives

**Files:**
- Create: `src/elements/ql-status-dot.ts`, `src/elements/ql-badge.ts`
- Test: `src/elements/ql-status-dot.test.ts`, `src/elements/ql-badge.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/elements/ql-status-dot.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { QlStatusDot } from './ql-status-dot';

describe('ql-status-dot', () => {
  it('is registered and defaults to neutral', () => {
    expect(customElements.get('ql-status-dot')).toBe(QlStatusDot);
    const el = document.createElement('ql-status-dot') as QlStatusDot;
    expect(el.status).toBe('neutral');
  });

  it('reflects status to an attribute for CSS variant selection', async () => {
    const el = document.createElement('ql-status-dot') as QlStatusDot;
    document.body.append(el);
    el.status = 'warn';
    await el.updateComplete;
    expect(el.getAttribute('status')).toBe('warn');
    el.remove();
  });

  it('binds each status to its --ql-status-* variable', () => {
    const cssText = QlStatusDot.styles.toString();
    expect(cssText).toContain("var(--ql-status-good, #7e8b6f)");
    expect(cssText).toContain("var(--ql-status-warn, #c08552)");
    expect(cssText).toContain("var(--ql-status-alert, #a85b4e)");
    expect(cssText).toContain("var(--ql-ink-muted, #8c8578)");
  });
});
```

Create `src/elements/ql-badge.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { QlBadge } from './ql-badge';

describe('ql-badge', () => {
  it('is registered and renders slotted content', async () => {
    expect(customElements.get('ql-badge')).toBe(QlBadge);
    const el = document.createElement('ql-badge');
    el.textContent = 'AQI 42';
    document.body.append(el);
    await (el as QlBadge).updateComplete;
    expect(el.shadowRoot?.querySelector('slot')).not.toBeNull();
    expect(el.textContent).toBe('AQI 42');
    el.remove();
  });

  it('styles the pill from --ql-* variables only', () => {
    const cssText = QlBadge.styles.toString();
    expect(cssText).toContain('var(--ql-radius-chip, 999px)');
    expect(cssText).toContain('var(--ql-surface-card, #fdfbf6)');
    expect(cssText).toContain('var(--ql-surface-border, #e4dccb)');
    expect(cssText).toContain('var(--ql-ink-primary, #2b2620)');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/elements/ql-status-dot.test.ts src/elements/ql-badge.test.ts`
Expected: FAIL — module resolve errors for both.

- [ ] **Step 3: Implement**

Create `src/elements/ql-status-dot.ts`:

```ts
import { css, html, LitElement, type CSSResult, type TemplateResult } from 'lit';

export type QlStatus = 'good' | 'warn' | 'alert' | 'neutral';

/** 8px status dot (Figma `status/dot`): good/warn/alert/neutral, colors from theme vars. */
export class QlStatusDot extends LitElement {
  static override properties = {
    status: { type: String, reflect: true },
  };

  declare status: QlStatus;

  constructor() {
    super();
    this.status = 'neutral';
  }

  static override styles: CSSResult = css`
    :host {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: var(--ql-radius-chip, 999px);
      background: var(--ql-ink-muted, #8c8578);
    }
    :host([status='good']) {
      background: var(--ql-status-good, #7e8b6f);
    }
    :host([status='warn']) {
      background: var(--ql-status-warn, #c08552);
    }
    :host([status='alert']) {
      background: var(--ql-status-alert, #a85b4e);
    }
  `;

  protected override render(): TemplateResult {
    return html``;
  }
}

customElements.define('ql-status-dot', QlStatusDot);
```

Create `src/elements/ql-badge.ts`:

```ts
import { css, html, LitElement, type CSSResult, type TemplateResult } from 'lit';

/** Caption pill (Figma `badge/count`): slotted caption text in a 999-radius surface pill. */
export class QlBadge extends LitElement {
  static override styles: CSSResult = css`
    :host {
      display: inline-flex;
      align-items: center;
      padding: 2px var(--ql-space-s, 8px);
      border-radius: var(--ql-radius-chip, 999px);
      background: var(--ql-surface-card, #fdfbf6);
      border: 1px solid var(--ql-surface-border, #e4dccb);
      color: var(--ql-ink-primary, #2b2620);
      font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      letter-spacing: 0.02em;
    }
  `;

  protected override render(): TemplateResult {
    return html`<slot></slot>`;
  }
}

customElements.define('ql-badge', QlBadge);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/elements/ql-status-dot.test.ts src/elements/ql-badge.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/elements/ql-status-dot.ts src/elements/ql-status-dot.test.ts src/elements/ql-badge.ts src/elements/ql-badge.test.ts
git commit -m "$(cat <<'EOF'
feat(elements): add ql-status-dot and ql-badge primitives

- status dot: good/warn/alert/neutral variants via reflected attribute
- badge: caption pill with slotted content
- All colors from --ql-* variables with light-mode fallbacks

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 4: ql-chip primitive

**Files:**
- Create: `src/elements/ql-chip.ts`
- Test: `src/elements/ql-chip.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/elements/ql-chip.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { QlChip } from './ql-chip';

async function mount(props: Partial<QlChip> = {}): Promise<QlChip> {
  const el = document.createElement('ql-chip') as QlChip;
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe('ql-chip', () => {
  it('is registered with device/secondary/inactive defaults', () => {
    expect(customElements.get('ql-chip')).toBe(QlChip);
    const el = document.createElement('ql-chip') as QlChip;
    expect(el.variant).toBe('device');
    expect(el.emphasis).toBe('secondary');
    expect(el.active).toBe(false);
    expect(el.touch).toBe(false);
  });

  it('renders a native button (keyboard semantics for free)', async () => {
    const el = await mount();
    expect(el.shadowRoot?.querySelector('button')).not.toBeNull();
    el.remove();
  });

  it('exposes device on/off state via aria-pressed', async () => {
    const el = await mount({ variant: 'device', active: true });
    expect(el.shadowRoot?.querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
    el.active = false;
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('button')?.getAttribute('aria-pressed')).toBe('false');
    el.remove();
  });

  it('omits aria-pressed for scene chips (momentary action)', async () => {
    const el = await mount({ variant: 'scene', emphasis: 'primary' });
    expect(el.shadowRoot?.querySelector('button')?.hasAttribute('aria-pressed')).toBe(false);
    el.remove();
  });

  it('reflects variant/emphasis/active/touch attributes for CSS variants', async () => {
    const el = await mount({ variant: 'scene', emphasis: 'primary', touch: true });
    expect(el.getAttribute('variant')).toBe('scene');
    expect(el.getAttribute('emphasis')).toBe('primary');
    expect(el.hasAttribute('touch')).toBe(true);
    el.remove();
  });

  it('styles active device chips with the champagne accent and touch size from touch/min', () => {
    const cssText = QlChip.styles.toString();
    expect(cssText).toContain('var(--ql-accent-champagne, #b08d57)');
    expect(cssText).toContain('var(--ql-touch-min, 56px)');
    expect(cssText).toContain('var(--ql-radius-chip, 999px)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/elements/ql-chip.test.ts`
Expected: FAIL — module resolve error.

- [ ] **Step 3: Implement**

Create `src/elements/ql-chip.ts`:

```ts
import { css, html, LitElement, nothing, type CSSResult, type TemplateResult } from 'lit';

export type QlChipVariant = 'device' | 'scene';
export type QlChipEmphasis = 'primary' | 'secondary';

/**
 * Pill chip (Figma `chip/device` + `chip/scene`).
 * - variant=device: stateful on/off (aria-pressed), on = champagne fill.
 * - variant=scene: momentary action; emphasis primary (ink fill) or secondary (surface).
 * - touch: 56px min height for iPad targets.
 * Emits only native click (composed); never calls hass — consumers own actions.
 * Content: default slot label, optional slot="icon".
 */
export class QlChip extends LitElement {
  static override properties = {
    variant: { type: String, reflect: true },
    emphasis: { type: String, reflect: true },
    active: { type: Boolean, reflect: true },
    touch: { type: Boolean, reflect: true },
  };

  declare variant: QlChipVariant;
  declare emphasis: QlChipEmphasis;
  declare active: boolean;
  declare touch: boolean;

  constructor() {
    super();
    this.variant = 'device';
    this.emphasis = 'secondary';
    this.active = false;
    this.touch = false;
  }

  static override styles: CSSResult = css`
    :host {
      display: inline-flex;
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: var(--ql-space-xs, 4px);
      min-height: 28px;
      padding: 4px var(--ql-space-m, 12px);
      border-radius: var(--ql-radius-chip, 999px);
      border: 1px solid var(--ql-surface-border, #e4dccb);
      background: var(--ql-surface-card, #fdfbf6);
      color: var(--ql-ink-primary, #2b2620);
      font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      cursor: pointer;
      transition:
        background 200ms ease,
        color 200ms ease;
    }
    :host([variant='device'][active]) button {
      background: var(--ql-accent-champagne, #b08d57);
      border-color: transparent;
      color: var(--ql-surface-card, #fdfbf6);
    }
    :host([variant='scene']) button {
      min-height: 36px;
      font-weight: 500;
      font-size: 13px;
    }
    :host([variant='scene'][emphasis='primary']) button {
      background: var(--ql-ink-primary, #2b2620);
      border-color: transparent;
      color: var(--ql-bg-base, #f4f0e8);
    }
    :host([touch]) button {
      min-height: var(--ql-touch-min, 56px);
      padding: var(--ql-space-s, 8px) var(--ql-space-l, 16px);
    }
  `;

  protected override render(): TemplateResult {
    return html`
      <button aria-pressed=${this.variant === 'device' ? String(this.active) : nothing}>
        <slot name="icon"></slot><slot></slot>
      </button>
    `;
  }
}

customElements.define('ql-chip', QlChip);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/elements/ql-chip.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/elements/ql-chip.ts src/elements/ql-chip.test.ts
git commit -m "$(cat <<'EOF'
feat(elements): add ql-chip device/scene primitive

- device variant: stateful aria-pressed, champagne fill when active
- scene variant: primary (ink) / secondary (surface) emphasis
- touch attribute enforces 56px iPad target via --ql-touch-min

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 5: ql-toggle primitive

**Files:**
- Create: `src/elements/ql-toggle.ts`
- Test: `src/elements/ql-toggle.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/elements/ql-toggle.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { QlToggle } from './ql-toggle';

async function mount(props: Partial<QlToggle> = {}): Promise<QlToggle> {
  const el = document.createElement('ql-toggle') as QlToggle;
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe('ql-toggle', () => {
  it('is registered, unchecked and enabled by default', () => {
    expect(customElements.get('ql-toggle')).toBe(QlToggle);
    const el = document.createElement('ql-toggle') as QlToggle;
    expect(el.checked).toBe(false);
    expect(el.disabled).toBe(false);
  });

  it('renders a native button with role=switch and aria-checked', async () => {
    const el = await mount({ checked: true, label: 'Motion detection' });
    const button = el.shadowRoot?.querySelector('button');
    expect(button?.getAttribute('role')).toBe('switch');
    expect(button?.getAttribute('aria-checked')).toBe('true');
    expect(button?.getAttribute('aria-label')).toBe('Motion detection');
    el.remove();
  });

  it('click flips checked and emits ql-change with the new value', async () => {
    const el = await mount();
    const events: Array<{ checked: boolean }> = [];
    el.addEventListener('ql-change', (e) =>
      events.push((e as CustomEvent<{ checked: boolean }>).detail),
    );
    el.shadowRoot?.querySelector('button')?.click();
    expect(el.checked).toBe(true);
    el.shadowRoot?.querySelector('button')?.click();
    expect(el.checked).toBe(false);
    expect(events).toEqual([{ checked: true }, { checked: false }]);
    el.remove();
  });

  it('does nothing when disabled', async () => {
    const el = await mount({ disabled: true });
    const events: unknown[] = [];
    el.addEventListener('ql-change', (e) => events.push(e));
    el.shadowRoot?.querySelector('button')?.click();
    expect(el.checked).toBe(false);
    expect(events).toEqual([]);
    el.remove();
  });

  it('binds track/thumb colors to --ql-* variables', () => {
    const cssText = QlToggle.styles.toString();
    expect(cssText).toContain('var(--ql-accent-champagne, #b08d57)');
    expect(cssText).toContain('var(--ql-surface-card, #fdfbf6)');
    expect(cssText).toContain('var(--ql-surface-border, #e4dccb)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/elements/ql-toggle.test.ts`
Expected: FAIL — module resolve error.

- [ ] **Step 3: Implement**

Create `src/elements/ql-toggle.ts`:

```ts
import { css, html, LitElement, nothing, type CSSResult, type TemplateResult } from 'lit';

/**
 * Switch (Figma `control/toggle`): 44×26 track, 22px thumb, champagne on-fill.
 * Native button + role=switch → Space/Enter for free. Emits `ql-change`
 * { checked }; never calls hass.
 */
export class QlToggle extends LitElement {
  static override properties = {
    checked: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    label: { type: String },
  };

  declare checked: boolean;
  declare disabled: boolean;
  declare label: string;

  constructor() {
    super();
    this.checked = false;
    this.disabled = false;
    this.label = '';
  }

  static override styles: CSSResult = css`
    button {
      position: relative;
      width: 44px;
      height: 26px;
      border-radius: var(--ql-radius-chip, 999px);
      border: 1px solid var(--ql-surface-border, #e4dccb);
      background: var(--ql-surface-card, #fdfbf6);
      cursor: pointer;
      padding: 0;
      transition: background 200ms ease;
    }
    button::after {
      content: '';
      position: absolute;
      top: 1px;
      left: 1px;
      width: 22px;
      height: 22px;
      border-radius: var(--ql-radius-chip, 999px);
      background: var(--ql-ink-muted, #8c8578);
      transition:
        transform 200ms ease,
        background 200ms ease;
    }
    :host([checked]) button {
      background: var(--ql-accent-champagne, #b08d57);
      border-color: transparent;
    }
    :host([checked]) button::after {
      transform: translateX(18px);
      background: var(--ql-surface-card, #fdfbf6);
    }
    :host([disabled]) button {
      opacity: 0.5;
      cursor: default;
    }
  `;

  private onClick(): void {
    if (this.disabled) {
      return;
    }
    this.checked = !this.checked;
    this.dispatchEvent(
      new CustomEvent('ql-change', {
        detail: { checked: this.checked },
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected override render(): TemplateResult {
    return html`
      <button
        role="switch"
        aria-checked=${String(this.checked)}
        aria-label=${this.label === '' ? nothing : this.label}
        ?disabled=${this.disabled}
        @click=${this.onClick}
      ></button>
    `;
  }
}

customElements.define('ql-toggle', QlToggle);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/elements/ql-toggle.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/elements/ql-toggle.ts src/elements/ql-toggle.test.ts
git commit -m "$(cat <<'EOF'
feat(elements): add ql-toggle switch primitive

- 44x26 track / 22px thumb per Figma control/toggle anatomy
- role=switch on a native button; emits ql-change {checked}
- disabled state inert and dimmed

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 6: ql-slider primitive

**Files:**
- Create: `src/elements/ql-slider.ts`
- Test: `src/elements/ql-slider.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/elements/ql-slider.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { QlSlider } from './ql-slider';

async function mount(props: Partial<QlSlider> = {}): Promise<QlSlider> {
  const el = document.createElement('ql-slider') as QlSlider;
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

function innerInput(el: QlSlider): HTMLInputElement {
  const input = el.shadowRoot?.querySelector('input');
  if (input === null || input === undefined) {
    throw new Error('slider input missing');
  }
  return input;
}

describe('ql-slider', () => {
  it('is registered with 0..100 step 1 defaults', () => {
    expect(customElements.get('ql-slider')).toBe(QlSlider);
    const el = document.createElement('ql-slider') as QlSlider;
    expect(el.value).toBe(0);
    expect(el.min).toBe(0);
    expect(el.max).toBe(100);
    expect(el.step).toBe(1);
  });

  it('renders a native range input (arrow keys for free) with the aria label', async () => {
    const el = await mount({ value: 30, label: 'Brightness' });
    const input = innerInput(el);
    expect(input.type).toBe('range');
    expect(input.getAttribute('aria-label')).toBe('Brightness');
    expect(input.value).toBe('30');
    el.remove();
  });

  it('re-emits input as ql-input and change as ql-change with numeric detail', async () => {
    const el = await mount({ value: 30 });
    const inputs: number[] = [];
    const changes: number[] = [];
    el.addEventListener('ql-input', (e) => inputs.push((e as CustomEvent<{ value: number }>).detail.value));
    el.addEventListener('ql-change', (e) => changes.push((e as CustomEvent<{ value: number }>).detail.value));
    const input = innerInput(el);
    input.value = '45';
    input.dispatchEvent(new Event('input'));
    input.value = '60';
    input.dispatchEvent(new Event('change'));
    expect(inputs).toEqual([45]);
    expect(changes).toEqual([60]);
    expect(el.value).toBe(60);
    el.remove();
  });

  it('exposes the fill percentage as --ql-slider-fill for track painting', async () => {
    const el = await mount({ value: 60, min: 0, max: 100 });
    expect(el.style.getPropertyValue('--ql-slider-fill')).toBe('60%');
    el.value = 25;
    await el.updateComplete;
    expect(el.style.getPropertyValue('--ql-slider-fill')).toBe('25%');
    el.remove();
  });

  it('disables the inner input when disabled', async () => {
    const el = await mount({ disabled: true });
    expect(innerInput(el).disabled).toBe(true);
    el.remove();
  });

  it('paints track and thumb from --ql-* variables', () => {
    const cssText = QlSlider.styles.toString();
    expect(cssText).toContain('var(--ql-accent-champagne, #b08d57)');
    expect(cssText).toContain('var(--ql-surface-border, #e4dccb)');
    expect(cssText).toContain('var(--ql-surface-card, #fdfbf6)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/elements/ql-slider.test.ts`
Expected: FAIL — module resolve error.

- [ ] **Step 3: Implement**

Create `src/elements/ql-slider.ts`:

```ts
import { css, html, LitElement, nothing, type CSSResult, type TemplateResult } from 'lit';

/**
 * Slider (Figma `control/slider`): 4px track, champagne fill, 16px surface thumb.
 * Wraps a native <input type="range"> so arrow/Home/End keys work for free.
 * Emits `ql-input` {value} while dragging and `ql-change` {value} on commit;
 * never calls hass. Fill is painted via the --ql-slider-fill host property.
 */
export class QlSlider extends LitElement {
  static override properties = {
    value: { type: Number },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    label: { type: String },
    disabled: { type: Boolean, reflect: true },
  };

  declare value: number;
  declare min: number;
  declare max: number;
  declare step: number;
  declare label: string;
  declare disabled: boolean;

  constructor() {
    super();
    this.value = 0;
    this.min = 0;
    this.max = 100;
    this.step = 1;
    this.label = '';
    this.disabled = false;
  }

  static override styles: CSSResult = css`
    :host {
      display: block;
    }
    input {
      width: 100%;
      height: 16px;
      margin: 0;
      -webkit-appearance: none;
      appearance: none;
      background: transparent;
      cursor: pointer;
    }
    :host([disabled]) input {
      cursor: default;
      opacity: 0.5;
    }
    input::-webkit-slider-runnable-track {
      height: 4px;
      border-radius: 2px;
      background: linear-gradient(
        to right,
        var(--ql-accent-champagne, #b08d57) var(--ql-slider-fill, 0%),
        var(--ql-surface-border, #e4dccb) var(--ql-slider-fill, 0%)
      );
    }
    input::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 16px;
      height: 16px;
      margin-top: -6px;
      border-radius: var(--ql-radius-chip, 999px);
      background: var(--ql-surface-card, #fdfbf6);
      border: 1px solid var(--ql-surface-border, #e4dccb);
    }
    input::-moz-range-track {
      height: 4px;
      border-radius: 2px;
      background: var(--ql-surface-border, #e4dccb);
    }
    input::-moz-range-progress {
      height: 4px;
      border-radius: 2px;
      background: var(--ql-accent-champagne, #b08d57);
    }
    input::-moz-range-thumb {
      width: 16px;
      height: 16px;
      border-radius: var(--ql-radius-chip, 999px);
      background: var(--ql-surface-card, #fdfbf6);
      border: 1px solid var(--ql-surface-border, #e4dccb);
    }
  `;

  private readValue(event: Event): number {
    return Number((event.target as HTMLInputElement).value);
  }

  private emit(name: 'ql-input' | 'ql-change', value: number): void {
    this.value = value;
    this.dispatchEvent(
      new CustomEvent(name, { detail: { value }, bubbles: true, composed: true }),
    );
  }

  private onInput(event: Event): void {
    this.emit('ql-input', this.readValue(event));
  }

  private onChange(event: Event): void {
    this.emit('ql-change', this.readValue(event));
  }

  protected override updated(): void {
    const range = this.max - this.min;
    const pct = range === 0 ? 0 : ((this.value - this.min) / range) * 100;
    this.style.setProperty('--ql-slider-fill', `${pct}%`);
  }

  protected override render(): TemplateResult {
    return html`
      <input
        type="range"
        min=${this.min}
        max=${this.max}
        step=${this.step}
        .value=${String(this.value)}
        aria-label=${this.label === '' ? nothing : this.label}
        ?disabled=${this.disabled}
        @input=${this.onInput}
        @change=${this.onChange}
      />
    `;
  }
}

customElements.define('ql-slider', QlSlider);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/elements/ql-slider.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/elements/ql-slider.ts src/elements/ql-slider.test.ts
git commit -m "$(cat <<'EOF'
feat(elements): add ql-slider range primitive

- Native input[type=range] wrapper: keyboard access for free
- ql-input (drag) / ql-change (commit) events with numeric detail
- Champagne fill painted via --ql-slider-fill custom property

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 7: ql-segmented primitive

**Files:**
- Create: `src/elements/ql-segmented.ts`
- Test: `src/elements/ql-segmented.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/elements/ql-segmented.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { QlSegmented, type QlSegmentOption } from './ql-segmented';

const OPTIONS: ReadonlyArray<QlSegmentOption> = [
  { value: 'agenda', label: 'Agenda' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
];

async function mount(value = 'agenda'): Promise<QlSegmented> {
  const el = document.createElement('ql-segmented') as QlSegmented;
  el.options = OPTIONS;
  el.value = value;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

function buttons(el: QlSegmented): HTMLButtonElement[] {
  return [...(el.shadowRoot?.querySelectorAll('button') ?? [])];
}

describe('ql-segmented', () => {
  it('renders one radio button per option inside a radiogroup', async () => {
    const el = await mount();
    expect(el.shadowRoot?.querySelector("[role='radiogroup']")).not.toBeNull();
    const all = buttons(el);
    expect(all.map((b) => b.textContent?.trim())).toEqual(['Agenda', 'Day', 'Week']);
    expect(all.map((b) => b.getAttribute('role'))).toEqual(['radio', 'radio', 'radio']);
    el.remove();
  });

  it('marks the selected option with aria-checked and roving tabindex', async () => {
    const el = await mount('day');
    const all = buttons(el);
    expect(all.map((b) => b.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(all.map((b) => b.tabIndex)).toEqual([-1, 0, -1]);
    el.remove();
  });

  it('click selects and emits ql-change with the option value', async () => {
    const el = await mount();
    const events: string[] = [];
    el.addEventListener('ql-change', (e) => events.push((e as CustomEvent<{ value: string }>).detail.value));
    buttons(el)[2]?.click();
    expect(el.value).toBe('week');
    expect(events).toEqual(['week']);
    el.remove();
  });

  it('clicking the already-selected option emits nothing', async () => {
    const el = await mount();
    const events: unknown[] = [];
    el.addEventListener('ql-change', (e) => events.push(e));
    buttons(el)[0]?.click();
    expect(events).toEqual([]);
    el.remove();
  });

  it('ArrowRight/ArrowLeft move selection and wrap', async () => {
    const el = await mount('week');
    const group = el.shadowRoot?.querySelector("[role='radiogroup']");
    group?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(el.value).toBe('agenda');
    group?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await el.updateComplete;
    expect(el.value).toBe('week');
    el.remove();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/elements/ql-segmented.test.ts`
Expected: FAIL — module resolve error.

- [ ] **Step 3: Implement**

Create `src/elements/ql-segmented.ts`:

```ts
import { css, html, LitElement, type CSSResult, type TemplateResult } from 'lit';

export interface QlSegmentOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Segmented control (Figma `control/segmented`): 2–4 segments, selected =
 * ink pill with bg/base text. Radiogroup semantics with roving tabindex and
 * arrow-key wrap. Emits `ql-change` {value}; never calls hass.
 */
export class QlSegmented extends LitElement {
  static override properties = {
    options: { attribute: false },
    value: { type: String },
    label: { type: String },
  };

  declare options: ReadonlyArray<QlSegmentOption>;
  declare value: string;
  declare label: string;

  constructor() {
    super();
    this.options = [];
    this.value = '';
    this.label = '';
  }

  static override styles: CSSResult = css`
    .group {
      display: inline-flex;
      gap: 2px;
      padding: 2px;
      border-radius: var(--ql-radius-chip, 999px);
      border: 1px solid var(--ql-surface-border, #e4dccb);
      background: var(--ql-surface-card, #fdfbf6);
    }
    button {
      border: 0;
      background: transparent;
      color: var(--ql-ink-muted, #8c8578);
      padding: 4px var(--ql-space-m, 12px);
      border-radius: var(--ql-radius-chip, 999px);
      font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      cursor: pointer;
      transition:
        background 200ms ease,
        color 200ms ease;
    }
    button[aria-checked='true'] {
      background: var(--ql-ink-primary, #2b2620);
      color: var(--ql-bg-base, #f4f0e8);
      font-weight: 500;
    }
  `;

  private select(value: string): void {
    if (value === this.value) {
      return;
    }
    this.value = value;
    this.dispatchEvent(
      new CustomEvent('ql-change', { detail: { value }, bubbles: true, composed: true }),
    );
    void this.updateComplete.then(() => {
      const selected = this.shadowRoot?.querySelector<HTMLButtonElement>(
        "button[aria-checked='true']",
      );
      selected?.focus();
    });
  }

  private onKeydown(event: KeyboardEvent): void {
    if (this.options.length === 0) {
      return;
    }
    const index = this.options.findIndex((option) => option.value === this.value);
    let next: number;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = (index + 1) % this.options.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = (index - 1 + this.options.length) % this.options.length;
    } else {
      return;
    }
    event.preventDefault();
    const option = this.options[next];
    if (option !== undefined) {
      this.select(option.value);
    }
  }

  protected override render(): TemplateResult {
    return html`
      <div class="group" role="radiogroup" aria-label=${this.label} @keydown=${this.onKeydown}>
        ${this.options.map(
          (option) => html`
            <button
              role="radio"
              aria-checked=${String(option.value === this.value)}
              tabindex=${option.value === this.value ? 0 : -1}
              @click=${(): void => this.select(option.value)}
            >
              ${option.label}
            </button>
          `,
        )}
      </div>
    `;
  }
}

customElements.define('ql-segmented', QlSegmented);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/elements/ql-segmented.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/elements/ql-segmented.ts src/elements/ql-segmented.test.ts
git commit -m "$(cat <<'EOF'
feat(elements): add ql-segmented control primitive

- Radiogroup semantics: roving tabindex, arrow-key wrap, focus follows
- Selected segment = ink pill per Figma control/segmented
- Emits ql-change {value}; no-op on reselect

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 8: ql-section-eyebrow structure element

**Files:**
- Create: `src/elements/ql-section-eyebrow.ts`
- Test: `src/elements/ql-section-eyebrow.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/elements/ql-section-eyebrow.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { QlSectionEyebrow } from './ql-section-eyebrow';

describe('ql-section-eyebrow', () => {
  it('renders the label text and a link slot', async () => {
    const el = document.createElement('ql-section-eyebrow') as QlSectionEyebrow;
    el.label = 'Rooms';
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.label')?.textContent).toBe('Rooms');
    expect(el.shadowRoot?.querySelector("slot[name='link']")).not.toBeNull();
    el.remove();
  });

  it('uppercases with 0.14em tracking and colors the link slot champagne', () => {
    const cssText = QlSectionEyebrow.styles.toString();
    expect(cssText).toContain('text-transform: uppercase');
    expect(cssText).toContain('letter-spacing: 0.14em');
    expect(cssText).toContain('var(--ql-ink-muted, #8c8578)');
    expect(cssText).toContain('var(--ql-accent-champagne, #b08d57)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/elements/ql-section-eyebrow.test.ts`
Expected: FAIL — module resolve error.

- [ ] **Step 3: Implement**

Create `src/elements/ql-section-eyebrow.ts`:

```ts
import { css, html, LitElement, type CSSResult, type TemplateResult } from 'lit';

/**
 * Section eyebrow (Figma `section/eyebrow`): letterspaced uppercase micro-label
 * with an optional right-aligned link slot ("All climates →" pattern — the
 * caller slots a localized <a>/<button>).
 */
export class QlSectionEyebrow extends LitElement {
  static override properties = {
    label: { type: String },
  };

  declare label: string;

  constructor() {
    super();
    this.label = '';
  }

  static override styles: CSSResult = css`
    :host {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--ql-space-s, 8px);
    }
    .label {
      color: var(--ql-ink-muted, #8c8578);
      font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    ::slotted(*) {
      color: var(--ql-accent-champagne, #b08d57);
      font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      text-decoration: none;
    }
  `;

  protected override render(): TemplateResult {
    return html`<span class="label">${this.label}</span><slot name="link"></slot>`;
  }
}

customElements.define('ql-section-eyebrow', QlSectionEyebrow);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/elements/ql-section-eyebrow.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/elements/ql-section-eyebrow.ts src/elements/ql-section-eyebrow.test.ts
git commit -m "$(cat <<'EOF'
feat(elements): add ql-section-eyebrow structure element

- Uppercase 0.14em-tracked micro-label per spec typography rules
- Right-aligned link slot styled champagne for "All X" pattern

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 9: ql-header-home structure element (+ greeting locale keys)

**Files:**
- Create: `src/elements/ql-header-home.ts`
- Test: `src/elements/ql-header-home.test.ts`
- Modify: `src/i18n/locales/en.ts`, `zh-hant.ts`, `zh-hans.ts`, `ms.ts`, `id.ts`

- [ ] **Step 1: Write the failing test**

Create `src/elements/ql-header-home.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { QlHeaderHome } from './ql-header-home';

async function mount(props: Partial<QlHeaderHome>): Promise<QlHeaderHome> {
  const el = document.createElement('ql-header-home') as QlHeaderHome;
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe('ql-header-home', () => {
  it('mobile variant renders a localized time-of-day greeting with the user name', async () => {
    const el = await mount({
      variant: 'mobile',
      homeName: 'Subang Jaya',
      userName: 'Steven',
      hour: 9,
    });
    expect(el.shadowRoot?.querySelector('h1')?.textContent?.trim()).toBe('Good morning, Steven');
    el.remove();
  });

  it('greeting follows hour boundaries: <12 morning, <18 afternoon, else evening', async () => {
    const el = await mount({ variant: 'mobile', userName: 'Mei', hour: 11 });
    expect(el.shadowRoot?.querySelector('h1')?.textContent?.trim()).toBe('Good morning, Mei');
    el.hour = 12;
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('h1')?.textContent?.trim()).toBe('Good afternoon, Mei');
    el.hour = 18;
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('h1')?.textContent?.trim()).toBe('Good evening, Mei');
    el.remove();
  });

  it('greeting is localized via t()', async () => {
    const el = await mount({ variant: 'mobile', userName: 'Steven', hour: 9, locale: 'zh-Hant' });
    expect(el.shadowRoot?.querySelector('h1')?.textContent?.trim()).toBe('早安, Steven');
    el.remove();
  });

  it('ipad and desktop variants NEVER greet a person, even with userName set', async () => {
    for (const variant of ['ipad', 'desktop'] as const) {
      const el = await mount({
        variant,
        homeName: 'Tung Chung',
        userName: 'Steven',
        hour: 9,
        presence: 'Steven & Mei home',
      });
      const text = el.shadowRoot?.textContent ?? '';
      expect(el.shadowRoot?.querySelector('h1')?.textContent?.trim()).toBe('Tung Chung');
      expect(text).not.toContain('Good morning');
      expect(text).not.toContain('Steven,');
      el.remove();
    }
  });

  it('renders meta and champagne presence, and a chip slot on ipad/desktop', async () => {
    const el = await mount({
      variant: 'ipad',
      homeName: 'Xiamen',
      meta: 'Fri 1 Aug · 29° · AQI 42',
      presence: 'Steven home',
    });
    expect(el.shadowRoot?.querySelector('.meta')?.textContent).toBe('Fri 1 Aug · 29° · AQI 42');
    expect(el.shadowRoot?.querySelector('.presence')?.textContent).toBe('Steven home');
    expect(el.shadowRoot?.querySelector("slot[name='chip']")).not.toBeNull();
    el.remove();
  });

  it('uses the display font for the headline', () => {
    expect(QlHeaderHome.styles.toString()).toContain('var(--ql-font-display, Marcellus, serif)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/elements/ql-header-home.test.ts`
Expected: FAIL — module resolve error.

- [ ] **Step 3: Add the greeting keys to ALL FIVE locale files**

In `src/i18n/locales/en.ts`, add inside the `en` object after `'common.offline': 'Offline',`:

```ts
  'greeting.morning': 'Good morning',
  'greeting.afternoon': 'Good afternoon',
  'greeting.evening': 'Good evening',
```

In `src/i18n/locales/zh-hant.ts` (same position, after `'common.offline'`):

```ts
  'greeting.morning': '早安',
  'greeting.afternoon': '午安',
  'greeting.evening': '晚安',
```

In `src/i18n/locales/zh-hans.ts`:

```ts
  'greeting.morning': '早上好',
  'greeting.afternoon': '下午好',
  'greeting.evening': '晚上好',
```

In `src/i18n/locales/ms.ts`:

```ts
  'greeting.morning': 'Selamat pagi',
  'greeting.afternoon': 'Selamat tengah hari',
  'greeting.evening': 'Selamat petang',
```

In `src/i18n/locales/id.ts`:

```ts
  'greeting.morning': 'Selamat pagi',
  'greeting.afternoon': 'Selamat siang',
  'greeting.evening': 'Selamat malam',
```

Run `npm run typecheck` — must be clean (all five updated) — and `npx vitest run src/i18n/i18n.test.ts` — parity tests PASS.

- [ ] **Step 4: Implement the element**

Create `src/elements/ql-header-home.ts`:

```ts
import { css, html, LitElement, nothing, type CSSResult, type TemplateResult } from 'lit';
import type { TranslationKey } from '../i18n/locales/en';
import { t } from '../i18n/translate';
import type { Locale } from '../i18n/types';

export type QlHeaderVariant = 'mobile' | 'ipad' | 'desktop';

/**
 * Home header (Figma `header/home`, spec §6):
 * - mobile: meta line → personal greeting (Marcellus) → home + presence line.
 * - ipad/desktop: single row, home name in Marcellus, meta + presence + chip
 *   slot (globe language chip). NEVER a personal greeting — iPads are shared
 *   consoles (spec §2). The strategy simply does not set userName here, and the
 *   element ignores it for these variants regardless.
 */
export class QlHeaderHome extends LitElement {
  static override properties = {
    variant: { type: String, reflect: true },
    homeName: { attribute: 'home-name', type: String },
    userName: { attribute: 'user-name', type: String },
    meta: { type: String },
    presence: { type: String },
    hour: { type: Number },
    locale: { type: String },
  };

  declare variant: QlHeaderVariant;
  declare homeName: string;
  declare userName: string;
  declare meta: string;
  declare presence: string;
  declare hour?: number;
  declare locale: Locale;

  constructor() {
    super();
    this.variant = 'mobile';
    this.homeName = '';
    this.userName = '';
    this.meta = '';
    this.presence = '';
    this.locale = 'en';
  }

  greeting(): string {
    const hour = this.hour ?? new Date().getHours();
    const key: TranslationKey =
      hour < 12 ? 'greeting.morning' : hour < 18 ? 'greeting.afternoon' : 'greeting.evening';
    return t(this.locale, key);
  }

  static override styles: CSSResult = css`
    :host {
      display: block;
      color: var(--ql-ink-primary, #2b2620);
    }
    .display {
      margin: 0;
      font: 400 34px/40px var(--ql-font-display, Marcellus, serif);
      letter-spacing: 0.04em;
    }
    .meta,
    .sub {
      margin: 0;
      color: var(--ql-ink-muted, #8c8578);
      font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      letter-spacing: 0.02em;
    }
    .presence {
      color: var(--ql-accent-champagne, #b08d57);
    }
    header.stack {
      display: flex;
      flex-direction: column;
      gap: var(--ql-space-xs, 4px);
    }
    header.row {
      display: flex;
      align-items: center;
      gap: var(--ql-space-l, 16px);
    }
    header.row .display {
      font-size: 24px;
      line-height: 30px;
    }
    header.row .meta {
      margin-left: auto;
    }
  `;

  protected override render(): TemplateResult {
    if (this.variant === 'mobile') {
      const greeting =
        this.userName === '' ? this.greeting() : `${this.greeting()}, ${this.userName}`;
      return html`
        <header class="stack">
          ${this.meta === '' ? nothing : html`<p class="meta">${this.meta}</p>`}
          <h1 class="display">${greeting}</h1>
          <p class="sub">
            ${this.homeName}${this.presence === ''
              ? nothing
              : html` · <span class="presence">${this.presence}</span>`}
          </p>
        </header>
      `;
    }
    return html`
      <header class="row">
        <h1 class="display">${this.homeName}</h1>
        <p class="meta">${this.meta}</p>
        ${this.presence === '' ? nothing : html`<span class="presence">${this.presence}</span>`}
        <slot name="chip"></slot>
      </header>
    `;
  }
}

customElements.define('ql-header-home', QlHeaderHome);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/elements/ql-header-home.test.ts src/i18n/i18n.test.ts`
Expected: PASS (6 + parity tests).

- [ ] **Step 6: Commit**

```bash
git add src/elements/ql-header-home.ts src/elements/ql-header-home.test.ts src/i18n/locales/en.ts src/i18n/locales/zh-hant.ts src/i18n/locales/zh-hans.ts src/i18n/locales/ms.ts src/i18n/locales/id.ts
git commit -m "$(cat <<'EOF'
feat(elements): add ql-header-home with breakpoint variants

- mobile: localized time-of-day greeting (Marcellus) + home/presence
- ipad/desktop: home-name row, chip slot, greeting structurally impossible
- greeting.morning/afternoon/evening added to all five locales

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 10: ql-header-room structure element (+ common.back key)

**Files:**
- Create: `src/elements/ql-header-room.ts`
- Test: `src/elements/ql-header-room.test.ts`
- Modify: all five `src/i18n/locales/*.ts`

- [ ] **Step 1: Write the failing test**

Create `src/elements/ql-header-room.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { QlHeaderRoom } from './ql-header-room';

async function mount(props: Partial<QlHeaderRoom>): Promise<QlHeaderRoom> {
  const el = document.createElement('ql-header-room') as QlHeaderRoom;
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe('ql-header-room', () => {
  it('renders the room name in the display font and dot-joined micro-stats', async () => {
    const el = await mount({ name: 'Living Room', stats: ['24.5°', '62%', 'AQI 18'] });
    expect(el.shadowRoot?.querySelector('h1')?.textContent).toBe('Living Room');
    expect(el.shadowRoot?.querySelector('.stats')?.textContent).toBe('24.5° · 62% · AQI 18');
    expect(QlHeaderRoom.styles.toString()).toContain('var(--ql-font-display, Marcellus, serif)');
    el.remove();
  });

  it('omits the stats line when there are no stats', async () => {
    const el = await mount({ name: 'Storage' });
    expect(el.shadowRoot?.querySelector('.stats')).toBeNull();
    el.remove();
  });

  it('back button has a localized aria-label and emits ql-back', async () => {
    const el = await mount({ name: 'Living Room', locale: 'zh-Hant' });
    const back = el.shadowRoot?.querySelector<HTMLButtonElement>('.back');
    expect(back?.getAttribute('aria-label')).toBe('返回');
    let fired = 0;
    el.addEventListener('ql-back', () => {
      fired += 1;
    });
    back?.click();
    expect(fired).toBe(1);
    el.remove();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/elements/ql-header-room.test.ts`
Expected: FAIL — module resolve error.

- [ ] **Step 3: Add `common.back` to ALL FIVE locale files**

After `'common.offline': …,` in each file:

- `en.ts`: `'common.back': 'Back',`
- `zh-hant.ts`: `'common.back': '返回',`
- `zh-hans.ts`: `'common.back': '返回',`
- `ms.ts`: `'common.back': 'Kembali',`
- `id.ts`: `'common.back': 'Kembali',`

Run `npm run typecheck` — clean.

- [ ] **Step 4: Implement the element**

Create `src/elements/ql-header-room.ts`:

```ts
import { css, html, LitElement, nothing, type CSSResult, type TemplateResult } from 'lit';
import { t } from '../i18n/translate';
import type { Locale } from '../i18n/types';

/**
 * Room header (Figma `header/room`, spec §6): back affordance + room name in
 * Marcellus + micro-stats row (temp · humidity · AQI, pre-formatted strings).
 * Emits `ql-back`; the strategy wires navigation.
 */
export class QlHeaderRoom extends LitElement {
  static override properties = {
    name: { type: String },
    stats: { attribute: false },
    locale: { type: String },
  };

  declare name: string;
  declare stats: ReadonlyArray<string>;
  declare locale: Locale;

  constructor() {
    super();
    this.name = '';
    this.stats = [];
    this.locale = 'en';
  }

  static override styles: CSSResult = css`
    header {
      display: flex;
      align-items: center;
      gap: var(--ql-space-m, 12px);
      color: var(--ql-ink-primary, #2b2620);
    }
    .back {
      width: 36px;
      height: 36px;
      border-radius: var(--ql-radius-chip, 999px);
      border: 1px solid var(--ql-surface-border, #e4dccb);
      background: var(--ql-surface-card, #fdfbf6);
      color: var(--ql-ink-primary, #2b2620);
      font: 400 18px/1 var(--ql-font-body, Outfit, sans-serif);
      cursor: pointer;
    }
    h1 {
      margin: 0;
      font: 400 24px/30px var(--ql-font-display, Marcellus, serif);
      letter-spacing: 0.04em;
    }
    .stats {
      margin: 0;
      color: var(--ql-ink-muted, #8c8578);
      font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
    }
  `;

  private onBack(): void {
    this.dispatchEvent(new CustomEvent('ql-back', { bubbles: true, composed: true }));
  }

  protected override render(): TemplateResult {
    return html`
      <header>
        <button class="back" aria-label=${t(this.locale, 'common.back')} @click=${this.onBack}>
          ‹
        </button>
        <div>
          <h1>${this.name}</h1>
          ${this.stats.length === 0
            ? nothing
            : html`<p class="stats">${this.stats.join(' · ')}</p>`}
        </div>
      </header>
    `;
  }
}

customElements.define('ql-header-room', QlHeaderRoom);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/elements/ql-header-room.test.ts src/i18n/i18n.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/elements/ql-header-room.ts src/elements/ql-header-room.test.ts src/i18n/locales/en.ts src/i18n/locales/zh-hant.ts src/i18n/locales/zh-hans.ts src/i18n/locales/ms.ts src/i18n/locales/id.ts
git commit -m "$(cat <<'EOF'
feat(elements): add ql-header-room with back affordance

- Marcellus room name + dot-joined micro-stats row
- Localized back button (common.back in all five locales), emits ql-back

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 11: registerCard and navigate helpers

**Files:**
- Create: `src/cards/register.ts`, `src/cards/navigate.ts`
- Test: `src/cards/register.test.ts`, `src/cards/navigate.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/cards/register.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { registerCard } from './register';

class FakeCardA extends HTMLElement {}
class FakeCardB extends HTMLElement {}

describe('registerCard', () => {
  it('defines the element and appends a window.customCards entry', () => {
    registerCard('ql-fake-card-a', FakeCardA, {
      name: 'Fake Card A',
      description: 'Test card',
    });
    expect(customElements.get('ql-fake-card-a')).toBe(FakeCardA);
    expect(window.customCards).toContainEqual({
      type: 'ql-fake-card-a',
      name: 'Fake Card A',
      description: 'Test card',
    });
  });

  it('preserves existing entries when registering another card', () => {
    registerCard('ql-fake-card-b', FakeCardB, {
      name: 'Fake Card B',
      description: 'Second test card',
    });
    const types = (window.customCards ?? []).map((entry) => entry.type);
    expect(types).toContain('ql-fake-card-a');
    expect(types).toContain('ql-fake-card-b');
  });
});
```

Create `src/cards/navigate.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { navigate } from './navigate';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('navigate', () => {
  it('pushes the path and fires location-changed for the HA router', () => {
    const push = vi.spyOn(history, 'pushState').mockImplementation(() => undefined);
    let detail: unknown;
    const listener = (e: Event): void => {
      detail = (e as CustomEvent).detail;
    };
    window.addEventListener('location-changed', listener);
    navigate('/quiet-luxe/living');
    window.removeEventListener('location-changed', listener);
    expect(push).toHaveBeenCalledWith(null, '', '/quiet-luxe/living');
    expect(detail).toEqual({ replace: false });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/cards/register.test.ts src/cards/navigate.test.ts`
Expected: FAIL — module resolve errors.

- [ ] **Step 3: Implement**

Create `src/cards/register.ts`:

```ts
export interface CustomCardEntry {
  readonly type: string;
  readonly name: string;
  readonly description: string;
}

declare global {
  interface Window {
    customCards?: CustomCardEntry[];
  }
}

/**
 * Defines a dashboard card element and lists it in HA's card picker.
 * Descriptions are English-only by design: window.customCards is read once at
 * bundle load, before any user locale is known (picker metadata, not UI).
 */
export function registerCard(
  tag: string,
  ctor: CustomElementConstructor,
  entry: Omit<CustomCardEntry, 'type'>,
): void {
  customElements.define(tag, ctor);
  window.customCards = window.customCards ?? [];
  window.customCards.push({ type: tag, ...entry });
}
```

Create `src/cards/navigate.ts`:

```ts
/**
 * HA-frontend navigation: pushState + the `location-changed` window event the
 * HA router listens for. Used by the room card's tap-to-drill-in.
 */
export function navigate(path: string): void {
  history.pushState(null, '', path);
  window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/cards/register.test.ts src/cards/navigate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/cards/register.ts src/cards/register.test.ts src/cards/navigate.ts src/cards/navigate.test.ts
git commit -m "$(cat <<'EOF'
feat(cards): add registerCard and navigate helpers

- registerCard: customElements.define + window.customCards entry (typed)
- navigate: pushState + location-changed event for HA router
- Shared by all quiet-luxe-* cards in Plan 3a/3b

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 12: quiet-luxe-room-card (+ room.lights_on key)

**Files:**
- Create: `src/cards/quiet-luxe-room-card.ts`
- Test: `src/cards/quiet-luxe-room-card.test.ts`
- Modify: all five `src/i18n/locales/*.ts`

- [ ] **Step 1: Write the failing test**

Create `src/cards/quiet-luxe-room-card.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  lightEntity,
  makeEntity,
  makeMockHass,
  sensorEntity,
} from '../testing/mock-hass';
import { QuietLuxeRoomCard, type RoomCardConfig } from './quiet-luxe-room-card';

const BASE_CONFIG: RoomCardConfig = {
  type: 'custom:quiet-luxe-room-card',
  name: 'Living Room',
  image: '/local/quiet-luxe/rooms/living.jpg',
};

async function mount(
  config: Partial<RoomCardConfig> = {},
  hass = makeMockHass(),
): Promise<QuietLuxeRoomCard> {
  const card = document.createElement('quiet-luxe-room-card') as QuietLuxeRoomCard;
  card.setConfig({ ...BASE_CONFIG, ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('quiet-luxe-room-card', () => {
  it('registers the element and a window.customCards entry', () => {
    expect(customElements.get('quiet-luxe-room-card')).toBe(QuietLuxeRoomCard);
    expect((window.customCards ?? []).map((e) => e.type)).toContain('quiet-luxe-room-card');
  });

  it('setConfig rejects missing name or image', () => {
    const card = new QuietLuxeRoomCard();
    expect(() => card.setConfig({ ...BASE_CONFIG, name: '' })).toThrow(/name/);
    expect(() => card.setConfig({ ...BASE_CONFIG, image: '' })).toThrow(/image/);
  });

  it('renders the photo, room name, and Figma scrim layers (M default)', async () => {
    const card = await mount();
    const root = card.shadowRoot?.querySelector<HTMLElement>('.room');
    expect(root?.dataset.size).toBe('m');
    expect(root?.style.backgroundImage).toContain('/local/quiet-luxe/rooms/living.jpg');
    expect(card.shadowRoot?.querySelector('.scrim-top .name')?.textContent).toBe('Living Room');
    expect(card.shadowRoot?.querySelector('.scrim-bottom')).not.toBeNull();
    const cssText = (QuietLuxeRoomCard.styles as unknown as ReadonlyArray<{ toString(): string }>)
      .map((s) => s.toString())
      .join('\n');
    expect(cssText).toContain('rgba(8, 6, 4, 0.62)');
    expect(cssText).toContain('rgba(8, 6, 4, 0.82)');
  });

  it('S density: bottom-scrim name only, no top scrim, no chips', async () => {
    const card = await mount({
      size: 's',
      chips: [{ entity: 'light.pendant', label: 'Lights' }],
    });
    expect(card.shadowRoot?.querySelector('.scrim-top')).toBeNull();
    expect(card.shadowRoot?.querySelector('.scrim-bottom .name-s')?.textContent).toBe(
      'Living Room',
    );
    expect(card.shadowRoot?.querySelector('ql-chip')).toBeNull();
  });

  it('stats line joins temperature and AQI, omitting unavailable entities', async () => {
    const hass = makeMockHass([
      sensorEntity('sensor.living_temp', '24.5'),
      sensorEntity('sensor.living_aqi', 'unavailable'),
    ]);
    const card = await mount(
      { temperature_entity: 'sensor.living_temp', aqi_entity: 'sensor.living_aqi' },
      hass,
    );
    expect(card.shadowRoot?.querySelector('.stats')?.textContent?.trim()).toBe('24.5°');
  });

  it('shows the lights-on glow dot only when the lights entity is on', async () => {
    const on = await mount(
      { lights_entity: 'light.living_group' },
      makeMockHass([makeEntity('light.living_group', 'on')]),
    );
    const dot = on.shadowRoot?.querySelector('.glow-dot');
    expect(dot?.getAttribute('aria-label')).toBe('Lights on');
    const off = await mount(
      { lights_entity: 'light.living_group' },
      makeMockHass([makeEntity('light.living_group', 'off')]),
    );
    expect(off.shadowRoot?.querySelector('.glow-dot')).toBeNull();
  });

  it('L density adds the AQI badge pill', async () => {
    const card = await mount(
      { size: 'l', aqi_entity: 'sensor.living_aqi' },
      makeMockHass([sensorEntity('sensor.living_aqi', '18')]),
    );
    expect(card.shadowRoot?.querySelector('ql-badge.aqi')?.textContent?.trim()).toBe('AQI 18');
  });

  it('tap and Enter navigate to navigation_path', async () => {
    vi.spyOn(history, 'pushState').mockImplementation(() => undefined);
    const card = await mount({ navigation_path: '/quiet-luxe/living' });
    const root = card.shadowRoot?.querySelector<HTMLElement>('.room');
    expect(root?.getAttribute('role')).toBe('button');
    expect(root?.getAttribute('tabindex')).toBe('0');
    root?.click();
    root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(history.pushState).toHaveBeenCalledTimes(2);
    expect(history.pushState).toHaveBeenCalledWith(null, '', '/quiet-luxe/living');
  });

  it('chip tap toggles the chip entity without navigating', async () => {
    vi.spyOn(history, 'pushState').mockImplementation(() => undefined);
    const hass = makeMockHass([lightEntity('light.pendant', 'on')]);
    const card = await mount(
      {
        navigation_path: '/quiet-luxe/living',
        chips: [{ entity: 'light.pendant', label: 'Lights' }],
      },
      hass,
    );
    card.shadowRoot
      ?.querySelector('ql-chip')
      ?.dispatchEvent(new Event('click', { bubbles: true }));
    expect(hass.calls).toEqual([
      { domain: 'homeassistant', service: 'toggle', data: { entity_id: 'light.pendant' } },
    ]);
    expect(history.pushState).not.toHaveBeenCalled();
  });

  it('sizes the layout grid: s/m/l rows 2/3/4', async () => {
    const card = await mount({ size: 's' });
    expect(card.getCardSize()).toBe(2);
    expect(card.getGridOptions()).toEqual({ rows: 2, columns: 6 });
    card.setConfig({ ...BASE_CONFIG, size: 'l' });
    expect(card.getCardSize()).toBe(4);
    expect(card.getGridOptions()).toEqual({ rows: 4, columns: 6 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/cards/quiet-luxe-room-card.test.ts`
Expected: FAIL — module resolve error.

- [ ] **Step 3: Add `room.lights_on` to ALL FIVE locale files**

After the `greeting.*` block in each file:

- `en.ts`: `'room.lights_on': 'Lights on',`
- `zh-hant.ts`: `'room.lights_on': '燈已開',`
- `zh-hans.ts`: `'room.lights_on': '灯已开',`
- `ms.ts`: `'room.lights_on': 'Lampu hidup',`
- `id.ts`: `'room.lights_on': 'Lampu menyala',`

Run `npm run typecheck` — clean.

- [ ] **Step 4: Implement the card**

Create `src/cards/quiet-luxe-room-card.ts`:

```ts
import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';
import '../elements/ql-badge';
import '../elements/ql-chip';
import { t } from '../i18n/translate';
import { navigate } from './navigate';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';

export type RoomCardSize = 's' | 'm' | 'l';

export interface RoomCardChipConfig {
  readonly entity: string;
  readonly label?: string;
}

export interface RoomCardConfig {
  readonly type: string;
  readonly name: string;
  readonly image: string;
  readonly size?: RoomCardSize;
  readonly navigation_path?: string;
  readonly temperature_entity?: string;
  readonly aqi_entity?: string;
  readonly lights_entity?: string;
  readonly chips?: ReadonlyArray<RoomCardChipConfig>;
}

const ROWS_BY_SIZE: Readonly<Record<RoomCardSize, number>> = { s: 2, m: 3, l: 4 };

/**
 * Photo room card (Figma `card/room`, spec §6): top + bottom gradient scrims
 * baked in for legibility on any photo (decision #12; scrim stops per the
 * Figma legibility fix), S/M/L density, lights-on glow dot, tappable device
 * chips on the bottom scrim, tap-to-navigate drill-in.
 * Scrim rgba values are Figma-locked and mode-independent by design.
 */
export class QuietLuxeRoomCard extends QlBaseCard {
  static override properties = {
    config: { attribute: false },
  };

  declare config?: RoomCardConfig;

  setConfig(config: RoomCardConfig): void {
    if (typeof config.name !== 'string' || config.name === '') {
      throw new Error('quiet-luxe-room-card: "name" is required');
    }
    if (typeof config.image !== 'string' || config.image === '') {
      throw new Error('quiet-luxe-room-card: "image" is required');
    }
    this.config = config;
  }

  getCardSize(): number {
    return ROWS_BY_SIZE[this.config?.size ?? 'm'];
  }

  getGridOptions(): { rows: number; columns: number } {
    return { rows: this.getCardSize(), columns: 6 };
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .room {
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        border-radius: var(--ql-radius-card, 18px);
        background-size: cover;
        background-position: center;
        cursor: pointer;
      }
      .room[data-size='s'] {
        min-height: 110px;
      }
      .room[data-size='m'] {
        min-height: 190px;
      }
      .room[data-size='l'] {
        min-height: 260px;
      }
      .scrim-top {
        background: linear-gradient(180deg, rgba(8, 6, 4, 0.62) 0%, transparent 45%);
        padding: var(--ql-space-m, 12px);
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .scrim-bottom {
        background: linear-gradient(0deg, rgba(8, 6, 4, 0.82) 0%, transparent 50%);
        padding: var(--ql-space-m, 12px);
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--ql-space-s, 8px);
      }
      .name {
        color: #ffffff;
        font: 500 16px/22px var(--ql-font-body, Outfit, sans-serif);
      }
      .name-s {
        color: #ffffff;
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .stats {
        color: rgba(255, 255, 255, 0.75);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ql-space-xs, 4px);
      }
      .glow-dot {
        flex: none;
        width: 10px;
        height: 10px;
        border-radius: var(--ql-radius-chip, 999px);
        background: radial-gradient(
          circle,
          var(--ql-glow-lamp-inner, #ffd98a),
          var(--ql-glow-lamp-outer, #e0b263)
        );
        box-shadow: 0 0 18px rgba(224, 178, 99, 0.45);
      }
      ql-badge.aqi {
        position: absolute;
        top: var(--ql-space-m, 12px);
        right: var(--ql-space-m, 12px);
      }
    `,
  ];

  private statsLine(): string {
    const parts: string[] = [];
    const tempId = this.config?.temperature_entity;
    if (tempId !== undefined && this.availability(tempId) === 'available') {
      const value = Number(this.entity(tempId)?.state);
      if (Number.isFinite(value)) {
        parts.push(`${value.toFixed(1)}°`);
      }
    }
    const aqi = this.aqiValue();
    if (aqi !== undefined) {
      parts.push(`AQI ${aqi}`);
    }
    return parts.join(' · ');
  }

  private aqiValue(): number | undefined {
    const aqiId = this.config?.aqi_entity;
    if (aqiId === undefined || this.availability(aqiId) !== 'available') {
      return undefined;
    }
    const value = Number(this.entity(aqiId)?.state);
    return Number.isFinite(value) ? Math.round(value) : undefined;
  }

  private lightsOn(): boolean {
    const lightsId = this.config?.lights_entity;
    return (
      lightsId !== undefined &&
      this.availability(lightsId) === 'available' &&
      this.entity(lightsId)?.state === 'on'
    );
  }

  private onTap(): void {
    const path = this.config?.navigation_path;
    if (path !== undefined) {
      navigate(path);
    }
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onTap();
    }
  }

  private onChipTap(event: Event, entityId: string): void {
    event.stopPropagation();
    void this.hass?.callService('homeassistant', 'toggle', { entity_id: entityId });
  }

  private renderChips(): TemplateResult | typeof nothing {
    const chips = this.config?.chips;
    if (chips === undefined || chips.length === 0) {
      return nothing;
    }
    return html`
      <span class="chips">
        ${chips.map((chip) => {
          const availability = this.availability(chip.entity);
          const on = availability === 'available' && this.entity(chip.entity)?.state === 'on';
          return html`
            <ql-chip
              variant="device"
              ?active=${on}
              class=${availability === 'available' ? '' : 'ql-unavailable'}
              @click=${(event: Event): void => this.onChipTap(event, chip.entity)}
              >${chip.label ?? chip.entity}</ql-chip
            >
          `;
        })}
      </span>
    `;
  }

  private renderAqiPill(): TemplateResult | typeof nothing {
    const aqi = this.aqiValue();
    return aqi === undefined ? nothing : html`<ql-badge class="aqi">AQI ${aqi}</ql-badge>`;
  }

  protected override render(): TemplateResult {
    if (this.config === undefined) {
      return html``;
    }
    const size = this.config.size ?? 'm';
    return html`
      <div
        class="room"
        data-size=${size}
        role="button"
        tabindex="0"
        aria-label=${this.config.name}
        style="background-image:url('${this.config.image}')"
        @click=${this.onTap}
        @keydown=${this.onKeydown}
      >
        ${size === 's'
          ? nothing
          : html`
              <div class="scrim-top">
                <span class="name">${this.config.name}</span>
                <span class="stats">${this.statsLine()}</span>
              </div>
            `}
        ${size === 'l' ? this.renderAqiPill() : nothing}
        <div class="scrim-bottom">
          ${size === 's' ? html`<span class="name-s">${this.config.name}</span>` : nothing}
          ${size === 's' ? nothing : this.renderChips()}
          ${this.lightsOn()
            ? html`
                <span
                  class="glow-dot"
                  role="img"
                  aria-label=${t(this.locale(), 'room.lights_on')}
                ></span>
              `
            : nothing}
        </div>
      </div>
    `;
  }
}

registerCard('quiet-luxe-room-card', QuietLuxeRoomCard, {
  name: 'Quiet Luxe Room Card',
  description: 'Photo room card with scrims, device chips, and drill-in navigation.',
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/cards/quiet-luxe-room-card.test.ts src/i18n/i18n.test.ts`
Expected: PASS (10 + parity tests).

- [ ] **Step 6: Commit**

```bash
git add src/cards/quiet-luxe-room-card.ts src/cards/quiet-luxe-room-card.test.ts src/i18n/locales/en.ts src/i18n/locales/zh-hant.ts src/i18n/locales/zh-hans.ts src/i18n/locales/ms.ts src/i18n/locales/id.ts
git commit -m "$(cat <<'EOF'
feat(cards): add quiet-luxe-room-card

- Photo card with Figma-locked top/bottom scrims for legibility
- S/M/L density, lights-on glow dot, tappable device chips (homeassistant.toggle)
- Tap/Enter/Space navigate to navigation_path; room.lights_on in all locales

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 13: Climate device-type and activity functions

**Files:**
- Create: `src/cards/climate-device-type.ts`
- Test: `src/cards/climate-device-type.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/cards/climate-device-type.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeEntity } from '../testing/mock-hass';
import { climateActivity, detectClimateDeviceType } from './climate-device-type';

describe('detectClimateDeviceType', () => {
  it('maps domains to device types', () => {
    expect(detectClimateDeviceType('climate.living_ac')).toBe('ac');
    expect(detectClimateDeviceType('humidifier.bedroom')).toBe('dehumidifier');
    expect(detectClimateDeviceType('fan.study')).toBe('fan');
    expect(detectClimateDeviceType('switch.bath_exhaust')).toBe('exhaust');
  });

  it('falls back to fan for unknown domains (config override expected)', () => {
    expect(detectClimateDeviceType('sensor.whatever')).toBe('fan');
    expect(detectClimateDeviceType('')).toBe('fan');
  });
});

describe('climateActivity', () => {
  it('off state is off', () => {
    expect(climateActivity(makeEntity('climate.a', 'off'))).toBe('off');
    expect(climateActivity(makeEntity('fan.a', 'off'))).toBe('off');
  });

  it('hvac_action idle is idle', () => {
    expect(climateActivity(makeEntity('climate.a', 'cool', { hvac_action: 'idle' }))).toBe('idle');
  });

  it('anything else running is active', () => {
    expect(climateActivity(makeEntity('climate.a', 'cool', { hvac_action: 'cooling' }))).toBe(
      'active',
    );
    expect(climateActivity(makeEntity('fan.a', 'on'))).toBe('active');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/cards/climate-device-type.test.ts`
Expected: FAIL — module resolve error.

- [ ] **Step 3: Implement**

Create `src/cards/climate-device-type.ts`:

```ts
import type { HassEntity } from '../types/home-assistant';

export type ClimateDeviceType = 'ac' | 'purifier' | 'dehumidifier' | 'fan' | 'exhaust';
export type ClimateActivity = 'active' | 'idle' | 'off';

const DOMAIN_DEFAULTS: Readonly<Record<string, ClimateDeviceType>> = {
  climate: 'ac',
  humidifier: 'dehumidifier',
  fan: 'fan',
  switch: 'exhaust',
};

/**
 * Domain-based default per spec §6 climate variants. Purifiers (fan domain,
 * e.g. Dyson) and exhausts wired as fans are indistinguishable from plain
 * fans by domain — those homes set `device_type` explicitly in config.
 */
export function detectClimateDeviceType(entityId: string): ClimateDeviceType {
  const domain = entityId.split('.')[0] ?? '';
  return DOMAIN_DEFAULTS[domain] ?? 'fan';
}

/** active | idle | off for any climate-family entity. */
export function climateActivity(entity: HassEntity): ClimateActivity {
  if (entity.state === 'off') {
    return 'off';
  }
  if (entity.attributes.hvac_action === 'idle') {
    return 'idle';
  }
  return 'active';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/cards/climate-device-type.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/cards/climate-device-type.ts src/cards/climate-device-type.test.ts
git commit -m "$(cat <<'EOF'
feat(cards): add climate device-type detection and activity helpers

- Domain map: climate=ac, humidifier=dehumidifier, fan=fan, switch=exhaust
- Purifier/exhaust-on-fan require explicit config override (documented)
- climateActivity: off / hvac_action idle / active

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 14: quiet-luxe-climate-card (+ state/power/confirm keys)

**Files:**
- Create: `src/cards/quiet-luxe-climate-card.ts`
- Test: `src/cards/quiet-luxe-climate-card.test.ts`
- Modify: all five `src/i18n/locales/*.ts`

- [ ] **Step 1: Write the failing test**

Create `src/cards/quiet-luxe-climate-card.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { climateEntity, makeEntity, makeMockHass, sensorEntity } from '../testing/mock-hass';
import { QuietLuxeClimateCard, type ClimateCardConfig } from './quiet-luxe-climate-card';

async function mount(
  config: Partial<ClimateCardConfig> & { entity: string },
  hass = makeMockHass(),
): Promise<QuietLuxeClimateCard> {
  const card = document.createElement('quiet-luxe-climate-card') as QuietLuxeClimateCard;
  card.setConfig({ type: 'custom:quiet-luxe-climate-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('quiet-luxe-climate-card', () => {
  it('registers element + picker entry, requires entity, sizes 2x4', () => {
    expect(customElements.get('quiet-luxe-climate-card')).toBe(QuietLuxeClimateCard);
    expect((window.customCards ?? []).map((e) => e.type)).toContain('quiet-luxe-climate-card');
    const card = new QuietLuxeClimateCard();
    expect(() =>
      card.setConfig({ type: 'custom:quiet-luxe-climate-card', entity: '' }),
    ).toThrow(/entity/);
    card.setConfig({ type: 'custom:quiet-luxe-climate-card', entity: 'climate.a' });
    expect(card.getCardSize()).toBe(2);
    expect(card.getGridOptions()).toEqual({ rows: 2, columns: 4 });
  });

  it('auto-detects device type from domain, with config override', async () => {
    const ac = await mount(
      { entity: 'climate.living_ac' },
      makeMockHass([climateEntity('climate.living_ac')]),
    );
    expect(ac.deviceType()).toBe('ac');
    expect(ac.shadowRoot?.querySelector<HTMLElement>('.ql-card')?.dataset.device).toBe('ac');
    const purifier = await mount(
      { entity: 'fan.dyson', device_type: 'purifier' },
      makeMockHass([makeEntity('fan.dyson', 'on')]),
    );
    expect(purifier.deviceType()).toBe('purifier');
  });

  it('shows current temperature for ACs and localized activity states', async () => {
    const hass = makeMockHass([
      climateEntity('climate.a', 'cool', { current_temperature: 24.5, hvac_action: 'cooling' }),
    ]);
    const card = await mount({ entity: 'climate.a' }, hass);
    expect(card.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('24.5°');
    expect(card.shadowRoot?.querySelector('.status')?.textContent?.trim()).toBe('Active');
    expect(card.shadowRoot?.querySelector('.status')?.classList.contains('accent')).toBe(true);
  });

  it('idle and off states render muted', async () => {
    const idle = await mount(
      { entity: 'climate.a' },
      makeMockHass([climateEntity('climate.a', 'cool', { hvac_action: 'idle' })]),
    );
    expect(idle.shadowRoot?.querySelector('.status')?.textContent?.trim()).toBe('Idle');
    const off = await mount(
      { entity: 'fan.a' },
      makeMockHass([makeEntity('fan.a', 'off')]),
    );
    expect(off.shadowRoot?.querySelector('.status')?.textContent?.trim()).toBe('Off');
    expect(off.shadowRoot?.querySelector('.status')?.classList.contains('muted')).toBe(true);
    expect(off.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('Off');
  });

  it('reads the numeral from value_entity when configured (purifier AQI)', async () => {
    const hass = makeMockHass([
      makeEntity('fan.dyson', 'on'),
      sensorEntity('sensor.dyson_aqi', '18'),
    ]);
    const card = await mount(
      { entity: 'fan.dyson', device_type: 'purifier', value_entity: 'sensor.dyson_aqi' },
      hass,
    );
    expect(card.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('18');
  });

  it('power tap toggles: climate uses turn_on/turn_off, others domain toggle', async () => {
    const offAc = makeMockHass([climateEntity('climate.a', 'off')]);
    const card = await mount({ entity: 'climate.a' }, offAc);
    card.shadowRoot?.querySelector<HTMLButtonElement>('.power')?.click();
    expect(offAc.calls).toEqual([
      { domain: 'climate', service: 'turn_on', data: { entity_id: 'climate.a' } },
    ]);
    const fanHass = makeMockHass([makeEntity('fan.a', 'on')]);
    const fanCard = await mount({ entity: 'fan.a' }, fanHass);
    fanCard.shadowRoot?.querySelector<HTMLButtonElement>('.power')?.click();
    expect(fanHass.calls).toEqual([
      { domain: 'fan', service: 'toggle', data: { entity_id: 'fan.a' } },
    ]);
  });

  it('confirm: first tap arms (no call), second tap executes, 3s disarms', async () => {
    vi.useFakeTimers();
    const hass = makeMockHass([makeEntity('switch.exhaust', 'on')]);
    const card = await mount({ entity: 'switch.exhaust', confirm: true }, hass);
    const power = (): HTMLButtonElement | null | undefined =>
      card.shadowRoot?.querySelector<HTMLButtonElement>('.power');
    power()?.click();
    await card.updateComplete;
    expect(hass.calls).toEqual([]);
    expect(card.shadowRoot?.querySelector('.status')?.textContent?.trim()).toBe(
      'Tap again to confirm',
    );
    power()?.click();
    await card.updateComplete;
    expect(hass.calls).toEqual([
      { domain: 'switch', service: 'toggle', data: { entity_id: 'switch.exhaust' } },
    ]);
    power()?.click();
    await card.updateComplete;
    vi.advanceTimersByTime(3000);
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector('.status')?.textContent?.trim()).toBe('Active');
    expect(hass.calls).toHaveLength(1);
  });

  it('unavailable renders muted with disabled power; missing renders the placeholder', async () => {
    const unavailable = await mount(
      { entity: 'climate.a' },
      makeMockHass([climateEntity('climate.a', 'unavailable')]),
    );
    expect(
      unavailable.shadowRoot?.querySelector('.ql-card')?.classList.contains('ql-unavailable'),
    ).toBe(true);
    expect(unavailable.shadowRoot?.querySelector('.status')?.textContent?.trim()).toBe(
      'Unavailable',
    );
    expect(unavailable.shadowRoot?.querySelector<HTMLButtonElement>('.power')?.disabled).toBe(
      true,
    );
    const missing = await mount({ entity: 'climate.ghost' }, makeMockHass());
    expect(missing.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('—');
    expect(
      missing.shadowRoot?.querySelector('.ql-card')?.classList.contains('ql-unavailable'),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/cards/quiet-luxe-climate-card.test.ts`
Expected: FAIL — module resolve error.

- [ ] **Step 3: Add the four keys to ALL FIVE locale files**

Insert after `'common.back': …,` (common.*) and after `'room.lights_on': …,` (state.*) in each file:

`en.ts`:

```ts
  'common.power': 'Power',
  'common.tap_confirm': 'Tap again to confirm',
  'state.active': 'Active',
  'state.idle': 'Idle',
```

`zh-hant.ts`:

```ts
  'common.power': '電源',
  'common.tap_confirm': '再點一次以確認',
  'state.active': '運作中',
  'state.idle': '待機',
```

`zh-hans.ts`:

```ts
  'common.power': '电源',
  'common.tap_confirm': '再点一次以确认',
  'state.active': '运行中',
  'state.idle': '待机',
```

`ms.ts`:

```ts
  'common.power': 'Kuasa',
  'common.tap_confirm': 'Ketik sekali lagi untuk mengesahkan',
  'state.active': 'Aktif',
  'state.idle': 'Sedia',
```

`id.ts`:

```ts
  'common.power': 'Daya',
  'common.tap_confirm': 'Ketuk sekali lagi untuk konfirmasi',
  'state.active': 'Aktif',
  'state.idle': 'Siaga',
```

Run `npm run typecheck` — clean.

- [ ] **Step 4: Implement the card**

Create `src/cards/quiet-luxe-climate-card.ts`:

```ts
import { css, html, type CSSResultGroup, type TemplateResult } from 'lit';
import { t } from '../i18n/translate';
import {
  climateActivity,
  detectClimateDeviceType,
  type ClimateDeviceType,
} from './climate-device-type';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';

export interface ClimateCardConfig {
  readonly type: string;
  readonly entity: string;
  readonly name?: string;
  readonly device_type?: ClimateDeviceType;
  readonly value_entity?: string;
  readonly confirm?: boolean;
}

export const CONFIRM_TIMEOUT_MS = 3000;

/**
 * Climate card (Figma `card/climate`): ac|purifier|dehumidifier|fan|exhaust ×
 * active|idle|off. Device type auto-detected from the entity domain with an
 * explicit `device_type` override; optional confirm-on-tap arms for 3s before
 * the power toggle fires (spec §9 confirm rule for consequential actions).
 */
export class QuietLuxeClimateCard extends QlBaseCard {
  static override properties = {
    config: { attribute: false },
    armed: { state: true },
  };

  declare config?: ClimateCardConfig;
  declare armed: boolean;
  private disarmTimer?: number;

  constructor() {
    super();
    this.armed = false;
  }

  setConfig(config: ClimateCardConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('quiet-luxe-climate-card: "entity" is required');
    }
    this.config = config;
  }

  getCardSize(): number {
    return 2;
  }

  getGridOptions(): { rows: number; columns: number } {
    return { rows: 2, columns: 4 };
  }

  deviceType(): ClimateDeviceType {
    return this.config?.device_type ?? detectClimateDeviceType(this.config?.entity ?? '');
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.disarmTimer);
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
      .value {
        margin: var(--ql-space-s, 8px) 0 0;
        font: 300 26px/30px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.01em;
      }
      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: var(--ql-space-s, 8px);
      }
      .status {
        margin: 0;
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .status.accent {
        color: var(--ql-accent-champagne, #b08d57);
      }
      .status.muted {
        color: var(--ql-ink-muted, #8c8578);
      }
      .status.warn {
        color: var(--ql-status-warn, #c08552);
      }
      .power {
        width: 36px;
        height: 36px;
        border-radius: var(--ql-radius-chip, 999px);
        border: 1px solid var(--ql-surface-border, #e4dccb);
        background: var(--ql-surface-card, #fdfbf6);
        color: var(--ql-ink-primary, #2b2620);
        cursor: pointer;
        font: 400 14px/1 var(--ql-font-body, Outfit, sans-serif);
      }
      .power:disabled {
        opacity: 0.5;
        cursor: default;
      }
    `,
  ];

  private onPowerTap(): void {
    if (this.config?.confirm === true && !this.armed) {
      this.armed = true;
      this.disarmTimer = window.setTimeout(() => {
        this.armed = false;
      }, CONFIRM_TIMEOUT_MS);
      return;
    }
    window.clearTimeout(this.disarmTimer);
    this.armed = false;
    this.callToggle();
  }

  private callToggle(): void {
    const entityId = this.config?.entity;
    if (entityId === undefined || this.hass === undefined) {
      return;
    }
    const domain = entityId.split('.')[0] ?? '';
    if (domain === 'climate') {
      const service = this.entity(entityId)?.state === 'off' ? 'turn_on' : 'turn_off';
      void this.hass.callService('climate', service, { entity_id: entityId });
      return;
    }
    void this.hass.callService(domain, 'toggle', { entity_id: entityId });
  }

  private valueText(): string {
    const config = this.config;
    if (config === undefined) {
      return '—';
    }
    const valueId = config.value_entity ?? config.entity;
    if (this.availability(valueId) !== 'available') {
      return '—';
    }
    const entity = this.entity(valueId);
    if (config.value_entity === undefined && valueId.startsWith('climate.')) {
      const temp = Number(entity?.attributes.current_temperature);
      return Number.isFinite(temp) ? `${temp.toFixed(1)}°` : '—';
    }
    const numeric = Number(entity?.state);
    if (Number.isFinite(numeric)) {
      return String(Math.round(numeric));
    }
    if (entity?.state === 'on') {
      return t(this.locale(), 'common.on');
    }
    if (entity?.state === 'off') {
      return t(this.locale(), 'common.off');
    }
    return '—';
  }

  private statusLine(): { text: string; cls: string } {
    const locale = this.locale();
    const entityId = this.config?.entity ?? '';
    if (this.availability(entityId) !== 'available') {
      return { text: t(locale, 'common.unavailable'), cls: 'muted' };
    }
    if (this.armed) {
      return { text: t(locale, 'common.tap_confirm'), cls: 'warn' };
    }
    const entity = this.entity(entityId);
    const activity = entity === undefined ? 'off' : climateActivity(entity);
    if (activity === 'active') {
      return { text: t(locale, 'state.active'), cls: 'accent' };
    }
    if (activity === 'idle') {
      return { text: t(locale, 'state.idle'), cls: 'muted' };
    }
    return { text: t(locale, 'common.off'), cls: 'muted' };
  }

  protected override render(): TemplateResult {
    if (this.config === undefined) {
      return html``;
    }
    const entityId = this.config.entity;
    const availability = this.availability(entityId);
    const label =
      this.config.name ??
      (this.entity(entityId)?.attributes.friendly_name as string | undefined) ??
      entityId;
    const status = this.statusLine();
    return html`
      <div
        class="ql-card ${availability === 'available' ? '' : 'ql-unavailable'}"
        data-device=${this.deviceType()}
      >
        <p class="eyebrow">${label}</p>
        <p class="value">${this.valueText()}</p>
        <div class="row">
          <p class="status ${status.cls}">${status.text}</p>
          <button
            class="power"
            aria-label=${t(this.locale(), 'common.power')}
            ?disabled=${availability !== 'available'}
            @click=${this.onPowerTap}
          >
            ⏻
          </button>
        </div>
      </div>
    `;
  }
}

registerCard('quiet-luxe-climate-card', QuietLuxeClimateCard, {
  name: 'Quiet Luxe Climate Card',
  description: 'AC, purifier, dehumidifier, fan, and exhaust card with confirm-optional power.',
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/cards/quiet-luxe-climate-card.test.ts src/i18n/i18n.test.ts`
Expected: PASS (8 + parity tests).

- [ ] **Step 6: Commit**

```bash
git add src/cards/quiet-luxe-climate-card.ts src/cards/quiet-luxe-climate-card.test.ts src/i18n/locales/en.ts src/i18n/locales/zh-hant.ts src/i18n/locales/zh-hans.ts src/i18n/locales/ms.ts src/i18n/locales/id.ts
git commit -m "$(cat <<'EOF'
feat(cards): add quiet-luxe-climate-card

- Domain-detected device type with device_type override; value_entity numeral
- active/idle/off states localized; unavailable/missing muted per spec
- Confirm-optional power toggle (arm + 3s disarm); climate vs domain toggle
- common.power/tap_confirm + state.active/idle in all five locales

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 15: quiet-luxe-light-card (+ light.brightness key)

**Files:**
- Create: `src/cards/quiet-luxe-light-card.ts`
- Test: `src/cards/quiet-luxe-light-card.test.ts`
- Modify: all five `src/i18n/locales/*.ts`

- [ ] **Step 1: Write the failing test**

Create `src/cards/quiet-luxe-light-card.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { lightEntity, makeMockHass } from '../testing/mock-hass';
import type { QlSlider } from '../elements/ql-slider';
import { QuietLuxeLightCard, type LightCardConfig } from './quiet-luxe-light-card';

async function mount(
  config: Partial<LightCardConfig> & { entity: string },
  hass = makeMockHass(),
): Promise<QuietLuxeLightCard> {
  const card = document.createElement('quiet-luxe-light-card') as QuietLuxeLightCard;
  card.setConfig({ type: 'custom:quiet-luxe-light-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

function slider(card: QuietLuxeLightCard): QlSlider {
  const el = card.shadowRoot?.querySelector<QlSlider>('ql-slider');
  if (el === null || el === undefined) {
    throw new Error('slider missing');
  }
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('quiet-luxe-light-card', () => {
  it('registers element + picker entry and requires entity', () => {
    expect(customElements.get('quiet-luxe-light-card')).toBe(QuietLuxeLightCard);
    expect((window.customCards ?? []).map((e) => e.type)).toContain('quiet-luxe-light-card');
    const card = new QuietLuxeLightCard();
    expect(() =>
      card.setConfig({ type: 'custom:quiet-luxe-light-card', entity: '' }),
    ).toThrow(/entity/);
  });

  it('shows brightness % from the 0-255 attribute and glows when on', async () => {
    const card = await mount(
      { entity: 'light.pendant' },
      makeMockHass([lightEntity('light.pendant', 'on', 128)]),
    );
    expect(card.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('50%');
    expect(slider(card).value).toBe(50);
    expect(card.shadowRoot?.querySelector('.bulb')?.classList.contains('on')).toBe(true);
    const cssText = (QuietLuxeLightCard.styles as unknown as ReadonlyArray<{ toString(): string }>)
      .map((s) => s.toString())
      .join('\n');
    expect(cssText).toContain('var(--ql-glow-lamp-inner, #ffd98a)');
    expect(cssText).toContain('0 0 18px rgba(224, 178, 99, 0.45)');
  });

  it('off state: 0%, no glow', async () => {
    const card = await mount(
      { entity: 'light.pendant' },
      makeMockHass([lightEntity('light.pendant', 'off')]),
    );
    expect(card.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('0%');
    expect(card.shadowRoot?.querySelector('.bulb')?.classList.contains('on')).toBe(false);
  });

  it('slider commit calls light.turn_on with brightness_pct, 0 calls light.turn_off', async () => {
    const hass = makeMockHass([lightEntity('light.pendant', 'on', 128)]);
    const card = await mount({ entity: 'light.pendant' }, hass);
    slider(card).dispatchEvent(
      new CustomEvent('ql-change', { detail: { value: 60 }, bubbles: true, composed: true }),
    );
    slider(card).dispatchEvent(
      new CustomEvent('ql-change', { detail: { value: 0 }, bubbles: true, composed: true }),
    );
    expect(hass.calls).toEqual([
      {
        domain: 'light',
        service: 'turn_on',
        data: { entity_id: 'light.pendant', brightness_pct: 60 },
      },
      { domain: 'light', service: 'turn_off', data: { entity_id: 'light.pendant' } },
    ]);
  });

  it('head tap toggles the light', async () => {
    const hass = makeMockHass([lightEntity('light.pendant', 'on', 128)]);
    const card = await mount({ entity: 'light.pendant' }, hass);
    card.shadowRoot?.querySelector<HTMLButtonElement>('.head')?.click();
    expect(hass.calls).toEqual([
      { domain: 'light', service: 'toggle', data: { entity_id: 'light.pendant' } },
    ]);
  });

  it('slider aria-label is localized via light.brightness', async () => {
    const card = await mount(
      { entity: 'light.pendant' },
      makeMockHass([lightEntity('light.pendant', 'on', 128)], 'zh-Hans'),
    );
    expect(slider(card).label).toBe('亮度');
  });

  it('unavailable: muted, slider disabled, no service calls; missing: placeholder', async () => {
    const hass = makeMockHass([lightEntity('light.pendant', 'unavailable')]);
    const card = await mount({ entity: 'light.pendant' }, hass);
    expect(card.shadowRoot?.querySelector('.ql-card')?.classList.contains('ql-unavailable')).toBe(
      true,
    );
    expect(slider(card).disabled).toBe(true);
    expect(card.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('Unavailable');
    const missing = await mount({ entity: 'light.ghost' }, makeMockHass());
    expect(missing.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('Unavailable');
    expect(missing.getCardSize()).toBe(2);
    expect(missing.getGridOptions()).toEqual({ rows: 2, columns: 4 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/cards/quiet-luxe-light-card.test.ts`
Expected: FAIL — module resolve error.

- [ ] **Step 3: Add `light.brightness` to ALL FIVE locale files**

After `'room.lights_on': …,` in each file:

- `en.ts`: `'light.brightness': 'Brightness',`
- `zh-hant.ts`: `'light.brightness': '亮度',`
- `zh-hans.ts`: `'light.brightness': '亮度',`
- `ms.ts`: `'light.brightness': 'Kecerahan',`
- `id.ts`: `'light.brightness': 'Kecerahan',`

Run `npm run typecheck` — clean.

- [ ] **Step 4: Implement the card**

Create `src/cards/quiet-luxe-light-card.ts`:

```ts
import { css, html, type CSSResultGroup, type TemplateResult } from 'lit';
import '../elements/ql-slider';
import { t } from '../i18n/translate';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';

export interface LightCardConfig {
  readonly type: string;
  readonly entity: string;
  readonly name?: string;
}

/**
 * Light card (Figma `card/light`): name head (tap = toggle), brightness
 * numeral + slider, amber glow bulb when on — the glow treatment is reserved
 * exclusively for lights that are on (spec §4).
 */
export class QuietLuxeLightCard extends QlBaseCard {
  static override properties = {
    config: { attribute: false },
  };

  declare config?: LightCardConfig;

  setConfig(config: LightCardConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('quiet-luxe-light-card: "entity" is required');
    }
    this.config = config;
  }

  getCardSize(): number {
    return 2;
  }

  getGridOptions(): { rows: number; columns: number } {
    return { rows: 2, columns: 4 };
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .head {
        display: flex;
        align-items: center;
        gap: var(--ql-space-s, 8px);
        border: 0;
        background: transparent;
        padding: 0;
        cursor: pointer;
        color: inherit;
      }
      .eyebrow {
        color: var(--ql-ink-muted, #8c8578);
        font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .bulb {
        width: 14px;
        height: 14px;
        border-radius: var(--ql-radius-chip, 999px);
        background: var(--ql-surface-border, #e4dccb);
        transition:
          background 200ms ease,
          box-shadow 200ms ease;
      }
      .bulb.on {
        background: radial-gradient(
          circle,
          var(--ql-glow-lamp-inner, #ffd98a),
          var(--ql-glow-lamp-outer, #e0b263)
        );
        box-shadow: 0 0 18px rgba(224, 178, 99, 0.45);
      }
      .value {
        margin: var(--ql-space-s, 8px) 0;
        font: 300 26px/30px var(--ql-font-body, Outfit, sans-serif);
      }
      .ql-unavailable .value {
        font-size: 14px;
        line-height: 20px;
      }
    `,
  ];

  private brightnessPct(): number {
    const entityId = this.config?.entity ?? '';
    const entity = this.entity(entityId);
    if (entity?.state !== 'on') {
      return 0;
    }
    const brightness = Number(entity.attributes.brightness);
    if (!Number.isFinite(brightness)) {
      return 100;
    }
    return Math.round((brightness / 255) * 100);
  }

  private onToggle(): void {
    const entityId = this.config?.entity;
    if (entityId === undefined || this.availability(entityId) !== 'available') {
      return;
    }
    void this.hass?.callService('light', 'toggle', { entity_id: entityId });
  }

  private onSlider(event: CustomEvent<{ value: number }>): void {
    const entityId = this.config?.entity;
    if (entityId === undefined || this.hass === undefined) {
      return;
    }
    if (event.detail.value === 0) {
      void this.hass.callService('light', 'turn_off', { entity_id: entityId });
      return;
    }
    void this.hass.callService('light', 'turn_on', {
      entity_id: entityId,
      brightness_pct: event.detail.value,
    });
  }

  protected override render(): TemplateResult {
    if (this.config === undefined) {
      return html``;
    }
    const entityId = this.config.entity;
    const availability = this.availability(entityId);
    const available = availability === 'available';
    const on = available && this.entity(entityId)?.state === 'on';
    const label =
      this.config.name ??
      (this.entity(entityId)?.attributes.friendly_name as string | undefined) ??
      entityId;
    const pct = this.brightnessPct();
    return html`
      <div class="ql-card ${available ? '' : 'ql-unavailable'}">
        <button class="head" aria-pressed=${String(on)} @click=${this.onToggle}>
          <span class="bulb ${on ? 'on' : ''}"></span>
          <span class="eyebrow">${label}</span>
        </button>
        <p class="value">${available ? `${pct}%` : t(this.locale(), 'common.unavailable')}</p>
        <ql-slider
          .value=${pct}
          .label=${t(this.locale(), 'light.brightness')}
          ?disabled=${!available}
          @ql-change=${this.onSlider}
        ></ql-slider>
      </div>
    `;
  }
}

registerCard('quiet-luxe-light-card', QuietLuxeLightCard, {
  name: 'Quiet Luxe Light Card',
  description: 'Light card with brightness slider and amber on-glow.',
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/cards/quiet-luxe-light-card.test.ts src/i18n/i18n.test.ts`
Expected: PASS (7 + parity tests).

- [ ] **Step 6: Commit**

```bash
git add src/cards/quiet-luxe-light-card.ts src/cards/quiet-luxe-light-card.test.ts src/i18n/locales/en.ts src/i18n/locales/zh-hant.ts src/i18n/locales/zh-hans.ts src/i18n/locales/ms.ts src/i18n/locales/id.ts
git commit -m "$(cat <<'EOF'
feat(cards): add quiet-luxe-light-card

- Brightness slider commits light.turn_on brightness_pct; 0 = turn_off
- Head tap toggles; amber glow bulb reserved for on state per spec
- light.brightness aria label in all five locales

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 16: quiet-luxe-cover-card (+ cover.* keys)

**Files:**
- Create: `src/cards/quiet-luxe-cover-card.ts`
- Test: `src/cards/quiet-luxe-cover-card.test.ts`
- Modify: all five `src/i18n/locales/*.ts`

- [ ] **Step 1: Write the failing test**

Create `src/cards/quiet-luxe-cover-card.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { coverEntity, makeEntity, makeMockHass } from '../testing/mock-hass';
import type { QlSlider } from '../elements/ql-slider';
import {
  QuietLuxeCoverCard,
  detectCoverType,
  type CoverCardConfig,
} from './quiet-luxe-cover-card';

async function mount(
  config: Partial<CoverCardConfig> & { entity: string },
  hass = makeMockHass(),
): Promise<QuietLuxeCoverCard> {
  const card = document.createElement('quiet-luxe-cover-card') as QuietLuxeCoverCard;
  card.setConfig({ type: 'custom:quiet-luxe-cover-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('detectCoverType', () => {
  it('maps device_class shade/blind to shade, everything else to curtain', () => {
    expect(detectCoverType(coverEntity('cover.a', 50, { device_class: 'shade' }))).toBe('shade');
    expect(detectCoverType(coverEntity('cover.a', 50, { device_class: 'blind' }))).toBe('shade');
    expect(detectCoverType(coverEntity('cover.a', 50, { device_class: 'curtain' }))).toBe(
      'curtain',
    );
    expect(detectCoverType(coverEntity('cover.a', 50))).toBe('curtain');
    expect(detectCoverType(undefined)).toBe('curtain');
  });
});

describe('quiet-luxe-cover-card', () => {
  it('registers element + picker entry, requires entity, sizes 2x4', () => {
    expect(customElements.get('quiet-luxe-cover-card')).toBe(QuietLuxeCoverCard);
    expect((window.customCards ?? []).map((e) => e.type)).toContain('quiet-luxe-cover-card');
    const card = new QuietLuxeCoverCard();
    expect(() =>
      card.setConfig({ type: 'custom:quiet-luxe-cover-card', entity: '' }),
    ).toThrow(/entity/);
    card.setConfig({ type: 'custom:quiet-luxe-cover-card', entity: 'cover.a' });
    expect(card.getCardSize()).toBe(2);
    expect(card.getGridOptions()).toEqual({ rows: 2, columns: 4 });
  });

  it('shows the position % and reflects cover type (config override wins)', async () => {
    const card = await mount(
      { entity: 'cover.living' },
      makeMockHass([coverEntity('cover.living', 65, { device_class: 'curtain' })]),
    );
    expect(card.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('65%');
    expect(card.shadowRoot?.querySelector<HTMLElement>('.ql-card')?.dataset.coverType).toBe(
      'curtain',
    );
    const forced = await mount(
      { entity: 'cover.living', cover_type: 'shade' },
      makeMockHass([coverEntity('cover.living', 65, { device_class: 'curtain' })]),
    );
    expect(forced.shadowRoot?.querySelector<HTMLElement>('.ql-card')?.dataset.coverType).toBe(
      'shade',
    );
  });

  it('slider commit calls cover.set_cover_position', async () => {
    const hass = makeMockHass([coverEntity('cover.living', 65)]);
    const card = await mount({ entity: 'cover.living' }, hass);
    card.shadowRoot?.querySelector<QlSlider>('ql-slider')?.dispatchEvent(
      new CustomEvent('ql-change', { detail: { value: 30 }, bubbles: true, composed: true }),
    );
    expect(hass.calls).toEqual([
      {
        domain: 'cover',
        service: 'set_cover_position',
        data: { entity_id: 'cover.living', position: 30 },
      },
    ]);
  });

  it('open/stop/close buttons are localized and call the matching services', async () => {
    const hass = makeMockHass([coverEntity('cover.living', 65)], 'zh-Hant');
    const card = await mount({ entity: 'cover.living' }, hass);
    const buttons = [...(card.shadowRoot?.querySelectorAll<HTMLButtonElement>('.ops button') ?? [])];
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['開啟', '停止', '關閉']);
    for (const button of buttons) {
      button.click();
    }
    expect(hass.calls).toEqual([
      { domain: 'cover', service: 'open_cover', data: { entity_id: 'cover.living' } },
      { domain: 'cover', service: 'stop_cover', data: { entity_id: 'cover.living' } },
      { domain: 'cover', service: 'close_cover', data: { entity_id: 'cover.living' } },
    ]);
  });

  it('unavailable: muted, controls disabled; missing: placeholder value', async () => {
    const card = await mount(
      { entity: 'cover.living' },
      makeMockHass([makeEntity('cover.living', 'unavailable')]),
    );
    expect(card.shadowRoot?.querySelector('.ql-card')?.classList.contains('ql-unavailable')).toBe(
      true,
    );
    expect(card.shadowRoot?.querySelector<QlSlider>('ql-slider')?.disabled).toBe(true);
    expect(
      [...(card.shadowRoot?.querySelectorAll<HTMLButtonElement>('.ops button') ?? [])].every(
        (b) => b.disabled,
      ),
    ).toBe(true);
    const missing = await mount({ entity: 'cover.ghost' }, makeMockHass());
    expect(missing.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('—');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/cards/quiet-luxe-cover-card.test.ts`
Expected: FAIL — module resolve error.

- [ ] **Step 3: Add the cover keys to ALL FIVE locale files**

After `'light.brightness': …,` in each file:

`en.ts`:

```ts
  'cover.open': 'Open',
  'cover.stop': 'Stop',
  'cover.close': 'Close',
```

`zh-hant.ts`:

```ts
  'cover.open': '開啟',
  'cover.stop': '停止',
  'cover.close': '關閉',
```

`zh-hans.ts`:

```ts
  'cover.open': '开启',
  'cover.stop': '停止',
  'cover.close': '关闭',
```

`ms.ts`:

```ts
  'cover.open': 'Buka',
  'cover.stop': 'Berhenti',
  'cover.close': 'Tutup',
```

`id.ts`:

```ts
  'cover.open': 'Buka',
  'cover.stop': 'Berhenti',
  'cover.close': 'Tutup',
```

Run `npm run typecheck` — clean.

- [ ] **Step 4: Implement the card**

Create `src/cards/quiet-luxe-cover-card.ts`:

```ts
import { css, html, type CSSResultGroup, type TemplateResult } from 'lit';
import '../elements/ql-slider';
import { t } from '../i18n/translate';
import type { HassEntity } from '../types/home-assistant';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';

export type CoverType = 'curtain' | 'shade';

export interface CoverCardConfig {
  readonly type: string;
  readonly entity: string;
  readonly name?: string;
  readonly cover_type?: CoverType;
}

/** device_class shade/blind → shade; curtain/awning/anything else → curtain. */
export function detectCoverType(entity: HassEntity | undefined): CoverType {
  const deviceClass = entity?.attributes.device_class;
  return deviceClass === 'shade' || deviceClass === 'blind' ? 'shade' : 'curtain';
}

/**
 * Cover card (Figma `card/cover`): curtain|shade, position numeral + slider
 * (cover.set_cover_position) and localized open/stop/close row with generous
 * touch targets.
 */
export class QuietLuxeCoverCard extends QlBaseCard {
  static override properties = {
    config: { attribute: false },
  };

  declare config?: CoverCardConfig;

  setConfig(config: CoverCardConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('quiet-luxe-cover-card: "entity" is required');
    }
    this.config = config;
  }

  getCardSize(): number {
    return 2;
  }

  getGridOptions(): { rows: number; columns: number } {
    return { rows: 2, columns: 4 };
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
      .value {
        margin: var(--ql-space-s, 8px) 0;
        font: 300 26px/30px var(--ql-font-body, Outfit, sans-serif);
      }
      .ops {
        display: flex;
        gap: var(--ql-space-s, 8px);
        margin-top: var(--ql-space-m, 12px);
      }
      .ops button {
        flex: 1;
        min-height: 44px;
        border-radius: var(--ql-radius-thumb, 12px);
        border: 1px solid var(--ql-surface-border, #e4dccb);
        background: var(--ql-surface-card, #fdfbf6);
        color: var(--ql-ink-primary, #2b2620);
        font: 400 13px/16px var(--ql-font-body, Outfit, sans-serif);
        cursor: pointer;
      }
      .ops button:disabled {
        opacity: 0.5;
        cursor: default;
      }
    `,
  ];

  private coverType(): CoverType {
    return this.config?.cover_type ?? detectCoverType(this.entity(this.config?.entity ?? ''));
  }

  private position(): number | undefined {
    const entityId = this.config?.entity ?? '';
    if (this.availability(entityId) !== 'available') {
      return undefined;
    }
    const entity = this.entity(entityId);
    const position = Number(entity?.attributes.current_position);
    if (Number.isFinite(position)) {
      return Math.round(position);
    }
    return entity?.state === 'open' ? 100 : 0;
  }

  private call(service: 'open_cover' | 'stop_cover' | 'close_cover'): void {
    const entityId = this.config?.entity;
    if (entityId === undefined) {
      return;
    }
    void this.hass?.callService('cover', service, { entity_id: entityId });
  }

  private onSlider(event: CustomEvent<{ value: number }>): void {
    const entityId = this.config?.entity;
    if (entityId === undefined) {
      return;
    }
    void this.hass?.callService('cover', 'set_cover_position', {
      entity_id: entityId,
      position: event.detail.value,
    });
  }

  protected override render(): TemplateResult {
    if (this.config === undefined) {
      return html``;
    }
    const entityId = this.config.entity;
    const available = this.availability(entityId) === 'available';
    const locale = this.locale();
    const label =
      this.config.name ??
      (this.entity(entityId)?.attributes.friendly_name as string | undefined) ??
      entityId;
    const position = this.position();
    return html`
      <div
        class="ql-card ${available ? '' : 'ql-unavailable'}"
        data-cover-type=${this.coverType()}
      >
        <p class="eyebrow">${label}</p>
        <p class="value">${position === undefined ? '—' : `${position}%`}</p>
        <ql-slider
          .value=${position ?? 0}
          .label=${label}
          ?disabled=${!available}
          @ql-change=${this.onSlider}
        ></ql-slider>
        <div class="ops">
          <button ?disabled=${!available} @click=${(): void => this.call('open_cover')}>
            ${t(locale, 'cover.open')}
          </button>
          <button ?disabled=${!available} @click=${(): void => this.call('stop_cover')}>
            ${t(locale, 'cover.stop')}
          </button>
          <button ?disabled=${!available} @click=${(): void => this.call('close_cover')}>
            ${t(locale, 'cover.close')}
          </button>
        </div>
      </div>
    `;
  }
}

registerCard('quiet-luxe-cover-card', QuietLuxeCoverCard, {
  name: 'Quiet Luxe Cover Card',
  description: 'Curtain and shade card with position slider and open/stop/close.',
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/cards/quiet-luxe-cover-card.test.ts src/i18n/i18n.test.ts`
Expected: PASS (6 + parity tests).

- [ ] **Step 6: Commit**

```bash
git add src/cards/quiet-luxe-cover-card.ts src/cards/quiet-luxe-cover-card.test.ts src/i18n/locales/en.ts src/i18n/locales/zh-hant.ts src/i18n/locales/zh-hans.ts src/i18n/locales/ms.ts src/i18n/locales/id.ts
git commit -m "$(cat <<'EOF'
feat(cards): add quiet-luxe-cover-card

- curtain|shade from device_class with cover_type override
- Position slider commits cover.set_cover_position; open/stop/close row
- cover.open/stop/close labels in all five locales

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 17: sensor formatting functions + quiet-luxe-sensor-tile (+ sensor.* keys)

**Files:**
- Create: `src/cards/sensor-format.ts`, `src/cards/quiet-luxe-sensor-tile.ts`
- Test: `src/cards/sensor-format.test.ts`, `src/cards/quiet-luxe-sensor-tile.test.ts`
- Modify: all five `src/i18n/locales/*.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/cards/sensor-format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatSensorValue, sensorStatus } from './sensor-format';

describe('formatSensorValue', () => {
  it('formats each metric exactly', () => {
    expect(formatSensorValue('aqi', '18.4')).toBe('18');
    expect(formatSensorValue('temp', '24.46')).toBe('24.5°');
    expect(formatSensorValue('humidity', '61.8')).toBe('62%');
    expect(formatSensorValue('uv', '7.2')).toBe('7');
    expect(formatSensorValue('rain', '80')).toBe('80%');
  });

  it('returns the placeholder for non-numeric or absent states', () => {
    expect(formatSensorValue('aqi', 'unknown')).toBe('—');
    expect(formatSensorValue('temp', undefined)).toBe('—');
    expect(formatSensorValue('uv', '')).toBe('—');
  });
});

describe('sensorStatus', () => {
  it('AQI: <=50 good, <=100 warn, else alert', () => {
    expect(sensorStatus('aqi', '50')).toBe('good');
    expect(sensorStatus('aqi', '51')).toBe('warn');
    expect(sensorStatus('aqi', '100')).toBe('warn');
    expect(sensorStatus('aqi', '101')).toBe('alert');
  });

  it('UV: <6 good, <8 warn, else alert (WHO index bands)', () => {
    expect(sensorStatus('uv', '5')).toBe('good');
    expect(sensorStatus('uv', '6')).toBe('warn');
    expect(sensorStatus('uv', '8')).toBe('alert');
  });

  it('humidity: 30-70 good, 20-30/70-80 warn, else alert', () => {
    expect(sensorStatus('humidity', '45')).toBe('good');
    expect(sensorStatus('humidity', '25')).toBe('warn');
    expect(sensorStatus('humidity', '75')).toBe('warn');
    expect(sensorStatus('humidity', '15')).toBe('alert');
    expect(sensorStatus('humidity', '85')).toBe('alert');
  });

  it('rain: >=60 warn, else neutral; temp always neutral', () => {
    expect(sensorStatus('rain', '59')).toBe('neutral');
    expect(sensorStatus('rain', '60')).toBe('warn');
    expect(sensorStatus('temp', '35')).toBe('neutral');
  });

  it('non-numeric states are neutral', () => {
    expect(sensorStatus('aqi', 'unknown')).toBe('neutral');
    expect(sensorStatus('uv', undefined)).toBe('neutral');
  });
});
```

Create `src/cards/quiet-luxe-sensor-tile.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { makeMockHass, sensorEntity } from '../testing/mock-hass';
import type { QlStatusDot } from '../elements/ql-status-dot';
import { QuietLuxeSensorTile, type SensorTileConfig } from './quiet-luxe-sensor-tile';

async function mount(
  config: Partial<SensorTileConfig> & { entity: string; metric: SensorTileConfig['metric'] },
  hass = makeMockHass(),
): Promise<QuietLuxeSensorTile> {
  const tile = document.createElement('quiet-luxe-sensor-tile') as QuietLuxeSensorTile;
  tile.setConfig({ type: 'custom:quiet-luxe-sensor-tile', ...config });
  tile.hass = hass;
  document.body.append(tile);
  await tile.updateComplete;
  return tile;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('quiet-luxe-sensor-tile', () => {
  it('registers element + picker entry; requires entity and a valid metric', () => {
    expect(customElements.get('quiet-luxe-sensor-tile')).toBe(QuietLuxeSensorTile);
    expect((window.customCards ?? []).map((e) => e.type)).toContain('quiet-luxe-sensor-tile');
    const tile = new QuietLuxeSensorTile();
    expect(() =>
      tile.setConfig({ type: 'custom:quiet-luxe-sensor-tile', entity: '', metric: 'aqi' }),
    ).toThrow(/entity/);
    expect(() =>
      tile.setConfig({
        type: 'custom:quiet-luxe-sensor-tile',
        entity: 'sensor.a',
        metric: 'speed' as never,
      }),
    ).toThrow(/metric/);
  });

  it('renders localized metric eyebrow, formatted value, and threshold dot', async () => {
    const tile = await mount(
      { entity: 'sensor.living_aqi', metric: 'aqi' },
      makeMockHass([sensorEntity('sensor.living_aqi', '18')], 'zh-Hans'),
    );
    expect(tile.shadowRoot?.querySelector('.eyebrow')?.textContent?.trim()).toBe('空气质量');
    expect(tile.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('18');
    expect(tile.shadowRoot?.querySelector<QlStatusDot>('ql-status-dot')?.status).toBe('good');
  });

  it('config name overrides the metric label', async () => {
    const tile = await mount(
      { entity: 'sensor.uv', metric: 'uv', name: 'UV Index' },
      makeMockHass([sensorEntity('sensor.uv', '7')]),
    );
    expect(tile.shadowRoot?.querySelector('.eyebrow')?.textContent?.trim()).toBe('UV Index');
    expect(tile.shadowRoot?.querySelector<QlStatusDot>('ql-status-dot')?.status).toBe('warn');
  });

  it('unavailable and missing render the muted placeholder with a neutral dot', async () => {
    const unavailable = await mount(
      { entity: 'sensor.a', metric: 'temp' },
      makeMockHass([sensorEntity('sensor.a', 'unavailable')]),
    );
    expect(
      unavailable.shadowRoot?.querySelector('.ql-card')?.classList.contains('ql-unavailable'),
    ).toBe(true);
    expect(unavailable.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('—');
    expect(unavailable.shadowRoot?.querySelector<QlStatusDot>('ql-status-dot')?.status).toBe(
      'neutral',
    );
    const missing = await mount({ entity: 'sensor.ghost', metric: 'humidity' }, makeMockHass());
    expect(missing.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('—');
    expect(missing.getCardSize()).toBe(1);
    expect(missing.getGridOptions()).toEqual({ rows: 1, columns: 3 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/cards/sensor-format.test.ts src/cards/quiet-luxe-sensor-tile.test.ts`
Expected: FAIL — module resolve errors.

- [ ] **Step 3: Add the sensor keys to ALL FIVE locale files**

After the `cover.*` block in each file:

`en.ts`:

```ts
  'sensor.aqi': 'AQI',
  'sensor.temp': 'Temperature',
  'sensor.humidity': 'Humidity',
  'sensor.uv': 'UV',
  'sensor.rain': 'Rain',
```

`zh-hant.ts`:

```ts
  'sensor.aqi': '空氣品質',
  'sensor.temp': '溫度',
  'sensor.humidity': '濕度',
  'sensor.uv': '紫外線',
  'sensor.rain': '降雨',
```

`zh-hans.ts`:

```ts
  'sensor.aqi': '空气质量',
  'sensor.temp': '温度',
  'sensor.humidity': '湿度',
  'sensor.uv': '紫外线',
  'sensor.rain': '降雨',
```

`ms.ts`:

```ts
  'sensor.aqi': 'AQI',
  'sensor.temp': 'Suhu',
  'sensor.humidity': 'Kelembapan',
  'sensor.uv': 'UV',
  'sensor.rain': 'Hujan',
```

`id.ts`:

```ts
  'sensor.aqi': 'AQI',
  'sensor.temp': 'Suhu',
  'sensor.humidity': 'Kelembapan',
  'sensor.uv': 'UV',
  'sensor.rain': 'Hujan',
```

Run `npm run typecheck` — clean.

- [ ] **Step 4: Implement the pure functions**

Create `src/cards/sensor-format.ts`:

```ts
import type { QlStatus } from '../elements/ql-status-dot';

export type SensorMetric = 'aqi' | 'temp' | 'humidity' | 'uv' | 'rain';

export const SENSOR_METRICS: ReadonlyArray<SensorMetric> = [
  'aqi',
  'temp',
  'humidity',
  'uv',
  'rain',
];

function numeric(state: string | undefined): number | undefined {
  if (state === undefined || state === '') {
    return undefined;
  }
  const value = Number(state);
  return Number.isFinite(value) ? value : undefined;
}

/** Exact display formatting per metric; '—' placeholder for non-numeric. */
export function formatSensorValue(metric: SensorMetric, state: string | undefined): string {
  const value = numeric(state);
  if (value === undefined) {
    return '—';
  }
  switch (metric) {
    case 'aqi':
      return String(Math.round(value));
    case 'temp':
      return `${value.toFixed(1)}°`;
    case 'humidity':
      return `${Math.round(value)}%`;
    case 'uv':
      return String(Math.round(value));
    case 'rain':
      return `${Math.round(value)}%`;
  }
}

/**
 * Status-dot thresholds:
 * - aqi: <=50 good, <=100 warn, else alert (US AQI bands)
 * - uv: <6 good, <8 warn, else alert (WHO UV index)
 * - humidity: 30-70 good, 20-30/70-80 warn, else alert (comfort band)
 * - rain: >=60% probability warn, else neutral
 * - temp: always neutral (no universal good/bad)
 */
export function sensorStatus(metric: SensorMetric, state: string | undefined): QlStatus {
  const value = numeric(state);
  if (value === undefined) {
    return 'neutral';
  }
  switch (metric) {
    case 'aqi':
      return value <= 50 ? 'good' : value <= 100 ? 'warn' : 'alert';
    case 'uv':
      return value < 6 ? 'good' : value < 8 ? 'warn' : 'alert';
    case 'humidity':
      if (value >= 30 && value <= 70) {
        return 'good';
      }
      return value >= 20 && value <= 80 ? 'warn' : 'alert';
    case 'rain':
      return value >= 60 ? 'warn' : 'neutral';
    case 'temp':
      return 'neutral';
  }
}
```

- [ ] **Step 5: Implement the tile**

Create `src/cards/quiet-luxe-sensor-tile.ts`:

```ts
import { css, html, type CSSResultGroup, type TemplateResult } from 'lit';
import '../elements/ql-status-dot';
import type { TranslationKey } from '../i18n/locales/en';
import { t } from '../i18n/translate';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';
import {
  formatSensorValue,
  SENSOR_METRICS,
  sensorStatus,
  type SensorMetric,
} from './sensor-format';

export interface SensorTileConfig {
  readonly type: string;
  readonly entity: string;
  readonly metric: SensorMetric;
  readonly name?: string;
}

const METRIC_LABEL_KEY: Readonly<Record<SensorMetric, TranslationKey>> = {
  aqi: 'sensor.aqi',
  temp: 'sensor.temp',
  humidity: 'sensor.humidity',
  uv: 'sensor.uv',
  rain: 'sensor.rain',
};

/**
 * Sensor tile (Figma `tile/sensor`): metric eyebrow + numeral + threshold
 * status dot. `metric` is explicit config (no hidden device_class guessing) —
 * the strategy passes it from its own bucketing.
 */
export class QuietLuxeSensorTile extends QlBaseCard {
  static override properties = {
    config: { attribute: false },
  };

  declare config?: SensorTileConfig;

  setConfig(config: SensorTileConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('quiet-luxe-sensor-tile: "entity" is required');
    }
    if (!SENSOR_METRICS.includes(config.metric)) {
      throw new Error(
        `quiet-luxe-sensor-tile: "metric" must be one of ${SENSOR_METRICS.join('|')}`,
      );
    }
    this.config = config;
  }

  getCardSize(): number {
    return 1;
  }

  getGridOptions(): { rows: number; columns: number } {
    return { rows: 1, columns: 3 };
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .ql-card {
        display: flex;
        flex-direction: column;
        gap: var(--ql-space-xs, 4px);
        padding: var(--ql-space-m, 12px);
      }
      .top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ql-space-s, 8px);
      }
      .eyebrow {
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .value {
        margin: 0;
        font: 300 26px/30px var(--ql-font-body, Outfit, sans-serif);
      }
    `,
  ];

  protected override render(): TemplateResult {
    if (this.config === undefined) {
      return html``;
    }
    const { entity: entityId, metric } = this.config;
    const available = this.availability(entityId) === 'available';
    const state = available ? this.entity(entityId)?.state : undefined;
    const label = this.config.name ?? t(this.locale(), METRIC_LABEL_KEY[metric]);
    return html`
      <div class="ql-card ${available ? '' : 'ql-unavailable'}">
        <div class="top">
          <p class="eyebrow">${label}</p>
          <ql-status-dot .status=${sensorStatus(metric, state)}></ql-status-dot>
        </div>
        <p class="value">${formatSensorValue(metric, state)}</p>
      </div>
    `;
  }
}

registerCard('quiet-luxe-sensor-tile', QuietLuxeSensorTile, {
  name: 'Quiet Luxe Sensor Tile',
  description: 'AQI, temperature, humidity, UV, and rain tile with status thresholds.',
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/cards/sensor-format.test.ts src/cards/quiet-luxe-sensor-tile.test.ts src/i18n/i18n.test.ts`
Expected: PASS (7 + 4 + parity tests).

- [ ] **Step 7: Commit**

```bash
git add src/cards/sensor-format.ts src/cards/sensor-format.test.ts src/cards/quiet-luxe-sensor-tile.ts src/cards/quiet-luxe-sensor-tile.test.ts src/i18n/locales/en.ts src/i18n/locales/zh-hant.ts src/i18n/locales/zh-hans.ts src/i18n/locales/ms.ts src/i18n/locales/id.ts
git commit -m "$(cat <<'EOF'
feat(cards): add quiet-luxe-sensor-tile with metric formatting

- formatSensorValue/sensorStatus pure fns with documented thresholds
- Explicit metric config (aqi|temp|humidity|uv|rain), localized eyebrows
- Unavailable/missing render muted placeholder with neutral dot

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 18: Bundle exports and registration

**Files:**
- Modify: `src/index.ts`
- Test: `src/index.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import * as bundle from './index';

const ELEMENT_TAGS = [
  'ql-canvas',
  'ql-status-dot',
  'ql-badge',
  'ql-chip',
  'ql-toggle',
  'ql-slider',
  'ql-segmented',
  'ql-section-eyebrow',
  'ql-header-home',
  'ql-header-room',
] as const;

const CARD_TAGS = [
  'quiet-luxe-room-card',
  'quiet-luxe-climate-card',
  'quiet-luxe-light-card',
  'quiet-luxe-cover-card',
  'quiet-luxe-sensor-tile',
] as const;

describe('bundle entry', () => {
  it('registers every element and card on import', () => {
    for (const tag of [...ELEMENT_TAGS, ...CARD_TAGS]) {
      expect(customElements.get(tag), tag).toBeDefined();
    }
  });

  it('lists every card in window.customCards exactly once', () => {
    const types = (window.customCards ?? []).map((entry) => entry.type);
    for (const tag of CARD_TAGS) {
      expect(types.filter((type) => type === tag)).toHaveLength(1);
    }
  });

  it('re-exports the public API', () => {
    expect(bundle.QlChip).toBeDefined();
    expect(bundle.QlToggle).toBeDefined();
    expect(bundle.QlSlider).toBeDefined();
    expect(bundle.QlSegmented).toBeDefined();
    expect(bundle.QlStatusDot).toBeDefined();
    expect(bundle.QlBadge).toBeDefined();
    expect(bundle.QlSectionEyebrow).toBeDefined();
    expect(bundle.QlHeaderHome).toBeDefined();
    expect(bundle.QlHeaderRoom).toBeDefined();
    expect(bundle.QuietLuxeRoomCard).toBeDefined();
    expect(bundle.QuietLuxeClimateCard).toBeDefined();
    expect(bundle.QuietLuxeLightCard).toBeDefined();
    expect(bundle.QuietLuxeCoverCard).toBeDefined();
    expect(bundle.QuietLuxeSensorTile).toBeDefined();
    expect(bundle.detectClimateDeviceType('climate.a')).toBe('ac');
    expect(bundle.formatSensorValue('aqi', '18')).toBe('18');
    expect(typeof bundle.navigate).toBe('function');
    expect(typeof bundle.registerCard).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/index.test.ts`
Expected: FAIL — `bundle.QlChip` (and the rest) undefined; element tags unregistered.

- [ ] **Step 3: Update `src/index.ts`**

Replace the full file with:

```ts
import { version } from '../package.json';
import { injectFontStylesheet } from './fonts/load-fonts';
import './elements/ql-canvas';
import './elements/ql-status-dot';
import './elements/ql-badge';
import './elements/ql-chip';
import './elements/ql-toggle';
import './elements/ql-slider';
import './elements/ql-segmented';
import './elements/ql-section-eyebrow';
import './elements/ql-header-home';
import './elements/ql-header-room';
import './cards/quiet-luxe-room-card';
import './cards/quiet-luxe-climate-card';
import './cards/quiet-luxe-light-card';
import './cards/quiet-luxe-cover-card';
import './cards/quiet-luxe-sensor-tile';

export { QlBaseCard, type EntityAvailability } from './cards/ql-base-card';
export { QlCanvas } from './elements/ql-canvas';
export { QlStatusDot, type QlStatus } from './elements/ql-status-dot';
export { QlBadge } from './elements/ql-badge';
export { QlChip, type QlChipEmphasis, type QlChipVariant } from './elements/ql-chip';
export { QlToggle } from './elements/ql-toggle';
export { QlSlider } from './elements/ql-slider';
export { QlSegmented, type QlSegmentOption } from './elements/ql-segmented';
export { QlSectionEyebrow } from './elements/ql-section-eyebrow';
export { QlHeaderHome, type QlHeaderVariant } from './elements/ql-header-home';
export { QlHeaderRoom } from './elements/ql-header-room';
export {
  QuietLuxeRoomCard,
  type RoomCardChipConfig,
  type RoomCardConfig,
  type RoomCardSize,
} from './cards/quiet-luxe-room-card';
export {
  CONFIRM_TIMEOUT_MS,
  QuietLuxeClimateCard,
  type ClimateCardConfig,
} from './cards/quiet-luxe-climate-card';
export { QuietLuxeLightCard, type LightCardConfig } from './cards/quiet-luxe-light-card';
export {
  detectCoverType,
  QuietLuxeCoverCard,
  type CoverCardConfig,
  type CoverType,
} from './cards/quiet-luxe-cover-card';
export { QuietLuxeSensorTile, type SensorTileConfig } from './cards/quiet-luxe-sensor-tile';
export {
  climateActivity,
  detectClimateDeviceType,
  type ClimateActivity,
  type ClimateDeviceType,
} from './cards/climate-device-type';
export {
  formatSensorValue,
  SENSOR_METRICS,
  sensorStatus,
  type SensorMetric,
} from './cards/sensor-format';
export { navigate } from './cards/navigate';
export { registerCard, type CustomCardEntry } from './cards/register';
export * from './tokens/palette';
export { colorCssVariables, cssVariableBlock, dimensionCssVariables } from './tokens/css';
export { resolveLocale } from './i18n/resolve';
export { t } from './i18n/translate';
export { SUPPORTED_LOCALES, type Locale } from './i18n/types';
export type { HomeAssistant } from './types/home-assistant';

injectFontStylesheet(document, import.meta.url);

console.info(
  `%c QUIET LUXE %c v${version} `,
  'background:#B08D57;color:#FDFBF6;font-weight:500',
  'color:#8C8578',
);
```

Note: `src/testing/mock-hass.ts` is deliberately NOT exported — it must never ship in the bundle.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/index.test.ts` then `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/index.test.ts
git commit -m "$(cat <<'EOF'
feat(cards): export and register the Plan 3a element/card library

- Side-effect imports register 10 elements + 5 cards on bundle load
- Public API re-exports classes, config types, and pure helpers
- mock-hass intentionally excluded from the bundle entry

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 19: Dev harness (light + dark visual QA page)

**Files:**
- Create: `dev/index.html`, `dev/main.ts`
- Modify: `package.json` (add `"dev": "vite"` script), `tsconfig.json` (add `"dev"` to `include`)

No unit test — this is a visual QA surface; verification is typecheck + build-exclusion + manual browser check. The vite lib build only follows the `src/index.ts` entry graph, so `dev/` can never reach `dist/` (asserted in Task 20).

- [ ] **Step 1: Create `dev/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Quiet Luxe — Dev Harness</title>
    <style>
      body {
        margin: 0;
        display: grid;
        grid-template-columns: 1fr 1fr;
      }
    </style>
  </head>
  <body>
    <div id="light"></div>
    <div id="dark"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `dev/main.ts`**

```ts
import '../src/index';
import {
  climateEntity,
  coverEntity,
  lightEntity,
  makeEntity,
  makeMockHass,
  sensorEntity,
} from '../src/testing/mock-hass';
import { cssVariableBlock } from '../src/tokens/css';
import type { ThemeMode } from '../src/tokens/types';

// Remote Unsplash photos are fine here: the harness is local-dev only and never
// ships in the HACS package (China-reachability rule applies to the bundle).
const PHOTO_LIVING =
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=70';
const PHOTO_STUDY =
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=70';

const hass = makeMockHass([
  lightEntity('light.pendant', 'on', 178),
  lightEntity('light.floor_lamp', 'off'),
  lightEntity('light.offline_lamp', 'unavailable'),
  makeEntity('light.living_group', 'on'),
  climateEntity('climate.living_ac', 'cool', { hvac_action: 'cooling' }),
  climateEntity('climate.master_ac', 'off'),
  makeEntity('fan.study_fan', 'on'),
  makeEntity('switch.bath_exhaust', 'off'),
  coverEntity('cover.living_curtain', 65, { device_class: 'curtain' }),
  coverEntity('cover.study_shade', 0, { device_class: 'shade' }),
  sensorEntity('sensor.living_aqi', '18'),
  sensorEntity('sensor.living_temp', '24.5'),
  sensorEntity('sensor.living_humidity', '62'),
  sensorEntity('sensor.uv_index', '7'),
  sensorEntity('sensor.rain_chance', '80'),
]);

type CardElement = HTMLElement & {
  hass: unknown;
  setConfig(config: Record<string, unknown>): void;
};

function makeCard(tag: string, config: Record<string, unknown>): CardElement {
  const card = document.createElement(tag) as CardElement;
  card.setConfig(config);
  card.hass = hass;
  return card;
}

function el(tag: string, props: Record<string, unknown> = {}, text = ''): HTMLElement {
  const node = document.createElement(tag) as HTMLElement & Record<string, unknown>;
  Object.assign(node, props);
  if (text !== '') {
    node.textContent = text;
  }
  return node;
}

function row(children: ReadonlyArray<HTMLElement>): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;';
  wrap.append(...children);
  return wrap;
}

function section(title: string, children: ReadonlyArray<HTMLElement>): HTMLElement {
  const wrap = document.createElement('section');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
  wrap.append(el('ql-section-eyebrow', { label: title }), ...children);
  return wrap;
}

function primitives(): HTMLElement[] {
  return [
    row([
      el('ql-chip', { variant: 'device', active: true }, 'Lights'),
      el('ql-chip', { variant: 'device' }, 'AC'),
      el('ql-chip', { variant: 'scene', emphasis: 'primary' }, 'Movie night'),
      el('ql-chip', { variant: 'scene', emphasis: 'secondary' }, 'Good morning'),
      el('ql-chip', { variant: 'scene', emphasis: 'secondary', touch: true }, 'iPad touch'),
    ]),
    row([
      el('ql-toggle', { checked: true, label: 'On toggle' }),
      el('ql-toggle', { label: 'Off toggle' }),
      el('ql-toggle', { disabled: true, label: 'Disabled toggle' }),
      el('ql-status-dot', { status: 'good' }),
      el('ql-status-dot', { status: 'warn' }),
      el('ql-status-dot', { status: 'alert' }),
      el('ql-status-dot', { status: 'neutral' }),
      el('ql-badge', {}, 'AQI 42'),
    ]),
    el('ql-slider', { value: 60, label: 'Brightness' }),
    el('ql-segmented', {
      value: 'agenda',
      label: 'Schedule view',
      options: [
        { value: 'agenda', label: 'Agenda' },
        { value: 'day', label: 'Day' },
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' },
      ],
    }),
  ];
}

function buildPane(mode: ThemeMode): HTMLElement {
  const pane = document.createElement('div');
  pane.style.cssText = `position:relative;min-height:100vh;${cssVariableBlock(mode)}`;
  const canvas = document.createElement('ql-canvas');
  const content = document.createElement('main');
  content.style.cssText =
    'position:relative;display:flex;flex-direction:column;gap:24px;padding:24px;max-width:430px;margin:0 auto;';
  content.append(
    el('ql-header-home', {
      variant: 'mobile',
      homeName: 'Subang Jaya',
      userName: 'Steven',
      meta: 'Fri 1 Aug · 29° · AQI 42',
      presence: 'Steven & Mei home',
      hour: 20,
    }),
    el('ql-header-home', {
      variant: 'ipad',
      homeName: 'Tung Chung',
      meta: 'Fri 1 Aug · 29°',
      presence: 'Home',
    }),
    el('ql-header-room', { name: 'Living Room', stats: ['24.5°', '62%', 'AQI 18'] }),
    section('Primitives', primitives()),
    section('Rooms', [
      makeCard('quiet-luxe-room-card', {
        type: 'custom:quiet-luxe-room-card',
        name: 'Living Room',
        image: PHOTO_LIVING,
        size: 'm',
        temperature_entity: 'sensor.living_temp',
        aqi_entity: 'sensor.living_aqi',
        lights_entity: 'light.living_group',
        navigation_path: '/quiet-luxe/living',
        chips: [
          { entity: 'light.pendant', label: 'Lights' },
          { entity: 'climate.living_ac', label: 'AC' },
        ],
      }),
      makeCard('quiet-luxe-room-card', {
        type: 'custom:quiet-luxe-room-card',
        name: 'Study',
        image: PHOTO_STUDY,
        size: 's',
        lights_entity: 'light.floor_lamp',
      }),
      makeCard('quiet-luxe-room-card', {
        type: 'custom:quiet-luxe-room-card',
        name: 'Master Bedroom',
        image: PHOTO_LIVING,
        size: 'l',
        aqi_entity: 'sensor.living_aqi',
        lights_entity: 'light.living_group',
      }),
    ]),
    section('Climate', [
      makeCard('quiet-luxe-climate-card', {
        type: 'custom:quiet-luxe-climate-card',
        entity: 'climate.living_ac',
        name: 'Living AC',
      }),
      makeCard('quiet-luxe-climate-card', {
        type: 'custom:quiet-luxe-climate-card',
        entity: 'fan.study_fan',
        name: 'Study Fan',
      }),
      makeCard('quiet-luxe-climate-card', {
        type: 'custom:quiet-luxe-climate-card',
        entity: 'switch.bath_exhaust',
        name: 'Bath Exhaust',
        device_type: 'exhaust',
        confirm: true,
      }),
      makeCard('quiet-luxe-climate-card', {
        type: 'custom:quiet-luxe-climate-card',
        entity: 'climate.missing_ac',
        name: 'Missing AC',
      }),
    ]),
    section('Lights', [
      makeCard('quiet-luxe-light-card', {
        type: 'custom:quiet-luxe-light-card',
        entity: 'light.pendant',
        name: 'Pendant',
      }),
      makeCard('quiet-luxe-light-card', {
        type: 'custom:quiet-luxe-light-card',
        entity: 'light.floor_lamp',
        name: 'Floor Lamp',
      }),
      makeCard('quiet-luxe-light-card', {
        type: 'custom:quiet-luxe-light-card',
        entity: 'light.offline_lamp',
        name: 'Offline Lamp',
      }),
    ]),
    section('Covers', [
      makeCard('quiet-luxe-cover-card', {
        type: 'custom:quiet-luxe-cover-card',
        entity: 'cover.living_curtain',
        name: 'Living Curtain',
      }),
      makeCard('quiet-luxe-cover-card', {
        type: 'custom:quiet-luxe-cover-card',
        entity: 'cover.study_shade',
        name: 'Study Shade',
      }),
    ]),
    section('Sensors', [
      row([
        makeCard('quiet-luxe-sensor-tile', {
          type: 'custom:quiet-luxe-sensor-tile',
          entity: 'sensor.living_aqi',
          metric: 'aqi',
        }),
        makeCard('quiet-luxe-sensor-tile', {
          type: 'custom:quiet-luxe-sensor-tile',
          entity: 'sensor.living_temp',
          metric: 'temp',
        }),
        makeCard('quiet-luxe-sensor-tile', {
          type: 'custom:quiet-luxe-sensor-tile',
          entity: 'sensor.living_humidity',
          metric: 'humidity',
        }),
        makeCard('quiet-luxe-sensor-tile', {
          type: 'custom:quiet-luxe-sensor-tile',
          entity: 'sensor.uv_index',
          metric: 'uv',
        }),
        makeCard('quiet-luxe-sensor-tile', {
          type: 'custom:quiet-luxe-sensor-tile',
          entity: 'sensor.rain_chance',
          metric: 'rain',
        }),
      ]),
    ]),
  );
  pane.append(canvas, content);
  return pane;
}

document.querySelector('#light')?.append(buildPane('light'));
document.querySelector('#dark')?.append(buildPane('dark'));
```

- [ ] **Step 3: Wire scripts and typecheck coverage**

In `package.json` `scripts`, add after `"build"`:

```json
    "dev": "vite",
```

In `tsconfig.json`, change `include` to:

```json
  "include": ["src", "dev", "vite.config.ts", "vitest.config.ts"]
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint` — clean.
Run: `npm run dev`, open `http://localhost:5173/dev/` in a browser. Verify visually, then Ctrl-C:

- Left pane light / right pane dark, both over the `ql-canvas` radial background.
- Every element and card renders in both panes; dark pane uses dark token values (glass surfaces, champagne `#C9A86A`).
- Glow only on: pendant light card bulb, living room glow dot. Offline lamp and Missing AC are muted, not errored.
- Confirm flow works on Bath Exhaust (tap power → "Tap again to confirm").
- Fonts fall back to system serif/sans (bundled fonts are built into `dist/`, not served in dev — expected; note, do not "fix").

- [ ] **Step 5: Commit**

```bash
git add dev/index.html dev/main.ts package.json tsconfig.json
git commit -m "$(cat <<'EOF'
feat(dev): add light/dark visual harness for the card library

- dev/index.html + dev/main.ts render every element/card against mock hass
- Side-by-side light and dark panes over ql-canvas with token variables
- Excluded from dist (lib entry graph); npm run dev serves it locally

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 20: Full verification and single-bundle assertion

**Files:** none created — verification gate.

- [ ] **Step 1: Run the full quality gate**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Expected: all clean; every suite green; build succeeds.

- [ ] **Step 2: Assert the single-bundle invariant still holds**

```bash
ls dist
ls dist/fonts | head -3
grep -c "quiet-luxe-room-card" dist/quiet-luxe.js
grep -c "mock-context" dist/quiet-luxe.js || true
```

Expected: `dist` contains exactly `quiet-luxe.js` and `fonts/`; fonts dir populated; room-card registration present in the bundle (count ≥ 1); `mock-context` count 0 (mock-hass NOT bundled). If `dist` contains anything from `dev/`, the build config regressed — stop and fix before committing anything.

- [ ] **Step 3: Report**

Summarize per the delegated-workstream format (objective, status, files, findings, validation, risks) and stop. Branch integration (merge/PR) is a user decision via superpowers:finishing-a-development-branch — do not merge unprompted.

---

## Self-review notes

- **Scope coverage vs task brief:** primitives (chip/toggle/slider/segmented/dot/badge) → Tasks 3–7; structure (eyebrow/header-home/header-room) → Tasks 8–10; cards (room/climate/light/cover/sensor) → Tasks 12–17; mock-hass → Task 1; dev harness → Task 19; exports/single-bundle → Tasks 18/20. Spec §6 iPad no-greeting rule → Task 9 (tested). Spec §4 glow-reserved-for-lights → Tasks 12/15. Decision #12 scrims → Task 12. Spec §9 confirm-on-tap → Task 14. Spec §10 i18n → per-task key additions with parity enforcement. Spec §12 muted unavailable/missing states tested on every card.
- **Deliberate scope boundaries:** sensor-tile `metric` is explicit config (detection belongs to the strategy's bucketing, Plan 4); purifier/exhaust-on-fan need `device_type` override (domain-ambiguous, documented in code); `window.customCards` metadata English-only (rationale in register.ts).
- **Type consistency check:** `RoomCardConfig`/`ClimateCardConfig`/`LightCardConfig`/`CoverCardConfig`/`SensorTileConfig` names match between card files, tests, and index exports; `QlStatus` flows dot → sensor-format → tile; `ql-change` detail shapes are `{checked}` (toggle), `{value}` (slider/segmented) consistently.
- **Placeholder scan:** none — every step carries complete code, exact paths, commands, and expected outcomes.
