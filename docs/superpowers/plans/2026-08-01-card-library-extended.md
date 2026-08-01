# Quiet Luxe Card Library Extended Implementation Plan (Plan 3b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Series note:** This is **Plan 3b** — the remaining spec-§7 components: media, camera, energy, schedule, tasks, car, vacuum cards; presence/door-motion/network-flow rows; device cutout card; language card; iPad idle clock. **Plan 3a** (`2026-08-01-card-library-core.md`) is fully executed and merged on `main` (commit `39c6735`); its patterns are canonical and reused verbatim here. Plan 4 (strategy) comes next.
>
> **Execution branch:** `feat/card-library-extended` (created in Task 1 Step 1).
>
> **Design source of truth:** Figma file `vaDrJjhYuziE1lVvNvJqwP` (<https://www.figma.com/design/vaDrJjhYuziE1lVvNvJqwP/>), page `01 Components`. Component anatomy mirrors `docs/superpowers/plans/2026-08-01-figma-design-system.md` Tasks 4/7/8 and spec §6/§7.

**Goal:** Implement the remaining Quiet Luxe dashboard components as tested Lit components — 7 cards, 3 hass-aware rows, device cutout card, language card, idle clock — extending the merged Plan 3a library, all exported from the single bundle.

**Architecture:** Identical to Plan 3a. Dashboard cards (`quiet-luxe-*`) extend `QlBaseCard`, implement the HA card contract, translate primitive events into `hass.callService`/`callApi`/`callWS` calls, and register via `registerCard` (customElements + `window.customCards`). Hass-aware rows (`ql-row-*`) also extend `QlBaseCard` but register via `customElements.define` only — they are strategy-composed building blocks, not picker cards. `ql-idle-clock` is a plain hass-free element in `src/elements/`. All styling reads `--ql-*` variables with locked light-mode fallbacks.

**Tech Stack:** TypeScript 6 strict (no decorators, `static override properties: PropertyDeclarations`, `declare` fields), Lit 3 (+ `live` directive), Vitest 4.1 + happy-dom (colocated `*.test.ts`, exact-value assertions), ESLint 10 flat, Vite 8 lib build (single-file ES bundle `dist/quiet-luxe.js`). **No new dependencies.**

**Source spec:** `docs/superpowers/specs/2026-08-01-ha-dashboard-redesign-design.md` §6–§8, §10, §12.

---

## Key decisions (D1–D6)

- **D1 — Energy history chart: delegate to apexcharts-card (the spec's own choice).** The bundled `quiet-luxe-energy-card` implements `form: strip | ring` only; `setConfig` rejects `form: chart` with a pointer message. Justification: spec §8 names apexcharts-card best-in-class for charts; a real time-series chart needs `/api/history` fetching, time axes, and zoom — reimplementing that inline violates the mature-dependency rule (global CLAUDE.md) and bloats the single bundle, while a naive inline SVG bar chart would still need the same history plumbing and look worse than the Figma `card/energy form=chart` visual target. Plan 4's strategy renders `custom:apexcharts-card` themed with `--ql-*` vars when `customElements.get('apexcharts-card')` exists and omits the chart section otherwise (graceful degradation, spec §8).
- **D2 — Language switching mechanism (verified 2026-08-01 against HA frontend `dev` branch):** there is **no** `frontend.set_language` service. The frontend root element listens for the `hass-language-select` DOM event (`src/state/translations-mixin.ts`: `this.addEventListener('hass-language-select', (e) => this._selectLanguage(e.detail, true))`), where `detail` **is the bare language-code string** (`ha-pick-language-row.ts`: `fireEvent(this, 'hass-language-select', ev.detail.value)`). It updates `hass.locale`/`hass.language`, persists to browser storage, and saves to the user profile via `saveTranslationPreferences`. The language card therefore dispatches `new CustomEvent('hass-language-select', { detail: code, bubbles: true, composed: true })`. HA's own translation codes for our five locales are exactly `en`, `zh-Hant`, `zh-Hans`, `ms`, `id` — identical to our `Locale` type.
- **D3 — Camera snapshots:** the card renders the camera entity's own `entity_picture` attribute (already a signed `/api/camera_proxy/<entity>?token=…` URL) plus a `time=<ms>` cache-buster — the documented REST param (HA REST API docs, verified 2026-08-01) — refreshed on a `refresh_interval` config timer (seconds, default 10). Live WebRTC/go2rtc streams stay community-card territory per spec §8; snapshot fallback is ours. A failed snapshot renders a muted labeled frame, never a broken `<img>`.
- **D4 — Media grouping (verified 2026-08-01 against HA frontend `src/data/media-player.ts`):** join = `media_player.join` with `{ entity_id: <leader>, group_members: [<speaker>] }`; unjoin = `media_player.unjoin` with `{ entity_id: <speaker> }`; current membership read from the **leader's** `group_members` attribute; volume = `media_player.volume_set` with `volume_level` 0–1.
- **D5 — Calendar/todo data (verified 2026-08-01):** calendars via REST `GET calendars/<entity_id>?start=<iso>&end=<iso>` through `hass.callApi` (HA REST API docs); todo items via WebSocket `{ type: 'todo/item/list', entity_id }` through `hass.callWS`, updates via `todo.update_item` service with `{ entity_id, item: <uid>, status: 'completed' | 'needs_action' }` (HA frontend `src/data/todo.ts`). `callApi`/`callWS` are added to our `HomeAssistant` type as **optional** members; data helpers throw loudly when absent and cards catch → `console.error` + muted empty state (spec §8: loud in console, graceful in UI).
- **D6 — Rows are cards without picker entries:** `ql-row-presence` / `ql-row-door-motion` / `ql-row-network-flow` extend `QlBaseCard` (they need hass) and implement `setConfig`, so they work as `type: custom:ql-row-*` in YAML and in the strategy, but are registered with `customElements.define` only — they do not pollute HA's card picker. `quiet-luxe-device-cutout-card` and all other `quiet-luxe-*` cards register via `registerCard` as in Plan 3a.

**Deliberate scope boundaries:** media `bar` form has no expand chevron — expansion into the full player is dashboard composition (Plan 4 strategy / HA card actions), not card behavior. Schedule card task rows are display-only glance rows; `quiet-luxe-tasks-card` is the interactive surface. Day/week/month schedule views are Figma visual targets only — `ql-segmented` shows them disabled with a localized "coming soon" hint. Language-card endonyms (`English`, `繁體中文`, `简体中文`, `Bahasa Melayu`, `Bahasa Indonesia`) and their English glosses are deliberately **not** routed through `t()` — endonyms are locale-invariant by design (each names itself in its own script; the gloss is an English gloss by Figma spec), mirroring 3a's documented English-only `window.customCards` exemption. Confirm-arm is intentionally repeated inline (car precondition, network-flow row) matching the proven `quiet-luxe-climate-card` pattern rather than extracted — three ~10-line usages with a shared exported `CONFIRM_TIMEOUT_MS`; extraction is deferred until a fourth user appears.

## Conventions (apply to every task — identical to Plan 3a)

1. **TDD:** every task = failing test → minimal implementation → green → commit. Targeted: `npx vitest run <file>`; full suite `npm test`.
2. **Commit footers** — every commit body ends with:

   ```
   Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
   Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
   ```

3. **i18n:** every user-visible string goes through `t(locale, key)`. New keys are added to **all five** locale files (`en`, `zh-hant`, `zh-hans`, `ms`, `id`) **in the same task** that first uses them; `TranslationTable` typing + the parity test enforce completeness (`npm run typecheck` fails until all five carry the key).
4. **Availability semantics** (spec §8/§12, `QlBaseCard`): `unavailable` → muted rendering (`ql-unavailable` class, `t('common.unavailable')`), controls disabled; `missing` → `—` placeholder, muted; **never** an error box at render time. `setConfig` MAY throw on malformed config (developer error). Async data failures: `console.error` + muted empty state, never a broken card.
5. **Styling:** only `var(--ql-*, <light fallback>)` — exceptions: `ql-idle-clock` is dark-pinned by design (Figma `idle/clock-face` is a night-mode composition; fixed dark literals documented in-code, like 3a's scrims).
6. **Events:** primitives dispatch `CustomEvent` with `bubbles: true, composed: true`; primitives never call hass — cards own service calls, verified via the mock-hass spies.
7. **Keyboard access:** interactive controls are native `<button>`/`<input>` or the Plan 3a primitives that wrap them.
8. `window.customCards` descriptions remain English-only (picker metadata).
9. **Lit `live()` rule:** any `ql-toggle` whose visual state must snap back after an intercepted change (confirm-arm flows) binds `.checked=${live(...)}` — plain bindings skip the reset because Lit dirty-checks against the last committed value.

## File structure

```
src/types/home-assistant.ts              MODIFIED: optional callApi/callWS members
src/testing/mock-hass.ts                 MODIFIED: api/ws spies + stub options (back-compat)
src/elements/ql-segmented.ts             MODIFIED: disabled+hint options, arrow-key skip
src/elements/ql-idle-clock.ts            iPad idle clock face (dark-pinned, hass-free)
src/cards/quiet-luxe-media-card.ts       bar|player|group-row media card
src/cards/quiet-luxe-camera-card.ts      glance|full snapshot card, LIVE badge
src/cards/energy-format.ts               pure fns: formatPower, formatEnergy, ringDasharray
src/cards/quiet-luxe-energy-card.ts      strip|ring energy card (chart → apexcharts, D1)
src/cards/schedule-data.ts               calendar/todo fetch helpers + agenda formatting
src/cards/quiet-luxe-schedule-card.ts    agenda card (day/week/month deferred, disabled)
src/cards/quiet-luxe-tasks-card.ts       todo list card, checkbox → todo.update_item
src/cards/car-silhouettes.ts             inline SVG path data per brand (bmw|audi|liauto)
src/cards/quiet-luxe-car-card.ts         brand hero + battery/fuel/range/lock/precondition
src/cards/quiet-luxe-vacuum-card.ts      docked|cleaning|returning + room chips
src/cards/ql-row-presence.ts             person avatars + home/away (define-only, D6)
src/cards/ql-row-door-motion.ts          binary_sensor row + optional motion toggle
src/cards/ql-row-network-flow.ts         switch row with confirm-arm + hint caption
src/cards/quiet-luxe-device-cutout-card.ts  generic device card with image slot
src/cards/quiet-luxe-language-card.ts    five language tiles → hass-language-select (D2)
dev/main.ts                              MODIFIED: every new component, both modes
src/index.ts                             MODIFIED: imports/exports; src/index.test.ts extended
src/i18n/locales/*.ts                    MODIFIED ×5, per-task keys
```

Each created `.ts` gets a colocated `.test.ts`.

## New i18n keys (full table — added task-by-task, never all at once)

| Key | Task | en | zh-Hant | zh-Hans | ms | id |
| --- | --- | --- | --- | --- | --- | --- |
| `media.idle` | 3 | Nothing playing | 未在播放 | 未在播放 | Tiada apa-apa dimainkan | Tidak ada yang diputar |
| `media.play` | 3 | Play | 播放 | 播放 | Main | Putar |
| `media.pause` | 3 | Pause | 暫停 | 暂停 | Jeda | Jeda |
| `media.next` | 3 | Next | 下一首 | 下一首 | Seterusnya | Berikutnya |
| `media.previous` | 3 | Previous | 上一首 | 上一首 | Sebelumnya | Sebelumnya |
| `media.volume` | 3 | Volume | 音量 | 音量 | Kelantangan | Volume |
| `media.join` | 3 | Join group | 加入群組 | 加入群组 | Sertai kumpulan | Gabung grup |
| `camera.live` | 4 | LIVE | 直播 | 直播 | LANGSUNG | LANGSUNG |
| `camera.snapshot_unavailable` | 4 | Snapshot unavailable | 無法取得畫面 | 无法获取画面 | Petikan tidak tersedia | Cuplikan tidak tersedia |
| `energy.today` | 6 | Today | 今日 | 今日 | Hari ini | Hari ini |
| `schedule.agenda` | 8 | Agenda | 議程 | 议程 | Agenda | Agenda |
| `schedule.day` | 8 | Day | 日 | 日 | Hari | Hari |
| `schedule.week` | 8 | Week | 週 | 周 | Minggu | Minggu |
| `schedule.month` | 8 | Month | 月 | 月 | Bulan | Bulan |
| `schedule.no_events` | 8 | No upcoming events | 沒有即將到來的行程 | 没有即将到来的日程 | Tiada acara akan datang | Tidak ada acara mendatang |
| `schedule.view_soon` | 8 | Coming soon | 即將推出 | 即将推出 | Akan datang | Segera hadir |
| `schedule.all_day` | 8 | All day | 全天 | 全天 | Sepanjang hari | Sepanjang hari |
| `tasks.open` | 9 | open | 項未完成 | 项未完成 | belum selesai | belum selesai |
| `tasks.all_done` | 9 | All done | 全部完成 | 全部完成 | Semua selesai | Semua selesai |
| `common.battery` | 10 | Battery | 電量 | 电量 | Bateri | Baterai |
| `car.locked` | 10 | Locked | 已上鎖 | 已上锁 | Berkunci | Terkunci |
| `car.unlocked` | 10 | Unlocked | 未上鎖 | 未上锁 | Tidak berkunci | Tidak terkunci |
| `car.precondition` | 10 | Precondition | 預先調溫 | 预先调温 | Prapenyaman | Prakondisi |
| `car.range` | 10 | Range | 續航 | 续航 | Jarak | Jangkauan |
| `car.fuel` | 10 | Fuel | 油量 | 油量 | Bahan api | Bahan bakar |
| `car.location` | 10 | Location | 位置 | 位置 | Lokasi | Lokasi |
| `vacuum.docked` | 11 | Docked | 已回充電座 | 已回充电座 | Di dok | Di dok |
| `vacuum.cleaning` | 11 | Cleaning | 清掃中 | 清扫中 | Sedang membersihkan | Sedang membersihkan |
| `vacuum.returning` | 11 | Returning | 返回中 | 返回中 | Kembali ke dok | Kembali ke dok |
| `vacuum.paused` | 11 | Paused | 已暫停 | 已暂停 | Dijeda | Dijeda |
| `vacuum.error` | 11 | Error | 錯誤 | 错误 | Ralat | Kesalahan |
| `vacuum.rooms` | 11 | Rooms | 房間 | 房间 | Bilik | Ruangan |
| `presence.home` | 12 | Home | 在家 | 在家 | Di rumah | Di rumah |
| `presence.away` | 12 | Away | 外出 | 外出 | Keluar | Keluar |
| `door.open` | 12 | Open | 已開 | 已开 | Terbuka | Terbuka |
| `door.closed` | 12 | Closed | 已關 | 已关 | Tertutup | Tertutup |
| `motion.detected` | 12 | Motion | 偵測到動靜 | 侦测到动静 | Pergerakan dikesan | Gerakan terdeteksi |
| `motion.clear` | 12 | Clear | 無動靜 | 无动静 | Tiada pergerakan | Tidak ada gerakan |
| `motion.toggle_label` | 12 | Motion detection | 動態偵測 | 移动侦测 | Pengesanan pergerakan | Deteksi gerakan |
| `flow.confirm_hint` | 13 | Tap twice to apply | 點兩次以生效 | 点两次以生效 | Ketik dua kali untuk melaksana | Ketuk dua kali untuk menerapkan |

**Per-task i18n mechanics:** each key row is added to all five locale files in its task. In `src/i18n/locales/en.ts` insert the lines before `} as const;`; in the other four files insert the same keys with that file's column value. The `TranslationKey` type is derived from `en`, so `npm run typecheck` fails until all five files agree.

---

### Task 1: hass typing + mock-hass api/ws spies

**Files:**
- Modify: `src/types/home-assistant.ts`
- Modify: `src/testing/mock-hass.ts`
- Test: `src/testing/mock-hass.test.ts` (extend)

- [ ] **Step 1: Create the execution branch**

```bash
git checkout main && git pull && git checkout -b feat/card-library-extended
```

- [ ] **Step 2: Write the failing tests**

Append to `src/testing/mock-hass.test.ts`:

```ts
describe('makeMockHass api/ws spies', () => {
  it('still accepts a plain language string (Plan 3a call sites)', () => {
    expect(makeMockHass([], 'ms').language).toBe('ms');
  });

  it('records callApi calls and resolves exact-path stubs', async () => {
    const hass = makeMockHass([], {
      apiResponses: { calendars: [{ entity_id: 'calendar.a' }] },
    });
    await expect(hass.callApi?.('GET', 'calendars')).resolves.toEqual([
      { entity_id: 'calendar.a' },
    ]);
    expect(hass.apiCalls).toEqual([{ method: 'GET', path: 'calendars' }]);
  });

  it('falls back to prefix-matched stubs for parameterised paths', async () => {
    const hass = makeMockHass([], { apiResponses: { 'calendars/calendar.a': [] } });
    await expect(hass.callApi?.('GET', 'calendars/calendar.a?start=x&end=y')).resolves.toEqual([]);
  });

  it('rejects loudly when no stub matches', async () => {
    const hass = makeMockHass();
    await expect(hass.callApi?.('GET', 'history')).rejects.toThrow('no apiResponses stub');
    await expect(hass.callWS?.({ type: 'todo/item/list' })).rejects.toThrow('no wsResponses stub');
  });

  it('records callWS messages and resolves stubs by type', async () => {
    const hass = makeMockHass([], { wsResponses: { 'todo/item/list': { items: [] } } });
    await expect(
      hass.callWS?.({ type: 'todo/item/list', entity_id: 'todo.a' }),
    ).resolves.toEqual({ items: [] });
    expect(hass.wsCalls).toEqual([{ type: 'todo/item/list', entity_id: 'todo.a' }]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/testing/mock-hass.test.ts`
Expected: FAIL — `hass.apiCalls`/`callApi` undefined; the language-string test passes (it exercises existing behavior).

- [ ] **Step 4: Implement**

Replace `src/types/home-assistant.ts` with:

```ts
import type { HassEntity } from 'home-assistant-js-websocket';

/**
 * Minimal typed view of the hass object HA passes to custom cards.
 * Deliberately narrow: extend here (never inline `any`) as Plans 3–4 need more.
 * custom-card-helpers was rejected (unmaintained since ~2022).
 */
export interface HomeAssistant {
  readonly states: Readonly<Record<string, HassEntity>>;
  readonly language: string;
  readonly locale?: { readonly language: string };
  callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
  ): Promise<unknown>;
  /**
   * REST helper; path WITHOUT the /api/ prefix, e.g. `calendars/calendar.x?start=…`
   * (HA REST API, verified 2026-08-01). Optional because narrow mocks may omit
   * it — callers guard and degrade gracefully (console error + muted UI).
   * HA implements this as a closure, so it is safe to call unbound.
   */
  callApi?<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string): Promise<T>;
  /**
   * WebSocket command helper, e.g. `{ type: 'todo/item/list', entity_id }`
   * (HA frontend data/todo.ts, verified 2026-08-01). Optional as above.
   */
  callWS?<T>(message: { readonly type: string } & Record<string, unknown>): Promise<T>;
}

export type { HassEntity };
```

Replace `src/testing/mock-hass.ts` with:

```ts
import type { HassEntity, HomeAssistant } from '../types/home-assistant';

export interface RecordedServiceCall {
  readonly domain: string;
  readonly service: string;
  readonly data?: Record<string, unknown>;
}

export interface RecordedApiCall {
  readonly method: string;
  readonly path: string;
}

export interface MockHassOptions {
  readonly language?: string;
  /**
   * callApi stubs. Lookup: exact path first, then the first key that is a
   * prefix of the requested path (lets the dev harness stub
   * `calendars/calendar.family` without hardcoding query timestamps).
   */
  readonly apiResponses?: Readonly<Record<string, unknown>>;
  /** callWS stubs keyed by `message.type`. */
  readonly wsResponses?: Readonly<Record<string, unknown>>;
}

/** HomeAssistant double with service/api/ws spies. Test/dev-harness use only. */
export interface MockHass extends HomeAssistant {
  readonly calls: ReadonlyArray<RecordedServiceCall>;
  readonly apiCalls: ReadonlyArray<RecordedApiCall>;
  readonly wsCalls: ReadonlyArray<Record<string, unknown>>;
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

function findApiStub(
  stubs: Readonly<Record<string, unknown>> | undefined,
  path: string,
): unknown {
  if (stubs === undefined) {
    return undefined;
  }
  if (path in stubs) {
    return stubs[path];
  }
  const prefixKey = Object.keys(stubs).find((key) => path.startsWith(key));
  return prefixKey === undefined ? undefined : stubs[prefixKey];
}

export function makeMockHass(
  entities: ReadonlyArray<HassEntity> = [],
  options: string | MockHassOptions = {},
): MockHass {
  const opts: MockHassOptions = typeof options === 'string' ? { language: options } : options;
  const language = opts.language ?? 'en';
  const calls: RecordedServiceCall[] = [];
  const apiCalls: RecordedApiCall[] = [];
  const wsCalls: Array<Record<string, unknown>> = [];
  return {
    states: Object.fromEntries(entities.map((entity) => [entity.entity_id, entity])),
    language,
    locale: { language },
    calls,
    apiCalls,
    wsCalls,
    callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown> {
      calls.push({ domain, service, data });
      return Promise.resolve(undefined);
    },
    callApi<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string): Promise<T> {
      apiCalls.push({ method, path });
      const stub = findApiStub(opts.apiResponses, path);
      if (stub === undefined) {
        return Promise.reject(new Error(`mock-hass: no apiResponses stub matches "${path}"`));
      }
      return Promise.resolve(stub as T);
    },
    callWS<T>(message: { readonly type: string } & Record<string, unknown>): Promise<T> {
      wsCalls.push(message);
      const stub = (opts.wsResponses ?? {})[message.type];
      if (stub === undefined) {
        return Promise.reject(new Error(`mock-hass: no wsResponses stub for "${message.type}"`));
      }
      return Promise.resolve(stub as T);
    },
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/testing/mock-hass.test.ts` then `npm run typecheck`
Expected: PASS (12 tests); typecheck clean (Plan 3a call sites unaffected by the union second param).

- [ ] **Step 6: Commit**

```bash
git add src/types/home-assistant.ts src/testing/mock-hass.ts src/testing/mock-hass.test.ts
git commit -m "$(cat <<'EOF'
feat(cards): add optional callApi/callWS to hass typing + mock spies

- HomeAssistant gains optional REST/WebSocket helpers (verified against HA
  REST docs and frontend source, 2026-08-01)
- mock-hass records apiCalls/wsCalls and serves stubbed responses; unknown
  paths reject loudly; prefix matching for parameterised calendar paths
- Second makeMockHass param stays back-compatible (string | options)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 2: ql-segmented disabled options

**Files:**
- Modify: `src/elements/ql-segmented.ts`
- Test: `src/elements/ql-segmented.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Append to `src/elements/ql-segmented.test.ts`:

```ts
describe('ql-segmented disabled options', () => {
  const MIXED: ReadonlyArray<QlSegmentOption> = [
    { value: 'agenda', label: 'Agenda' },
    { value: 'day', label: 'Day', disabled: true, hint: 'Coming soon' },
    { value: 'week', label: 'Week' },
  ];

  async function mountMixed(value = 'agenda'): Promise<QlSegmented> {
    const el = document.createElement('ql-segmented') as QlSegmented;
    el.options = MIXED;
    el.value = value;
    document.body.append(el);
    await el.updateComplete;
    return el;
  }

  it('renders disabled options with the native disabled attribute and hint title', async () => {
    const el = await mountMixed();
    const day = buttons(el)[1];
    expect(day?.disabled).toBe(true);
    expect(day?.getAttribute('title')).toBe('Coming soon');
    el.remove();
  });

  it('never selects a disabled option, even programmatically via keyboard focus path', async () => {
    const el = await mountMixed();
    const events: unknown[] = [];
    el.addEventListener('ql-change', (e) => events.push(e));
    buttons(el)[1]?.click();
    await el.updateComplete;
    expect(el.value).toBe('agenda');
    expect(events).toEqual([]);
    el.remove();
  });

  it('arrow keys skip disabled options and wrap', async () => {
    const el = await mountMixed();
    const group = el.shadowRoot?.querySelector("[role='radiogroup']");
    group?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(el.value).toBe('week');
    group?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(el.value).toBe('agenda');
    el.remove();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/elements/ql-segmented.test.ts`
Expected: FAIL — `disabled`/`hint` unknown on `QlSegmentOption` (type error) and no disabled attribute rendered.

- [ ] **Step 3: Implement**

In `src/elements/ql-segmented.ts`:

1. Extend the option interface:

```ts
export interface QlSegmentOption {
  readonly value: string;
  readonly label: string;
  /** Disabled segments render inert with a hint tooltip (native title). */
  readonly disabled?: boolean;
  readonly hint?: string;
}
```

2. Change `select` to take the option and guard disabled (replace the existing `private select(value: string)` method):

```ts
  private select(option: QlSegmentOption): void {
    if (option.disabled === true || option.value === this.value) {
      return;
    }
    this.value = option.value;
    this.dispatchEvent(
      new CustomEvent('ql-change', {
        detail: { value: option.value },
        bubbles: true,
        composed: true,
      }),
    );
    void this.updateComplete.then(() => {
      const selected = this.shadowRoot?.querySelector<HTMLButtonElement>(
        "button[aria-checked='true']",
      );
      selected?.focus();
    });
  }
```

3. Replace `onKeydown` with a disabled-skipping walk:

```ts
  private onKeydown(event: KeyboardEvent): void {
    const count = this.options.length;
    if (count === 0) {
      return;
    }
    let direction: 1 | -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      direction = 1;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      direction = -1;
    } else {
      return;
    }
    event.preventDefault();
    const start = this.options.findIndex((option) => option.value === this.value);
    for (let offset = 1; offset <= count; offset += 1) {
      const index = (((start + direction * offset) % count) + count) % count;
      const option = this.options[index];
      if (option !== undefined && option.disabled !== true) {
        this.select(option);
        return;
      }
    }
  }
```

4. In `render()`, update the per-option button to:

```ts
            <button
              role="radio"
              aria-checked=${String(option.value === this.value)}
              tabindex=${option.value === this.value ? 0 : -1}
              ?disabled=${option.disabled === true}
              title=${option.hint ?? nothing}
              @click=${(): void => this.select(option)}
            >
              ${option.label}
            </button>
```

(`nothing` is already exported by `lit`; add it to the existing lit import if absent.)

5. Append to the styles:

```ts
    button:disabled {
      opacity: 0.45;
      cursor: default;
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/elements/ql-segmented.test.ts`
Expected: PASS (8 tests — 5 existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/elements/ql-segmented.ts src/elements/ql-segmented.test.ts
git commit -m "$(cat <<'EOF'
feat(elements): support disabled segments with hint tooltips in ql-segmented

- QlSegmentOption gains disabled/hint; disabled segments render inert
  with a native title tooltip
- Arrow-key roving skips disabled segments and still wraps
- Needed for the schedule card's deferred day/week/month views

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 3: quiet-luxe-media-card (+ media.* keys)

**Files:**
- Create: `src/cards/quiet-luxe-media-card.ts`
- Modify: `src/i18n/locales/en.ts`, `zh-hant.ts`, `zh-hans.ts`, `ms.ts`, `id.ts`
- Test: `src/cards/quiet-luxe-media-card.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/cards/quiet-luxe-media-card.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeEntity, makeMockHass, type MockHass } from '../testing/mock-hass';
import { QuietLuxeMediaCard, type MediaCardConfig } from './quiet-luxe-media-card';

function playingSonos(): ReturnType<typeof makeEntity> {
  return makeEntity('media_player.living', 'playing', {
    friendly_name: 'Living Sonos',
    media_title: 'So What',
    media_artist: 'Miles Davis',
    media_album_name: 'Kind of Blue',
    source: 'Spotify',
    volume_level: 0.34,
    entity_picture: '/api/media_player_proxy/media_player.living?token=art',
    group_members: ['media_player.living', 'media_player.kitchen'],
  });
}

async function mount(
  config: Omit<MediaCardConfig, 'type'>,
  hass: MockHass,
): Promise<QuietLuxeMediaCard> {
  const card = document.createElement('quiet-luxe-media-card') as QuietLuxeMediaCard;
  card.setConfig({ type: 'custom:quiet-luxe-media-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

describe('quiet-luxe-media-card', () => {
  it('is registered and listed in window.customCards', () => {
    expect(customElements.get('quiet-luxe-media-card')).toBe(QuietLuxeMediaCard);
    const entry = (window.customCards ?? []).find((c) => c.type === 'quiet-luxe-media-card');
    expect(entry?.name).toBe('Quiet Luxe Media Card');
  });

  it('setConfig validates entity and group-row leader', () => {
    const card = new QuietLuxeMediaCard();
    expect(() => card.setConfig({ type: 'x', entity: '' })).toThrow('"entity" is required');
    expect(() =>
      card.setConfig({ type: 'x', entity: 'media_player.kitchen', form: 'group-row' }),
    ).toThrow('group-row requires "leader"');
  });

  it('player form renders track, artist line, source and artwork', async () => {
    const card = await mount({ entity: 'media_player.living' }, makeMockHass([playingSonos()]));
    const text = card.shadowRoot?.textContent ?? '';
    expect(text).toContain('So What');
    expect(text).toContain('Miles Davis — Kind of Blue');
    expect(text).toContain('Spotify');
    expect(card.shadowRoot?.querySelector('img.art')?.getAttribute('src')).toBe(
      '/api/media_player_proxy/media_player.living?token=art',
    );
    card.remove();
  });

  it('shows the localized idle line when nothing is playing', async () => {
    const idle = makeEntity('media_player.living', 'idle', { friendly_name: 'Living Sonos' });
    const en = await mount({ entity: 'media_player.living', form: 'bar' }, makeMockHass([idle]));
    expect(en.shadowRoot?.textContent).toContain('Nothing playing');
    en.remove();
    const zh = await mount(
      { entity: 'media_player.living', form: 'bar' },
      makeMockHass([idle], 'zh-Hant'),
    );
    expect(zh.shadowRoot?.textContent).toContain('未在播放');
    zh.remove();
  });

  it('transport buttons call media_player services', async () => {
    const hass = makeMockHass([playingSonos()]);
    const card = await mount({ entity: 'media_player.living' }, hass);
    card.shadowRoot?.querySelector<HTMLButtonElement>('button.play')?.click();
    card.shadowRoot?.querySelector<HTMLButtonElement>('button.next')?.click();
    card.shadowRoot?.querySelector<HTMLButtonElement>('button.previous')?.click();
    expect(hass.calls).toEqual([
      {
        domain: 'media_player',
        service: 'media_play_pause',
        data: { entity_id: 'media_player.living' },
      },
      {
        domain: 'media_player',
        service: 'media_next_track',
        data: { entity_id: 'media_player.living' },
      },
      {
        domain: 'media_player',
        service: 'media_previous_track',
        data: { entity_id: 'media_player.living' },
      },
    ]);
    card.remove();
  });

  it('volume slider commit calls volume_set with a 0..1 level', async () => {
    const hass = makeMockHass([playingSonos()]);
    const card = await mount({ entity: 'media_player.living' }, hass);
    card.shadowRoot
      ?.querySelector('ql-slider')
      ?.dispatchEvent(
        new CustomEvent('ql-change', { detail: { value: 60 }, bubbles: true, composed: true }),
      );
    expect(hass.calls).toEqual([
      {
        domain: 'media_player',
        service: 'volume_set',
        data: { entity_id: 'media_player.living', volume_level: 0.6 },
      },
    ]);
    card.remove();
  });

  it('group-row join toggle calls join on the leader and unjoin on the speaker', async () => {
    const hass = makeMockHass([
      playingSonos(),
      makeEntity('media_player.kitchen', 'playing', { friendly_name: 'Kitchen Sonos' }),
      makeEntity('media_player.study', 'idle', { friendly_name: 'Study Sonos' }),
    ]);
    const joined = await mount(
      { entity: 'media_player.kitchen', form: 'group-row', leader: 'media_player.living' },
      hass,
    );
    const joinedToggle = joined.shadowRoot?.querySelector<
      HTMLElement & { checked: boolean }
    >('ql-toggle');
    expect(joinedToggle?.checked).toBe(true);
    joinedToggle?.dispatchEvent(
      new CustomEvent('ql-change', { detail: { checked: false }, bubbles: true, composed: true }),
    );
    const unjoined = await mount(
      { entity: 'media_player.study', form: 'group-row', leader: 'media_player.living' },
      hass,
    );
    const unjoinedToggle = unjoined.shadowRoot?.querySelector<
      HTMLElement & { checked: boolean }
    >('ql-toggle');
    expect(unjoinedToggle?.checked).toBe(false);
    unjoinedToggle?.dispatchEvent(
      new CustomEvent('ql-change', { detail: { checked: true }, bubbles: true, composed: true }),
    );
    expect(hass.calls).toEqual([
      { domain: 'media_player', service: 'unjoin', data: { entity_id: 'media_player.kitchen' } },
      {
        domain: 'media_player',
        service: 'join',
        data: { entity_id: 'media_player.living', group_members: ['media_player.study'] },
      },
    ]);
    joined.remove();
    unjoined.remove();
  });

  it('unavailable entity renders muted with disabled transport', async () => {
    const hass = makeMockHass([makeEntity('media_player.living', 'unavailable')]);
    const card = await mount({ entity: 'media_player.living' }, hass);
    expect(card.shadowRoot?.querySelector('.ql-unavailable')).not.toBeNull();
    expect(card.shadowRoot?.textContent).toContain('Unavailable');
    expect(card.shadowRoot?.querySelector<HTMLButtonElement>('button.play')?.disabled).toBe(true);
    card.remove();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/cards/quiet-luxe-media-card.test.ts`
Expected: FAIL — module resolve error for `./quiet-luxe-media-card`.

- [ ] **Step 3: Add the media.* i18n keys (all five locales)**

Add to `src/i18n/locales/en.ts` before `} as const;`:

```ts
  'media.idle': 'Nothing playing',
  'media.play': 'Play',
  'media.pause': 'Pause',
  'media.next': 'Next',
  'media.previous': 'Previous',
  'media.volume': 'Volume',
  'media.join': 'Join group',
```

Add to `src/i18n/locales/zh-hant.ts`:

```ts
  'media.idle': '未在播放',
  'media.play': '播放',
  'media.pause': '暫停',
  'media.next': '下一首',
  'media.previous': '上一首',
  'media.volume': '音量',
  'media.join': '加入群組',
```

Add to `src/i18n/locales/zh-hans.ts`:

```ts
  'media.idle': '未在播放',
  'media.play': '播放',
  'media.pause': '暂停',
  'media.next': '下一首',
  'media.previous': '上一首',
  'media.volume': '音量',
  'media.join': '加入群组',
```

Add to `src/i18n/locales/ms.ts`:

```ts
  'media.idle': 'Tiada apa-apa dimainkan',
  'media.play': 'Main',
  'media.pause': 'Jeda',
  'media.next': 'Seterusnya',
  'media.previous': 'Sebelumnya',
  'media.volume': 'Kelantangan',
  'media.join': 'Sertai kumpulan',
```

Add to `src/i18n/locales/id.ts`:

```ts
  'media.idle': 'Tidak ada yang diputar',
  'media.play': 'Putar',
  'media.pause': 'Jeda',
  'media.next': 'Berikutnya',
  'media.previous': 'Sebelumnya',
  'media.volume': 'Volume',
  'media.join': 'Gabung grup',
```

- [ ] **Step 4: Implement**

Create `src/cards/quiet-luxe-media-card.ts`:

```ts
import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import { t } from '../i18n/translate';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';

export type MediaCardForm = 'bar' | 'player' | 'group-row';

export interface MediaCardConfig {
  readonly type: string;
  readonly entity: string;
  readonly form?: MediaCardForm;
  readonly name?: string;
  /** group-row only: the group coordinator this speaker joins or leaves. */
  readonly leader?: string;
}

/**
 * Media card (Figma `card/media`): form=bar (collapsed strip) | player (full
 * transport + volume) | group-row (join toggle + per-speaker volume).
 * Service contracts per plan D4 (verified 2026-08-01): join targets the
 * leader with group_members=[speaker]; unjoin targets the speaker;
 * volume_set takes volume_level 0..1. Membership reads the leader's
 * group_members attribute.
 */
export class QuietLuxeMediaCard extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
  };

  declare config?: MediaCardConfig;

  setConfig(config: MediaCardConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('quiet-luxe-media-card: "entity" is required');
    }
    if ((config.form ?? 'player') === 'group-row' && (config.leader ?? '') === '') {
      throw new Error('quiet-luxe-media-card: group-row requires "leader"');
    }
    this.config = config;
  }

  form(): MediaCardForm {
    return this.config?.form ?? 'player';
  }

  getCardSize(): number {
    return this.form() === 'player' ? 4 : 1;
  }

  getGridOptions(): { rows: number; columns: number } {
    return this.form() === 'player' ? { rows: 4, columns: 6 } : { rows: 1, columns: 12 };
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .row {
        display: flex;
        align-items: center;
        gap: var(--ql-space-m, 12px);
      }
      .art {
        border-radius: var(--ql-radius-thumb, 12px);
        object-fit: cover;
        background: var(--ql-surface-border, #e4dccb);
        flex: none;
      }
      .art.bar {
        width: 28px;
        height: 28px;
      }
      .art.player {
        width: 64px;
        height: 64px;
      }
      .lines {
        flex: 1;
        min-width: 0;
      }
      .eyebrow {
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .title {
        margin: 2px 0 0;
        font: 500 16px/22px var(--ql-font-body, Outfit, sans-serif);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .caption {
        margin: 2px 0 0;
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .muted {
        color: var(--ql-ink-muted, #8c8578);
      }
      .name {
        margin: 0;
        font: 400 14px/20px var(--ql-font-body, Outfit, sans-serif);
        flex: 1;
      }
      .transport-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--ql-space-l, 16px);
        margin-top: var(--ql-space-m, 12px);
      }
      button.transport {
        border-radius: var(--ql-radius-chip, 999px);
        border: 1px solid var(--ql-surface-border, #e4dccb);
        background: var(--ql-surface-card, #fdfbf6);
        color: var(--ql-ink-primary, #2b2620);
        cursor: pointer;
        font: 400 13px/1 var(--ql-font-body, Outfit, sans-serif);
        width: 30px;
        height: 30px;
      }
      button.transport.play {
        width: 34px;
        height: 34px;
        background: var(--ql-ink-primary, #2b2620);
        color: var(--ql-bg-base, #f4f0e8);
        border-color: transparent;
      }
      button.transport:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .volume-row {
        display: flex;
        align-items: center;
        gap: var(--ql-space-m, 12px);
        margin-top: var(--ql-space-m, 12px);
      }
      .volume-row ql-slider {
        flex: 1;
      }
      .row-volume {
        flex: 1;
      }
    `,
  ];

  private callMedia(service: string): void {
    const entityId = this.config?.entity;
    if (entityId === undefined || this.hass === undefined) {
      return;
    }
    void this.hass.callService('media_player', service, { entity_id: entityId });
  }

  private onPlayPause(): void {
    this.callMedia('media_play_pause');
  }

  private onNext(): void {
    this.callMedia('media_next_track');
  }

  private onPrevious(): void {
    this.callMedia('media_previous_track');
  }

  private onVolume(event: CustomEvent<{ value: number }>): void {
    const entityId = this.config?.entity;
    if (entityId === undefined || this.hass === undefined) {
      return;
    }
    void this.hass.callService('media_player', 'volume_set', {
      entity_id: entityId,
      volume_level: event.detail.value / 100,
    });
  }

  private onJoinToggle(event: CustomEvent<{ checked: boolean }>): void {
    const config = this.config;
    if (config?.leader === undefined || this.hass === undefined) {
      return;
    }
    if (event.detail.checked) {
      void this.hass.callService('media_player', 'join', {
        entity_id: config.leader,
        group_members: [config.entity],
      });
      return;
    }
    void this.hass.callService('media_player', 'unjoin', { entity_id: config.entity });
  }

  private isJoined(): boolean {
    const leader = this.config?.leader;
    if (leader === undefined) {
      return false;
    }
    const members = this.entity(leader)?.attributes.group_members as
      | ReadonlyArray<string>
      | undefined;
    return members?.includes(this.config?.entity ?? '') ?? false;
  }

  private volumePercent(): number {
    const level = Number(this.entity(this.config?.entity ?? '')?.attributes.volume_level);
    return Number.isFinite(level) ? Math.round(level * 100) : 0;
  }

  private artwork(size: 'bar' | 'player'): TemplateResult {
    const picture = this.entity(this.config?.entity ?? '')?.attributes.entity_picture as
      | string
      | undefined;
    if (picture === undefined) {
      return html`<div class="art ${size}"></div>`;
    }
    return html`<img class="art ${size}" src=${picture} alt="" />`;
  }

  protected override render(): TemplateResult {
    const config = this.config;
    if (config === undefined) {
      return html``;
    }
    const locale = this.locale();
    const availability = this.availability(config.entity);
    const unavailable = availability !== 'available';
    const cardClass = unavailable ? 'ql-card ql-unavailable' : 'ql-card';
    const entity = this.entity(config.entity);
    const name =
      config.name ?? (entity?.attributes.friendly_name as string | undefined) ?? config.entity;
    if (this.form() === 'group-row') {
      return html`
        <div class="${cardClass} row">
          <p class="name">${name}</p>
          <ql-slider
            class="row-volume"
            .value=${this.volumePercent()}
            label=${t(locale, 'media.volume')}
            ?disabled=${unavailable}
            @ql-change=${this.onVolume}
          ></ql-slider>
          <ql-toggle
            .checked=${this.isJoined()}
            label=${t(locale, 'media.join')}
            ?disabled=${unavailable}
            @ql-change=${this.onJoinToggle}
          ></ql-toggle>
        </div>
      `;
    }
    const playing = entity?.state === 'playing';
    const title = entity?.attributes.media_title as string | undefined;
    const trackText = unavailable
      ? t(locale, 'common.unavailable')
      : (title ?? t(locale, 'media.idle'));
    const trackMuted = unavailable || title === undefined;
    const source = entity?.attributes.source as string | undefined;
    const playButton = html`
      <button
        class="transport play"
        aria-label=${playing ? t(locale, 'media.pause') : t(locale, 'media.play')}
        ?disabled=${unavailable}
        @click=${this.onPlayPause}
      >
        ${playing ? '⏸' : '▶'}
      </button>
    `;
    if (this.form() === 'bar') {
      return html`
        <div class="${cardClass} row">
          ${this.artwork('bar')}
          <div class="lines">
            <p class="caption ${trackMuted ? 'muted' : ''}">${trackText}</p>
            ${source === undefined ? nothing : html`<p class="caption muted">${source}</p>`}
          </div>
          ${playButton}
        </div>
      `;
    }
    const artist = entity?.attributes.media_artist as string | undefined;
    const album = entity?.attributes.media_album_name as string | undefined;
    const artistLine =
      artist === undefined ? undefined : album === undefined ? artist : `${artist} — ${album}`;
    return html`
      <div class=${cardClass}>
        <div class="row">
          ${this.artwork('player')}
          <div class="lines">
            ${source === undefined ? nothing : html`<p class="eyebrow">${source}</p>`}
            <p class="title ${trackMuted ? 'muted' : ''}">${trackText}</p>
            ${artistLine === undefined ? nothing : html`<p class="caption muted">${artistLine}</p>`}
          </div>
        </div>
        <div class="transport-row">
          <button
            class="transport previous"
            aria-label=${t(locale, 'media.previous')}
            ?disabled=${unavailable}
            @click=${this.onPrevious}
          >
            ⏮
          </button>
          ${playButton}
          <button
            class="transport next"
            aria-label=${t(locale, 'media.next')}
            ?disabled=${unavailable}
            @click=${this.onNext}
          >
            ⏭
          </button>
        </div>
        <div class="volume-row">
          <ql-slider
            .value=${this.volumePercent()}
            label=${t(locale, 'media.volume')}
            ?disabled=${unavailable}
            @ql-change=${this.onVolume}
          ></ql-slider>
          <span class="caption muted">${this.volumePercent()}%</span>
        </div>
      </div>
    `;
  }
}

registerCard('quiet-luxe-media-card', QuietLuxeMediaCard, {
  name: 'Quiet Luxe Media Card',
  description: 'Media player as collapsed bar, full player, or speaker group row.',
});
```

Note: the group-row `checked` state comes from the leader's `group_members`, so a real HA state push re-syncs the toggle; no `live()` needed here because the toggle is not intercepted.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/cards/quiet-luxe-media-card.test.ts src/i18n/i18n.test.ts` then `npm run typecheck`
Expected: PASS (8 media tests + i18n parity); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/cards/quiet-luxe-media-card.ts src/cards/quiet-luxe-media-card.test.ts src/i18n/locales
git commit -m "$(cat <<'EOF'
feat(cards): add quiet-luxe-media-card (bar/player/group-row)

- Transport, volume_set (0..1), artwork via entity_picture
- Group row: join targets leader with group_members, unjoin targets
  speaker; membership from leader group_members (verified 2026-08-01)
- media.* keys added to all five locales; idle line localized

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 4: quiet-luxe-camera-card (+ camera.* keys)

**Files:**
- Create: `src/cards/quiet-luxe-camera-card.ts`
- Modify: `src/i18n/locales/*.ts` (×5)
- Test: `src/cards/quiet-luxe-camera-card.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/cards/quiet-luxe-camera-card.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeEntity, makeMockHass, type MockHass } from '../testing/mock-hass';
import {
  DEFAULT_CAMERA_REFRESH_S,
  QuietLuxeCameraCard,
  type CameraCardConfig,
} from './quiet-luxe-camera-card';

function cameraEntity(state = 'streaming'): ReturnType<typeof makeEntity> {
  return makeEntity('camera.front_door', state, {
    friendly_name: 'Front Door',
    entity_picture: '/api/camera_proxy/camera.front_door?token=abc',
  });
}

async function mount(
  config: Omit<CameraCardConfig, 'type'>,
  hass: MockHass,
): Promise<QuietLuxeCameraCard> {
  const card = document.createElement('quiet-luxe-camera-card') as QuietLuxeCameraCard;
  card.setConfig({ type: 'custom:quiet-luxe-camera-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

describe('quiet-luxe-camera-card', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is registered, defaults to glance form and a 10s refresh', () => {
    expect(customElements.get('quiet-luxe-camera-card')).toBe(QuietLuxeCameraCard);
    expect(DEFAULT_CAMERA_REFRESH_S).toBe(10);
    const entry = (window.customCards ?? []).find((c) => c.type === 'quiet-luxe-camera-card');
    expect(entry?.name).toBe('Quiet Luxe Camera Card');
  });

  it('renders the proxied snapshot with a time cache-buster', async () => {
    const card = await mount({ entity: 'camera.front_door' }, makeMockHass([cameraEntity()]));
    const src = card.shadowRoot?.querySelector('img')?.getAttribute('src') ?? '';
    expect(src.startsWith('/api/camera_proxy/camera.front_door?token=abc&time=')).toBe(true);
    card.remove();
  });

  it('shows the LIVE badge only on the full form', async () => {
    const hass = makeMockHass([cameraEntity()]);
    const glance = await mount({ entity: 'camera.front_door' }, hass);
    expect(glance.shadowRoot?.textContent).not.toContain('LIVE');
    glance.remove();
    const full = await mount({ entity: 'camera.front_door', form: 'full' }, hass);
    expect(full.shadowRoot?.textContent).toContain('LIVE');
    full.remove();
  });

  it('replaces a failed snapshot with a muted label, never a broken img', async () => {
    const card = await mount(
      { entity: 'camera.front_door', form: 'full' },
      makeMockHass([cameraEntity()]),
    );
    card.shadowRoot?.querySelector('img')?.dispatchEvent(new Event('error'));
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector('img')).toBeNull();
    expect(card.shadowRoot?.textContent).toContain('Snapshot unavailable');
    expect(card.shadowRoot?.textContent).not.toContain('LIVE');
    card.remove();
  });

  it('retries after the refresh interval by clearing the error and re-rendering', async () => {
    const card = await mount(
      { entity: 'camera.front_door', refresh_interval: 5 },
      makeMockHass([cameraEntity()]),
    );
    card.shadowRoot?.querySelector('img')?.dispatchEvent(new Event('error'));
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector('img')).toBeNull();
    vi.advanceTimersByTime(5000);
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector('img')).not.toBeNull();
    card.remove();
  });

  it('unavailable or pictureless cameras render the muted unavailable frame', async () => {
    const card = await mount(
      { entity: 'camera.front_door', form: 'full' },
      makeMockHass([makeEntity('camera.front_door', 'unavailable')]),
    );
    expect(card.shadowRoot?.querySelector('img')).toBeNull();
    expect(card.shadowRoot?.querySelector('.ql-unavailable')).not.toBeNull();
    expect(card.shadowRoot?.textContent).toContain('Unavailable');
    card.remove();
  });

  it('clears its timer on disconnect', async () => {
    const card = await mount({ entity: 'camera.front_door' }, makeMockHass([cameraEntity()]));
    card.remove();
    expect(vi.getTimerCount()).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/cards/quiet-luxe-camera-card.test.ts`
Expected: FAIL — module resolve error.

- [ ] **Step 3: Add the camera.* i18n keys (all five locales)**

`en.ts`:

```ts
  'camera.live': 'LIVE',
  'camera.snapshot_unavailable': 'Snapshot unavailable',
```

`zh-hant.ts`:

```ts
  'camera.live': '直播',
  'camera.snapshot_unavailable': '無法取得畫面',
```

`zh-hans.ts`:

```ts
  'camera.live': '直播',
  'camera.snapshot_unavailable': '无法获取画面',
```

`ms.ts`:

```ts
  'camera.live': 'LANGSUNG',
  'camera.snapshot_unavailable': 'Petikan tidak tersedia',
```

`id.ts`:

```ts
  'camera.live': 'LANGSUNG',
  'camera.snapshot_unavailable': 'Cuplikan tidak tersedia',
```

- [ ] **Step 4: Implement**

Create `src/cards/quiet-luxe-camera-card.ts`:

```ts
import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import { t } from '../i18n/translate';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';

export type CameraCardForm = 'glance' | 'full';

export const DEFAULT_CAMERA_REFRESH_S = 10;

export interface CameraCardConfig {
  readonly type: string;
  readonly entity: string;
  readonly form?: CameraCardForm;
  readonly name?: string;
  /** Snapshot refresh interval in seconds. */
  readonly refresh_interval?: number;
}

/**
 * Camera card (Figma `card/camera`): form=glance (16:9 thumb + status line) |
 * full (frame + name + LIVE badge). Snapshot strategy per plan D3: render the
 * entity's own signed entity_picture (/api/camera_proxy/… with token) plus a
 * `time` cache-buster (documented REST param), refreshed on an interval.
 * A failed or absent snapshot renders a muted labeled frame — never a broken
 * <img> icon (spec §8).
 */
export class QuietLuxeCameraCard extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
    tick: { state: true },
    snapshotFailed: { state: true },
  };

  declare config?: CameraCardConfig;
  declare tick: number;
  declare snapshotFailed: boolean;
  private refreshTimer?: number;

  constructor() {
    super();
    this.tick = 0;
    this.snapshotFailed = false;
  }

  setConfig(config: CameraCardConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('quiet-luxe-camera-card: "entity" is required');
    }
    this.config = config;
    this.startTimer();
  }

  form(): CameraCardForm {
    return this.config?.form ?? 'glance';
  }

  getCardSize(): number {
    return this.form() === 'full' ? 3 : 2;
  }

  getGridOptions(): { rows: number; columns: number } {
    return this.form() === 'full' ? { rows: 3, columns: 6 } : { rows: 2, columns: 3 };
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.startTimer();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.refreshTimer);
    this.refreshTimer = undefined;
  }

  private startTimer(): void {
    window.clearInterval(this.refreshTimer);
    this.refreshTimer = undefined;
    if (!this.isConnected || this.config === undefined) {
      return;
    }
    const seconds = this.config.refresh_interval ?? DEFAULT_CAMERA_REFRESH_S;
    this.refreshTimer = window.setInterval(() => {
      this.tick += 1;
      this.snapshotFailed = false;
    }, seconds * 1000);
  }

  private snapshotUrl(): string | undefined {
    const picture = this.entity(this.config?.entity ?? '')?.attributes.entity_picture as
      | string
      | undefined;
    if (picture === undefined) {
      return undefined;
    }
    const separator = picture.includes('?') ? '&' : '?';
    return `${picture}${separator}time=${Date.now()}`;
  }

  private onSnapshotError(): void {
    this.snapshotFailed = true;
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .ql-card {
        padding: var(--ql-space-s, 8px);
      }
      .frame {
        position: relative;
        aspect-ratio: 16 / 9;
        border-radius: var(--ql-radius-thumb, 12px);
        overflow: hidden;
        background: var(--ql-surface-border, #e4dccb);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .frame img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .fallback {
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ql-space-s, 8px);
        margin-top: var(--ql-space-s, 8px);
        padding: 0 var(--ql-space-xs, 4px);
      }
      .name {
        margin: 0;
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .live {
        display: inline-flex;
        align-items: center;
        gap: var(--ql-space-xs, 4px);
        color: var(--ql-status-alert, #a85b4e);
        font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.14em;
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
    const url = availability === 'available' ? this.snapshotUrl() : undefined;
    const showImage = url !== undefined && !this.snapshotFailed;
    const name =
      config.name ??
      (this.entity(config.entity)?.attributes.friendly_name as string | undefined) ??
      config.entity;
    const fallbackText =
      availability === 'available'
        ? t(locale, 'camera.snapshot_unavailable')
        : t(locale, 'common.unavailable');
    return html`
      <div class="ql-card ${showImage ? '' : 'ql-unavailable'}">
        <div class="frame">
          ${showImage
            ? html`<img src=${url} alt=${name} @error=${this.onSnapshotError} />`
            : html`<p class="fallback">${fallbackText}</p>`}
        </div>
        <div class="meta">
          <p class="name">${name}</p>
          ${this.form() === 'full' && showImage
            ? html`<span class="live"
                ><ql-status-dot status="alert"></ql-status-dot>${t(locale, 'camera.live')}</span
              >`
            : nothing}
        </div>
      </div>
    `;
  }
}

registerCard('quiet-luxe-camera-card', QuietLuxeCameraCard, {
  name: 'Quiet Luxe Camera Card',
  description: 'Camera snapshot card (glance or full) with interval refresh and LIVE badge.',
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/cards/quiet-luxe-camera-card.test.ts src/i18n/i18n.test.ts` then `npm run typecheck`
Expected: PASS (7 camera tests + parity); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/cards/quiet-luxe-camera-card.ts src/cards/quiet-luxe-camera-card.test.ts src/i18n/locales
git commit -m "$(cat <<'EOF'
feat(cards): add quiet-luxe-camera-card (glance/full snapshot)

- Snapshot from the entity's signed entity_picture + time cache-buster,
  refreshed on refresh_interval (default 10s); timer cleaned on disconnect
- Failed/absent snapshots render a muted labeled frame, never a broken img
- LIVE badge on the full form only; camera.* keys in all five locales

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 5: energy formatting helpers

**Files:**
- Create: `src/cards/energy-format.ts`
- Test: `src/cards/energy-format.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/cards/energy-format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatEnergy, formatPower, ringDasharray } from './energy-format';

describe('formatPower', () => {
  it('renders watts below 1 kW and kW with two decimals above', () => {
    expect(formatPower(0)).toBe('0 W');
    expect(formatPower(824.4)).toBe('824 W');
    expect(formatPower(1236)).toBe('1.24 kW');
    expect(formatPower(11500)).toBe('11.50 kW');
  });

  it('placeholders non-finite input', () => {
    expect(formatPower(undefined)).toBe('—');
    expect(formatPower(Number.NaN)).toBe('—');
  });
});

describe('formatEnergy', () => {
  it('renders kWh with one decimal', () => {
    expect(formatEnergy(8.61)).toBe('8.6 kWh');
    expect(formatEnergy(0)).toBe('0.0 kWh');
  });

  it('placeholders non-finite input', () => {
    expect(formatEnergy(undefined)).toBe('—');
  });
});

describe('ringDasharray', () => {
  it('maps load fraction onto the circle circumference', () => {
    expect(ringDasharray(2300, 4600, 20)).toBe('62.83 125.66');
  });

  it('clamps to the full circle and handles a zero max', () => {
    expect(ringDasharray(9999, 4600, 20)).toBe('125.66 125.66');
    expect(ringDasharray(-5, 4600, 20)).toBe('0.00 125.66');
    expect(ringDasharray(5, 0, 20)).toBe('0.00 125.66');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/cards/energy-format.test.ts`
Expected: FAIL — module resolve error.

- [ ] **Step 3: Implement**

Create `src/cards/energy-format.ts`:

```ts
/** Exact display formatting for power/energy values (Figma `card/energy`). */
export function formatPower(watts: number | undefined): string {
  if (watts === undefined || !Number.isFinite(watts)) {
    return '—';
  }
  if (Math.abs(watts) < 1000) {
    return `${Math.round(watts)} W`;
  }
  return `${(watts / 1000).toFixed(2)} kW`;
}

export function formatEnergy(kwh: number | undefined): string {
  if (kwh === undefined || !Number.isFinite(kwh)) {
    return '—';
  }
  return `${kwh.toFixed(1)} kWh`;
}

/**
 * stroke-dasharray for the per-phase donut: `<filled> <circumference>`,
 * clamped to 0..1 of max. Radius is the SVG circle radius in px.
 */
export function ringDasharray(watts: number, maxWatts: number, radius: number): string {
  const circumference = 2 * Math.PI * radius;
  const fraction = maxWatts <= 0 ? 0 : Math.min(Math.max(watts / maxWatts, 0), 1);
  return `${(circumference * fraction).toFixed(2)} ${circumference.toFixed(2)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/cards/energy-format.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/cards/energy-format.ts src/cards/energy-format.test.ts
git commit -m "$(cat <<'EOF'
feat(cards): add power/energy formatting helpers

- formatPower: W below 1 kW, kW with two decimals above, em-dash fallback
- formatEnergy: kWh with one decimal
- ringDasharray: clamped donut stroke math for the per-phase ring

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 6: quiet-luxe-energy-card (strip | ring) (+ energy.today key)

**Files:**
- Create: `src/cards/quiet-luxe-energy-card.ts`
- Modify: `src/i18n/locales/*.ts` (×5)
- Test: `src/cards/quiet-luxe-energy-card.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/cards/quiet-luxe-energy-card.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeMockHass, sensorEntity, type MockHass } from '../testing/mock-hass';
import {
  DEFAULT_RING_MAX_W,
  QuietLuxeEnergyCard,
  type EnergyCardConfig,
} from './quiet-luxe-energy-card';

async function mount(
  config: Omit<EnergyCardConfig, 'type'>,
  hass: MockHass,
): Promise<QuietLuxeEnergyCard> {
  const card = document.createElement('quiet-luxe-energy-card') as QuietLuxeEnergyCard;
  card.setConfig({ type: 'custom:quiet-luxe-energy-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

describe('quiet-luxe-energy-card', () => {
  it('is registered and validates config', () => {
    expect(customElements.get('quiet-luxe-energy-card')).toBe(QuietLuxeEnergyCard);
    const card = new QuietLuxeEnergyCard();
    expect(() => card.setConfig({ type: 'x', power_entity: '' })).toThrow(
      '"power_entity" is required',
    );
    expect(() =>
      card.setConfig({
        type: 'x',
        power_entity: 'sensor.p',
        form: 'chart' as unknown as 'strip',
      }),
    ).toThrow('apexcharts-card');
  });

  it('strip renders formatted power and localized today energy', async () => {
    const hass = makeMockHass([
      sensorEntity('sensor.power_total', '1236'),
      sensorEntity('sensor.energy_today', '8.61'),
    ]);
    const card = await mount(
      { power_entity: 'sensor.power_total', today_entity: 'sensor.energy_today' },
      hass,
    );
    const text = card.shadowRoot?.textContent ?? '';
    expect(text).toContain('1.24 kW');
    expect(text).toContain('8.6 kWh');
    expect(text).toContain('Today');
    card.remove();
  });

  it('localizes the today label', async () => {
    const hass = makeMockHass(
      [sensorEntity('sensor.power_total', '400'), sensorEntity('sensor.energy_today', '2')],
      'zh-Hant',
    );
    const card = await mount(
      { power_entity: 'sensor.power_total', today_entity: 'sensor.energy_today' },
      hass,
    );
    expect(card.shadowRoot?.textContent).toContain('今日');
    card.remove();
  });

  it('ring renders the phase donut with exact dasharray at 50% of default max', async () => {
    const hass = makeMockHass([sensorEntity('sensor.phase_l1', '2300')]);
    const card = await mount({ form: 'ring', power_entity: 'sensor.phase_l1', name: 'L1' }, hass);
    expect(DEFAULT_RING_MAX_W).toBe(4600);
    const progress = card.shadowRoot?.querySelector('circle.progress');
    expect(progress?.getAttribute('stroke-dasharray')).toBe('62.83 125.66');
    expect(card.shadowRoot?.textContent).toContain('L1');
    expect(card.shadowRoot?.textContent).toContain('2.30 kW');
    card.remove();
  });

  it('unavailable power renders muted placeholders', async () => {
    const hass = makeMockHass([sensorEntity('sensor.power_total', 'unavailable')]);
    const card = await mount({ power_entity: 'sensor.power_total' }, hass);
    expect(card.shadowRoot?.querySelector('.ql-unavailable')).not.toBeNull();
    expect(card.shadowRoot?.textContent).toContain('—');
    card.remove();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/cards/quiet-luxe-energy-card.test.ts`
Expected: FAIL — module resolve error.

- [ ] **Step 3: Add the energy.today key (all five locales)**

`en.ts`: `'energy.today': 'Today',` · `zh-hant.ts`: `'energy.today': '今日',` · `zh-hans.ts`: `'energy.today': '今日',` · `ms.ts`: `'energy.today': 'Hari ini',` · `id.ts`: `'energy.today': 'Hari ini',`

- [ ] **Step 4: Implement**

Create `src/cards/quiet-luxe-energy-card.ts`:

```ts
import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import { t } from '../i18n/translate';
import { formatEnergy, formatPower, ringDasharray } from './energy-format';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';

export type EnergyCardForm = 'strip' | 'ring';

export const DEFAULT_RING_MAX_W = 4600;
export const RING_RADIUS = 20;

export interface EnergyCardConfig {
  readonly type: string;
  readonly form?: EnergyCardForm;
  /** Power sensor in W. */
  readonly power_entity: string;
  /** Today's energy sensor in kWh (strip form). */
  readonly today_entity?: string;
  /** Ring label, e.g. the phase name ("L1"). */
  readonly name?: string;
  /** Full-scale W for the ring donut. */
  readonly max_power?: number;
}

/**
 * Energy card (Figma `card/energy`): form=strip (live power + today kWh) |
 * ring (per-phase SVG donut). History charts are deliberately NOT implemented
 * here — plan decision D1 delegates them to apexcharts-card via the strategy.
 */
export class QuietLuxeEnergyCard extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
  };

  declare config?: EnergyCardConfig;

  setConfig(config: EnergyCardConfig): void {
    if (typeof config.power_entity !== 'string' || config.power_entity === '') {
      throw new Error('quiet-luxe-energy-card: "power_entity" is required');
    }
    const form = config.form ?? 'strip';
    if (form !== 'strip' && form !== 'ring') {
      throw new Error(
        'quiet-luxe-energy-card: form must be "strip" or "ring" — history charts are delegated to apexcharts-card (plan D1)',
      );
    }
    this.config = config;
  }

  form(): EnergyCardForm {
    return this.config?.form ?? 'strip';
  }

  getCardSize(): number {
    return this.form() === 'ring' ? 2 : 1;
  }

  getGridOptions(): { rows: number; columns: number } {
    return this.form() === 'ring' ? { rows: 2, columns: 3 } : { rows: 1, columns: 4 };
  }

  private powerWatts(): number | undefined {
    const entityId = this.config?.power_entity ?? '';
    if (this.availability(entityId) !== 'available') {
      return undefined;
    }
    const value = Number(this.entity(entityId)?.state);
    return Number.isFinite(value) ? value : undefined;
  }

  private todayKwh(): number | undefined {
    const entityId = this.config?.today_entity;
    if (entityId === undefined || this.availability(entityId) !== 'available') {
      return undefined;
    }
    const value = Number(this.entity(entityId)?.state);
    return Number.isFinite(value) ? value : undefined;
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .strip {
        display: flex;
        align-items: baseline;
        gap: var(--ql-space-m, 12px);
      }
      .bolt {
        color: var(--ql-accent-champagne, #b08d57);
        font-size: 16px;
      }
      .value {
        margin: 0;
        font: 300 26px/30px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.01em;
      }
      .caption {
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .ring {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--ql-space-s, 8px);
      }
      svg {
        width: 72px;
        height: 72px;
      }
      circle.track {
        fill: none;
        stroke: var(--ql-surface-border, #e4dccb);
        stroke-width: 4;
      }
      circle.progress {
        fill: none;
        stroke: var(--ql-accent-champagne, #b08d57);
        stroke-width: 4;
        stroke-linecap: round;
      }
      .eyebrow {
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 500 11px/14px var(--ql-font-body, Outfit, sans-serif);
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
    `,
  ];

  protected override render(): TemplateResult {
    const config = this.config;
    if (config === undefined) {
      return html``;
    }
    const locale = this.locale();
    const watts = this.powerWatts();
    const unavailable = this.availability(config.power_entity) !== 'available';
    const cardClass = unavailable ? 'ql-card ql-unavailable' : 'ql-card';
    if (this.form() === 'ring') {
      return html`
        <div class="${cardClass} ring">
          ${config.name === undefined ? nothing : html`<p class="eyebrow">${config.name}</p>`}
          <svg viewBox="0 0 48 48" role="img" aria-label=${config.name ?? config.power_entity}>
            <circle class="track" cx="24" cy="24" r=${RING_RADIUS}></circle>
            <circle
              class="progress"
              cx="24"
              cy="24"
              r=${RING_RADIUS}
              stroke-dasharray=${ringDasharray(
                watts ?? 0,
                config.max_power ?? DEFAULT_RING_MAX_W,
                RING_RADIUS,
              )}
              transform="rotate(-90 24 24)"
            ></circle>
          </svg>
          <p class="value">${formatPower(watts)}</p>
        </div>
      `;
    }
    const today = this.todayKwh();
    return html`
      <div class="${cardClass} strip">
        <span class="bolt" aria-hidden="true">⚡</span>
        <p class="value">${formatPower(watts)}</p>
        ${config.today_entity === undefined
          ? nothing
          : html`<p class="caption">${formatEnergy(today)} · ${t(locale, 'energy.today')}</p>`}
      </div>
    `;
  }
}

registerCard('quiet-luxe-energy-card', QuietLuxeEnergyCard, {
  name: 'Quiet Luxe Energy Card',
  description: 'Live power strip or per-phase ring. History charts via apexcharts-card.',
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/cards/quiet-luxe-energy-card.test.ts src/i18n/i18n.test.ts` then `npm run typecheck`
Expected: PASS (5 energy tests + parity); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/cards/quiet-luxe-energy-card.ts src/cards/quiet-luxe-energy-card.test.ts src/i18n/locales
git commit -m "$(cat <<'EOF'
feat(cards): add quiet-luxe-energy-card (strip/ring)

- Strip: live power numeral + today kWh caption (energy.today, 5 locales)
- Ring: per-phase SVG donut, champagne on border track, clamped dasharray
- form:chart rejected with an apexcharts pointer per plan decision D1

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 7: calendar/todo data helpers

**Files:**
- Create: `src/cards/schedule-data.ts`
- Test: `src/cards/schedule-data.test.ts`

API contracts (verified 2026-08-01, plan D5): REST `GET calendars/<entity_id>?start=<iso>&end=<iso>` returns events whose `start`/`end` carry `dateTime` (timed) or `date` (all-day); WS `{ type: 'todo/item/list', entity_id }` returns `{ items }` with `uid`/`summary`/`status`/`due`; `todo.update_item` takes `{ entity_id, item: <uid>, status }`.

- [ ] **Step 1: Write the failing test**

Create `src/cards/schedule-data.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeMockHass } from '../testing/mock-hass';
import type { HomeAssistant } from '../types/home-assistant';
import {
  AGENDA_DEFAULT_DAYS,
  AGENDA_REFRESH_MS,
  fetchAgenda,
  fetchTodoItems,
  formatAgendaTime,
  isDueSoon,
  updateTodoItem,
  type AgendaItem,
} from './schedule-data';

const START = new Date('2026-08-01T00:00:00.000Z');
const END = new Date('2026-08-08T00:00:00.000Z');

describe('fetchAgenda', () => {
  it('fetches each calendar with iso start/end, merges and sorts', async () => {
    const hass = makeMockHass([], {
      apiResponses: {
        'calendars/calendar.family?start=2026-08-01T00:00:00.000Z&end=2026-08-08T00:00:00.000Z': [
          {
            summary: 'Dentist',
            start: { dateTime: '2026-08-03T09:30:00+08:00' },
            end: { dateTime: '2026-08-03T10:30:00+08:00' },
          },
        ],
        'calendars/calendar.school?start=2026-08-01T00:00:00.000Z&end=2026-08-08T00:00:00.000Z': [
          {
            summary: 'Sports day',
            start: { date: '2026-08-02' },
            end: { date: '2026-08-03' },
          },
        ],
      },
    });
    const agenda = await fetchAgenda(hass, ['calendar.family', 'calendar.school'], START, END);
    expect(agenda.map((item) => item.title)).toEqual(['Sports day', 'Dentist']);
    expect(agenda[0]?.allDay).toBe(true);
    expect(agenda[0]?.calendarId).toBe('calendar.school');
    expect(agenda[1]?.allDay).toBe(false);
    expect(hass.apiCalls).toHaveLength(2);
  });

  it('throws loudly when callApi is unavailable', async () => {
    const bare: HomeAssistant = {
      states: {},
      language: 'en',
      callService: () => Promise.resolve(undefined),
    };
    await expect(fetchAgenda(bare, ['calendar.a'], START, END)).rejects.toThrow(
      'callApi unavailable',
    );
  });
});

describe('fetchTodoItems / updateTodoItem', () => {
  it('lists items over the todo/item/list websocket command', async () => {
    const hass = makeMockHass([], {
      wsResponses: {
        'todo/item/list': {
          items: [{ uid: 'a1', summary: 'Buy milk', status: 'needs_action' }],
        },
      },
    });
    const items = await fetchTodoItems(hass, 'todo.family');
    expect(items).toEqual([{ uid: 'a1', summary: 'Buy milk', status: 'needs_action' }]);
    expect(hass.wsCalls).toEqual([{ type: 'todo/item/list', entity_id: 'todo.family' }]);
  });

  it('throws loudly when callWS is unavailable', async () => {
    const bare: HomeAssistant = {
      states: {},
      language: 'en',
      callService: () => Promise.resolve(undefined),
    };
    await expect(fetchTodoItems(bare, 'todo.family')).rejects.toThrow('callWS unavailable');
  });

  it('updates an item through todo.update_item with uid + status', async () => {
    const hass = makeMockHass();
    await updateTodoItem(hass, 'todo.family', 'a1', true);
    await updateTodoItem(hass, 'todo.family', 'a1', false);
    expect(hass.calls).toEqual([
      {
        domain: 'todo',
        service: 'update_item',
        data: { entity_id: 'todo.family', item: 'a1', status: 'completed' },
      },
      {
        domain: 'todo',
        service: 'update_item',
        data: { entity_id: 'todo.family', item: 'a1', status: 'needs_action' },
      },
    ]);
  });
});

describe('formatAgendaTime', () => {
  const timed: AgendaItem = {
    title: 'Dentist',
    start: new Date(2026, 7, 1, 9, 30),
    allDay: false,
    calendarId: 'calendar.family',
  };
  const allDay: AgendaItem = { ...timed, allDay: true };

  it('formats weekday + 24h time per locale', () => {
    expect(formatAgendaTime(timed, 'en')).toBe('Sat 09:30');
    expect(formatAgendaTime(timed, 'zh-Hant')).toBe('週六 09:30');
  });

  it('localizes all-day events', () => {
    expect(formatAgendaTime(allDay, 'en')).toBe('All day');
    expect(formatAgendaTime(allDay, 'ms')).toBe('Sepanjang hari');
  });
});

describe('isDueSoon', () => {
  const now = new Date(2026, 7, 1, 12, 0);

  it('flags overdue and due-today items, not later ones', () => {
    expect(isDueSoon('2026-07-31', now)).toBe(true);
    expect(isDueSoon('2026-08-01', now)).toBe(true);
    expect(isDueSoon('2026-08-02', now)).toBe(false);
    expect(isDueSoon(undefined, now)).toBe(false);
  });
});

describe('constants', () => {
  it('locks the agenda defaults', () => {
    expect(AGENDA_DEFAULT_DAYS).toBe(7);
    expect(AGENDA_REFRESH_MS).toBe(900000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/cards/schedule-data.test.ts`
Expected: FAIL — module resolve error.

- [ ] **Step 3: Implement**

Create `src/cards/schedule-data.ts`:

```ts
import { t } from '../i18n/translate';
import type { Locale } from '../i18n/types';
import type { HomeAssistant } from '../types/home-assistant';

export const AGENDA_DEFAULT_DAYS = 7;
export const AGENDA_REFRESH_MS = 15 * 60 * 1000;

/** Event shape from GET /api/calendars/<id> (HA REST API, verified 2026-08-01). */
export interface HaCalendarEvent {
  readonly summary: string;
  readonly start: { readonly dateTime?: string; readonly date?: string };
  readonly end: { readonly dateTime?: string; readonly date?: string };
}

export interface AgendaItem {
  readonly title: string;
  readonly start: Date;
  readonly allDay: boolean;
  readonly calendarId: string;
}

/** Item shape from the todo/item/list WS command (HA frontend data/todo.ts). */
export interface HaTodoItem {
  readonly uid: string;
  readonly summary: string;
  readonly status: 'needs_action' | 'completed';
  readonly due?: string;
}

function toAgendaItem(event: HaCalendarEvent, calendarId: string): AgendaItem {
  const allDay = event.start.dateTime === undefined;
  const startIso = event.start.dateTime ?? `${event.start.date ?? ''}T00:00:00`;
  return { title: event.summary, start: new Date(startIso), allDay, calendarId };
}

/**
 * Merged, time-sorted agenda across calendars. Both HA's callApi and the mock
 * are closures, so calling the extracted reference unbound is safe.
 */
export async function fetchAgenda(
  hass: HomeAssistant,
  calendarIds: ReadonlyArray<string>,
  start: Date,
  end: Date,
): Promise<AgendaItem[]> {
  const callApi = hass.callApi;
  if (callApi === undefined) {
    throw new Error('quiet-luxe: hass.callApi unavailable — cannot load calendar events');
  }
  const perCalendar = await Promise.all(
    calendarIds.map(async (calendarId) => {
      const path = `calendars/${calendarId}?start=${start.toISOString()}&end=${end.toISOString()}`;
      const events = await callApi<ReadonlyArray<HaCalendarEvent>>('GET', path);
      return events.map((event) => toAgendaItem(event, calendarId));
    }),
  );
  return perCalendar.flat().sort((a, b) => a.start.getTime() - b.start.getTime());
}

export async function fetchTodoItems(
  hass: HomeAssistant,
  entityId: string,
): Promise<ReadonlyArray<HaTodoItem>> {
  const callWS = hass.callWS;
  if (callWS === undefined) {
    throw new Error('quiet-luxe: hass.callWS unavailable — cannot load to-do items');
  }
  const response = await callWS<{ readonly items: ReadonlyArray<HaTodoItem> }>({
    type: 'todo/item/list',
    entity_id: entityId,
  });
  return response.items;
}

/** todo.update_item with uid + status (verified 2026-08-01, plan D5). */
export function updateTodoItem(
  hass: HomeAssistant,
  entityId: string,
  uid: string,
  completed: boolean,
): Promise<unknown> {
  return hass.callService('todo', 'update_item', {
    entity_id: entityId,
    item: uid,
    status: completed ? 'completed' : 'needs_action',
  });
}

/**
 * Deterministic agenda time: localized short weekday (Intl) + 24h HH:MM.
 * All-day events use the localized schedule.all_day string.
 */
export function formatAgendaTime(item: AgendaItem, locale: Locale): string {
  if (item.allDay) {
    return t(locale, 'schedule.all_day');
  }
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(item.start);
  const hours = String(item.start.getHours()).padStart(2, '0');
  const minutes = String(item.start.getMinutes()).padStart(2, '0');
  return `${weekday} ${hours}:${minutes}`;
}

/** Due highlight rule: overdue or due today (spec §6 "due highlights"). */
export function isDueSoon(due: string | undefined, now: Date = new Date()): boolean {
  if (due === undefined) {
    return false;
  }
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return new Date(due).getTime() < endOfToday.getTime();
}
```

Note: `formatAgendaTime` references `schedule.all_day`, which is added in Task 8 — implement Tasks 7 and 8 Steps 3 together if running strictly sequentially, or add the `schedule.*` keys now and skip that step in Task 8. **Preferred order: add the `schedule.*` key block (Task 8 Step 3) during this task's Step 3, then Task 8 skips it.** The commit below includes the locale files either way.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/cards/schedule-data.test.ts src/i18n/i18n.test.ts` then `npm run typecheck`
Expected: PASS (9 tests + parity); typecheck clean (requires the `schedule.*` keys from Task 8 Step 3 — see note above).

- [ ] **Step 5: Commit**

```bash
git add src/cards/schedule-data.ts src/cards/schedule-data.test.ts src/i18n/locales
git commit -m "$(cat <<'EOF'
feat(cards): add calendar/todo data helpers for schedule surfaces

- fetchAgenda: REST calendars/<id>?start&end per calendar, merged + sorted
- fetchTodoItems via todo/item/list WS; updateTodoItem via todo.update_item
- Deterministic localized agenda time + due-soon rule; schedule.* keys ×5
- Helpers throw loudly when callApi/callWS absent; cards degrade muted

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 8: quiet-luxe-schedule-card (agenda) (+ schedule.* keys)

**Files:**
- Create: `src/cards/quiet-luxe-schedule-card.ts`
- Modify: `src/i18n/locales/*.ts` (×5 — skip if already added in Task 7 Step 3)
- Test: `src/cards/quiet-luxe-schedule-card.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/cards/quiet-luxe-schedule-card.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QlSegmentOption } from '../elements/ql-segmented';
import { makeMockHass, type MockHass } from '../testing/mock-hass';
import { QuietLuxeScheduleCard, type ScheduleCardConfig } from './quiet-luxe-schedule-card';

const CAL_STUB = {
  apiResponses: {
    'calendars/calendar.family': [
      {
        summary: 'Dentist',
        start: { dateTime: '2026-08-03T09:30:00+08:00' },
        end: { dateTime: '2026-08-03T10:30:00+08:00' },
      },
      {
        summary: 'Sports day',
        start: { date: '2026-08-02' },
        end: { date: '2026-08-03' },
      },
    ],
  },
  wsResponses: {
    'todo/item/list': {
      items: [
        { uid: 'a1', summary: 'Buy milk', status: 'needs_action', due: '2026-07-31' },
        { uid: 'a2', summary: 'Done thing', status: 'completed' },
      ],
    },
  },
};

async function mount(
  config: Omit<ScheduleCardConfig, 'type'>,
  hass: MockHass,
): Promise<QuietLuxeScheduleCard> {
  const card = document.createElement('quiet-luxe-schedule-card') as QuietLuxeScheduleCard;
  card.setConfig({ type: 'custom:quiet-luxe-schedule-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  await card.refresh();
  await card.updateComplete;
  return card;
}

describe('quiet-luxe-schedule-card', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is registered and self-hides when no calendar and no todo are configured', async () => {
    expect(customElements.get('quiet-luxe-schedule-card')).toBe(QuietLuxeScheduleCard);
    const card = document.createElement('quiet-luxe-schedule-card') as QuietLuxeScheduleCard;
    card.setConfig({ type: 'custom:quiet-luxe-schedule-card' });
    card.hass = makeMockHass();
    document.body.append(card);
    await card.updateComplete;
    expect(card.getCardSize()).toBe(0);
    expect(card.shadowRoot?.querySelector('.ql-card')).toBeNull();
    card.remove();
  });

  it('renders sorted agenda rows with localized times and marks the first as next', async () => {
    const card = await mount(
      { calendars: ['calendar.family'], todo_entity: 'todo.family' },
      makeMockHass([], CAL_STUB),
    );
    const rows = [...(card.shadowRoot?.querySelectorAll('.event') ?? [])];
    expect(rows.map((row) => row.textContent?.includes('Sports day'))).toEqual([true, false]);
    expect(rows[0]?.classList.contains('next')).toBe(true);
    expect(rows[0]?.textContent).toContain('All day');
    card.remove();
  });

  it('offers agenda enabled and day/week/month disabled with a localized hint', async () => {
    const card = await mount(
      { calendars: ['calendar.family'] },
      makeMockHass([], { ...CAL_STUB, language: 'zh-Hant' }),
    );
    const segmented = card.shadowRoot?.querySelector('ql-segmented') as
      | (HTMLElement & { options: ReadonlyArray<QlSegmentOption>; value: string })
      | null;
    expect(segmented?.value).toBe('agenda');
    expect(segmented?.options.map((o) => o.disabled === true)).toEqual([
      false,
      true,
      true,
      true,
    ]);
    expect(segmented?.options[1]?.hint).toBe('即將推出');
    card.remove();
  });

  it('shows open todo glance rows with due highlight', async () => {
    const card = await mount(
      { calendars: ['calendar.family'], todo_entity: 'todo.family' },
      makeMockHass([], CAL_STUB),
    );
    const tasks = [...(card.shadowRoot?.querySelectorAll('.task') ?? [])];
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.textContent).toContain('Buy milk');
    expect(tasks[0]?.querySelector('.due')).not.toBeNull();
    card.remove();
  });

  it('renders the empty state when the window has no events', async () => {
    const card = await mount(
      { calendars: ['calendar.family'] },
      makeMockHass([], { apiResponses: { 'calendars/calendar.family': [] } }),
    );
    expect(card.shadowRoot?.textContent).toContain('No upcoming events');
    card.remove();
  });

  it('degrades muted with a console error when the calendar API fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const card = await mount({ calendars: ['calendar.family'] }, makeMockHass());
    expect(errorSpy).toHaveBeenCalled();
    expect(card.shadowRoot?.textContent).toContain('Unavailable');
    card.remove();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/cards/quiet-luxe-schedule-card.test.ts`
Expected: FAIL — module resolve error.

- [ ] **Step 3: Add the schedule.* keys (all five locales) — SKIP if done in Task 7**

`en.ts`:

```ts
  'schedule.agenda': 'Agenda',
  'schedule.day': 'Day',
  'schedule.week': 'Week',
  'schedule.month': 'Month',
  'schedule.no_events': 'No upcoming events',
  'schedule.view_soon': 'Coming soon',
  'schedule.all_day': 'All day',
```

`zh-hant.ts`:

```ts
  'schedule.agenda': '議程',
  'schedule.day': '日',
  'schedule.week': '週',
  'schedule.month': '月',
  'schedule.no_events': '沒有即將到來的行程',
  'schedule.view_soon': '即將推出',
  'schedule.all_day': '全天',
```

`zh-hans.ts`:

```ts
  'schedule.agenda': '议程',
  'schedule.day': '日',
  'schedule.week': '周',
  'schedule.month': '月',
  'schedule.no_events': '没有即将到来的日程',
  'schedule.view_soon': '即将推出',
  'schedule.all_day': '全天',
```

`ms.ts`:

```ts
  'schedule.agenda': 'Agenda',
  'schedule.day': 'Hari',
  'schedule.week': 'Minggu',
  'schedule.month': 'Bulan',
  'schedule.no_events': 'Tiada acara akan datang',
  'schedule.view_soon': 'Akan datang',
  'schedule.all_day': 'Sepanjang hari',
```

`id.ts`:

```ts
  'schedule.agenda': 'Agenda',
  'schedule.day': 'Hari',
  'schedule.week': 'Minggu',
  'schedule.month': 'Bulan',
  'schedule.no_events': 'Tidak ada acara mendatang',
  'schedule.view_soon': 'Segera hadir',
  'schedule.all_day': 'Sepanjang hari',
```

- [ ] **Step 4: Implement**

Create `src/cards/quiet-luxe-schedule-card.ts`:

```ts
import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import type { QlSegmentOption } from '../elements/ql-segmented';
import { t } from '../i18n/translate';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';
import {
  AGENDA_DEFAULT_DAYS,
  AGENDA_REFRESH_MS,
  fetchAgenda,
  fetchTodoItems,
  formatAgendaTime,
  isDueSoon,
  type AgendaItem,
  type HaTodoItem,
} from './schedule-data';

export interface ScheduleCardConfig {
  readonly type: string;
  /** Calendar entity ids. Omitted/empty (per-home `calendar: none`) + no todo → renders nothing. */
  readonly calendars?: ReadonlyArray<string>;
  readonly todo_entity?: string;
  /** Agenda window in days. */
  readonly days?: number;
}

/**
 * Schedule card (Figma `card/schedule`), agenda view only — day/week/month
 * are Figma visual targets, surfaced as disabled segments with a localized
 * "coming soon" hint (plan scope). Task rows here are display-only glance
 * rows; quiet-luxe-tasks-card is the interactive surface.
 */
export class QuietLuxeScheduleCard extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
    agenda: { state: true },
    tasks: { state: true },
    loadFailed: { state: true },
  };

  declare config?: ScheduleCardConfig;
  declare agenda: ReadonlyArray<AgendaItem>;
  declare tasks: ReadonlyArray<HaTodoItem>;
  declare loadFailed: boolean;
  private started = false;
  private refreshTimer?: number;

  constructor() {
    super();
    this.agenda = [];
    this.tasks = [];
    this.loadFailed = false;
  }

  setConfig(config: ScheduleCardConfig): void {
    this.config = config;
  }

  hasSources(): boolean {
    return (this.config?.calendars?.length ?? 0) > 0 || this.config?.todo_entity !== undefined;
  }

  getCardSize(): number {
    return this.hasSources() ? 4 : 0;
  }

  getGridOptions(): { rows: number; columns: number } {
    return { rows: 4, columns: 6 };
  }

  protected override willUpdate(): void {
    if (!this.started && this.hass !== undefined && this.config !== undefined && this.hasSources()) {
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
    const calendars = config.calendars ?? [];
    if (calendars.length > 0) {
      try {
        const start = new Date();
        const end = new Date(
          start.getTime() + (config.days ?? AGENDA_DEFAULT_DAYS) * 24 * 60 * 60 * 1000,
        );
        this.agenda = await fetchAgenda(hass, calendars, start, end);
        this.loadFailed = false;
      } catch (error) {
        this.loadFailed = true;
        console.error('quiet-luxe-schedule-card: calendar load failed', error);
      }
    }
    if (config.todo_entity !== undefined) {
      try {
        this.tasks = await fetchTodoItems(hass, config.todo_entity);
      } catch (error) {
        console.error('quiet-luxe-schedule-card: to-do load failed', error);
      }
    }
  }

  private viewOptions(): ReadonlyArray<QlSegmentOption> {
    const locale = this.locale();
    const soon = t(locale, 'schedule.view_soon');
    return [
      { value: 'agenda', label: t(locale, 'schedule.agenda') },
      { value: 'day', label: t(locale, 'schedule.day'), disabled: true, hint: soon },
      { value: 'week', label: t(locale, 'schedule.week'), disabled: true, hint: soon },
      { value: 'month', label: t(locale, 'schedule.month'), disabled: true, hint: soon },
    ];
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ql-space-s, 8px);
        margin-bottom: var(--ql-space-m, 12px);
      }
      .event {
        display: flex;
        gap: var(--ql-space-m, 12px);
        padding: var(--ql-space-s, 8px) 0 var(--ql-space-s, 8px) var(--ql-space-m, 12px);
        border-left: 2px solid var(--ql-surface-border, #e4dccb);
      }
      .event.next {
        border-left-color: var(--ql-accent-champagne, #b08d57);
      }
      .time {
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/20px var(--ql-font-body, Outfit, sans-serif);
        white-space: nowrap;
      }
      .title {
        margin: 0;
        font: 400 14px/20px var(--ql-font-body, Outfit, sans-serif);
      }
      .empty {
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .divider {
        border: 0;
        border-top: 1px solid var(--ql-surface-border, #e4dccb);
        margin: var(--ql-space-m, 12px) 0;
      }
      .task {
        display: flex;
        align-items: baseline;
        gap: var(--ql-space-s, 8px);
        padding: 2px 0;
        font: 400 14px/20px var(--ql-font-body, Outfit, sans-serif);
      }
      .box {
        color: var(--ql-ink-muted, #8c8578);
      }
      .due {
        color: var(--ql-status-warn, #c08552);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
    `,
  ];

  protected override render(): TemplateResult {
    if (this.config === undefined || !this.hasSources()) {
      return html``;
    }
    const locale = this.locale();
    const openTasks = this.tasks.filter((task) => task.status !== 'completed');
    const calendarsConfigured = (this.config.calendars?.length ?? 0) > 0;
    return html`
      <div class="ql-card">
        <div class="head">
          <ql-section-eyebrow label=${t(locale, 'section.schedule')}></ql-section-eyebrow>
          <ql-segmented
            .options=${this.viewOptions()}
            value="agenda"
            label=${t(locale, 'section.schedule')}
          ></ql-segmented>
        </div>
        ${calendarsConfigured
          ? this.loadFailed
            ? html`<p class="empty">${t(locale, 'common.unavailable')}</p>`
            : this.agenda.length === 0
              ? html`<p class="empty">${t(locale, 'schedule.no_events')}</p>`
              : this.agenda.map(
                  (item, index) => html`
                    <div class="event ${index === 0 ? 'next' : ''}">
                      <p class="time">${formatAgendaTime(item, locale)}</p>
                      <p class="title">${item.title}</p>
                    </div>
                  `,
                )
          : nothing}
        ${openTasks.length > 0
          ? html`
              <hr class="divider" />
              ${openTasks.map(
                (task) => html`
                  <div class="task">
                    <span class="box" aria-hidden="true">☐</span>
                    <span>${task.summary}</span>
                    ${isDueSoon(task.due) ? html`<span class="due">${task.due}</span>` : nothing}
                  </div>
                `,
              )}
            `
          : nothing}
      </div>
    `;
  }
}

registerCard('quiet-luxe-schedule-card', QuietLuxeScheduleCard, {
  name: 'Quiet Luxe Schedule Card',
  description: 'Calendar agenda with to-do glance rows. Renders nothing without sources.',
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/cards/quiet-luxe-schedule-card.test.ts src/i18n/i18n.test.ts` then `npm run typecheck`
Expected: PASS (6 schedule tests + parity); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/cards/quiet-luxe-schedule-card.ts src/cards/quiet-luxe-schedule-card.test.ts src/i18n/locales
git commit -m "$(cat <<'EOF'
feat(cards): add quiet-luxe-schedule-card agenda view

- Functional agenda: merged calendars via REST + todo glance rows via WS,
  15-min refresh, bronze next-event rule, localized times
- day/week/month segments present but disabled with localized hint
- calendar:none / no sources → card self-hides (getCardSize 0, empty render)
- API failures log loudly and degrade to a muted line (spec §8)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 9: quiet-luxe-tasks-card (+ tasks.* keys)

**Files:**
- Create: `src/cards/quiet-luxe-tasks-card.ts`
- Modify: `src/i18n/locales/*.ts` (×5)
- Test: `src/cards/quiet-luxe-tasks-card.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/cards/quiet-luxe-tasks-card.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeEntity, makeMockHass, type MockHass } from '../testing/mock-hass';
import { QuietLuxeTasksCard, type TasksCardConfig } from './quiet-luxe-tasks-card';

const WS_STUB = {
  wsResponses: {
    'todo/item/list': {
      items: [
        { uid: 'a1', summary: 'Buy milk', status: 'needs_action', due: '2026-07-31' },
        { uid: 'a2', summary: 'Water plants', status: 'needs_action' },
        { uid: 'a3', summary: 'Done thing', status: 'completed' },
      ],
    },
  },
};

function todoEntity(): ReturnType<typeof makeEntity> {
  return makeEntity('todo.family', '2', { friendly_name: 'Family Tasks' });
}

async function mount(
  config: Omit<TasksCardConfig, 'type'>,
  hass: MockHass,
): Promise<QuietLuxeTasksCard> {
  const card = document.createElement('quiet-luxe-tasks-card') as QuietLuxeTasksCard;
  card.setConfig({ type: 'custom:quiet-luxe-tasks-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  await card.refresh();
  await card.updateComplete;
  return card;
}

describe('quiet-luxe-tasks-card', () => {
  it('is registered and requires an entity', () => {
    expect(customElements.get('quiet-luxe-tasks-card')).toBe(QuietLuxeTasksCard);
    const card = new QuietLuxeTasksCard();
    expect(() => card.setConfig({ type: 'x', entity: '' })).toThrow('"entity" is required');
  });

  it('renders one checkbox row per item and the open-count footer', async () => {
    const card = await mount({ entity: 'todo.family' }, makeMockHass([todoEntity()], WS_STUB));
    const checkboxes = [
      ...(card.shadowRoot?.querySelectorAll<HTMLInputElement>("input[type='checkbox']") ?? []),
    ];
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes.map((box) => box.checked)).toEqual([false, false, true]);
    expect(card.shadowRoot?.textContent).toContain('2 open');
    expect(card.shadowRoot?.querySelector('.due')?.textContent).toContain('2026-07-31');
    card.remove();
  });

  it('localizes the footer', async () => {
    const card = await mount(
      { entity: 'todo.family' },
      makeMockHass([todoEntity()], { ...WS_STUB, language: 'zh-Hant' }),
    );
    expect(card.shadowRoot?.textContent).toContain('2 項未完成');
    card.remove();
  });

  it('checkbox change calls todo.update_item with the item uid', async () => {
    const hass = makeMockHass([todoEntity()], WS_STUB);
    const card = await mount({ entity: 'todo.family' }, hass);
    const first = card.shadowRoot?.querySelector<HTMLInputElement>("input[type='checkbox']");
    if (first === null || first === undefined) {
      throw new Error('checkbox missing');
    }
    first.checked = true;
    first.dispatchEvent(new Event('change'));
    expect(hass.calls).toEqual([
      {
        domain: 'todo',
        service: 'update_item',
        data: { entity_id: 'todo.family', item: 'a1', status: 'completed' },
      },
    ]);
    card.remove();
  });

  it('shows the all-done footer when nothing is open', async () => {
    const card = await mount(
      { entity: 'todo.family' },
      makeMockHass([todoEntity()], {
        wsResponses: {
          'todo/item/list': { items: [{ uid: 'a3', summary: 'Done', status: 'completed' }] },
        },
      }),
    );
    expect(card.shadowRoot?.textContent).toContain('All done');
    card.remove();
  });

  it('unavailable todo entity renders muted without rows', async () => {
    const card = await mount(
      { entity: 'todo.family' },
      makeMockHass([makeEntity('todo.family', 'unavailable')], WS_STUB),
    );
    expect(card.shadowRoot?.querySelector('.ql-unavailable')).not.toBeNull();
    expect(card.shadowRoot?.querySelectorAll("input[type='checkbox']")).toHaveLength(0);
    card.remove();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/cards/quiet-luxe-tasks-card.test.ts`
Expected: FAIL — module resolve error.

- [ ] **Step 3: Add the tasks.* keys (all five locales)**

`en.ts`: `'tasks.open': 'open',` and `'tasks.all_done': 'All done',`
`zh-hant.ts`: `'tasks.open': '項未完成',` and `'tasks.all_done': '全部完成',`
`zh-hans.ts`: `'tasks.open': '项未完成',` and `'tasks.all_done': '全部完成',`
`ms.ts`: `'tasks.open': 'belum selesai',` and `'tasks.all_done': 'Semua selesai',`
`id.ts`: `'tasks.open': 'belum selesai',` and `'tasks.all_done': 'Semua selesai',`

(The footer is composed as `` `${count} ${t('tasks.open')}` `` — count-prefix order holds across all five locales.)

- [ ] **Step 4: Implement**

Create `src/cards/quiet-luxe-tasks-card.ts`:

```ts
import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
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

  protected override willUpdate(): void {
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
    const name =
      config.name ??
      (this.entity(config.entity)?.attributes.friendly_name as string | undefined) ??
      config.entity;
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/cards/quiet-luxe-tasks-card.test.ts src/i18n/i18n.test.ts` then `npm run typecheck`
Expected: PASS (6 tasks tests + parity); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/cards/quiet-luxe-tasks-card.ts src/cards/quiet-luxe-tasks-card.test.ts src/i18n/locales
git commit -m "$(cat <<'EOF'
feat(cards): add quiet-luxe-tasks-card with todo.update_item checkboxes

- Items via todo/item/list WS, refresh after each toggle
- Due highlight for overdue/today items; "N open" / all-done footer ×5 locales
- Unavailable todo entity renders muted without rows

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 10: car silhouettes + quiet-luxe-car-card (+ car.*/common.battery keys)

**Files:**
- Create: `src/cards/car-silhouettes.ts`, `src/cards/quiet-luxe-car-card.ts`
- Modify: `src/i18n/locales/*.ts` (×5)
- Test: `src/cards/car-silhouettes.test.ts`, `src/cards/quiet-luxe-car-card.test.ts`

Semantics note: for a `binary_sensor` with `device_class: lock`, HA defines `on` = **unlocked/open**, `off` = **locked** (stable HA binary_sensor contract).

- [ ] **Step 1: Write the failing tests**

Create `src/cards/car-silhouettes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CAR_BODY_PATHS, CAR_VIEWBOX, CAR_WHEELS, type CarBrand } from './car-silhouettes';

const BRANDS: ReadonlyArray<CarBrand> = ['bmw', 'audi', 'liauto'];

describe('car silhouettes', () => {
  it('provides a closed path and two wheels per brand in the shared viewBox', () => {
    expect(CAR_VIEWBOX).toBe('0 0 240 84');
    for (const brand of BRANDS) {
      expect(CAR_BODY_PATHS[brand].startsWith('M')).toBe(true);
      expect(CAR_BODY_PATHS[brand].endsWith('Z')).toBe(true);
      expect(CAR_WHEELS[brand]).toHaveLength(2);
    }
  });

  it('keeps the three silhouettes distinct', () => {
    expect(new Set(BRANDS.map((brand) => CAR_BODY_PATHS[brand])).size).toBe(3);
  });
});
```

Create `src/cards/quiet-luxe-car-card.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeEntity, makeMockHass, sensorEntity, type MockHass } from '../testing/mock-hass';
import { CAR_BODY_PATHS } from './car-silhouettes';
import { CONFIRM_TIMEOUT_MS } from './quiet-luxe-climate-card';
import { QuietLuxeCarCard, type CarCardConfig } from './quiet-luxe-car-card';

function carEntities(): ReturnType<typeof makeEntity>[] {
  return [
    sensorEntity('sensor.car_battery', '76'),
    sensorEntity('sensor.car_fuel', '55'),
    sensorEntity('sensor.car_range', '412', { unit_of_measurement: 'km' }),
    makeEntity('binary_sensor.car_lock', 'off', { device_class: 'lock' }),
    makeEntity('switch.car_precondition', 'off'),
    sensorEntity('sensor.car_location', 'Subang Jaya'),
  ];
}

const FULL_CONFIG: Omit<CarCardConfig, 'type'> = {
  brand: 'liauto',
  name: 'Li Auto L7',
  battery_entity: 'sensor.car_battery',
  fuel_entity: 'sensor.car_fuel',
  range_entity: 'sensor.car_range',
  lock_entity: 'binary_sensor.car_lock',
  precondition_entity: 'switch.car_precondition',
  location_entity: 'sensor.car_location',
};

async function mount(
  config: Omit<CarCardConfig, 'type'>,
  hass: MockHass,
): Promise<QuietLuxeCarCard> {
  const card = document.createElement('quiet-luxe-car-card') as QuietLuxeCarCard;
  card.setConfig({ type: 'custom:quiet-luxe-car-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

describe('quiet-luxe-car-card', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is registered and validates brand', () => {
    expect(customElements.get('quiet-luxe-car-card')).toBe(QuietLuxeCarCard);
    const card = new QuietLuxeCarCard();
    expect(() =>
      card.setConfig({ type: 'x', brand: 'tesla' as unknown as 'bmw' }),
    ).toThrow('brand must be one of');
  });

  it('renders the brand silhouette in ink via currentColor', async () => {
    const card = await mount(FULL_CONFIG, makeMockHass(carEntities()));
    const path = card.shadowRoot?.querySelector('svg.hero path');
    expect(path?.getAttribute('d')).toBe(CAR_BODY_PATHS.liauto);
    expect(path?.getAttribute('fill')).toBe('currentColor');
    expect(card.shadowRoot?.querySelectorAll('svg.hero circle')).toHaveLength(2);
    card.remove();
  });

  it('renders battery, fuel, range with units and localized labels', async () => {
    const card = await mount(FULL_CONFIG, makeMockHass(carEntities()));
    const text = card.shadowRoot?.textContent ?? '';
    expect(text).toContain('76%');
    expect(text).toContain('55%');
    expect(text).toContain('412 km');
    expect(text).toContain('Battery');
    expect(text).toContain('Fuel');
    expect(text).toContain('Range');
    expect(text).toContain('Subang Jaya');
    card.remove();
  });

  it('maps binary_sensor lock semantics (off = locked)', async () => {
    const locked = await mount(FULL_CONFIG, makeMockHass(carEntities()));
    expect(locked.shadowRoot?.textContent).toContain('Locked');
    locked.remove();
    const entities = carEntities().map((entity) =>
      entity.entity_id === 'binary_sensor.car_lock' ? { ...entity, state: 'on' } : entity,
    );
    const unlocked = await mount(FULL_CONFIG, makeMockHass(entities, 'zh-Hant'));
    expect(unlocked.shadowRoot?.textContent).toContain('未上鎖');
    unlocked.remove();
  });

  it('precondition toggle arms first, then toggles the switch on confirm', async () => {
    const hass = makeMockHass(carEntities());
    const card = await mount(FULL_CONFIG, hass);
    const toggle = card.shadowRoot?.querySelector('ql-toggle');
    const change = (): boolean | undefined =>
      toggle?.dispatchEvent(
        new CustomEvent('ql-change', { detail: { checked: true }, bubbles: true, composed: true }),
      );
    change();
    await card.updateComplete;
    expect(hass.calls).toEqual([]);
    expect(card.shadowRoot?.textContent).toContain('Tap again to confirm');
    change();
    expect(hass.calls).toEqual([
      { domain: 'switch', service: 'toggle', data: { entity_id: 'switch.car_precondition' } },
    ]);
    card.remove();
  });

  it('disarms after the confirm timeout', async () => {
    const hass = makeMockHass(carEntities());
    const card = await mount(FULL_CONFIG, hass);
    card.shadowRoot
      ?.querySelector('ql-toggle')
      ?.dispatchEvent(
        new CustomEvent('ql-change', { detail: { checked: true }, bubbles: true, composed: true }),
      );
    vi.advanceTimersByTime(CONFIRM_TIMEOUT_MS);
    await card.updateComplete;
    expect(card.shadowRoot?.textContent).not.toContain('Tap again to confirm');
    expect(hass.calls).toEqual([]);
    card.remove();
  });

  it('omits unconfigured stats and placeholders unavailable ones', async () => {
    const minimal = await mount(
      { brand: 'bmw', battery_entity: 'sensor.car_battery' },
      makeMockHass([sensorEntity('sensor.car_battery', 'unavailable')]),
    );
    const text = minimal.shadowRoot?.textContent ?? '';
    expect(text).toContain('—');
    expect(text).not.toContain('Fuel');
    expect(text).not.toContain('Range');
    expect(minimal.shadowRoot?.querySelector('ql-toggle')).toBeNull();
    minimal.remove();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/cards/car-silhouettes.test.ts src/cards/quiet-luxe-car-card.test.ts`
Expected: FAIL — module resolve errors.

- [ ] **Step 3: Add the car.* and common.battery keys (all five locales)**

`en.ts`:

```ts
  'common.battery': 'Battery',
  'car.locked': 'Locked',
  'car.unlocked': 'Unlocked',
  'car.precondition': 'Precondition',
  'car.range': 'Range',
  'car.fuel': 'Fuel',
  'car.location': 'Location',
```

`zh-hant.ts`:

```ts
  'common.battery': '電量',
  'car.locked': '已上鎖',
  'car.unlocked': '未上鎖',
  'car.precondition': '預先調溫',
  'car.range': '續航',
  'car.fuel': '油量',
  'car.location': '位置',
```

`zh-hans.ts`:

```ts
  'common.battery': '电量',
  'car.locked': '已上锁',
  'car.unlocked': '未上锁',
  'car.precondition': '预先调温',
  'car.range': '续航',
  'car.fuel': '油量',
  'car.location': '位置',
```

`ms.ts`:

```ts
  'common.battery': 'Bateri',
  'car.locked': 'Berkunci',
  'car.unlocked': 'Tidak berkunci',
  'car.precondition': 'Prapenyaman',
  'car.range': 'Jarak',
  'car.fuel': 'Bahan api',
  'car.location': 'Lokasi',
```

`id.ts`:

```ts
  'common.battery': 'Baterai',
  'car.locked': 'Terkunci',
  'car.unlocked': 'Tidak terkunci',
  'car.precondition': 'Prakondisi',
  'car.range': 'Jangkauan',
  'car.fuel': 'Bahan bakar',
  'car.location': 'Lokasi',
```

- [ ] **Step 4: Implement the silhouettes module**

Create `src/cards/car-silhouettes.ts`:

```ts
export type CarBrand = 'bmw' | 'audi' | 'liauto';

export const CAR_VIEWBOX = '0 0 240 84';

export interface CarWheel {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

/**
 * Hand-drawn side-profile silhouettes (Figma `card/car` cutout heroes),
 * ink-colored via currentColor. Left = front. Wheel arches are upward
 * semicircular arcs; wheels are solid circles beneath them.
 * bmw = low sedan, audi = sloped sportback, liauto = tall L7-style SUV.
 */
export const CAR_BODY_PATHS: Readonly<Record<CarBrand, string>> = {
  bmw: 'M16 63 C11 63 8 59 9 54 C10 47 18 44 30 42 L48 39 C62 27 80 21 102 21 L126 21 C148 21 164 27 178 38 L206 42 C221 45 231 49 231 56 C231 61 227 63 222 63 L204 63 A15 15 0 0 1 174 63 L84 63 A15 15 0 0 1 54 63 Z',
  audi: 'M16 63 C11 63 8 59 9 54 C10 47 18 44 32 42 L52 39 C66 26 86 20 106 20 L120 20 C146 20 168 29 184 41 L208 45 C222 47 231 51 231 57 C231 61 227 63 222 63 L204 63 A15 15 0 0 1 174 63 L84 63 A15 15 0 0 1 54 63 Z',
  liauto:
    'M14 64 C9 64 7 60 8 55 C9 48 16 45 28 43 L40 40 C50 24 68 16 94 15 L140 15 C164 15 180 23 194 37 L212 43 C225 46 232 50 232 57 C232 62 228 64 223 64 L205 64 A16 16 0 0 1 173 64 L85 64 A16 16 0 0 1 53 64 Z',
};

export const CAR_WHEELS: Readonly<Record<CarBrand, ReadonlyArray<CarWheel>>> = {
  bmw: [
    { cx: 69, cy: 63, r: 10 },
    { cx: 189, cy: 63, r: 10 },
  ],
  audi: [
    { cx: 69, cy: 63, r: 10 },
    { cx: 189, cy: 63, r: 10 },
  ],
  liauto: [
    { cx: 69, cy: 64, r: 11 },
    { cx: 189, cy: 64, r: 11 },
  ],
};
```

- [ ] **Step 5: Implement the card**

Create `src/cards/quiet-luxe-car-card.ts`:

```ts
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
import { t } from '../i18n/translate';
import { CAR_BODY_PATHS, CAR_VIEWBOX, CAR_WHEELS, type CarBrand } from './car-silhouettes';
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

  getGridOptions(): { rows: number; columns: number } {
    return { rows: 3, columns: 6 };
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
        <p class="eyebrow">${name}</p>
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
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/cards/car-silhouettes.test.ts src/cards/quiet-luxe-car-card.test.ts src/i18n/i18n.test.ts` then `npm run typecheck`
Expected: PASS (2 + 7 + parity); typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src/cards/car-silhouettes.ts src/cards/car-silhouettes.test.ts src/cards/quiet-luxe-car-card.ts src/cards/quiet-luxe-car-card.test.ts src/i18n/locales
git commit -m "$(cat <<'EOF'
feat(cards): add quiet-luxe-car-card with per-brand SVG silhouettes

- Inline ink-colored silhouettes (bmw sedan / audi sportback / liauto SUV)
- Battery/fuel/range stats, lock semantics (binary_sensor off=locked),
  confirm-armed precondition toggle (live()-bound), location caption
- car.* + common.battery keys in all five locales

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 11: quiet-luxe-vacuum-card (+ vacuum.* keys)

**Files:**
- Create: `src/cards/quiet-luxe-vacuum-card.ts`
- Modify: `src/i18n/locales/*.ts` (×5)
- Test: `src/cards/quiet-luxe-vacuum-card.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/cards/quiet-luxe-vacuum-card.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeEntity, makeMockHass, type MockHass } from '../testing/mock-hass';
import {
  DEFAULT_ROOM_COMMAND,
  QuietLuxeVacuumCard,
  type VacuumCardConfig,
} from './quiet-luxe-vacuum-card';

function vacuumEntity(state = 'cleaning'): ReturnType<typeof makeEntity> {
  return makeEntity('vacuum.robot', state, { friendly_name: 'Robot', battery_level: 76 });
}

const ROOMS_CONFIG: Omit<VacuumCardConfig, 'type'> = {
  entity: 'vacuum.robot',
  rooms: [
    { name: 'Living', params: { segments: [3] } },
    { name: 'Kitchen', command: 'app_zoned_clean', params: { zones: [[1, 2, 3, 4]] } },
  ],
};

async function mount(
  config: Omit<VacuumCardConfig, 'type'>,
  hass: MockHass,
): Promise<QuietLuxeVacuumCard> {
  const card = document.createElement('quiet-luxe-vacuum-card') as QuietLuxeVacuumCard;
  card.setConfig({ type: 'custom:quiet-luxe-vacuum-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

describe('quiet-luxe-vacuum-card', () => {
  it('is registered and requires an entity', () => {
    expect(customElements.get('quiet-luxe-vacuum-card')).toBe(QuietLuxeVacuumCard);
    const card = new QuietLuxeVacuumCard();
    expect(() => card.setConfig({ type: 'x', entity: '' })).toThrow('"entity" is required');
  });

  it('localizes the known vacuum states', async () => {
    const cases: ReadonlyArray<[string, string]> = [
      ['docked', 'Docked'],
      ['cleaning', 'Cleaning'],
      ['returning', 'Returning'],
      ['paused', 'Paused'],
      ['error', 'Error'],
      ['idle', 'Idle'],
    ];
    for (const [state, label] of cases) {
      const card = await mount({ entity: 'vacuum.robot' }, makeMockHass([vacuumEntity(state)]));
      expect(card.shadowRoot?.textContent).toContain(label);
      card.remove();
    }
    const zh = await mount(
      { entity: 'vacuum.robot' },
      makeMockHass([vacuumEntity('cleaning')], 'zh-Hant'),
    );
    expect(zh.shadowRoot?.textContent).toContain('清掃中');
    zh.remove();
  });

  it('shows battery with the localized label', async () => {
    const card = await mount({ entity: 'vacuum.robot' }, makeMockHass([vacuumEntity()]));
    expect(card.shadowRoot?.textContent).toContain('76%');
    expect(card.shadowRoot?.textContent).toContain('Battery');
    card.remove();
  });

  it('room chips send config-driven vacuum.send_command payloads', async () => {
    const hass = makeMockHass([vacuumEntity('docked')]);
    const card = await mount(ROOMS_CONFIG, hass);
    const chips = [...(card.shadowRoot?.querySelectorAll('ql-chip') ?? [])];
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(['Living', 'Kitchen']);
    (chips[0] as HTMLElement).click();
    (chips[1] as HTMLElement).click();
    expect(DEFAULT_ROOM_COMMAND).toBe('app_segment_clean');
    expect(hass.calls).toEqual([
      {
        domain: 'vacuum',
        service: 'send_command',
        data: {
          entity_id: 'vacuum.robot',
          command: 'app_segment_clean',
          params: { segments: [3] },
        },
      },
      {
        domain: 'vacuum',
        service: 'send_command',
        data: {
          entity_id: 'vacuum.robot',
          command: 'app_zoned_clean',
          params: { zones: [[1, 2, 3, 4]] },
        },
      },
    ]);
    card.remove();
  });

  it('unavailable vacuum renders muted with no chips', async () => {
    const card = await mount(
      ROOMS_CONFIG,
      makeMockHass([makeEntity('vacuum.robot', 'unavailable')]),
    );
    expect(card.shadowRoot?.querySelector('.ql-unavailable')).not.toBeNull();
    expect(card.shadowRoot?.querySelectorAll('ql-chip')).toHaveLength(0);
    expect(card.shadowRoot?.textContent).toContain('Unavailable');
    card.remove();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/cards/quiet-luxe-vacuum-card.test.ts`
Expected: FAIL — module resolve error.

- [ ] **Step 3: Add the vacuum.* keys (all five locales)**

`en.ts`:

```ts
  'vacuum.docked': 'Docked',
  'vacuum.cleaning': 'Cleaning',
  'vacuum.returning': 'Returning',
  'vacuum.paused': 'Paused',
  'vacuum.error': 'Error',
  'vacuum.rooms': 'Rooms',
```

`zh-hant.ts`:

```ts
  'vacuum.docked': '已回充電座',
  'vacuum.cleaning': '清掃中',
  'vacuum.returning': '返回中',
  'vacuum.paused': '已暫停',
  'vacuum.error': '錯誤',
  'vacuum.rooms': '房間',
```

`zh-hans.ts`:

```ts
  'vacuum.docked': '已回充电座',
  'vacuum.cleaning': '清扫中',
  'vacuum.returning': '返回中',
  'vacuum.paused': '已暂停',
  'vacuum.error': '错误',
  'vacuum.rooms': '房间',
```

`ms.ts`:

```ts
  'vacuum.docked': 'Di dok',
  'vacuum.cleaning': 'Sedang membersihkan',
  'vacuum.returning': 'Kembali ke dok',
  'vacuum.paused': 'Dijeda',
  'vacuum.error': 'Ralat',
  'vacuum.rooms': 'Bilik',
```

`id.ts`:

```ts
  'vacuum.docked': 'Di dok',
  'vacuum.cleaning': 'Sedang membersihkan',
  'vacuum.returning': 'Kembali ke dok',
  'vacuum.paused': 'Dijeda',
  'vacuum.error': 'Kesalahan',
  'vacuum.rooms': 'Ruangan',
```

- [ ] **Step 4: Implement**

Create `src/cards/quiet-luxe-vacuum-card.ts`:

```ts
import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import type { TranslationKey } from '../i18n/locales/en';
import { t } from '../i18n/translate';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';

export const DEFAULT_ROOM_COMMAND = 'app_segment_clean';

export interface VacuumRoomConfig {
  readonly name: string;
  /** vacuum.send_command command; defaults to app_segment_clean. */
  readonly command?: string;
  /** Vendor-specific payload, passed through verbatim (config-driven). */
  readonly params?: unknown;
}

export interface VacuumCardConfig {
  readonly type: string;
  readonly entity: string;
  readonly name?: string;
  readonly rooms?: ReadonlyArray<VacuumRoomConfig>;
}

const STATE_KEYS: Readonly<Record<string, TranslationKey>> = {
  docked: 'vacuum.docked',
  cleaning: 'vacuum.cleaning',
  returning: 'vacuum.returning',
  paused: 'vacuum.paused',
  error: 'vacuum.error',
  idle: 'state.idle',
};

/**
 * Vacuum card (Figma `card/vacuum`, state=docked|cleaning|returning):
 * localized state line, battery, and config-driven room-clean chips that
 * call vacuum.send_command with per-room command/params payloads.
 */
export class QuietLuxeVacuumCard extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
  };

  declare config?: VacuumCardConfig;

  setConfig(config: VacuumCardConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('quiet-luxe-vacuum-card: "entity" is required');
    }
    this.config = config;
  }

  getCardSize(): number {
    return 2;
  }

  getGridOptions(): { rows: number; columns: number } {
    return { rows: 2, columns: 4 };
  }

  private onRoomTap(room: VacuumRoomConfig): void {
    const entityId = this.config?.entity;
    if (entityId === undefined || this.hass === undefined) {
      return;
    }
    const data: Record<string, unknown> = {
      entity_id: entityId,
      command: room.command ?? DEFAULT_ROOM_COMMAND,
    };
    if (room.params !== undefined) {
      data.params = room.params;
    }
    void this.hass.callService('vacuum', 'send_command', data);
  }

  private statusLine(): { text: string; cls: string } {
    const locale = this.locale();
    const entityId = this.config?.entity ?? '';
    if (this.availability(entityId) !== 'available') {
      return { text: t(locale, 'common.unavailable'), cls: 'muted' };
    }
    const state = this.entity(entityId)?.state ?? '';
    const key = STATE_KEYS[state];
    if (key === undefined) {
      return { text: '—', cls: 'muted' };
    }
    if (state === 'cleaning' || state === 'returning') {
      return { text: t(locale, key), cls: 'accent' };
    }
    if (state === 'error') {
      return { text: t(locale, key), cls: 'warn' };
    }
    return { text: t(locale, key), cls: 'muted' };
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
      .row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--ql-space-s, 8px);
        margin-top: var(--ql-space-s, 8px);
      }
      .status {
        margin: 0;
        font: 400 14px/20px var(--ql-font-body, Outfit, sans-serif);
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
      .battery {
        margin: 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ql-space-s, 8px);
        margin-top: var(--ql-space-m, 12px);
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
    const entity = this.entity(config.entity);
    const name =
      config.name ?? (entity?.attributes.friendly_name as string | undefined) ?? config.entity;
    const status = this.statusLine();
    const battery = Number(entity?.attributes.battery_level);
    const rooms = config.rooms ?? [];
    return html`
      <div class="ql-card ${availability === 'available' ? '' : 'ql-unavailable'}">
        <p class="eyebrow">${name}</p>
        <div class="row">
          <p class="status ${status.cls}">${status.text}</p>
          ${Number.isFinite(battery)
            ? html`<p class="battery">
                ${Math.round(battery)}% · ${t(locale, 'common.battery')}
              </p>`
            : nothing}
        </div>
        ${rooms.length > 0 && availability === 'available'
          ? html`
              <div class="chips" role="group" aria-label=${t(locale, 'vacuum.rooms')}>
                ${rooms.map(
                  (room) => html`
                    <ql-chip
                      variant="scene"
                      emphasis="secondary"
                      @click=${(): void => this.onRoomTap(room)}
                      >${room.name}</ql-chip
                    >
                  `,
                )}
              </div>
            `
          : nothing}
      </div>
    `;
  }
}

registerCard('quiet-luxe-vacuum-card', QuietLuxeVacuumCard, {
  name: 'Quiet Luxe Vacuum Card',
  description: 'Vacuum state, battery, and config-driven room cleaning chips.',
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/cards/quiet-luxe-vacuum-card.test.ts src/i18n/i18n.test.ts` then `npm run typecheck`
Expected: PASS (5 vacuum tests + parity); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/cards/quiet-luxe-vacuum-card.ts src/cards/quiet-luxe-vacuum-card.test.ts src/i18n/locales
git commit -m "$(cat <<'EOF'
feat(cards): add quiet-luxe-vacuum-card with room-clean chips

- Localized docked/cleaning/returning/paused/error/idle states ×5 locales
- Battery from battery_level; chips send vacuum.send_command with
  config-driven command/params payloads (segment/zoned cleaning)
- Unavailable renders muted, chips withheld

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 12: ql-row-presence + ql-row-door-motion (+ presence/door/motion keys)

**Files:**
- Create: `src/cards/ql-row-presence.ts`, `src/cards/ql-row-door-motion.ts`
- Modify: `src/i18n/locales/*.ts` (×5)
- Test: `src/cards/ql-row-presence.test.ts`, `src/cards/ql-row-door-motion.test.ts`

Both rows follow plan D6: `QlBaseCard` subclasses registered via `customElements.define` only (no picker entry).

- [ ] **Step 1: Write the failing tests**

Create `src/cards/ql-row-presence.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeEntity, makeMockHass, type MockHass } from '../testing/mock-hass';
import { QlRowPresence, type PresenceRowConfig } from './ql-row-presence';

function people(): ReturnType<typeof makeEntity>[] {
  return [
    makeEntity('person.steven', 'home', { friendly_name: 'Steven' }),
    makeEntity('person.mei', 'not_home', {
      friendly_name: 'Mei',
      entity_picture: '/api/image/serve/mei/512x512',
    }),
  ];
}

async function mount(
  config: Omit<PresenceRowConfig, 'type'>,
  hass: MockHass,
): Promise<QlRowPresence> {
  const row = document.createElement('ql-row-presence') as QlRowPresence;
  row.setConfig({ type: 'custom:ql-row-presence', ...config });
  row.hass = hass;
  document.body.append(row);
  await row.updateComplete;
  return row;
}

describe('ql-row-presence', () => {
  it('is registered without a customCards picker entry', () => {
    expect(customElements.get('ql-row-presence')).toBe(QlRowPresence);
    expect((window.customCards ?? []).some((c) => c.type === 'ql-row-presence')).toBe(false);
  });

  it('requires a non-empty entities list', () => {
    const row = new QlRowPresence();
    expect(() => row.setConfig({ type: 'x', entities: [] })).toThrow('"entities" is required');
  });

  it('renders picture avatars when available and initials otherwise', async () => {
    const row = await mount({ entities: ['person.steven', 'person.mei'] }, makeMockHass(people()));
    expect(row.shadowRoot?.querySelector('.initial')?.textContent?.trim()).toBe('S');
    expect(row.shadowRoot?.querySelector('img.avatar')?.getAttribute('src')).toBe(
      '/api/image/serve/mei/512x512',
    );
    row.remove();
  });

  it('localizes home/away states and accents who is home', async () => {
    const row = await mount(
      { entities: ['person.steven', 'person.mei'] },
      makeMockHass(people(), 'zh-Hant'),
    );
    const persons = [...(row.shadowRoot?.querySelectorAll('.person') ?? [])];
    expect(persons[0]?.textContent).toContain('在家');
    expect(persons[0]?.classList.contains('away')).toBe(false);
    expect(persons[1]?.textContent).toContain('外出');
    expect(persons[1]?.classList.contains('away')).toBe(true);
    row.remove();
  });

  it('shows offline for unavailable person entities', async () => {
    const row = await mount(
      { entities: ['person.steven'] },
      makeMockHass([makeEntity('person.steven', 'unavailable', { friendly_name: 'Steven' })]),
    );
    expect(row.shadowRoot?.textContent).toContain('Offline');
    row.remove();
  });
});
```

Create `src/cards/ql-row-door-motion.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeEntity, makeMockHass, type MockHass } from '../testing/mock-hass';
import { QlRowDoorMotion, type DoorMotionRowConfig } from './ql-row-door-motion';

async function mount(
  config: Omit<DoorMotionRowConfig, 'type'>,
  hass: MockHass,
): Promise<QlRowDoorMotion> {
  const row = document.createElement('ql-row-door-motion') as QlRowDoorMotion;
  row.setConfig({ type: 'custom:ql-row-door-motion', ...config });
  row.hass = hass;
  document.body.append(row);
  await row.updateComplete;
  return row;
}

describe('ql-row-door-motion', () => {
  it('is registered without a picker entry and requires an entity', () => {
    expect(customElements.get('ql-row-door-motion')).toBe(QlRowDoorMotion);
    expect((window.customCards ?? []).some((c) => c.type === 'ql-row-door-motion')).toBe(false);
    const row = new QlRowDoorMotion();
    expect(() => row.setConfig({ type: 'x', entity: '' })).toThrow('"entity" is required');
  });

  it('renders door open/closed from state with status dots', async () => {
    const open = await mount(
      { entity: 'binary_sensor.front_door' },
      makeMockHass([
        makeEntity('binary_sensor.front_door', 'on', {
          friendly_name: 'Front Door',
          device_class: 'door',
        }),
      ]),
    );
    expect(open.shadowRoot?.textContent).toContain('Open');
    expect(open.shadowRoot?.querySelector('ql-status-dot')?.getAttribute('status')).toBe('warn');
    open.remove();
    const closed = await mount(
      { entity: 'binary_sensor.front_door' },
      makeMockHass(
        [
          makeEntity('binary_sensor.front_door', 'off', {
            friendly_name: 'Front Door',
            device_class: 'door',
          }),
        ],
        'zh-Hant',
      ),
    );
    expect(closed.shadowRoot?.textContent).toContain('已關');
    expect(closed.shadowRoot?.querySelector('ql-status-dot')?.getAttribute('status')).toBe('good');
    closed.remove();
  });

  it('detects motion kind from device_class and localizes detected/clear', async () => {
    const row = await mount(
      { entity: 'binary_sensor.hall_motion' },
      makeMockHass([
        makeEntity('binary_sensor.hall_motion', 'on', {
          friendly_name: 'Hall Motion',
          device_class: 'motion',
        }),
      ]),
    );
    expect(row.shadowRoot?.textContent).toContain('Motion');
    row.remove();
  });

  it('shows the detection toggle only when configured and calls the toggle service', async () => {
    const hass = makeMockHass([
      makeEntity('binary_sensor.hall_motion', 'off', { device_class: 'motion' }),
      makeEntity('switch.hall_motion_detection', 'on'),
    ]);
    const bare = await mount({ entity: 'binary_sensor.hall_motion' }, hass);
    expect(bare.shadowRoot?.querySelector('ql-toggle')).toBeNull();
    bare.remove();
    const withToggle = await mount(
      {
        entity: 'binary_sensor.hall_motion',
        toggle_entity: 'switch.hall_motion_detection',
        show_toggle: true,
      },
      hass,
    );
    const toggle = withToggle.shadowRoot?.querySelector('ql-toggle');
    expect(toggle).not.toBeNull();
    toggle?.dispatchEvent(
      new CustomEvent('ql-change', { detail: { checked: false }, bubbles: true, composed: true }),
    );
    expect(hass.calls).toEqual([
      { domain: 'switch', service: 'toggle', data: { entity_id: 'switch.hall_motion_detection' } },
    ]);
    withToggle.remove();
  });

  it('unavailable sensor renders muted with a neutral dot', async () => {
    const row = await mount(
      { entity: 'binary_sensor.front_door' },
      makeMockHass([makeEntity('binary_sensor.front_door', 'unavailable')]),
    );
    expect(row.shadowRoot?.querySelector('.ql-unavailable')).not.toBeNull();
    expect(row.shadowRoot?.querySelector('ql-status-dot')?.getAttribute('status')).toBe('neutral');
    row.remove();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/cards/ql-row-presence.test.ts src/cards/ql-row-door-motion.test.ts`
Expected: FAIL — module resolve errors.

- [ ] **Step 3: Add the presence/door/motion keys (all five locales)**

`en.ts`:

```ts
  'presence.home': 'Home',
  'presence.away': 'Away',
  'door.open': 'Open',
  'door.closed': 'Closed',
  'motion.detected': 'Motion',
  'motion.clear': 'Clear',
  'motion.toggle_label': 'Motion detection',
```

`zh-hant.ts`:

```ts
  'presence.home': '在家',
  'presence.away': '外出',
  'door.open': '已開',
  'door.closed': '已關',
  'motion.detected': '偵測到動靜',
  'motion.clear': '無動靜',
  'motion.toggle_label': '動態偵測',
```

`zh-hans.ts`:

```ts
  'presence.home': '在家',
  'presence.away': '外出',
  'door.open': '已开',
  'door.closed': '已关',
  'motion.detected': '侦测到动静',
  'motion.clear': '无动静',
  'motion.toggle_label': '移动侦测',
```

`ms.ts`:

```ts
  'presence.home': 'Di rumah',
  'presence.away': 'Keluar',
  'door.open': 'Terbuka',
  'door.closed': 'Tertutup',
  'motion.detected': 'Pergerakan dikesan',
  'motion.clear': 'Tiada pergerakan',
  'motion.toggle_label': 'Pengesanan pergerakan',
```

`id.ts`:

```ts
  'presence.home': 'Di rumah',
  'presence.away': 'Keluar',
  'door.open': 'Terbuka',
  'door.closed': 'Tertutup',
  'motion.detected': 'Gerakan terdeteksi',
  'motion.clear': 'Tidak ada gerakan',
  'motion.toggle_label': 'Deteksi gerakan',
```

- [ ] **Step 4: Implement ql-row-presence**

Create `src/cards/ql-row-presence.ts`:

```ts
import {
  css,
  html,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import { t } from '../i18n/translate';
import type { HassEntity } from '../types/home-assistant';
import { QlBaseCard } from './ql-base-card';

export interface PresenceRowConfig {
  readonly type: string;
  /** person.* entity ids. */
  readonly entities: ReadonlyArray<string>;
}

/**
 * Presence row (Figma `row/presence`): avatar circles + names, home in
 * accent, away muted. Avatars use entity_picture with an initial fallback.
 * Registered define-only (plan D6).
 */
export class QlRowPresence extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
  };

  declare config?: PresenceRowConfig;

  setConfig(config: PresenceRowConfig): void {
    if (!Array.isArray(config.entities) || config.entities.length === 0) {
      throw new Error('ql-row-presence: "entities" is required');
    }
    this.config = config;
  }

  getCardSize(): number {
    return 1;
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .ql-card {
        display: flex;
        align-items: center;
        gap: var(--ql-space-l, 16px);
        padding: var(--ql-space-m, 12px) var(--ql-space-l, 16px);
      }
      .person {
        display: inline-flex;
        align-items: center;
        gap: var(--ql-space-s, 8px);
      }
      .avatar,
      .initial {
        width: 18px;
        height: 18px;
        border-radius: var(--ql-radius-chip, 999px);
        object-fit: cover;
      }
      .initial {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--ql-surface-border, #e4dccb);
        color: var(--ql-ink-primary, #2b2620);
        font: 500 10px/1 var(--ql-font-body, Outfit, sans-serif);
      }
      .name {
        color: var(--ql-accent-champagne, #b08d57);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .state {
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
      .person.away .name {
        color: var(--ql-ink-muted, #8c8578);
      }
    `,
  ];

  private personName(entityId: string, entity: HassEntity | undefined): string {
    return (
      (entity?.attributes.friendly_name as string | undefined) ??
      entityId.split('.')[1] ??
      entityId
    );
  }

  protected override render(): TemplateResult {
    const config = this.config;
    if (config === undefined) {
      return html``;
    }
    const locale = this.locale();
    return html`
      <div class="ql-card">
        ${config.entities.map((entityId) => {
          const entity = this.entity(entityId);
          const availability = this.availability(entityId);
          const home = availability === 'available' && entity?.state === 'home';
          const stateText =
            availability !== 'available'
              ? t(locale, 'common.offline')
              : t(locale, home ? 'presence.home' : 'presence.away');
          const name = this.personName(entityId, entity);
          const picture = entity?.attributes.entity_picture as string | undefined;
          return html`
            <span class="person ${home ? '' : 'away'}">
              ${picture !== undefined
                ? html`<img class="avatar" src=${picture} alt=${name} />`
                : html`<span class="initial" aria-hidden="true"
                    >${name.charAt(0).toUpperCase()}</span
                  >`}
              <span class="name">${name}</span>
              <span class="state">${stateText}</span>
            </span>
          `;
        })}
      </div>
    `;
  }
}

customElements.define('ql-row-presence', QlRowPresence);
```

- [ ] **Step 5: Implement ql-row-door-motion**

Create `src/cards/ql-row-door-motion.ts`:

```ts
import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import type { QlStatus } from '../elements/ql-status-dot';
import { t } from '../i18n/translate';
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
        flex: 1;
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
    const name =
      config.name ??
      (this.entity(config.entity)?.attributes.friendly_name as string | undefined) ??
      config.entity;
    const info = this.stateInfo();
    const toggleId = config.toggle_entity;
    const showToggle = config.show_toggle === true && toggleId !== undefined;
    const toggleOn = toggleId !== undefined && this.entity(toggleId)?.state === 'on';
    return html`
      <div class="ql-card ${availability === 'available' ? '' : 'ql-unavailable'}">
        <ql-status-dot status=${info.dot}></ql-status-dot>
        <p class="name">${name}</p>
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
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/cards/ql-row-presence.test.ts src/cards/ql-row-door-motion.test.ts src/i18n/i18n.test.ts` then `npm run typecheck`
Expected: PASS (4 + 5 + parity); typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src/cards/ql-row-presence.ts src/cards/ql-row-presence.test.ts src/cards/ql-row-door-motion.ts src/cards/ql-row-door-motion.test.ts src/i18n/locales
git commit -m "$(cat <<'EOF'
feat(cards): add ql-row-presence and ql-row-door-motion rows

- Presence: entity_picture avatars with initial fallback, localized
  home/away/offline, accent for who is home
- Door/motion: device_class-derived kind, localized states, status dots,
  optional detection toggle calling the switch toggle service
- Define-only registration (no picker entries, plan D6); keys ×5 locales

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 13: ql-row-network-flow + quiet-luxe-device-cutout-card (+ flow key)

**Files:**
- Create: `src/cards/ql-row-network-flow.ts`, `src/cards/quiet-luxe-device-cutout-card.ts`
- Modify: `src/i18n/locales/*.ts` (×5)
- Test: `src/cards/ql-row-network-flow.test.ts`, `src/cards/quiet-luxe-device-cutout-card.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/cards/ql-row-network-flow.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeEntity, makeMockHass, type MockHass } from '../testing/mock-hass';
import { CONFIRM_TIMEOUT_MS } from './quiet-luxe-climate-card';
import { QlRowNetworkFlow, type NetworkFlowRowConfig } from './ql-row-network-flow';

async function mount(
  config: Omit<NetworkFlowRowConfig, 'type'>,
  hass: MockHass,
): Promise<QlRowNetworkFlow> {
  const row = document.createElement('ql-row-network-flow') as QlRowNetworkFlow;
  row.setConfig({ type: 'custom:ql-row-network-flow', ...config });
  row.hass = hass;
  document.body.append(row);
  await row.updateComplete;
  return row;
}

describe('ql-row-network-flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is registered without a picker entry and requires an entity', () => {
    expect(customElements.get('ql-row-network-flow')).toBe(QlRowNetworkFlow);
    expect((window.customCards ?? []).some((c) => c.type === 'ql-row-network-flow')).toBe(false);
    const row = new QlRowNetworkFlow();
    expect(() => row.setConfig({ type: 'x', entity: '' })).toThrow('"entity" is required');
  });

  it('always shows the localized confirm hint caption', async () => {
    const row = await mount(
      { entity: 'switch.guest_wifi', name: 'Guest Wi-Fi', description: 'UniFi guest network' },
      makeMockHass([makeEntity('switch.guest_wifi', 'on')], 'zh-Hant'),
    );
    expect(row.shadowRoot?.textContent).toContain('Guest Wi-Fi');
    expect(row.shadowRoot?.textContent).toContain('UniFi guest network');
    expect(row.shadowRoot?.textContent).toContain('點兩次以生效');
    row.remove();
  });

  it('first toggle arms without a service call; second within timeout toggles', async () => {
    const hass = makeMockHass([makeEntity('switch.guest_wifi', 'on')]);
    const row = await mount({ entity: 'switch.guest_wifi' }, hass);
    const change = (): boolean | undefined =>
      row.shadowRoot
        ?.querySelector('ql-toggle')
        ?.dispatchEvent(
          new CustomEvent('ql-change', {
            detail: { checked: false },
            bubbles: true,
            composed: true,
          }),
        );
    change();
    await row.updateComplete;
    expect(hass.calls).toEqual([]);
    expect(row.shadowRoot?.textContent).toContain('Tap again to confirm');
    change();
    expect(hass.calls).toEqual([
      { domain: 'switch', service: 'toggle', data: { entity_id: 'switch.guest_wifi' } },
    ]);
    row.remove();
  });

  it('disarms after the confirm timeout without calling the service', async () => {
    const hass = makeMockHass([makeEntity('switch.guest_wifi', 'on')]);
    const row = await mount({ entity: 'switch.guest_wifi' }, hass);
    row.shadowRoot
      ?.querySelector('ql-toggle')
      ?.dispatchEvent(
        new CustomEvent('ql-change', { detail: { checked: false }, bubbles: true, composed: true }),
      );
    vi.advanceTimersByTime(CONFIRM_TIMEOUT_MS);
    await row.updateComplete;
    expect(row.shadowRoot?.textContent).not.toContain('Tap again to confirm');
    expect(hass.calls).toEqual([]);
    row.remove();
  });

  it('unavailable switch renders muted with a disabled toggle', async () => {
    const row = await mount(
      { entity: 'switch.guest_wifi' },
      makeMockHass([makeEntity('switch.guest_wifi', 'unavailable')]),
    );
    expect(row.shadowRoot?.querySelector('.ql-unavailable')).not.toBeNull();
    const toggle = row.shadowRoot?.querySelector<HTMLElement & { disabled: boolean }>('ql-toggle');
    expect(toggle?.disabled).toBe(true);
    row.remove();
  });
});
```

Create `src/cards/quiet-luxe-device-cutout-card.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeEntity, makeMockHass, type MockHass } from '../testing/mock-hass';
import {
  QuietLuxeDeviceCutoutCard,
  type DeviceCutoutCardConfig,
} from './quiet-luxe-device-cutout-card';

async function mount(
  config: Omit<DeviceCutoutCardConfig, 'type'>,
  hass: MockHass,
): Promise<QuietLuxeDeviceCutoutCard> {
  const card = document.createElement('quiet-luxe-device-cutout-card') as QuietLuxeDeviceCutoutCard;
  card.setConfig({ type: 'custom:quiet-luxe-device-cutout-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

describe('quiet-luxe-device-cutout-card', () => {
  it('is registered in window.customCards and requires an entity', () => {
    expect(customElements.get('quiet-luxe-device-cutout-card')).toBe(QuietLuxeDeviceCutoutCard);
    const entry = (window.customCards ?? []).find(
      (c) => c.type === 'quiet-luxe-device-cutout-card',
    );
    expect(entry?.name).toBe('Quiet Luxe Device Cutout Card');
    const card = new QuietLuxeDeviceCutoutCard();
    expect(() => card.setConfig({ type: 'x', entity: '' })).toThrow('"entity" is required');
  });

  it('renders name, cutout image and localized on/off status', async () => {
    const hass = makeMockHass([
      makeEntity('media_player.tv', 'on', { friendly_name: 'Living TV' }),
    ]);
    const card = await mount(
      { entity: 'media_player.tv', image: '/local/quiet-luxe/tv.png' },
      hass,
    );
    expect(card.shadowRoot?.textContent).toContain('Living TV');
    expect(card.shadowRoot?.textContent).toContain('On');
    expect(card.shadowRoot?.querySelector('img.cutout')?.getAttribute('src')).toBe(
      '/local/quiet-luxe/tv.png',
    );
    card.remove();
  });

  it('hides a failed image and keeps the status line', async () => {
    const hass = makeMockHass([makeEntity('media_player.tv', 'off')]);
    const card = await mount(
      { entity: 'media_player.tv', name: 'TV', image: '/local/broken.png' },
      hass,
    );
    card.shadowRoot?.querySelector('img.cutout')?.dispatchEvent(new Event('error'));
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector('img.cutout')).toBeNull();
    expect(card.shadowRoot?.textContent).toContain('Off');
    card.remove();
  });

  it('renders muted unavailable state without an image requirement', async () => {
    const hass = makeMockHass([makeEntity('media_player.tv', 'unavailable')], 'zh-Hans');
    const card = await mount({ entity: 'media_player.tv', name: 'TV' }, hass);
    expect(card.shadowRoot?.querySelector('.ql-unavailable')).not.toBeNull();
    expect(card.shadowRoot?.textContent).toContain('不可用');
    card.remove();
  });
});
```

(The zh-Hans assertion uses the existing Plan 3a `common.unavailable` value `不可用` — verified against `src/i18n/locales/zh-hans.ts`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/cards/ql-row-network-flow.test.ts src/cards/quiet-luxe-device-cutout-card.test.ts`
Expected: FAIL — module resolve errors.

- [ ] **Step 3: Add the flow key (all five locales)**

`en.ts`: `'flow.confirm_hint': 'Tap twice to apply',`
`zh-hant.ts`: `'flow.confirm_hint': '點兩次以生效',`
`zh-hans.ts`: `'flow.confirm_hint': '点两次以生效',`
`ms.ts`: `'flow.confirm_hint': 'Ketik dua kali untuk melaksana',`
`id.ts`: `'flow.confirm_hint': 'Ketuk dua kali untuk menerapkan',`

- [ ] **Step 4: Implement ql-row-network-flow**

Create `src/cards/ql-row-network-flow.ts`:

```ts
import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import { live } from 'lit/directives/live.js';
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
    const name =
      config.name ??
      (this.entity(config.entity)?.attributes.friendly_name as string | undefined) ??
      config.entity;
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
```

- [ ] **Step 5: Implement quiet-luxe-device-cutout-card**

Create `src/cards/quiet-luxe-device-cutout-card.ts`:

```ts
import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import type { QlStatus } from '../elements/ql-status-dot';
import { t } from '../i18n/translate';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';

export interface DeviceCutoutCardConfig {
  readonly type: string;
  readonly entity: string;
  readonly name?: string;
  /** Cutout image URL (image slot per Figma `card/device-cutout`). */
  readonly image?: string;
}

/**
 * Generic device cutout card (Figma `card/device-cutout`): eyebrow name,
 * optional cutout image, localized on/off/unavailable status line. Used for
 * Sonos/Dyson/TV/dehumidifier-style products.
 */
export class QuietLuxeDeviceCutoutCard extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
    imageFailed: { state: true },
  };

  declare config?: DeviceCutoutCardConfig;
  declare imageFailed: boolean;

  constructor() {
    super();
    this.imageFailed = false;
  }

  setConfig(config: DeviceCutoutCardConfig): void {
    if (typeof config.entity !== 'string' || config.entity === '') {
      throw new Error('quiet-luxe-device-cutout-card: "entity" is required');
    }
    this.config = config;
    this.imageFailed = false;
  }

  getCardSize(): number {
    return 2;
  }

  getGridOptions(): { rows: number; columns: number } {
    return { rows: 2, columns: 3 };
  }

  private onImageError(): void {
    this.imageFailed = true;
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
      img.cutout {
        display: block;
        width: 100%;
        max-height: 96px;
        object-fit: contain;
        margin: var(--ql-space-m, 12px) 0;
      }
      .status {
        display: inline-flex;
        align-items: center;
        gap: var(--ql-space-s, 8px);
        margin: var(--ql-space-s, 8px) 0 0;
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
    const name =
      config.name ??
      (this.entity(config.entity)?.attributes.friendly_name as string | undefined) ??
      config.entity;
    const on = availability === 'available' && this.entity(config.entity)?.state === 'on';
    const statusText =
      availability !== 'available'
        ? t(locale, 'common.unavailable')
        : t(locale, on ? 'common.on' : 'common.off');
    const dot: QlStatus = availability !== 'available' ? 'neutral' : on ? 'good' : 'neutral';
    const showImage = config.image !== undefined && !this.imageFailed;
    return html`
      <div class="ql-card ${availability === 'available' ? '' : 'ql-unavailable'}">
        <p class="eyebrow">${name}</p>
        ${showImage
          ? html`<img class="cutout" src=${config.image} alt="" @error=${this.onImageError} />`
          : nothing}
        <p class="status"><ql-status-dot status=${dot}></ql-status-dot>${statusText}</p>
      </div>
    `;
  }
}

registerCard('quiet-luxe-device-cutout-card', QuietLuxeDeviceCutoutCard, {
  name: 'Quiet Luxe Device Cutout Card',
  description: 'Generic device card with a cutout image slot and status line.',
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/cards/ql-row-network-flow.test.ts src/cards/quiet-luxe-device-cutout-card.test.ts src/i18n/i18n.test.ts` then `npm run typecheck`
Expected: PASS (5 + 3 + parity); typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src/cards/ql-row-network-flow.ts src/cards/ql-row-network-flow.test.ts src/cards/quiet-luxe-device-cutout-card.ts src/cards/quiet-luxe-device-cutout-card.test.ts src/i18n/locales
git commit -m "$(cat <<'EOF'
feat(cards): add ql-row-network-flow and quiet-luxe-device-cutout-card

- Network-flow row: climate-pattern confirm-arm on a live()-bound toggle,
  persistent localized confirm hint, warn caption while armed
- Device cutout card: image slot config with graceful img-error hiding,
  localized on/off/unavailable status + dot
- flow.confirm_hint key in all five locales

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 14: quiet-luxe-language-card

**Files:**
- Create: `src/cards/quiet-luxe-language-card.ts`
- Test: `src/cards/quiet-luxe-language-card.test.ts`

No new i18n keys: tile endonyms and their English glosses are locale-invariant by design (documented exemption in the plan header). The switching mechanism is plan D2 — the `hass-language-select` DOM event with a bare language-code detail, verified 2026-08-01 against the HA frontend `dev` branch; the frontend persists the choice to browser storage and the user profile.

- [ ] **Step 1: Write the failing test**

Create `src/cards/quiet-luxe-language-card.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeMockHass, type MockHass } from '../testing/mock-hass';
import {
  LANGUAGE_TILES,
  QuietLuxeLanguageCard,
  type LanguageCardConfig,
} from './quiet-luxe-language-card';

async function mount(
  config: Omit<LanguageCardConfig, 'type'>,
  hass: MockHass,
): Promise<QuietLuxeLanguageCard> {
  const card = document.createElement('quiet-luxe-language-card') as QuietLuxeLanguageCard;
  card.setConfig({ type: 'custom:quiet-luxe-language-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

describe('quiet-luxe-language-card', () => {
  it('is registered and exposes all five tiles by default', async () => {
    expect(customElements.get('quiet-luxe-language-card')).toBe(QuietLuxeLanguageCard);
    expect(LANGUAGE_TILES.map((tile) => tile.code)).toEqual([
      'en',
      'zh-Hant',
      'zh-Hans',
      'ms',
      'id',
    ]);
    const card = await mount({}, makeMockHass());
    const buttons = [...(card.shadowRoot?.querySelectorAll('button') ?? [])];
    expect(buttons).toHaveLength(5);
    expect(buttons[1]?.textContent).toContain('繁體中文');
    expect(buttons[1]?.textContent).toContain('Traditional Chinese');
    card.remove();
  });

  it('validates a languages subset and renders only it', async () => {
    const card = new QuietLuxeLanguageCard();
    expect(() =>
      card.setConfig({ type: 'x', languages: ['fr' as unknown as 'en'] }),
    ).toThrow('unsupported language');
    const subset = await mount({ languages: ['en', 'ms'] }, makeMockHass());
    expect(subset.shadowRoot?.querySelectorAll('button')).toHaveLength(2);
    subset.remove();
  });

  it('marks the tile matching the current hass locale as selected', async () => {
    const card = await mount({}, makeMockHass([], 'zh-Hant'));
    const buttons = [...(card.shadowRoot?.querySelectorAll('button') ?? [])];
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
      'false',
      'false',
    ]);
    card.remove();
  });

  it('dispatches hass-language-select with the bare language code on tap', async () => {
    const card = await mount({}, makeMockHass());
    const received: string[] = [];
    window.addEventListener('hass-language-select', (event) =>
      received.push((event as CustomEvent<string>).detail),
    );
    const buttons = [...(card.shadowRoot?.querySelectorAll('button') ?? [])];
    buttons[3]?.click();
    expect(received).toEqual(['ms']);
    card.remove();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/cards/quiet-luxe-language-card.test.ts`
Expected: FAIL — module resolve error.

- [ ] **Step 3: Implement**

Create `src/cards/quiet-luxe-language-card.ts`:

```ts
import {
  css,
  html,
  type CSSResultGroup,
  type PropertyDeclarations,
  type TemplateResult,
} from 'lit';
import { SUPPORTED_LOCALES, type Locale } from '../i18n/types';
import { QlBaseCard } from './ql-base-card';
import { registerCard } from './register';

export interface LanguageTile {
  readonly code: Locale;
  /** Endonym — locale-invariant by design; deliberately not via t(). */
  readonly native: string;
  /** English gloss per Figma card/language anatomy; locale-invariant. */
  readonly gloss: string;
}

export const LANGUAGE_TILES: ReadonlyArray<LanguageTile> = [
  { code: 'en', native: 'English', gloss: 'English' },
  { code: 'zh-Hant', native: '繁體中文', gloss: 'Traditional Chinese' },
  { code: 'zh-Hans', native: '简体中文', gloss: 'Simplified Chinese' },
  { code: 'ms', native: 'Bahasa Melayu', gloss: 'Malay' },
  { code: 'id', native: 'Bahasa Indonesia', gloss: 'Indonesian' },
];

export interface LanguageCardConfig {
  readonly type: string;
  /** Optional subset; defaults to all five supported locales. */
  readonly languages?: ReadonlyArray<Locale>;
}

/**
 * Language card (Figma `card/language`): five large kiosk-friendly tiles.
 * Switching per plan D2 (verified 2026-08-01): dispatch the
 * `hass-language-select` event with the bare language-code string, bubbling
 * and composed so the HA frontend root receives it; HA updates hass.locale,
 * browser storage, and the user profile (saveTranslationPreferences).
 * Selected state derives from the live hass locale.
 */
export class QuietLuxeLanguageCard extends QlBaseCard {
  static override properties: PropertyDeclarations = {
    config: { attribute: false },
  };

  declare config?: LanguageCardConfig;

  setConfig(config: LanguageCardConfig): void {
    for (const code of config.languages ?? []) {
      if (!SUPPORTED_LOCALES.includes(code)) {
        throw new Error(`quiet-luxe-language-card: unsupported language "${code}"`);
      }
    }
    this.config = config;
  }

  getCardSize(): number {
    return 2;
  }

  getGridOptions(): { rows: number; columns: number } {
    return { rows: 2, columns: 12 };
  }

  private tiles(): ReadonlyArray<LanguageTile> {
    const subset = this.config?.languages;
    if (subset === undefined || subset.length === 0) {
      return LANGUAGE_TILES;
    }
    return LANGUAGE_TILES.filter((tile) => subset.includes(tile.code));
  }

  private onSelect(code: Locale): void {
    this.dispatchEvent(
      new CustomEvent<string>('hass-language-select', {
        detail: code,
        bubbles: true,
        composed: true,
      }),
    );
  }

  static override styles: CSSResultGroup = [
    QlBaseCard.qlCardStyles,
    css`
      .grid {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ql-space-m, 12px);
      }
      button {
        flex: 1 1 160px;
        min-height: var(--ql-touch-min, 56px);
        padding: var(--ql-space-m, 12px) var(--ql-space-l, 16px);
        border-radius: var(--ql-radius-card, 18px);
        border: 1px solid var(--ql-surface-border, #e4dccb);
        background: var(--ql-surface-card, #fdfbf6);
        color: var(--ql-ink-primary, #2b2620);
        cursor: pointer;
        text-align: left;
        transition: border-color 200ms ease;
      }
      button[aria-pressed='true'] {
        border-color: var(--ql-accent-champagne, #b08d57);
      }
      .native {
        margin: 0;
        font: 500 16px/22px var(--ql-font-body, Outfit, sans-serif);
      }
      .gloss {
        margin: 2px 0 0;
        color: var(--ql-ink-muted, #8c8578);
        font: 400 12px/16px var(--ql-font-body, Outfit, sans-serif);
      }
    `,
  ];

  protected override render(): TemplateResult {
    if (this.config === undefined) {
      return html``;
    }
    const current = this.locale();
    return html`
      <div class="grid">
        ${this.tiles().map(
          (tile) => html`
            <button
              aria-pressed=${String(tile.code === current)}
              lang=${tile.code}
              @click=${(): void => this.onSelect(tile.code)}
            >
              <p class="native">${tile.native}</p>
              <p class="gloss">${tile.gloss}</p>
            </button>
          `,
        )}
      </div>
    `;
  }
}

registerCard('quiet-luxe-language-card', QuietLuxeLanguageCard, {
  name: 'Quiet Luxe Language Card',
  description: 'Kiosk-friendly language tiles that fire hass-language-select.',
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/cards/quiet-luxe-language-card.test.ts` then `npm run typecheck`
Expected: PASS (4 tests); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/cards/quiet-luxe-language-card.ts src/cards/quiet-luxe-language-card.test.ts
git commit -m "$(cat <<'EOF'
feat(cards): add quiet-luxe-language-card with verified switch mechanism

- Five endonym tiles (locale-invariant by design, documented exemption)
- Tap dispatches hass-language-select with the bare code — the HA frontend
  mechanism verified 2026-08-01 (no service exists for this)
- Selected tile follows the live hass locale; languages subset config

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 15: ql-idle-clock element

**Files:**
- Create: `src/elements/ql-idle-clock.ts`
- Test: `src/elements/ql-idle-clock.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/elements/ql-idle-clock.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { QlIdleClock } from './ql-idle-clock';

async function mount(props: Partial<QlIdleClock> = {}): Promise<QlIdleClock> {
  const el = document.createElement('ql-idle-clock') as QlIdleClock;
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe('ql-idle-clock', () => {
  it('is registered and renders time, date and weather lines', async () => {
    expect(customElements.get('ql-idle-clock')).toBe(QlIdleClock);
    const el = await mount({
      time: '21:42',
      date: 'Friday, 1 August',
      weather: '29° · Rain 80% · AQI 42',
    });
    expect(el.shadowRoot?.querySelector('.time')?.textContent).toBe('21:42');
    expect(el.shadowRoot?.querySelector('.date')?.textContent).toBe('Friday, 1 August');
    expect(el.shadowRoot?.querySelector('.weather')?.textContent).toBe('29° · Rain 80% · AQI 42');
    el.remove();
  });

  it('omits the weather line when empty', async () => {
    const el = await mount({ time: '21:42', date: 'Friday' });
    expect(el.shadowRoot?.querySelector('.weather')).toBeNull();
    el.remove();
  });

  it('is dark-pinned by design (fixed night palette, no theme vars)', () => {
    const cssText = QlIdleClock.styles.toString();
    expect(cssText).toContain('#262019');
    expect(cssText).toContain('#100d0a');
    expect(cssText).toContain('#ede6d8');
    expect(cssText).not.toContain('var(--ql-bg-base');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/elements/ql-idle-clock.test.ts`
Expected: FAIL — module resolve error.

- [ ] **Step 3: Implement**

Create `src/elements/ql-idle-clock.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/elements/ql-idle-clock.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/elements/ql-idle-clock.ts src/elements/ql-idle-clock.test.ts
git commit -m "$(cat <<'EOF'
feat(elements): add ql-idle-clock iPad idle face

- Oversized time + date + weather line, centered on the dark radial
- Dark-pinned fixed palette by design (night-mode composition, like scrims)
- Hass-free element; strategy feeds pre-formatted strings

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 16: Dev harness extension (every new component, both modes)

**Files:**
- Modify: `dev/main.ts`

No unit test — visual QA surface (same rationale as Plan 3a Task 19); verification is typecheck + manual browser check. `buildPane` runs once per mode, so additions appear in both light and dark automatically.

- [ ] **Step 1: Extend the mock hass**

In `dev/main.ts`, replace the `const hass = makeMockHass([...]);` block with:

```ts
const hass = makeMockHass(
  [
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
    makeEntity('media_player.living_sonos', 'playing', {
      friendly_name: 'Living Sonos',
      media_title: 'So What',
      media_artist: 'Miles Davis',
      media_album_name: 'Kind of Blue',
      source: 'Spotify',
      volume_level: 0.34,
      entity_picture: PHOTO_STUDY,
      group_members: ['media_player.living_sonos', 'media_player.kitchen_sonos'],
    }),
    makeEntity('media_player.kitchen_sonos', 'playing', {
      friendly_name: 'Kitchen Sonos',
      volume_level: 0.2,
    }),
    makeEntity('media_player.study_sonos', 'idle', { friendly_name: 'Study Sonos' }),
    makeEntity('media_player.tv', 'off', { friendly_name: 'Living TV' }),
    makeEntity('camera.front_door', 'streaming', {
      friendly_name: 'Front Door',
      entity_picture: PHOTO_LIVING,
    }),
    makeEntity('camera.gate', 'unavailable', { friendly_name: 'Gate' }),
    sensorEntity('sensor.power_total', '1236'),
    sensorEntity('sensor.energy_today', '8.61'),
    sensorEntity('sensor.phase_l1', '2300'),
    sensorEntity('sensor.phase_l2', '840'),
    sensorEntity('sensor.phase_l3', '410'),
    makeEntity('todo.family', '2', { friendly_name: 'Family Tasks' }),
    makeEntity('person.steven', 'home', { friendly_name: 'Steven' }),
    makeEntity('person.mei', 'not_home', {
      friendly_name: 'Mei',
      entity_picture: PHOTO_STUDY,
    }),
    makeEntity('binary_sensor.front_door', 'off', {
      friendly_name: 'Front Door',
      device_class: 'door',
    }),
    makeEntity('binary_sensor.hall_motion', 'on', {
      friendly_name: 'Hall Motion',
      device_class: 'motion',
    }),
    makeEntity('switch.hall_motion_detection', 'on'),
    makeEntity('switch.guest_wifi', 'on', { friendly_name: 'Guest Wi-Fi' }),
    sensorEntity('sensor.car_battery', '76'),
    sensorEntity('sensor.car_fuel', '55'),
    sensorEntity('sensor.car_range', '412', { unit_of_measurement: 'km' }),
    makeEntity('binary_sensor.car_lock', 'off', { device_class: 'lock' }),
    makeEntity('switch.car_precondition', 'off'),
    sensorEntity('sensor.car_location', 'Subang Jaya'),
    makeEntity('vacuum.robot', 'cleaning', { friendly_name: 'Robot', battery_level: 76 }),
  ],
  {
    apiResponses: {
      'calendars/calendar.family': [
        {
          summary: 'Dentist',
          start: { dateTime: '2026-08-03T09:30:00+08:00' },
          end: { dateTime: '2026-08-03T10:30:00+08:00' },
        },
        {
          summary: 'Sports day',
          start: { date: '2026-08-02' },
          end: { date: '2026-08-03' },
        },
      ],
    },
    wsResponses: {
      'todo/item/list': {
        items: [
          { uid: 'a1', summary: 'Buy milk', status: 'needs_action', due: '2026-07-31' },
          { uid: 'a2', summary: 'Water plants', status: 'needs_action' },
          { uid: 'a3', summary: 'Book flights', status: 'completed' },
        ],
      },
    },
  },
);
```

- [ ] **Step 2: Append the new sections**

In `buildPane`, after the existing `section('Sensors', …)` argument (still inside `content.append(…)`), add:

```ts
    section('Media', [
      makeCard('quiet-luxe-media-card', {
        type: 'custom:quiet-luxe-media-card',
        entity: 'media_player.living_sonos',
        form: 'player',
      }),
      makeCard('quiet-luxe-media-card', {
        type: 'custom:quiet-luxe-media-card',
        entity: 'media_player.living_sonos',
        form: 'bar',
      }),
      makeCard('quiet-luxe-media-card', {
        type: 'custom:quiet-luxe-media-card',
        entity: 'media_player.kitchen_sonos',
        form: 'group-row',
        leader: 'media_player.living_sonos',
      }),
      makeCard('quiet-luxe-media-card', {
        type: 'custom:quiet-luxe-media-card',
        entity: 'media_player.study_sonos',
        form: 'group-row',
        leader: 'media_player.living_sonos',
      }),
    ]),
    section('Cameras', [
      row([
        makeCard('quiet-luxe-camera-card', {
          type: 'custom:quiet-luxe-camera-card',
          entity: 'camera.front_door',
          form: 'full',
        }),
        makeCard('quiet-luxe-camera-card', {
          type: 'custom:quiet-luxe-camera-card',
          entity: 'camera.front_door',
          form: 'glance',
        }),
        makeCard('quiet-luxe-camera-card', {
          type: 'custom:quiet-luxe-camera-card',
          entity: 'camera.gate',
          form: 'glance',
        }),
      ]),
    ]),
    section('Energy', [
      makeCard('quiet-luxe-energy-card', {
        type: 'custom:quiet-luxe-energy-card',
        power_entity: 'sensor.power_total',
        today_entity: 'sensor.energy_today',
      }),
      row([
        makeCard('quiet-luxe-energy-card', {
          type: 'custom:quiet-luxe-energy-card',
          form: 'ring',
          power_entity: 'sensor.phase_l1',
          name: 'L1',
        }),
        makeCard('quiet-luxe-energy-card', {
          type: 'custom:quiet-luxe-energy-card',
          form: 'ring',
          power_entity: 'sensor.phase_l2',
          name: 'L2',
        }),
        makeCard('quiet-luxe-energy-card', {
          type: 'custom:quiet-luxe-energy-card',
          form: 'ring',
          power_entity: 'sensor.phase_l3',
          name: 'L3',
        }),
      ]),
    ]),
    section('Schedule & Tasks', [
      makeCard('quiet-luxe-schedule-card', {
        type: 'custom:quiet-luxe-schedule-card',
        calendars: ['calendar.family'],
        todo_entity: 'todo.family',
      }),
      makeCard('quiet-luxe-tasks-card', {
        type: 'custom:quiet-luxe-tasks-card',
        entity: 'todo.family',
      }),
    ]),
    section('Car', [
      makeCard('quiet-luxe-car-card', {
        type: 'custom:quiet-luxe-car-card',
        brand: 'liauto',
        name: 'Li Auto L7',
        battery_entity: 'sensor.car_battery',
        fuel_entity: 'sensor.car_fuel',
        range_entity: 'sensor.car_range',
        lock_entity: 'binary_sensor.car_lock',
        precondition_entity: 'switch.car_precondition',
        location_entity: 'sensor.car_location',
      }),
      row([
        makeCard('quiet-luxe-car-card', {
          type: 'custom:quiet-luxe-car-card',
          brand: 'bmw',
          name: 'BMW',
          battery_entity: 'sensor.car_battery',
        }),
        makeCard('quiet-luxe-car-card', {
          type: 'custom:quiet-luxe-car-card',
          brand: 'audi',
          name: 'Audi',
          range_entity: 'sensor.car_range',
        }),
      ]),
    ]),
    section('Vacuum', [
      makeCard('quiet-luxe-vacuum-card', {
        type: 'custom:quiet-luxe-vacuum-card',
        entity: 'vacuum.robot',
        rooms: [
          { name: 'Living', params: { segments: [3] } },
          { name: 'Kitchen', params: { segments: [5] } },
        ],
      }),
    ]),
    section('Rows', [
      makeCard('ql-row-presence', {
        type: 'custom:ql-row-presence',
        entities: ['person.steven', 'person.mei'],
      }),
      makeCard('ql-row-door-motion', {
        type: 'custom:ql-row-door-motion',
        entity: 'binary_sensor.front_door',
      }),
      makeCard('ql-row-door-motion', {
        type: 'custom:ql-row-door-motion',
        entity: 'binary_sensor.hall_motion',
        toggle_entity: 'switch.hall_motion_detection',
        show_toggle: true,
      }),
      makeCard('ql-row-network-flow', {
        type: 'custom:ql-row-network-flow',
        entity: 'switch.guest_wifi',
        name: 'Guest Wi-Fi',
        description: 'UniFi guest network',
      }),
      makeCard('quiet-luxe-device-cutout-card', {
        type: 'custom:quiet-luxe-device-cutout-card',
        entity: 'media_player.tv',
        name: 'Living TV',
      }),
    ]),
    section('Language', [
      makeCard('quiet-luxe-language-card', { type: 'custom:quiet-luxe-language-card' }),
    ]),
    section('Idle clock', [
      (() => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'height:320px;border-radius:18px;overflow:hidden;';
        wrap.append(
          el('ql-idle-clock', {
            time: '21:42',
            date: 'Friday, 1 August',
            weather: '29° · Rain 80% · AQI 42',
          }),
        );
        return wrap;
      })(),
    ]),
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck` (clean), then `npm run dev` and open the printed URL. Check both panes: media player/bar/group rows, cameras (front door photo + unavailable gate muted), energy strip + three rings, schedule agenda + tasks, three car silhouettes, vacuum chips, all four rows, language tiles (selected = English in the `en` harness), idle clock block. Confirm no console errors except the intentional schedule/tasks stubs resolving.

- [ ] **Step 4: Commit**

```bash
git add dev/main.ts
git commit -m "$(cat <<'EOF'
feat(dev): extend the harness with every Plan 3b component

- Mock hass grows media/camera/energy/todo/person/car/vacuum entities and
  calendar/todo API stubs (prefix-matched paths)
- New sections render all cards, rows, language tiles and idle clock in
  both light and dark panes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 17: Bundle exports and registration

**Files:**
- Modify: `src/index.ts`
- Modify: `src/index.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/index.test.ts`, replace the `ELEMENT_TAGS` and `CARD_TAGS` arrays with:

```ts
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
  'ql-idle-clock',
  'ql-row-presence',
  'ql-row-door-motion',
  'ql-row-network-flow',
] as const;

const CARD_TAGS = [
  'quiet-luxe-room-card',
  'quiet-luxe-climate-card',
  'quiet-luxe-light-card',
  'quiet-luxe-cover-card',
  'quiet-luxe-sensor-tile',
  'quiet-luxe-media-card',
  'quiet-luxe-camera-card',
  'quiet-luxe-energy-card',
  'quiet-luxe-schedule-card',
  'quiet-luxe-tasks-card',
  'quiet-luxe-car-card',
  'quiet-luxe-vacuum-card',
  'quiet-luxe-device-cutout-card',
  'quiet-luxe-language-card',
] as const;
```

Append inside the existing `describe('bundle entry', …)` block:

```ts
  it('keeps rows and idle clock out of the card picker', () => {
    const types = (window.customCards ?? []).map((entry) => entry.type);
    for (const tag of ['ql-row-presence', 'ql-row-door-motion', 'ql-row-network-flow', 'ql-idle-clock']) {
      expect(types.includes(tag), tag).toBe(false);
    }
  });

  it('re-exports the Plan 3b public API', () => {
    expect(bundle.QuietLuxeMediaCard).toBeDefined();
    expect(bundle.QuietLuxeCameraCard).toBeDefined();
    expect(bundle.QuietLuxeEnergyCard).toBeDefined();
    expect(bundle.QuietLuxeScheduleCard).toBeDefined();
    expect(bundle.QuietLuxeTasksCard).toBeDefined();
    expect(bundle.QuietLuxeCarCard).toBeDefined();
    expect(bundle.QuietLuxeVacuumCard).toBeDefined();
    expect(bundle.QuietLuxeDeviceCutoutCard).toBeDefined();
    expect(bundle.QuietLuxeLanguageCard).toBeDefined();
    expect(bundle.QlRowPresence).toBeDefined();
    expect(bundle.QlRowDoorMotion).toBeDefined();
    expect(bundle.QlRowNetworkFlow).toBeDefined();
    expect(bundle.QlIdleClock).toBeDefined();
    expect(bundle.formatPower(1236)).toBe('1.24 kW');
    expect(bundle.formatEnergy(8.61)).toBe('8.6 kWh');
    expect(bundle.LANGUAGE_TILES).toHaveLength(5);
    expect(bundle.CAR_BODY_PATHS.bmw.startsWith('M')).toBe(true);
    expect(typeof bundle.fetchAgenda).toBe('function');
    expect(typeof bundle.fetchTodoItems).toBe('function');
    expect(typeof bundle.updateTodoItem).toBe('function');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/index.test.ts`
Expected: FAIL — new tags unregistered, new exports undefined.

- [ ] **Step 3: Extend `src/index.ts`**

Add after the existing side-effect imports:

```ts
import './elements/ql-idle-clock';
import './cards/quiet-luxe-media-card';
import './cards/quiet-luxe-camera-card';
import './cards/quiet-luxe-energy-card';
import './cards/quiet-luxe-schedule-card';
import './cards/quiet-luxe-tasks-card';
import './cards/quiet-luxe-car-card';
import './cards/quiet-luxe-vacuum-card';
import './cards/ql-row-presence';
import './cards/ql-row-door-motion';
import './cards/ql-row-network-flow';
import './cards/quiet-luxe-device-cutout-card';
import './cards/quiet-luxe-language-card';
```

Add after the existing exports (before the `injectFontStylesheet` call):

```ts
export { QlIdleClock } from './elements/ql-idle-clock';
export {
  QuietLuxeMediaCard,
  type MediaCardConfig,
  type MediaCardForm,
} from './cards/quiet-luxe-media-card';
export {
  DEFAULT_CAMERA_REFRESH_S,
  QuietLuxeCameraCard,
  type CameraCardConfig,
  type CameraCardForm,
} from './cards/quiet-luxe-camera-card';
export { formatEnergy, formatPower, ringDasharray } from './cards/energy-format';
export {
  DEFAULT_RING_MAX_W,
  QuietLuxeEnergyCard,
  RING_RADIUS,
  type EnergyCardConfig,
  type EnergyCardForm,
} from './cards/quiet-luxe-energy-card';
export {
  AGENDA_DEFAULT_DAYS,
  AGENDA_REFRESH_MS,
  fetchAgenda,
  fetchTodoItems,
  formatAgendaTime,
  isDueSoon,
  updateTodoItem,
  type AgendaItem,
  type HaCalendarEvent,
  type HaTodoItem,
} from './cards/schedule-data';
export {
  QuietLuxeScheduleCard,
  type ScheduleCardConfig,
} from './cards/quiet-luxe-schedule-card';
export { QuietLuxeTasksCard, type TasksCardConfig } from './cards/quiet-luxe-tasks-card';
export {
  CAR_BODY_PATHS,
  CAR_VIEWBOX,
  CAR_WHEELS,
  type CarBrand,
  type CarWheel,
} from './cards/car-silhouettes';
export { QuietLuxeCarCard, type CarCardConfig } from './cards/quiet-luxe-car-card';
export {
  DEFAULT_ROOM_COMMAND,
  QuietLuxeVacuumCard,
  type VacuumCardConfig,
  type VacuumRoomConfig,
} from './cards/quiet-luxe-vacuum-card';
export { QlRowPresence, type PresenceRowConfig } from './cards/ql-row-presence';
export {
  QlRowDoorMotion,
  type DoorMotionKind,
  type DoorMotionRowConfig,
} from './cards/ql-row-door-motion';
export { QlRowNetworkFlow, type NetworkFlowRowConfig } from './cards/ql-row-network-flow';
export {
  QuietLuxeDeviceCutoutCard,
  type DeviceCutoutCardConfig,
} from './cards/quiet-luxe-device-cutout-card';
export {
  LANGUAGE_TILES,
  QuietLuxeLanguageCard,
  type LanguageCardConfig,
  type LanguageTile,
} from './cards/quiet-luxe-language-card';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/index.test.ts` then `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/index.test.ts
git commit -m "$(cat <<'EOF'
feat(cards): export and register the Plan 3b component set

- Side-effect imports register 9 new picker cards + 3 rows + idle clock
- Public API re-exports classes, config types, silhouettes and data helpers
- Picker-exclusion asserted for define-only rows (plan D6)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 18: Full verification and single-bundle assertion

**Files:** none created — verification gate (mirrors Plan 3a Task 20).

- [ ] **Step 1: Run the full quality gate**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Expected: all clean; every suite green; build succeeds.

- [ ] **Step 2: Assert the single-bundle invariant still holds**

```bash
ls dist
ls dist/fonts | head -3
grep -c "quiet-luxe-media-card" dist/quiet-luxe.js
grep -c "hass-language-select" dist/quiet-luxe.js
grep -c "mock-context" dist/quiet-luxe.js || true
wc -c dist/quiet-luxe.js
```

Expected: `dist` contains exactly `quiet-luxe.js` and `fonts/`; fonts populated; media-card registration and the language event present (count ≥ 1 each); `mock-context` count 0 (mock-hass NOT bundled). Record the byte size and note the delta vs the `main` baseline (rebuild `main` if needed) in the final report — flag anything beyond a ~25% growth for discussion (no dependency was added, so growth should be modest). If `dist` contains anything from `dev/`, the build config regressed — stop and fix before committing anything.

- [ ] **Step 3: Report**

Summarize per the delegated-workstream format (objective, status, files, findings, validation, risks — including the bundle-size note) and stop. Branch integration (merge/PR) is a user decision via superpowers:finishing-a-development-branch — do not merge unprompted.

---

## Self-review notes

- **Scope coverage vs task brief:** media bar|player|group-row → Task 3; camera glance|full + refresh + LIVE + graceful error → Task 4; energy strip|ring + chart decision D1 → Tasks 5–6; schedule agenda (calendar REST + todo WS, disabled views, self-hide on `calendar: none`) → Tasks 2/7/8; tasks card → Task 9; car brands + SVG silhouettes + confirm-armed precondition → Task 10; vacuum states + config-driven room payloads → Task 11; presence/door-motion rows → Task 12; network-flow row + device cutout → Task 13; language card (D2 mechanism) → Task 14; idle clock → Task 15; harness both modes → Task 16; exports → Task 17; final gate incl. size note → Task 18. Every spec §7 component now has an implementation task; §6 layouts consume them in Plan 4.
- **Version-specific behavior:** all five researched contracts (calendar REST, todo WS/service, hass-language-select, camera proxy time param, media join/unjoin) verified against primary sources on 2026-08-01 and recorded in D1–D5 with the exact payload shapes used in code and tests.
- **Type consistency check:** `MediaCardForm`/`CameraCardForm`/`EnergyCardForm`/`CarBrand`/`DoorMotionKind` names match across cards, tests, and index exports; `HaTodoItem`/`AgendaItem` flow schedule-data → schedule/tasks cards; `QlSegmentOption.disabled/hint` (Task 2) match Task 8's `viewOptions()`; `CONFIRM_TIMEOUT_MS` imported from the climate card in Tasks 10/13 and re-used in both confirm tests; `ql-change` detail shapes stay `{checked}`/`{value}`.
- **Placeholder scan:** none — every step carries complete code, exact paths, commands, and expected outcomes. The zh-Hans unavailable assertion was verified against the existing locale file rather than guessed.
- **Known deliberate boundaries:** restated in the header (bar chevron, display-only schedule tasks, deferred calendar views, endonym i18n exemption, inline confirm-arm repetition).
