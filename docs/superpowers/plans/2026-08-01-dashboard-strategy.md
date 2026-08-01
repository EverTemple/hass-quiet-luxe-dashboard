# Quiet Luxe Dashboard Strategy Implementation Plan (Plan 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Series note:** This is **Plan 4 of 5** — the dashboard strategy + per-home config. Plans 1–3b (HACS foundation, Figma system, card library core + extended) are fully executed and merged on `main` (latest `b908ae5`); their patterns are canonical and reused verbatim here. Plan 5 (per-instance rollout: HA-side permissions/scripts, kiosk-mode, live-instance validation) comes next.
>
> **Execution branch:** `feat/dashboard-strategy` (created in Task 1 Step 1).
>
> **i18n rule:** every new user-visible string goes through `t(locale, key)`; new keys land in **all five** locale files (`en`, `zh-hant`, `zh-hans`, `ms`, `id`) in the same task that first uses them (translations are supplied inline in each task). The `TranslationTable` typing makes `npm run typecheck` fail until all five carry the key.
>
> **No new runtime dependencies.**

**Goal:** A custom HA dashboard strategy (`strategy: type: custom:quiet-luxe`) that generates the entire Quiet Luxe dashboard — home, per-room, and domain views — from the HA area/device/entity registries plus a small validated per-home config, with RBAC tier filtering and graceful omission of anything a home doesn't have.

**Architecture:** Pure-function pipeline: `validateHomeConfig` (loud errors) → `fetchRegistrySnapshot` (three documented `hass.callWS` registry list calls) → `buildRegistryIndex` (pure bucketing by area/domain/device_class + `ql-*` label filtering) → section builders (pure, return `null` when empty — a missing integration never renders) → view builders → `viewsForTier` RBAC filter → dashboard JSON. The only impure edges are the strategy element itself and a thin `quiet-luxe-header-card` wrapping the Plan 3a header elements. Errors surface as a loud `console.error` plus a minimal fallback view — never a white screen.

**Tech Stack:** TypeScript 6 strict (no decorators, `static override properties`, `declare` fields), Lit 3 (header card only — everything else emits plain JSON), Vitest 4.1 + happy-dom (colocated `*.test.ts`, exact-value assertions), ESLint 10 flat, Vite 8 lib build (single-file ES bundle `dist/quiet-luxe.js`).

**Source spec:** `docs/superpowers/specs/2026-08-01-ha-dashboard-redesign-design.md` §2, §5, §6, §8, §9, §10, §12.

---

## Verified HA strategy API facts (all checked 2026-08-01)

1. **Custom dashboard strategy contract** (developers.home-assistant.io/docs/frontend/custom-ui/custom-strategy/): a dashboard strategy is a class registered as custom element **`ll-strategy-dashboard-<name>`** exposing **`static async generate(config, hass)`** that returns the full dashboard config (`{ title?, views: [...] }`). View strategies (`ll-strategy-view-<name>`, return `{ cards }`) exist but we use a **dashboard** strategy only. Referenced from YAML as `strategy: { type: custom:<name>, ...options }`; the whole strategy object (including our keys) is passed as `config` to `generate`. Optional extras: `getCreateSuggestions(hass)`, `getConfigElement()`.
2. **Registry access from a strategy** (same doc): the documented data path is WebSocket — `hass.callWS({ type: 'config/area_registry/list' })`, `config/device_registry/list`, `config/entity_registry/list`. We use exactly these (D1). Registry rows carry `labels: string[]` since HA 2024.4 (labels feature); we normalize with `?? []` for older instances.
3. **Sections view YAML** (home-assistant.io/dashboards/sections/): view `type: sections` with `max_columns`, `dense_section_placement`; each section is `type: grid` with `cards`; sections can span columns via `column_span`; cards size themselves inside the 12-units-per-section-column grid via `grid_options: { columns, rows }` (the Plan 3a cards already implement `getGridOptions()`); native `heading` cards title sections and accept `tap_action`.
4. **Per-user view visibility** (home-assistant.io/dashboards/views/): views accept `visible: [{ user: <user_id> }]`. We do **not** emit it here — user ids are per-instance data; Plan 5 may add them during rollout. Strategy-side RBAC is generation filtering (§9 layer 1).
5. **`window.customStrategies`** metadata registration exists since HA 2026.5 (third-party writeup, vahac.com, read 2026-08-01) — metadata only; the custom element must still be defined. Exact metadata shape is **UNCONFIRMED** (not in official docs); we push a `{ type, name, description }` record guarded so it is a harmless no-op on any HA version.
6. **`hass.user`** carries `{ id, name, is_admin }` for the logged-in user (HA frontend `CurrentUser`); we type only those three fields.

Spec §13 assumption stands: the three instances' HA versions must support sections views + this strategy API — verified against live instances in Plan 5, not here.

## Key decisions (D1–D9)

- **D1 — Registry via `callWS`, not `hass.areas`/`hass.devices`/`hass.entities`:** the frontend hass object does expose registry records, but the *documented* custom-strategy contract shows the three `config/*_registry/list` WS calls (fact 2). We use the documented path, normalize into our own typed `RegistrySnapshot`, and keep everything downstream pure and mock-testable via `wsResponses` stubs.
- **D2 — Absolute navigation paths via `dashboard_path` config:** HA `navigate` actions want absolute paths (`/<dashboard-url>/<view>`), and the strategy cannot know the dashboard's `url_path` at generate time. `HomeConfig.dashboard_path` (default `quiet-luxe`) supplies it; README documents that it must match the dashboard's URL path. `viewUrl(home, path)` is the single helper.
- **D3 — `energy` flag carries its entities:** `energy: false | { power_entity, today_entity?, phase_entities?, tariff? }`. Bare `energy: true` is rejected with a message pointing at the required shape — Shelly 3EM entity ids are per-install and cannot be reliably auto-discovered.
- **D4 — Family tier does not see the Car view:** the plan brief says family loses "admin/network"; spec §5 says "Car — admin only" and §5 wins for what the brief leaves unstated. Family keeps motion toggles (spec §6: "admin/family"). Guest additionally loses the greeting and gets kiosk defaults.
- **D5 — Unknown non-admin users default to guest** (least privilege). Tier membership lists (`users.family` / `users.guests`) match HA user id or name (case-insensitive) so configs stay readable while ids remain usable.
- **D6 — Community-card presence detected at generate time:** `customElements.get('apexcharts-card')` / `customElements.get('webrtc-camera')` → `ctx.hasApexcharts` / `ctx.hasWebrtcCard`. Missing apexcharts → the history chart is omitted (never a broken card); `camera_engine: webrtc` without the WebRTC card → snapshot cards (graceful fallback, spec §8).
- **D7 — `quiet-luxe-header-card` is a thin define-only card** (not in the picker) wrapping the Plan 3a `ql-header-home`/`ql-header-room` elements — the strategy can only emit *cards*, and headers need hass data (weather/presence/user). Breakpoint variant from viewport width: `<768` mobile, `<1400` ipad, else desktop (matching the 390/1180/1680 spec frames).
- **D8 — Fallback dashboard is English-only:** when generation fails the config itself may be the broken part, so locale resolution is not trusted; admins see the error message in the diagnostic markdown card, non-admins see only the generic body (spec §8: diagnostic card is admin-visible only).
- **D9 — Generic switches render as `quiet-luxe-device-cutout-card`** in the room "Switches" section (Z2M relays, Broadlink RF fans per spec §2/§6); switches already claimed as admin flows or motion-detection toggles are excluded from that section.

## Deferred (explicitly out of this plan)

Scene chips section (no scenes fixture data yet); iPad idle-face + kiosk-mode wiring (Plan 5); per-view HA `visible:` user lists (Plan 5, per-instance user ids); HA-side permission enforcement — **strategy-level omission is defense-in-depth, NOT the security boundary; HA user permissions are, and Plan 5 configures those (spec §9 layer 2)**; energy tariff cost estimate + top consumers (needs statistics plumbing); All-Climates per-category "all off" (needs Plan 5 scripts + confirm flows); Admin instance-health card (Plan 5); schedule day/week/month (deferred in Plan 3b).

## Conventions (apply to every task)

1. **TDD:** every task = failing test → minimal implementation → green → commit. Targeted runs: `npx vitest run <file>`; full suite `npm test`.
2. **Commit footers** — every commit body ends with:

   ```
   Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
   Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
   ```

3. **i18n:** new keys go into `src/i18n/locales/en.ts` (before `} as const;`) **and** the matching row into `zh-hant.ts`, `zh-hans.ts`, `ms.ts`, `id.ts` in the same task. Placement within the object is free; key parity is what typecheck enforces.
4. **Graceful degradation (spec §8):** builders return `null`/`[]` when inputs are empty — a missing integration never renders. Malformed *config* throws `QuietLuxeConfigError` (developer error, loud). Registry failures throw `QuietLuxeRegistryError`. Both are caught only at the strategy boundary → `console.error` + fallback view.
5. **Pure builders:** section/view builders never touch `window`, `customElements`, `Date`, or hass methods — everything they need is in `StrategyContext`. The strategy entry computes the impure bits once.
6. Lint/typecheck before every commit: `npm run lint && npm run typecheck` — expected clean.

## File structure

```
src/strategy/types.ts                    Tier, Lovelace JSON types, PATHS, roomPath, isSection, StrategyContext
src/strategy/config.ts                   HomeConfig schema + validateHomeConfig + viewUrl + QuietLuxeConfigError
src/strategy/reference-homes.ts          SUBANG_CONFIG / TUNGCHUNG_CONFIG / XIAMEN_CONFIG (spec §2 matrix)
src/strategy/registry.ts                 WS registry types + fetchRegistrySnapshot + buildRegistryIndex + ql-* labels
src/strategy/rbac.ts                     resolveTier + viewsForTier
src/strategy/sections/heading.ts         headingCard + sectionOf helpers
src/strategy/sections/rooms.ts           orderedAreas, roomPhoto, roomCardFor, roomsSection
src/strategy/sections/climate.ts         climateEntityIds (active-first), climateCards, climateSection
src/strategy/sections/presence.ts        presenceSection
src/strategy/sections/security.ts        securitySection (glance), doorMotionRows, cameraWallCards, securityViewSections
src/strategy/sections/sensors.ts         sensorTiles + sensorsSection (room "Air & sensors")
src/strategy/sections/media.ts           orderedPlayers, mediaSection (bar), sonosGroupRows, mediaViewSections
src/strategy/sections/energy.ts          energySection (strip), apexchartsHistoryCard, energyViewSections
src/strategy/sections/schedule.ts        scheduleSection (calendar: none → null)
src/strategy/sections/car.ts             carCard, carSection (admin only)
src/strategy/sections/vacuum.ts          vacuumSection
src/strategy/sections/admin.ts           adminSection (network-flow rows)
src/strategy/views/home.ts               headerCardConfig + homeView
src/strategy/views/room.ts               roomView + roomViews (per area)
src/strategy/views/domain.ts             media/security/energy/climates/car/admin/language views
src/strategy/quiet-luxe-strategy.ts      ll-strategy-dashboard-quiet-luxe element + fallback dashboard
src/cards/quiet-luxe-header-card.ts      D7 header wrapper card (define-only)
src/types/home-assistant.ts              MODIFIED: optional `user` member
src/testing/mock-hass.ts                 MODIFIED: `user` option
src/testing/mock-registry.ts             registry fixture builders + referenceHome() + makeContext()
src/index.ts                             MODIFIED: strategy + header card imports/exports
src/index.test.ts                        MODIFIED: registration assertions
dev/main.ts                              MODIFIED: strategy JSON inspector for the three reference homes
README.md                                MODIFIED: dashboard YAML usage + config reference
src/i18n/locales/*.ts                    MODIFIED ×5, per-task keys
src/strategy/reference-dashboards.test.ts  final-gate matrix + snapshot tests
```

Each created `.ts` gets a colocated `.test.ts`.

---

### Task 1: Branch, strategy types, per-home config schema + validation

**Files:**
- Create: `src/strategy/types.ts`
- Create: `src/strategy/config.ts`
- Create: `src/strategy/types.test.ts`
- Create: `src/strategy/config.test.ts`

- [x] **Step 1: Create the execution branch**

```bash
git checkout main && git pull && git checkout -b feat/dashboard-strategy
```

- [x] **Step 2: Write the failing tests**

`src/strategy/types.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isSection, PATHS, roomPath } from './types';

describe('strategy types helpers', () => {
  it('builds room view paths from area ids', () => {
    expect(roomPath('main_living')).toBe('room-main_living');
  });

  it('exposes the fixed domain view paths', () => {
    expect(PATHS).toEqual({
      home: 'home',
      media: 'media',
      security: 'security',
      energy: 'energy',
      climates: 'climates',
      car: 'car',
      admin: 'admin',
      language: 'language',
    });
  });

  it('isSection narrows away nulls', () => {
    const sections = [{ type: 'grid' as const, cards: [] }, null].filter(isSection);
    expect(sections).toEqual([{ type: 'grid', cards: [] }]);
  });
});
```

`src/strategy/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DASHBOARD_PATH,
  QuietLuxeConfigError,
  validateHomeConfig,
  viewUrl,
} from './config';

describe('validateHomeConfig', () => {
  it('applies defaults to a minimal config', () => {
    const home = validateHomeConfig({ name: 'Test Home' });
    expect(home).toEqual({
      name: 'Test Home',
      dashboard_path: undefined,
      energy: false,
      car: 'none',
      car_entities: undefined,
      calendar: 'none',
      vacuum: false,
      media_rich: false,
      camera_engine: 'snapshot',
      broadlink: false,
      room_order: undefined,
      rooms: undefined,
      photo_base: undefined,
      admin_flows: undefined,
      kiosk: undefined,
      users: undefined,
    });
  });

  it('rejects non-object config loudly', () => {
    expect(() => validateHomeConfig(undefined)).toThrowError(QuietLuxeConfigError);
    expect(() => validateHomeConfig('subang')).toThrowError(/must be an object/);
  });

  it('rejects a missing or empty name', () => {
    expect(() => validateHomeConfig({})).toThrowError(/"name" is required/);
    expect(() => validateHomeConfig({ name: '' })).toThrowError(/"name" must be a non-empty string/);
  });

  it('rejects unknown keys by name (typo safety)', () => {
    expect(() => validateHomeConfig({ name: 'X', engery: false })).toThrowError(
      /unknown home config key\(s\): engery/,
    );
  });

  it('rejects bare energy: true with a pointer to the entity shape', () => {
    expect(() => validateHomeConfig({ name: 'X', energy: true })).toThrowError(/power_entity/);
  });

  it('accepts a full energy object', () => {
    const home = validateHomeConfig({
      name: 'X',
      energy: {
        power_entity: 'sensor.p',
        today_entity: 'sensor.t',
        phase_entities: ['sensor.a'],
        tariff: 0.5,
      },
    });
    expect(home.energy).toEqual({
      power_entity: 'sensor.p',
      today_entity: 'sensor.t',
      phase_entities: ['sensor.a'],
      tariff: 0.5,
    });
  });

  it('rejects an invalid car flag', () => {
    expect(() => validateHomeConfig({ name: 'X', car: 'tesla' })).toThrowError(
      /"car" must be one of bmw\|audi\|liauto\|none/,
    );
  });

  it('rejects car_entities without a car brand', () => {
    expect(() =>
      validateHomeConfig({ name: 'X', car_entities: { battery_entity: 'sensor.b' } }),
    ).toThrowError(/requires "car"/);
  });

  it('parses room overrides and rejects malformed ones', () => {
    const home = validateHomeConfig({
      name: 'X',
      rooms: { living: { photo: '/local/l.jpg', hidden: true } },
    });
    expect(home.rooms).toEqual({
      living: { name: undefined, photo: '/local/l.jpg', hidden: true },
    });
    expect(() => validateHomeConfig({ name: 'X', rooms: { living: { pic: 'x' } } })).toThrowError(
      /unknown "rooms.living" key\(s\): pic/,
    );
  });

  it('parses admin flows and requires their entity', () => {
    const home = validateHomeConfig({
      name: 'X',
      admin_flows: [{ entity: 'switch.f', name: 'Flow' }],
    });
    expect(home.admin_flows).toEqual([
      { entity: 'switch.f', name: 'Flow', description: undefined },
    ]);
    expect(() =>
      validateHomeConfig({ name: 'X', admin_flows: [{ name: 'no entity' }] }),
    ).toThrowError(/"admin_flows\[0\].entity" is required/);
  });

  it('parses kiosk and users blocks', () => {
    const home = validateHomeConfig({
      name: 'X',
      kiosk: { language: 'zh-Hant' },
      users: { family: ['mei'], guests: ['kiosk'] },
    });
    expect(home.kiosk).toEqual({ language: 'zh-Hant' });
    expect(home.users).toEqual({ family: ['mei'], guests: ['kiosk'] });
  });
});

describe('viewUrl', () => {
  it('builds absolute paths from the default dashboard path', () => {
    expect(viewUrl(validateHomeConfig({ name: 'X' }), 'home')).toBe(
      `/${DEFAULT_DASHBOARD_PATH}/home`,
    );
  });

  it('honours dashboard_path overrides', () => {
    expect(viewUrl(validateHomeConfig({ name: 'X', dashboard_path: 'ql' }), 'media')).toBe(
      '/ql/media',
    );
  });
});
```

- [x] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/strategy/types.test.ts src/strategy/config.test.ts`
Expected: FAIL — cannot resolve `./types` / `./config`.

- [x] **Step 4: Implement `src/strategy/types.ts`**

```ts
/**
 * Lovelace JSON emitted by the strategy. Shapes follow the HA sections-view
 * YAML schema (home-assistant.io/dashboards/sections + /views, verified
 * 2026-08-01). Card configs are open records: HA passes them through to each
 * card's setConfig untouched, and layout keys like grid_options ride along.
 */
export type Tier = 'admin' | 'family' | 'guest';

export interface LovelaceCardConfig {
  readonly type: string;
  readonly [key: string]: unknown;
}

export interface LovelaceSectionConfig {
  readonly type: 'grid';
  readonly column_span?: number;
  readonly cards: ReadonlyArray<LovelaceCardConfig>;
}

export interface LovelaceViewConfig {
  readonly title: string;
  readonly path: string;
  readonly type: 'sections';
  readonly icon?: string;
  readonly subview?: boolean;
  readonly max_columns?: number;
  readonly sections: ReadonlyArray<LovelaceSectionConfig>;
}

export interface LovelaceDashboardConfig {
  readonly title?: string;
  readonly views: ReadonlyArray<LovelaceViewConfig>;
}

export const PATHS = {
  home: 'home',
  media: 'media',
  security: 'security',
  energy: 'energy',
  climates: 'climates',
  car: 'car',
  admin: 'admin',
  language: 'language',
} as const;

export function roomPath(areaId: string): string {
  return `room-${areaId}`;
}

export function isSection(
  section: LovelaceSectionConfig | null,
): section is LovelaceSectionConfig {
  return section !== null;
}
```

(`StrategyContext` is added to this file in Task 4, once `RegistryIndex` exists.)

- [x] **Step 5: Implement `src/strategy/config.ts`**

```ts
const CAR_FLAGS = ['bmw', 'audi', 'liauto', 'none'] as const;
export type CarFlag = (typeof CAR_FLAGS)[number];

const CALENDAR_FLAGS = ['google', 'none'] as const;
export type CalendarFlag = (typeof CALENDAR_FLAGS)[number];

const CAMERA_ENGINES = ['webrtc', 'snapshot'] as const;
export type CameraEngine = (typeof CAMERA_ENGINES)[number];

export interface RoomOverride {
  readonly name?: string;
  readonly photo?: string;
  readonly hidden?: boolean;
}

export interface EnergyConfig {
  readonly power_entity: string;
  readonly today_entity?: string;
  readonly phase_entities?: ReadonlyArray<string>;
  /** Cost per kWh in home currency; reserved for the Plan 5 cost estimate. */
  readonly tariff?: number;
}

export interface CarEntities {
  readonly battery_entity?: string;
  readonly fuel_entity?: string;
  readonly range_entity?: string;
  readonly lock_entity?: string;
  readonly precondition_entity?: string;
  readonly location_entity?: string;
}

export interface AdminFlow {
  readonly entity: string;
  readonly name?: string;
  readonly description?: string;
}

export interface KioskConfig {
  readonly language?: string;
}

export interface UsersConfig {
  readonly family?: ReadonlyArray<string>;
  readonly guests?: ReadonlyArray<string>;
}

export interface HomeConfig {
  readonly name: string;
  /** Dashboard url_path; navigation targets are built from it (D2). */
  readonly dashboard_path?: string;
  readonly energy: false | EnergyConfig;
  readonly car: CarFlag;
  readonly car_entities?: CarEntities;
  readonly calendar: CalendarFlag;
  readonly vacuum: boolean;
  readonly media_rich: boolean;
  readonly camera_engine: CameraEngine;
  readonly broadlink: boolean;
  readonly room_order?: ReadonlyArray<string>;
  readonly rooms?: Readonly<Record<string, RoomOverride>>;
  readonly photo_base?: string;
  readonly admin_flows?: ReadonlyArray<AdminFlow>;
  readonly kiosk?: KioskConfig;
  readonly users?: UsersConfig;
}

export const DEFAULT_DASHBOARD_PATH = 'quiet-luxe';
export const DEFAULT_PHOTO_BASE = '/local/quiet-luxe/rooms';

export class QuietLuxeConfigError extends Error {
  constructor(message: string) {
    super(`[quiet-luxe] invalid home config: ${message}`);
    this.name = 'QuietLuxeConfigError';
  }
}

/** Absolute navigation path for a view; the dashboard's url_path must match (README). */
export function viewUrl(home: HomeConfig, viewPath: string): string {
  return `/${home.dashboard_path ?? DEFAULT_DASHBOARD_PATH}/${viewPath}`;
}

function fail(message: string): never {
  throw new QuietLuxeConfigError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectUnknownKeys(
  raw: Record<string, unknown>,
  allowed: ReadonlyArray<string>,
  context: string,
): void {
  const unknown = Object.keys(raw).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    fail(`unknown ${context} key(s): ${unknown.join(', ')}`);
  }
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value === '') {
    fail(`"${label}" must be a non-empty string`);
  }
  return value;
}

function optString(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : stringValue(value, label);
}

function reqString(value: unknown, label: string): string {
  if (value === undefined) {
    fail(`"${label}" is required`);
  }
  return stringValue(value, label);
}

function boolValue(value: unknown, label: string, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'boolean') {
    fail(`"${label}" must be true or false`);
  }
  return value;
}

function enumValue<T extends string>(
  value: unknown,
  label: string,
  allowed: ReadonlyArray<T>,
  fallback: T,
): T {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'string' || !(allowed as ReadonlyArray<string>).includes(value)) {
    fail(`"${label}" must be one of ${allowed.join('|')}`);
  }
  return value as T;
}

function stringArray(value: unknown, label: string): ReadonlyArray<string> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item === '')) {
    fail(`"${label}" must be an array of non-empty strings`);
  }
  return value as ReadonlyArray<string>;
}

function parseEnergy(value: unknown): false | EnergyConfig {
  if (value === undefined || value === false) {
    return false;
  }
  if (value === true) {
    fail('"energy" must be false or an object like { power_entity: "sensor.x" }; bare true names no entities');
  }
  if (!isRecord(value)) {
    fail('"energy" must be false or an object');
  }
  rejectUnknownKeys(value, ['power_entity', 'today_entity', 'phase_entities', 'tariff'], '"energy"');
  if (value.tariff !== undefined && typeof value.tariff !== 'number') {
    fail('"energy.tariff" must be a number');
  }
  return {
    power_entity: reqString(value.power_entity, 'energy.power_entity'),
    today_entity: optString(value.today_entity, 'energy.today_entity'),
    phase_entities: stringArray(value.phase_entities, 'energy.phase_entities'),
    tariff: value.tariff,
  };
}

const CAR_ENTITY_KEYS = [
  'battery_entity',
  'fuel_entity',
  'range_entity',
  'lock_entity',
  'precondition_entity',
  'location_entity',
] as const;

function parseCarEntities(value: unknown): CarEntities | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    fail('"car_entities" must be an object');
  }
  rejectUnknownKeys(value, CAR_ENTITY_KEYS, '"car_entities"');
  return Object.fromEntries(
    CAR_ENTITY_KEYS.map((key) => [key, optString(value[key], `car_entities.${key}`)]),
  ) as CarEntities;
}

function parseRooms(value: unknown): Readonly<Record<string, RoomOverride>> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    fail('"rooms" must be a map of area_id to override');
  }
  const rooms: Record<string, RoomOverride> = {};
  for (const [areaId, override] of Object.entries(value)) {
    if (!isRecord(override)) {
      fail(`"rooms.${areaId}" must be an object`);
    }
    rejectUnknownKeys(override, ['name', 'photo', 'hidden'], `"rooms.${areaId}"`);
    const hidden = override.hidden;
    if (hidden !== undefined && typeof hidden !== 'boolean') {
      fail(`"rooms.${areaId}.hidden" must be true or false`);
    }
    rooms[areaId] = {
      name: optString(override.name, `rooms.${areaId}.name`),
      photo: optString(override.photo, `rooms.${areaId}.photo`),
      hidden,
    };
  }
  return rooms;
}

function parseAdminFlows(value: unknown): ReadonlyArray<AdminFlow> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    fail('"admin_flows" must be an array');
  }
  return value.map((flow: unknown, index) => {
    if (!isRecord(flow)) {
      fail(`"admin_flows[${index}]" must be an object`);
    }
    rejectUnknownKeys(flow, ['entity', 'name', 'description'], `"admin_flows[${index}]"`);
    return {
      entity: reqString(flow.entity, `admin_flows[${index}].entity`),
      name: optString(flow.name, `admin_flows[${index}].name`),
      description: optString(flow.description, `admin_flows[${index}].description`),
    };
  });
}

function parseKiosk(value: unknown): KioskConfig | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    fail('"kiosk" must be an object');
  }
  rejectUnknownKeys(value, ['language'], '"kiosk"');
  return { language: optString(value.language, 'kiosk.language') };
}

function parseUsers(value: unknown): UsersConfig | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    fail('"users" must be an object');
  }
  rejectUnknownKeys(value, ['family', 'guests'], '"users"');
  return {
    family: stringArray(value.family, 'users.family'),
    guests: stringArray(value.guests, 'users.guests'),
  };
}

const TOP_KEYS = [
  'name',
  'dashboard_path',
  'energy',
  'car',
  'car_entities',
  'calendar',
  'vacuum',
  'media_rich',
  'camera_engine',
  'broadlink',
  'room_order',
  'rooms',
  'photo_base',
  'admin_flows',
  'kiosk',
  'users',
] as const;

export function validateHomeConfig(raw: unknown): HomeConfig {
  if (!isRecord(raw)) {
    fail('config "home" must be an object (see README "Dashboard YAML")');
  }
  rejectUnknownKeys(raw, TOP_KEYS, 'home config');
  const car = enumValue(raw.car, 'car', CAR_FLAGS, 'none');
  const carEntities = parseCarEntities(raw.car_entities);
  if (car === 'none' && carEntities !== undefined) {
    fail('"car_entities" requires "car" to be bmw, audi, or liauto');
  }
  return {
    name: reqString(raw.name, 'name'),
    dashboard_path: optString(raw.dashboard_path, 'dashboard_path'),
    energy: parseEnergy(raw.energy),
    car,
    car_entities: carEntities,
    calendar: enumValue(raw.calendar, 'calendar', CALENDAR_FLAGS, 'none'),
    vacuum: boolValue(raw.vacuum, 'vacuum', false),
    media_rich: boolValue(raw.media_rich, 'media_rich', false),
    camera_engine: enumValue(raw.camera_engine, 'camera_engine', CAMERA_ENGINES, 'snapshot'),
    broadlink: boolValue(raw.broadlink, 'broadlink', false),
    room_order: stringArray(raw.room_order, 'room_order'),
    rooms: parseRooms(raw.rooms),
    photo_base: optString(raw.photo_base, 'photo_base'),
    admin_flows: parseAdminFlows(raw.admin_flows),
    kiosk: parseKiosk(raw.kiosk),
    users: parseUsers(raw.users),
  };
}
```

- [x] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/strategy/types.test.ts src/strategy/config.test.ts`
Expected: PASS (all tests).

- [x] **Step 7: Lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: clean.

- [x] **Step 8: Commit**

```bash
git add src/strategy/types.ts src/strategy/types.test.ts src/strategy/config.ts src/strategy/config.test.ts
git commit -m "$(cat <<'EOF'
feat(strategy): add home config schema and validation

- Typed HomeConfig with feature flags, room overrides, kiosk/users blocks
- validateHomeConfig rejects unknown keys and malformed values loudly
- viewUrl builds absolute nav paths from dashboard_path (D2)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

---

### Task 2: Reference home configs (spec §2 matrix)

**Files:**
- Create: `src/strategy/reference-homes.ts`
- Create: `src/strategy/reference-homes.test.ts`

- [x] **Step 1: Write the failing test**

`src/strategy/reference-homes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SUBANG_CONFIG, TUNGCHUNG_CONFIG, XIAMEN_CONFIG } from './reference-homes';

describe('reference home configs (spec §2 matrix)', () => {
  it('energy exists only in Subang Jaya (Shelly 3EM)', () => {
    expect(SUBANG_CONFIG.energy).not.toBe(false);
    expect(TUNGCHUNG_CONFIG.energy).toBe(false);
    expect(XIAMEN_CONFIG.energy).toBe(false);
  });

  it('car brands follow the matrix', () => {
    expect(SUBANG_CONFIG.car).toBe('bmw');
    expect(TUNGCHUNG_CONFIG.car).toBe('audi');
    expect(XIAMEN_CONFIG.car).toBe('liauto');
  });

  it('calendar is google except Xiamen (China-reachability rule)', () => {
    expect(SUBANG_CONFIG.calendar).toBe('google');
    expect(TUNGCHUNG_CONFIG.calendar).toBe('google');
    expect(XIAMEN_CONFIG.calendar).toBe('none');
  });

  it('vacuum only in Xiamen (Dreame X30 Pro)', () => {
    expect(SUBANG_CONFIG.vacuum).toBe(false);
    expect(TUNGCHUNG_CONFIG.vacuum).toBe(false);
    expect(XIAMEN_CONFIG.vacuum).toBe(true);
  });

  it('media_rich only in Subang Jaya (Sonos everywhere)', () => {
    expect(SUBANG_CONFIG.media_rich).toBe(true);
    expect(TUNGCHUNG_CONFIG.media_rich).toBe(false);
    expect(XIAMEN_CONFIG.media_rich).toBe(false);
  });

  it('camera engine: webrtc for NVR/RTSP homes, snapshot for Dahua-cloud Xiamen', () => {
    expect(SUBANG_CONFIG.camera_engine).toBe('webrtc');
    expect(TUNGCHUNG_CONFIG.camera_engine).toBe('webrtc');
    expect(XIAMEN_CONFIG.camera_engine).toBe('snapshot');
  });

  it('broadlink RF/IR only in Subang Jaya and Tung Chung', () => {
    expect(SUBANG_CONFIG.broadlink).toBe(true);
    expect(TUNGCHUNG_CONFIG.broadlink).toBe(true);
    expect(XIAMEN_CONFIG.broadlink).toBe(false);
  });

  it('kiosk default languages per home', () => {
    expect(SUBANG_CONFIG.kiosk?.language).toBe('en');
    expect(TUNGCHUNG_CONFIG.kiosk?.language).toBe('zh-Hant');
    expect(XIAMEN_CONFIG.kiosk?.language).toBe('zh-Hans');
  });

  it('every home routes the shared kiosk user to the guest tier', () => {
    for (const home of [SUBANG_CONFIG, TUNGCHUNG_CONFIG, XIAMEN_CONFIG]) {
      expect(home.users?.guests).toContain('kiosk');
    }
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/strategy/reference-homes.test.ts`
Expected: FAIL — cannot resolve `./reference-homes`.

- [x] **Step 3: Implement `src/strategy/reference-homes.ts`**

```ts
import { validateHomeConfig, type HomeConfig } from './config';

/**
 * Spec §2 per-home matrix as validated fixtures. Entity ids are UNCONFIRMED
 * until the live instances are reachable (spec §13); wrong ids degrade to
 * muted/omitted at render time, they never break generation.
 */
export const SUBANG_CONFIG: HomeConfig = validateHomeConfig({
  name: 'Subang Jaya',
  energy: {
    power_entity: 'sensor.shelly_3em_total_power',
    today_entity: 'sensor.shelly_3em_total_energy_today',
    phase_entities: [
      'sensor.shelly_3em_phase_a_power',
      'sensor.shelly_3em_phase_b_power',
      'sensor.shelly_3em_phase_c_power',
    ],
    tariff: 0.516,
  },
  car: 'bmw',
  car_entities: {
    battery_entity: 'sensor.bmw_battery',
    range_entity: 'sensor.bmw_range',
    lock_entity: 'binary_sensor.bmw_lock',
    location_entity: 'device_tracker.bmw',
  },
  calendar: 'google',
  vacuum: false,
  media_rich: true,
  camera_engine: 'webrtc',
  broadlink: true,
  room_order: ['main_living', 'side_living', 'master_bedroom'],
  admin_flows: [
    { entity: 'switch.nr_guest_wifi', name: 'Guest Wi-Fi', description: 'UniFi guest network' },
    { entity: 'switch.nr_plex_forward', name: 'Plex port forward', description: 'pfSense NAT rule' },
  ],
  kiosk: { language: 'en' },
  users: { guests: ['kiosk'] },
});

export const TUNGCHUNG_CONFIG: HomeConfig = validateHomeConfig({
  name: 'Tung Chung',
  car: 'audi',
  car_entities: {
    battery_entity: 'sensor.audi_battery',
    range_entity: 'sensor.audi_range',
  },
  calendar: 'google',
  camera_engine: 'webrtc',
  broadlink: true,
  admin_flows: [
    { entity: 'switch.nr_cam_uplink', name: 'Camera uplink', description: 'UniFi port' },
  ],
  kiosk: { language: 'zh-Hant' },
  users: { guests: ['kiosk'] },
});

export const XIAMEN_CONFIG: HomeConfig = validateHomeConfig({
  name: 'Xiamen',
  car: 'liauto',
  car_entities: {
    battery_entity: 'sensor.liauto_battery',
    fuel_entity: 'sensor.liauto_fuel',
    range_entity: 'sensor.liauto_range',
  },
  calendar: 'none',
  vacuum: true,
  camera_engine: 'snapshot',
  broadlink: false,
  kiosk: { language: 'zh-Hans' },
  users: { guests: ['kiosk'] },
});
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/strategy/reference-homes.test.ts`
Expected: PASS.

- [x] **Step 5: Lint + typecheck, then commit**

Run: `npm run lint && npm run typecheck` — expected clean.

```bash
git add src/strategy/reference-homes.ts src/strategy/reference-homes.test.ts
git commit -m "$(cat <<'EOF'
feat(strategy): add reference home configs (spec §2 matrix)

- Subang/TungChung/Xiamen fixtures validated at module load
- Matrix differences asserted: energy, car brand, calendar, vacuum,
  media_rich, camera engine, broadlink, kiosk language

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

---

### Task 3: Registry snapshot fetch (documented WS calls)

**Files:**
- Create: `src/strategy/registry.ts`
- Create: `src/strategy/registry.test.ts`

- [x] **Step 1: Write the failing test**

`src/strategy/registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeMockHass } from '../testing/mock-hass';
import { fetchRegistrySnapshot, QuietLuxeRegistryError } from './registry';

describe('fetchRegistrySnapshot', () => {
  const wsResponses = {
    'config/area_registry/list': [{ area_id: 'living', name: 'Living Room' }],
    'config/device_registry/list': [{ id: 'dev-1', area_id: 'living' }],
    'config/entity_registry/list': [
      { entity_id: 'light.pendant', device_id: 'dev-1', platform: 'hue' },
    ],
  };

  it('normalizes raw rows (labels/nullables) into the snapshot shape', async () => {
    const hass = makeMockHass([], { wsResponses });
    const snapshot = await fetchRegistrySnapshot(hass);
    expect(snapshot.areas).toEqual([
      { area_id: 'living', name: 'Living Room', picture: null, labels: [] },
    ]);
    expect(snapshot.devices).toEqual([{ id: 'dev-1', area_id: 'living', labels: [] }]);
    expect(snapshot.entities).toEqual([
      {
        entity_id: 'light.pendant',
        area_id: null,
        device_id: 'dev-1',
        labels: [],
        hidden_by: null,
        disabled_by: null,
        entity_category: null,
        platform: 'hue',
        name: null,
      },
    ]);
    expect(hass.wsCalls.map((call) => call.type)).toEqual([
      'config/area_registry/list',
      'config/device_registry/list',
      'config/entity_registry/list',
    ]);
  });

  it('throws QuietLuxeRegistryError when callWS is missing', async () => {
    const hass = makeMockHass([], { wsResponses });
    const withoutWs = { ...hass, callWS: undefined };
    await expect(fetchRegistrySnapshot(withoutWs)).rejects.toBeInstanceOf(QuietLuxeRegistryError);
  });

  it('wraps WS failures loudly', async () => {
    const hass = makeMockHass([], { wsResponses: {} });
    await expect(fetchRegistrySnapshot(hass)).rejects.toThrowError(/registry read failed/);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/strategy/registry.test.ts`
Expected: FAIL — cannot resolve `./registry`.

- [x] **Step 3: Implement `src/strategy/registry.ts`** (fetch half; the index half lands in Task 4)

```ts
import type { HassEntity, HomeAssistant } from '../types/home-assistant';

export const LABEL_FAVORITE = 'ql-favorite';
export const LABEL_HIDDEN = 'ql-hidden';
export const LABEL_PRIMARY_CAMERA = 'ql-primary-camera';

export interface AreaEntry {
  readonly area_id: string;
  readonly name: string;
  readonly picture: string | null;
  readonly labels: ReadonlyArray<string>;
}

export interface DeviceEntry {
  readonly id: string;
  readonly area_id: string | null;
  readonly labels: ReadonlyArray<string>;
}

export interface EntityEntry {
  readonly entity_id: string;
  readonly area_id: string | null;
  readonly device_id: string | null;
  readonly labels: ReadonlyArray<string>;
  readonly hidden_by: string | null;
  readonly disabled_by: string | null;
  readonly entity_category: string | null;
  readonly platform: string;
  readonly name: string | null;
}

export interface RegistrySnapshot {
  readonly areas: ReadonlyArray<AreaEntry>;
  readonly devices: ReadonlyArray<DeviceEntry>;
  readonly entities: ReadonlyArray<EntityEntry>;
}

export class QuietLuxeRegistryError extends Error {
  constructor(message: string) {
    super(`[quiet-luxe] registry read failed: ${message}`);
    this.name = 'QuietLuxeRegistryError';
  }
}

/* Raw WS payload rows; labels are absent before HA 2024.4, hence ?? [] below. */
interface RawAreaEntry {
  readonly area_id: string;
  readonly name: string;
  readonly picture?: string | null;
  readonly labels?: ReadonlyArray<string>;
}

interface RawDeviceEntry {
  readonly id: string;
  readonly area_id?: string | null;
  readonly labels?: ReadonlyArray<string>;
}

interface RawEntityEntry {
  readonly entity_id: string;
  readonly area_id?: string | null;
  readonly device_id?: string | null;
  readonly labels?: ReadonlyArray<string>;
  readonly hidden_by?: string | null;
  readonly disabled_by?: string | null;
  readonly entity_category?: string | null;
  readonly platform?: string;
  readonly name?: string | null;
}

/**
 * Reads the three HA registries over WebSocket — the documented custom-strategy
 * data path (developers.home-assistant.io custom-strategy, verified 2026-08-01).
 */
export async function fetchRegistrySnapshot(hass: HomeAssistant): Promise<RegistrySnapshot> {
  const callWS = hass.callWS;
  if (callWS === undefined) {
    throw new QuietLuxeRegistryError('hass.callWS is unavailable');
  }
  try {
    const [areas, devices, entities] = await Promise.all([
      callWS<ReadonlyArray<RawAreaEntry>>({ type: 'config/area_registry/list' }),
      callWS<ReadonlyArray<RawDeviceEntry>>({ type: 'config/device_registry/list' }),
      callWS<ReadonlyArray<RawEntityEntry>>({ type: 'config/entity_registry/list' }),
    ]);
    return {
      areas: areas.map((area) => ({
        area_id: area.area_id,
        name: area.name,
        picture: area.picture ?? null,
        labels: area.labels ?? [],
      })),
      devices: devices.map((device) => ({
        id: device.id,
        area_id: device.area_id ?? null,
        labels: device.labels ?? [],
      })),
      entities: entities.map((entity) => ({
        entity_id: entity.entity_id,
        area_id: entity.area_id ?? null,
        device_id: entity.device_id ?? null,
        labels: entity.labels ?? [],
        hidden_by: entity.hidden_by ?? null,
        disabled_by: entity.disabled_by ?? null,
        entity_category: entity.entity_category ?? null,
        platform: entity.platform ?? '',
        name: entity.name ?? null,
      })),
    };
  } catch (error) {
    throw new QuietLuxeRegistryError(error instanceof Error ? error.message : String(error));
  }
}
```

(The `HassEntity` import is used by `buildRegistryIndex` in Task 4; if the linter flags it as unused at this step, add it in Task 4 instead.)

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/strategy/registry.test.ts`
Expected: PASS.

- [x] **Step 5: Lint + typecheck, then commit**

Run: `npm run lint && npm run typecheck` — expected clean (remove the unused `HassEntity` import if flagged; it returns in Task 4).

```bash
git add src/strategy/registry.ts src/strategy/registry.test.ts
git commit -m "$(cat <<'EOF'
feat(strategy): fetch HA registry snapshot over WebSocket

- config/{area,device,entity}_registry/list per the documented
  custom-strategy contract (verified 2026-08-01)
- Rows normalized to non-optional typed entries; labels default []
- QuietLuxeRegistryError wraps every failure loudly

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

---

### Task 4: Registry index (bucketing + labels) and mock registry fixtures

**Files:**
- Modify: `src/strategy/registry.ts` (append `RegistryIndex` + `buildRegistryIndex`)
- Modify: `src/strategy/types.ts` (append `StrategyContext`)
- Create: `src/testing/mock-registry.ts`
- Modify: `src/strategy/registry.test.ts` (append index tests)

- [x] **Step 1: Write the failing tests** — append to `src/strategy/registry.test.ts`:

```ts
import { makeEntity } from '../testing/mock-hass';
import { buildRegistryIndex } from './registry';
import { mockArea, mockDevice, mockRegEntity, referenceHome } from '../testing/mock-registry';

describe('buildRegistryIndex', () => {
  const snapshot = {
    areas: [mockArea('living', 'Living Room'), mockArea('bedroom', 'Bedroom')],
    devices: [mockDevice('dev-motion', 'living')],
    entities: [
      mockRegEntity('light.pendant', { area_id: 'living' }),
      mockRegEntity('light.fav_lamp', { area_id: 'living', labels: ['ql-favorite'] }),
      mockRegEntity('light.hidden_strip', { area_id: 'living', labels: ['ql-hidden'] }),
      mockRegEntity('sensor.living_temp', { area_id: 'living' }),
      mockRegEntity('sensor.diag_rssi', { area_id: 'living', entity_category: 'diagnostic' }),
      mockRegEntity('binary_sensor.hall_motion', { device_id: 'dev-motion' }),
      mockRegEntity('switch.hall_motion_detection', { device_id: 'dev-motion' }),
      mockRegEntity('light.disabled', { area_id: 'living', disabled_by: 'user' }),
      mockRegEntity('media_player.sonos', { area_id: 'bedroom', platform: 'sonos' }),
    ],
  };
  const states = Object.fromEntries(
    [
      makeEntity('light.pendant', 'on'),
      makeEntity('light.fav_lamp', 'off'),
      makeEntity('sensor.living_temp', '24.5', { device_class: 'temperature' }),
      makeEntity('binary_sensor.hall_motion', 'off', { device_class: 'motion' }),
      makeEntity('switch.hall_motion_detection', 'on'),
      makeEntity('media_player.sonos', 'idle'),
    ].map((entity) => [entity.entity_id, entity]),
  );
  const index = buildRegistryIndex(snapshot, states);

  it('sorts areas by name', () => {
    expect(index.areas.map((area) => area.area_id)).toEqual(['bedroom', 'living']);
  });

  it('excludes hidden/disabled/diagnostic/ql-hidden entities everywhere', () => {
    // Device-linked motion entities land in 'living' via dev-motion; favorites
    // first, then alphabetical.
    expect(index.inAreaAll('living')).toEqual([
      'light.fav_lamp',
      'binary_sensor.hall_motion',
      'light.pendant',
      'sensor.living_temp',
      'switch.hall_motion_detection',
    ]);
  });

  it('puts ql-favorite entities first within a bucket', () => {
    expect(index.inArea('living', 'light')).toEqual(['light.fav_lamp', 'light.pendant']);
  });

  it('assigns device-linked entities to the device area', () => {
    expect(index.inArea('living', 'binary_sensor', 'motion')).toEqual([
      'binary_sensor.hall_motion',
    ]);
  });

  it('filters by device_class read from states', () => {
    expect(index.all('sensor', 'temperature')).toEqual(['sensor.living_temp']);
    expect(index.all('sensor', 'aqi')).toEqual([]);
  });

  it('exposes labels, platform, and device siblings', () => {
    expect(index.hasLabel('light.fav_lamp', 'ql-favorite')).toBe(true);
    expect(index.platformOf('media_player.sonos')).toBe('sonos');
    expect(index.siblings('binary_sensor.hall_motion')).toEqual([
      'switch.hall_motion_detection',
    ]);
  });
});

describe('referenceHome fixtures', () => {
  it('subang fixture buckets hallmark entities', () => {
    const { snapshot: subang, entities } = referenceHome('subang');
    const states = Object.fromEntries(entities.map((entity) => [entity.entity_id, entity]));
    const index = buildRegistryIndex(subang, states);
    expect(index.inArea('main_living', 'light')).toContain('light.main_living_pendant');
    expect(index.all('camera')[0]).toBe('camera.front_gate'); // ql-favorite? no: primary label ordering is a section concern; alphabetical here
    expect(index.all('vacuum')).toEqual([]);
  });

  it('xiamen fixture has a vacuum and no calendars', () => {
    const { snapshot: xiamen, entities } = referenceHome('xiamen');
    const states = Object.fromEntries(entities.map((entity) => [entity.entity_id, entity]));
    const index = buildRegistryIndex(xiamen, states);
    expect(index.all('vacuum')).toEqual(['vacuum.dreame_x30']);
    expect(index.all('calendar')).toEqual([]);
  });
});
```

Note: `camera.front_gate` sorts before `camera.porch` alphabetically, so the first assertion holds without label ordering.

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run src/strategy/registry.test.ts`
Expected: FAIL — `buildRegistryIndex` and `../testing/mock-registry` do not exist.

- [x] **Step 3: Append `RegistryIndex` + `buildRegistryIndex` to `src/strategy/registry.ts`**

```ts
export interface RegistryIndex {
  /** All areas, sorted by name. Ordering/hiding per home config is a section concern. */
  readonly areas: ReadonlyArray<AreaEntry>;
  area(areaId: string): AreaEntry | undefined;
  /** All visible entity ids assigned (directly or via device) to the area. */
  inAreaAll(areaId: string): ReadonlyArray<string>;
  inArea(areaId: string, domain: string, deviceClass?: string): ReadonlyArray<string>;
  all(domain: string, deviceClass?: string): ReadonlyArray<string>;
  hasLabel(entityId: string, label: string): boolean;
  platformOf(entityId: string): string | undefined;
  /** Visible entities sharing the entity's device (motion-toggle discovery). */
  siblings(entityId: string): ReadonlyArray<string>;
}

const EMPTY: ReadonlyArray<string> = [];

/**
 * Pure index over a registry snapshot. Visibility rules (spec §8):
 * hidden_by/disabled_by set, entity_category set (config/diagnostic), or the
 * ql-hidden label → excluded everywhere. ql-favorite sorts first per bucket.
 */
export function buildRegistryIndex(
  snapshot: RegistrySnapshot,
  states: Readonly<Record<string, HassEntity>>,
): RegistryIndex {
  const areaById = new Map(snapshot.areas.map((area) => [area.area_id, area]));
  const deviceById = new Map(snapshot.devices.map((device) => [device.id, device]));
  const favoriteRank = (entity: EntityEntry): number =>
    entity.labels.includes(LABEL_FAVORITE) ? 0 : 1;
  const visible = snapshot.entities
    .filter(
      (entity) =>
        entity.hidden_by === null &&
        entity.disabled_by === null &&
        entity.entity_category === null &&
        !entity.labels.includes(LABEL_HIDDEN),
    )
    .sort(
      (a, b) => favoriteRank(a) - favoriteRank(b) || a.entity_id.localeCompare(b.entity_id),
    );
  const entityById = new Map(visible.map((entity) => [entity.entity_id, entity]));
  const ordered = visible.map((entity) => entity.entity_id);

  const effectiveArea = (entity: EntityEntry): string | null =>
    entity.area_id ??
    (entity.device_id === null ? null : (deviceById.get(entity.device_id)?.area_id ?? null));

  const byArea = new Map<string, string[]>();
  const byDevice = new Map<string, string[]>();
  for (const entity of visible) {
    const areaId = effectiveArea(entity);
    if (areaId !== null) {
      byArea.set(areaId, [...(byArea.get(areaId) ?? []), entity.entity_id]);
    }
    if (entity.device_id !== null) {
      byDevice.set(entity.device_id, [...(byDevice.get(entity.device_id) ?? []), entity.entity_id]);
    }
  }

  const domainOf = (id: string): string => id.split('.')[0];
  const deviceClassOf = (id: string): string | undefined => {
    const deviceClass: unknown = states[id]?.attributes.device_class;
    return typeof deviceClass === 'string' ? deviceClass : undefined;
  };
  const matching = (
    ids: ReadonlyArray<string>,
    domain: string,
    deviceClass?: string,
  ): ReadonlyArray<string> =>
    ids.filter(
      (id) =>
        domainOf(id) === domain && (deviceClass === undefined || deviceClassOf(id) === deviceClass),
    );

  return {
    areas: [...snapshot.areas].sort((a, b) => a.name.localeCompare(b.name)),
    area: (areaId) => areaById.get(areaId),
    inAreaAll: (areaId) => byArea.get(areaId) ?? EMPTY,
    inArea: (areaId, domain, deviceClass) => matching(byArea.get(areaId) ?? EMPTY, domain, deviceClass),
    all: (domain, deviceClass) => matching(ordered, domain, deviceClass),
    hasLabel: (entityId, label) => entityById.get(entityId)?.labels.includes(label) ?? false,
    platformOf: (entityId) => entityById.get(entityId)?.platform,
    siblings: (entityId) => {
      const deviceId = entityById.get(entityId)?.device_id ?? null;
      if (deviceId === null) {
        return EMPTY;
      }
      return (byDevice.get(deviceId) ?? EMPTY).filter((id) => id !== entityId);
    },
  };
}
```

- [x] **Step 4: Replace `src/strategy/types.ts` with the version that adds `StrategyContext`** (full file — Task 1 content plus the imports and the trailing interface):

```ts
import type { HassEntity } from '../types/home-assistant';
import type { Locale } from '../i18n/types';
import type { HomeConfig } from './config';
import type { RegistryIndex } from './registry';

/**
 * Lovelace JSON emitted by the strategy. Shapes follow the HA sections-view
 * YAML schema (home-assistant.io/dashboards/sections + /views, verified
 * 2026-08-01). Card configs are open records: HA passes them through to each
 * card's setConfig untouched, and layout keys like grid_options ride along.
 */
export type Tier = 'admin' | 'family' | 'guest';

export interface LovelaceCardConfig {
  readonly type: string;
  readonly [key: string]: unknown;
}

export interface LovelaceSectionConfig {
  readonly type: 'grid';
  readonly column_span?: number;
  readonly cards: ReadonlyArray<LovelaceCardConfig>;
}

export interface LovelaceViewConfig {
  readonly title: string;
  readonly path: string;
  readonly type: 'sections';
  readonly icon?: string;
  readonly subview?: boolean;
  readonly max_columns?: number;
  readonly sections: ReadonlyArray<LovelaceSectionConfig>;
}

export interface LovelaceDashboardConfig {
  readonly title?: string;
  readonly views: ReadonlyArray<LovelaceViewConfig>;
}

export const PATHS = {
  home: 'home',
  media: 'media',
  security: 'security',
  energy: 'energy',
  climates: 'climates',
  car: 'car',
  admin: 'admin',
  language: 'language',
} as const;

export function roomPath(areaId: string): string {
  return `room-${areaId}`;
}

export function isSection(
  section: LovelaceSectionConfig | null,
): section is LovelaceSectionConfig {
  return section !== null;
}

/** Everything section/view builders may read. Builders stay pure over this. */
export interface StrategyContext {
  readonly home: HomeConfig;
  readonly registry: RegistryIndex;
  readonly states: Readonly<Record<string, HassEntity>>;
  readonly locale: Locale;
  readonly tier: Tier;
  readonly hasApexcharts: boolean;
  readonly hasWebrtcCard: boolean;
}
```

- [x] **Step 5: Create `src/testing/mock-registry.ts`**

```ts
import type { HassEntity } from '../types/home-assistant';
import type { Locale } from '../i18n/types';
import { validateHomeConfig, type HomeConfig } from '../strategy/config';
import {
  buildRegistryIndex,
  type AreaEntry,
  type DeviceEntry,
  type EntityEntry,
  type RegistrySnapshot,
} from '../strategy/registry';
import type { StrategyContext, Tier } from '../strategy/types';
import { makeEntity } from './mock-hass';

export function mockArea(areaId: string, name: string, extra: Partial<AreaEntry> = {}): AreaEntry {
  return { area_id: areaId, name, picture: null, labels: [], ...extra };
}

export function mockDevice(
  id: string,
  areaId: string | null = null,
  extra: Partial<DeviceEntry> = {},
): DeviceEntry {
  return { id, area_id: areaId, labels: [], ...extra };
}

export function mockRegEntity(entityId: string, extra: Partial<EntityEntry> = {}): EntityEntry {
  return {
    entity_id: entityId,
    area_id: null,
    device_id: null,
    labels: [],
    hidden_by: null,
    disabled_by: null,
    entity_category: null,
    platform: 'test',
    name: null,
    ...extra,
  };
}

export interface MockContextOptions {
  /**
   * Raw home config merged over { name: 'Test Home' } and validated. The
   * HomeConfig union member lets tests pass reference configs (interfaces are
   * not assignable to Record<string, unknown> under strict TS).
   */
  readonly home?: Record<string, unknown> | HomeConfig;
  readonly snapshot?: RegistrySnapshot;
  readonly entities?: ReadonlyArray<HassEntity>;
  readonly locale?: Locale;
  readonly tier?: Tier;
  readonly hasApexcharts?: boolean;
  readonly hasWebrtcCard?: boolean;
}

export function makeContext(options: MockContextOptions = {}): StrategyContext {
  const snapshot = options.snapshot ?? { areas: [], devices: [], entities: [] };
  const states = Object.fromEntries(
    (options.entities ?? []).map((entity) => [entity.entity_id, entity]),
  );
  return {
    home: validateHomeConfig({ name: 'Test Home', ...(options.home ?? {}) }),
    registry: buildRegistryIndex(snapshot, states),
    states,
    locale: options.locale ?? 'en',
    tier: options.tier ?? 'admin',
    hasApexcharts: options.hasApexcharts ?? false,
    hasWebrtcCard: options.hasWebrtcCard ?? false,
  };
}

/* ------------------------------------------------------------------ */
/* Reference-home registry fixtures (pair with src/strategy/reference-homes.ts) */

export type ReferenceHomeName = 'subang' | 'tungchung' | 'xiamen';

export interface ReferenceHome {
  readonly snapshot: RegistrySnapshot;
  readonly entities: ReadonlyArray<HassEntity>;
}

interface Row {
  readonly id: string;
  readonly state: string;
  readonly area?: string;
  readonly device?: string;
  readonly platform?: string;
  readonly labels?: ReadonlyArray<string>;
  readonly attributes?: Record<string, unknown>;
}

function build(
  areas: ReadonlyArray<AreaEntry>,
  devices: ReadonlyArray<DeviceEntry>,
  rows: ReadonlyArray<Row>,
): ReferenceHome {
  return {
    snapshot: {
      areas,
      devices,
      entities: rows.map((row) =>
        mockRegEntity(row.id, {
          area_id: row.area ?? null,
          device_id: row.device ?? null,
          platform: row.platform ?? 'test',
          labels: row.labels ?? [],
        }),
      ),
    },
    entities: rows.map((row) => makeEntity(row.id, row.state, row.attributes ?? {})),
  };
}

const SUBANG: ReferenceHome = build(
  [
    mockArea('main_living', 'Main Living'),
    mockArea('side_living', 'Side Living'),
    mockArea('master_bedroom', 'Master Bedroom'),
  ],
  [mockDevice('dev-hall-motion', 'main_living')],
  [
    { id: 'light.main_living_pendant', state: 'on', area: 'main_living', attributes: { friendly_name: 'Pendant' } },
    { id: 'light.master_lamp', state: 'off', area: 'master_bedroom' },
    { id: 'climate.main_living_ac', state: 'cool', area: 'main_living' },
    { id: 'climate.master_ac', state: 'off', area: 'master_bedroom' },
    { id: 'fan.side_living_fan', state: 'on', area: 'side_living' },
    { id: 'cover.main_living_shade', state: 'open', area: 'main_living', attributes: { device_class: 'shade', current_position: 70 } },
    { id: 'cover.master_curtain', state: 'closed', area: 'master_bedroom', attributes: { device_class: 'curtain', current_position: 0 } },
    { id: 'sensor.main_living_temp', state: '24.5', area: 'main_living', attributes: { device_class: 'temperature' } },
    { id: 'sensor.main_living_humidity', state: '61', area: 'main_living', attributes: { device_class: 'humidity' } },
    { id: 'sensor.main_living_aqi', state: '18', area: 'main_living', attributes: { device_class: 'aqi' } },
    { id: 'media_player.living_sonos', state: 'playing', area: 'main_living', platform: 'sonos', attributes: { friendly_name: 'Living Sonos', media_title: 'So What' } },
    { id: 'media_player.kitchen_sonos', state: 'idle', platform: 'sonos', attributes: { friendly_name: 'Kitchen Sonos' } },
    { id: 'media_player.living_tv', state: 'off', area: 'main_living', platform: 'samsungtv', attributes: { device_class: 'tv', friendly_name: 'Living TV' } },
    { id: 'camera.front_gate', state: 'idle', platform: 'dahua', labels: ['ql-primary-camera'] },
    { id: 'camera.porch', state: 'idle', platform: 'dahua' },
    { id: 'person.steven', state: 'home', attributes: { friendly_name: 'Steven' } },
    { id: 'person.mei', state: 'home', attributes: { friendly_name: 'Mei' } },
    { id: 'calendar.family', state: 'off', platform: 'google_calendar' },
    { id: 'todo.family_tasks', state: '3', platform: 'google_tasks' },
    { id: 'weather.subang', state: 'rainy', attributes: { temperature: 31 } },
    { id: 'sensor.shelly_3em_total_power', state: '2350', attributes: { device_class: 'power' } },
    { id: 'sensor.shelly_3em_total_energy_today', state: '12.4', attributes: { device_class: 'energy' } },
    { id: 'sensor.shelly_3em_phase_a_power', state: '820', attributes: { device_class: 'power' } },
    { id: 'sensor.shelly_3em_phase_b_power', state: '640', attributes: { device_class: 'power' } },
    { id: 'sensor.shelly_3em_phase_c_power', state: '890', attributes: { device_class: 'power' } },
    { id: 'binary_sensor.front_door', state: 'off', attributes: { device_class: 'door', friendly_name: 'Front Door' } },
    { id: 'binary_sensor.hall_motion', state: 'off', area: 'main_living', device: 'dev-hall-motion', attributes: { device_class: 'motion', friendly_name: 'Hall Motion' } },
    { id: 'switch.hall_motion_detection', state: 'on', area: 'main_living', device: 'dev-hall-motion', attributes: { friendly_name: 'Hall Motion Detection' } },
    { id: 'switch.living_fan_rf', state: 'off', area: 'main_living', platform: 'broadlink', attributes: { friendly_name: 'Ceiling Fan' } },
    { id: 'switch.nr_guest_wifi', state: 'on', attributes: { friendly_name: 'Guest Wi-Fi' } },
    { id: 'switch.nr_plex_forward', state: 'off', attributes: { friendly_name: 'Plex port forward' } },
    { id: 'sensor.bmw_battery', state: '76', attributes: { device_class: 'battery' } },
    { id: 'sensor.bmw_range', state: '412' },
    { id: 'binary_sensor.bmw_lock', state: 'off', attributes: { device_class: 'lock' } },
    { id: 'device_tracker.bmw', state: 'home' },
  ],
);

const TUNGCHUNG: ReferenceHome = build(
  [mockArea('living', 'Living Room'), mockArea('bedroom', 'Bedroom')],
  [mockDevice('dev-living-motion', 'living')],
  [
    { id: 'light.living_ceiling', state: 'on', area: 'living' },
    { id: 'light.bedroom_lamp', state: 'off', area: 'bedroom' },
    { id: 'climate.living_ac', state: 'cool', area: 'living' },
    { id: 'cover.living_curtain', state: 'open', area: 'living', attributes: { device_class: 'curtain', current_position: 100 } },
    { id: 'sensor.living_temp', state: '27.0', area: 'living', attributes: { device_class: 'temperature' } },
    { id: 'sensor.living_aqi', state: '35', area: 'living', attributes: { device_class: 'aqi' } },
    { id: 'media_player.lg_tv', state: 'off', area: 'living', platform: 'webostv', attributes: { device_class: 'tv' } },
    { id: 'camera.srihome_living', state: 'idle', platform: 'generic' },
    { id: 'person.steven', state: 'home', attributes: { friendly_name: 'Steven' } },
    { id: 'calendar.family', state: 'off', platform: 'google_calendar' },
    { id: 'todo.family_tasks', state: '1', platform: 'google_tasks' },
    { id: 'weather.tungchung', state: 'sunny', attributes: { temperature: 29 } },
    { id: 'binary_sensor.entry_door', state: 'off', attributes: { device_class: 'door' } },
    { id: 'binary_sensor.living_motion', state: 'off', area: 'living', device: 'dev-living-motion', attributes: { device_class: 'motion' } },
    { id: 'switch.living_motion_detection', state: 'on', area: 'living', device: 'dev-living-motion' },
    { id: 'switch.bedroom_fan_rf', state: 'off', area: 'bedroom', platform: 'broadlink' },
    { id: 'switch.nr_cam_uplink', state: 'on' },
    { id: 'sensor.audi_battery', state: '58', attributes: { device_class: 'battery' } },
    { id: 'sensor.audi_range', state: '230' },
  ],
);

const XIAMEN: ReferenceHome = build(
  [mockArea('living', 'Living Room'), mockArea('bedroom', 'Bedroom'), mockArea('storage', 'Storage')],
  [mockDevice('dev-entry-motion', 'living')],
  [
    { id: 'light.living_ceiling', state: 'on', area: 'living' },
    { id: 'light.storage_light', state: 'off', area: 'storage' },
    { id: 'climate.living_ac', state: 'cool', area: 'living' },
    { id: 'climate.bedroom_ac', state: 'off', area: 'bedroom' },
    { id: 'cover.living_curtain', state: 'open', area: 'living', attributes: { device_class: 'curtain', current_position: 100 } },
    { id: 'sensor.living_temp', state: '26.1', area: 'living', attributes: { device_class: 'temperature' } },
    { id: 'sensor.living_aqi', state: '52', area: 'living', attributes: { device_class: 'aqi' } },
    { id: 'media_player.tcl_tv', state: 'off', area: 'living', platform: 'tcl', attributes: { device_class: 'tv' } },
    { id: 'camera.dahua_living', state: 'idle', platform: 'dahua' },
    { id: 'vacuum.dreame_x30', state: 'docked', attributes: { battery_level: 100, friendly_name: 'Dreame X30 Pro' } },
    { id: 'person.steven', state: 'not_home', attributes: { friendly_name: 'Steven' } },
    { id: 'weather.xiamen', state: 'cloudy', attributes: { temperature: 33 } },
    { id: 'binary_sensor.entry_door', state: 'off', attributes: { device_class: 'door' } },
    { id: 'binary_sensor.entry_motion', state: 'off', area: 'living', device: 'dev-entry-motion', attributes: { device_class: 'motion' } },
    { id: 'switch.entry_motion_detection', state: 'on', area: 'living', device: 'dev-entry-motion' },
    { id: 'sensor.liauto_battery', state: '64', attributes: { device_class: 'battery' } },
    { id: 'sensor.liauto_fuel', state: '41' },
    { id: 'sensor.liauto_range', state: '588' },
  ],
);

export function referenceHome(name: ReferenceHomeName): ReferenceHome {
  return { subang: SUBANG, tungchung: TUNGCHUNG, xiamen: XIAMEN }[name];
}
```

- [x] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/strategy/registry.test.ts src/strategy/types.test.ts src/strategy/config.test.ts`
Expected: PASS.

- [x] **Step 7: Lint + typecheck, then commit**

Run: `npm run lint && npm run typecheck` — expected clean.

```bash
git add src/strategy/registry.ts src/strategy/registry.test.ts src/strategy/types.ts src/testing/mock-registry.ts
git commit -m "$(cat <<'EOF'
feat(strategy): add registry index bucketing and mock registry fixtures

- buildRegistryIndex: area/domain/device_class bucketing, ql-* label
  rules, favorites-first ordering, device siblings
- StrategyContext type for pure builders
- mock-registry: fixture builders, makeContext, three reference-home
  synthetic inventories matching the spec §2 matrix

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

---

### Task 5: Heading helpers + rooms grid section

**Files:**
- Create: `src/strategy/sections/heading.ts`
- Create: `src/strategy/sections/rooms.ts`
- Create: `src/strategy/sections/rooms.test.ts`

No new i18n keys (`section.rooms` already exists from Plan 3a).

- [x] **Step 1: Write the failing test**

`src/strategy/sections/rooms.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { t } from '../../i18n/translate';
import { makeEntity } from '../../testing/mock-hass';
import { makeContext, mockArea, mockRegEntity } from '../../testing/mock-registry';
import { headingCard, sectionOf } from './heading';
import { orderedAreas, roomCardFor, roomPhoto, roomsSection } from './rooms';

const snapshot = {
  areas: [
    mockArea('living', 'Living Room'),
    mockArea('bedroom', 'Bedroom'),
    mockArea('empty', 'Empty Room'),
  ],
  devices: [],
  entities: [
    mockRegEntity('light.living_ceiling', { area_id: 'living' }),
    mockRegEntity('climate.living_ac', { area_id: 'living' }),
    mockRegEntity('sensor.living_temp', { area_id: 'living' }),
    mockRegEntity('light.bedroom_lamp', { area_id: 'bedroom' }),
  ],
};
const entities = [
  makeEntity('light.living_ceiling', 'on'),
  makeEntity('climate.living_ac', 'cool'),
  makeEntity('sensor.living_temp', '24.0', { device_class: 'temperature' }),
  makeEntity('light.bedroom_lamp', 'off'),
];

describe('headingCard / sectionOf', () => {
  it('renders translated headings with optional navigation', () => {
    expect(headingCard('en', 'section.rooms')).toEqual({ type: 'heading', heading: 'Rooms' });
    expect(headingCard('zh-Hant', 'section.rooms', '/quiet-luxe/home')).toEqual({
      type: 'heading',
      heading: t('zh-Hant', 'section.rooms'),
      tap_action: { action: 'navigate', navigation_path: '/quiet-luxe/home' },
    });
  });

  it('returns null when there are no cards (missing integration never renders)', () => {
    expect(sectionOf(headingCard('en', 'section.rooms'), [])).toBeNull();
  });
});

describe('orderedAreas', () => {
  it('drops areas with no visible entities and honours room_order, then name order', () => {
    const ctx = makeContext({ home: { room_order: ['bedroom'] }, snapshot, entities });
    expect(orderedAreas(ctx).map((area) => area.area_id)).toEqual(['bedroom', 'living']);
  });

  it('drops rooms hidden by override', () => {
    const ctx = makeContext({ home: { rooms: { bedroom: { hidden: true } } }, snapshot, entities });
    expect(orderedAreas(ctx).map((area) => area.area_id)).toEqual(['living']);
  });
});

describe('roomPhoto', () => {
  it('prefers override photo, then area picture, then the photo_base default', () => {
    const ctx = makeContext({
      home: { rooms: { living: { photo: '/local/custom.jpg' } } },
      snapshot,
      entities,
    });
    expect(roomPhoto(ctx.home, mockArea('living', 'Living Room'))).toBe('/local/custom.jpg');
    expect(
      roomPhoto(ctx.home, mockArea('bedroom', 'Bedroom', { picture: '/api/area.jpg' })),
    ).toBe('/api/area.jpg');
    expect(roomPhoto(ctx.home, mockArea('bedroom', 'Bedroom'))).toBe(
      '/local/quiet-luxe/rooms/bedroom.jpg',
    );
  });
});

describe('roomCardFor / roomsSection', () => {
  it('emits the full room card config for a populated area', () => {
    const ctx = makeContext({ snapshot, entities });
    expect(roomCardFor(ctx, mockArea('living', 'Living Room'))).toEqual({
      type: 'custom:quiet-luxe-room-card',
      name: 'Living Room',
      image: '/local/quiet-luxe/rooms/living.jpg',
      navigation_path: '/quiet-luxe/room-living',
      temperature_entity: 'sensor.living_temp',
      aqi_entity: undefined,
      lights_entity: 'light.living_ceiling',
      chips: [{ entity: 'light.living_ceiling' }, { entity: 'climate.living_ac' }],
      grid_options: { columns: 6 },
    });
  });

  it('returns a two-column section with heading, and null on an empty registry', () => {
    const populated = roomsSection(makeContext({ snapshot, entities }));
    expect(populated?.column_span).toBe(2);
    expect(populated?.cards[0]).toEqual({ type: 'heading', heading: 'Rooms' });
    expect(populated?.cards).toHaveLength(3); // heading + living + bedroom
    expect(roomsSection(makeContext({}))).toBeNull();
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run src/strategy/sections/rooms.test.ts`
Expected: FAIL — modules do not exist.

- [x] **Step 3: Implement `src/strategy/sections/heading.ts`**

```ts
import type { TranslationKey } from '../../i18n/locales/en';
import { t } from '../../i18n/translate';
import type { Locale } from '../../i18n/types';
import type { LovelaceCardConfig, LovelaceSectionConfig } from '../types';

/** Native HA heading card; tap_action navigates when a path is given. */
export function headingCard(
  locale: Locale,
  key: TranslationKey,
  navigationPath?: string,
): LovelaceCardConfig {
  if (navigationPath === undefined) {
    return { type: 'heading', heading: t(locale, key) };
  }
  return {
    type: 'heading',
    heading: t(locale, key),
    tap_action: { action: 'navigate', navigation_path: navigationPath },
  };
}

/** null when there is nothing beyond the heading — spec §8 graceful omission. */
export function sectionOf(
  heading: LovelaceCardConfig,
  cards: ReadonlyArray<LovelaceCardConfig>,
  columnSpan?: number,
): LovelaceSectionConfig | null {
  if (cards.length === 0) {
    return null;
  }
  const section: LovelaceSectionConfig = { type: 'grid', cards: [heading, ...cards] };
  return columnSpan === undefined ? section : { ...section, column_span: columnSpan };
}
```

- [x] **Step 4: Implement `src/strategy/sections/rooms.ts`**

```ts
import { DEFAULT_PHOTO_BASE, viewUrl, type HomeConfig } from '../config';
import type { AreaEntry } from '../registry';
import {
  roomPath,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type StrategyContext,
} from '../types';
import { headingCard, sectionOf } from './heading';

export function roomName(home: HomeConfig, area: AreaEntry): string {
  return home.rooms?.[area.area_id]?.name ?? area.name;
}

/** Photo precedence: config override → HA area picture → photo_base default. */
export function roomPhoto(home: HomeConfig, area: AreaEntry): string {
  const override = home.rooms?.[area.area_id]?.photo;
  if (override !== undefined) {
    return override;
  }
  if (area.picture !== null) {
    return area.picture;
  }
  return `${home.photo_base ?? DEFAULT_PHOTO_BASE}/${area.area_id}.jpg`;
}

/** Visible areas: not hidden by override, at least one visible entity; room_order first, then name. */
export function orderedAreas(ctx: StrategyContext): ReadonlyArray<AreaEntry> {
  const order = ctx.home.room_order ?? [];
  const rank = (area: AreaEntry): number => {
    const index = order.indexOf(area.area_id);
    return index === -1 ? order.length : index;
  };
  return ctx.registry.areas
    .filter((area) => ctx.home.rooms?.[area.area_id]?.hidden !== true)
    .filter((area) => ctx.registry.inAreaAll(area.area_id).length > 0)
    .slice()
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export function roomCardFor(ctx: StrategyContext, area: AreaEntry): LovelaceCardConfig {
  const { registry } = ctx;
  const areaId = area.area_id;
  const chips = [
    registry.inArea(areaId, 'light')[0],
    registry.inArea(areaId, 'climate')[0],
    registry.inArea(areaId, 'cover')[0],
    registry.inArea(areaId, 'media_player', 'tv')[0],
  ]
    .filter((entity): entity is string => entity !== undefined)
    .map((entity) => ({ entity }));
  return {
    type: 'custom:quiet-luxe-room-card',
    name: roomName(ctx.home, area),
    image: roomPhoto(ctx.home, area),
    navigation_path: viewUrl(ctx.home, roomPath(areaId)),
    temperature_entity: registry.inArea(areaId, 'sensor', 'temperature')[0],
    aqi_entity: registry.inArea(areaId, 'sensor', 'aqi')[0],
    lights_entity: registry.inArea(areaId, 'light')[0],
    chips,
    grid_options: { columns: 6 },
  };
}

/** Home "Rooms" grid: 2-per-row photo cards spanning two view columns (spec §6). */
export function roomsSection(ctx: StrategyContext): LovelaceSectionConfig | null {
  const cards = orderedAreas(ctx).map((area) => roomCardFor(ctx, area));
  return sectionOf(headingCard(ctx.locale, 'section.rooms'), cards, 2);
}
```

- [x] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/strategy/sections/rooms.test.ts`
Expected: PASS.

- [x] **Step 6: Lint + typecheck, then commit**

Run: `npm run lint && npm run typecheck` — expected clean.

```bash
git add src/strategy/sections/heading.ts src/strategy/sections/rooms.ts src/strategy/sections/rooms.test.ts
git commit -m "$(cat <<'EOF'
feat(strategy): add rooms grid section builder

- headingCard/sectionOf helpers (heading card + graceful null sections)
- orderedAreas honours room_order, hidden overrides, empty-area drop
- roomCardFor discovers chips/temp/aqi/lights; photo fallback chain

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

---

### Task 6: Climate row + presence sections

**Files:**
- Create: `src/strategy/sections/climate.ts`
- Create: `src/strategy/sections/climate.test.ts`
- Create: `src/strategy/sections/presence.ts`
- Create: `src/strategy/sections/presence.test.ts`
- Modify: `src/i18n/locales/en.ts`, `zh-hant.ts`, `zh-hans.ts`, `ms.ts`, `id.ts`

- [x] **Step 1: Write the failing tests**

`src/strategy/sections/climate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeEntity } from '../../testing/mock-hass';
import { makeContext, mockArea, mockRegEntity } from '../../testing/mock-registry';
import { climateCards, climateEntityIds, climateSection } from './climate';

const snapshot = {
  areas: [mockArea('living', 'Living Room'), mockArea('bedroom', 'Bedroom')],
  devices: [],
  entities: [
    mockRegEntity('climate.living_ac', { area_id: 'living' }),
    mockRegEntity('climate.bedroom_ac', { area_id: 'bedroom' }),
    mockRegEntity('fan.living_purifier', { area_id: 'living' }),
    mockRegEntity('humidifier.bedroom_dehumidifier', { area_id: 'bedroom' }),
  ],
};
const entities = [
  makeEntity('climate.living_ac', 'off'),
  makeEntity('climate.bedroom_ac', 'cool'),
  makeEntity('fan.living_purifier', 'on'),
  makeEntity('humidifier.bedroom_dehumidifier', 'off'),
];

describe('climateEntityIds', () => {
  it('collects climate/fan/humidifier domains, active devices first', () => {
    const ctx = makeContext({ snapshot, entities });
    expect(climateEntityIds(ctx)).toEqual([
      'climate.bedroom_ac',
      'fan.living_purifier',
      'climate.living_ac',
      'humidifier.bedroom_dehumidifier',
    ]);
  });

  it('scopes to an area when given', () => {
    const ctx = makeContext({ snapshot, entities });
    expect(climateEntityIds(ctx, 'living')).toEqual([
      'fan.living_purifier',
      'climate.living_ac',
    ]);
  });
});

describe('climateSection', () => {
  it('limits cards, links the heading to the climates view, sizes cards 4 columns', () => {
    const ctx = makeContext({ snapshot, entities });
    const section = climateSection(ctx, { limit: 3 });
    expect(section?.cards[0]).toMatchObject({
      type: 'heading',
      tap_action: { action: 'navigate', navigation_path: '/quiet-luxe/climates' },
    });
    expect(section?.cards).toHaveLength(4); // heading + 3
    expect(section?.cards[1]).toEqual({
      type: 'custom:quiet-luxe-climate-card',
      entity: 'climate.bedroom_ac',
      grid_options: { columns: 4 },
    });
  });

  it('room-scoped sections have no heading navigation', () => {
    const ctx = makeContext({ snapshot, entities });
    const section = climateSection(ctx, { areaId: 'living' });
    expect(section?.cards[0]).toEqual({
      type: 'heading',
      heading: 'Climate',
    });
  });

  it('returns null when the home has no climate devices', () => {
    expect(climateSection(makeContext({}))).toBeNull();
    expect(climateCards(makeContext({}))).toEqual([]);
  });
});
```

`src/strategy/sections/presence.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeEntity } from '../../testing/mock-hass';
import { makeContext, mockRegEntity } from '../../testing/mock-registry';
import { presenceSection } from './presence';

describe('presenceSection', () => {
  it('emits a single presence row over all person entities', () => {
    const ctx = makeContext({
      snapshot: {
        areas: [],
        devices: [],
        entities: [mockRegEntity('person.mei'), mockRegEntity('person.steven')],
      },
      entities: [makeEntity('person.mei', 'home'), makeEntity('person.steven', 'not_home')],
    });
    const section = presenceSection(ctx);
    expect(section?.cards[0]).toEqual({ type: 'heading', heading: 'Presence' });
    expect(section?.cards[1]).toEqual({
      type: 'custom:ql-row-presence',
      entities: ['person.mei', 'person.steven'],
    });
  });

  it('returns null when there are no person entities', () => {
    expect(presenceSection(makeContext({}))).toBeNull();
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run src/strategy/sections/climate.test.ts src/strategy/sections/presence.test.ts`
Expected: FAIL — modules do not exist (and the `section.presence` key does not exist).

- [x] **Step 3: Add the i18n key** — one row in each locale file (before `} as const;` in `en.ts`; matching position in the other four):

```
en.ts:       'section.presence': 'Presence',
zh-hant.ts:  'section.presence': '在家狀態',
zh-hans.ts:  'section.presence': '在家状态',
ms.ts:       'section.presence': 'Kehadiran',
id.ts:       'section.presence': 'Kehadiran',
```

- [x] **Step 4: Implement `src/strategy/sections/climate.ts`**

```ts
import { viewUrl } from '../config';
import {
  PATHS,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type StrategyContext,
} from '../types';
import { headingCard, sectionOf } from './heading';

/** Spec climate row covers ACs, fans/purifiers, dehumidifiers (§6). */
export const CLIMATE_DOMAINS = ['climate', 'fan', 'humidifier'] as const;

const INACTIVE_STATES = new Set(['off', 'unavailable', 'unknown', 'idle']);

/** "Active devices first" sort (spec §6), stable within groups. */
export function climateEntityIds(ctx: StrategyContext, areaId?: string): ReadonlyArray<string> {
  const ids = CLIMATE_DOMAINS.flatMap((domain) =>
    areaId === undefined ? ctx.registry.all(domain) : ctx.registry.inArea(areaId, domain),
  );
  const inactiveRank = (id: string): number =>
    INACTIVE_STATES.has(ctx.states[id]?.state ?? 'unavailable') ? 1 : 0;
  return [...ids].sort((a, b) => inactiveRank(a) - inactiveRank(b));
}

export function climateCards(
  ctx: StrategyContext,
  areaId?: string,
  limit?: number,
): ReadonlyArray<LovelaceCardConfig> {
  const ids = climateEntityIds(ctx, areaId);
  const scoped = limit === undefined ? ids : ids.slice(0, limit);
  return scoped.map((entity) => ({
    type: 'custom:quiet-luxe-climate-card',
    entity,
    grid_options: { columns: 4 },
  }));
}

export interface ClimateSectionOptions {
  readonly areaId?: string;
  readonly limit?: number;
}

export function climateSection(
  ctx: StrategyContext,
  options: ClimateSectionOptions = {},
): LovelaceSectionConfig | null {
  const nav = options.areaId === undefined ? viewUrl(ctx.home, PATHS.climates) : undefined;
  return sectionOf(
    headingCard(ctx.locale, 'section.climate', nav),
    climateCards(ctx, options.areaId, options.limit),
  );
}
```

- [x] **Step 5: Implement `src/strategy/sections/presence.ts`**

```ts
import type { LovelaceSectionConfig, StrategyContext } from '../types';
import { headingCard, sectionOf } from './heading';

export function presenceSection(ctx: StrategyContext): LovelaceSectionConfig | null {
  const persons = ctx.registry.all('person');
  if (persons.length === 0) {
    return null;
  }
  return sectionOf(headingCard(ctx.locale, 'section.presence'), [
    { type: 'custom:ql-row-presence', entities: persons },
  ]);
}
```

- [x] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/strategy/sections/climate.test.ts src/strategy/sections/presence.test.ts src/i18n/i18n.test.ts`
Expected: PASS (including the locale-parity test).

- [x] **Step 7: Lint + typecheck, then commit**

```bash
git add src/strategy/sections/climate.ts src/strategy/sections/climate.test.ts src/strategy/sections/presence.ts src/strategy/sections/presence.test.ts src/i18n/locales
git commit -m "$(cat <<'EOF'
feat(strategy): add climate and presence section builders

- climate row: climate/fan/humidifier domains, active-first, limit,
  heading links to the All Climates view
- presence row over person entities
- i18n: section.presence in all five locales

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

---

### Task 7: Security sections + room "Air & sensors" section

**Files:**
- Create: `src/strategy/sections/security.ts`
- Create: `src/strategy/sections/security.test.ts`
- Create: `src/strategy/sections/sensors.ts`
- Create: `src/strategy/sections/sensors.test.ts`
- Modify: all five locale files

- [x] **Step 1: Write the failing tests**

`src/strategy/sections/security.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeEntity } from '../../testing/mock-hass';
import { makeContext, mockArea, mockDevice, mockRegEntity } from '../../testing/mock-registry';
import {
  cameraWallCards,
  doorMotionRows,
  orderedCameras,
  securitySection,
  securityViewSections,
} from './security';

const snapshot = {
  areas: [mockArea('living', 'Living Room')],
  devices: [mockDevice('dev-motion', 'living')],
  entities: [
    mockRegEntity('camera.back', {}),
    mockRegEntity('camera.front', { labels: ['ql-primary-camera'] }),
    mockRegEntity('camera.side', {}),
    mockRegEntity('binary_sensor.front_door', {}),
    mockRegEntity('binary_sensor.hall_motion', { device_id: 'dev-motion' }),
    mockRegEntity('switch.hall_motion_detection', { device_id: 'dev-motion' }),
  ],
};
const entities = [
  makeEntity('camera.back', 'idle'),
  makeEntity('camera.front', 'idle'),
  makeEntity('camera.side', 'idle'),
  makeEntity('binary_sensor.front_door', 'off', { device_class: 'door' }),
  makeEntity('binary_sensor.hall_motion', 'off', { device_class: 'motion' }),
  makeEntity('switch.hall_motion_detection', 'on'),
];

describe('orderedCameras / securitySection', () => {
  it('puts the ql-primary-camera first and shows two glance thumbs', () => {
    const ctx = makeContext({ snapshot, entities });
    expect(orderedCameras(ctx)).toEqual(['camera.front', 'camera.back', 'camera.side']);
    const section = securitySection(ctx);
    expect(section?.cards).toHaveLength(3); // heading + 2 thumbs
    expect(section?.cards[1]).toEqual({
      type: 'custom:quiet-luxe-camera-card',
      entity: 'camera.front',
      form: 'glance',
      grid_options: { columns: 6 },
    });
  });

  it('returns null when there are no cameras', () => {
    expect(securitySection(makeContext({}))).toBeNull();
  });
});

describe('doorMotionRows', () => {
  it('emits door rows and motion rows with discovered same-device toggles', () => {
    const ctx = makeContext({ snapshot, entities });
    expect(doorMotionRows(ctx)).toEqual([
      { type: 'custom:ql-row-door-motion', entity: 'binary_sensor.front_door', kind: 'door' },
      {
        type: 'custom:ql-row-door-motion',
        entity: 'binary_sensor.hall_motion',
        kind: 'motion',
        toggle_entity: 'switch.hall_motion_detection',
        show_toggle: true,
      },
    ]);
  });

  it('hides motion toggles from the guest tier (spec §9)', () => {
    const ctx = makeContext({ snapshot, entities, tier: 'guest' });
    const motion = doorMotionRows(ctx).find((row) => row.kind === 'motion');
    expect(motion?.show_toggle).toBe(false);
  });

  it('scopes to an area when given', () => {
    const ctx = makeContext({ snapshot, entities });
    expect(doorMotionRows(ctx, 'living').map((row) => row.entity)).toEqual([
      'binary_sensor.hall_motion',
    ]);
  });
});

describe('cameraWallCards / securityViewSections', () => {
  it('uses webrtc-camera when the engine is webrtc AND the card is installed', () => {
    const ctx = makeContext({
      home: { camera_engine: 'webrtc' },
      snapshot,
      entities,
      hasWebrtcCard: true,
    });
    expect(cameraWallCards(ctx)[0]).toEqual({ type: 'custom:webrtc-camera', entity: 'camera.front' });
  });

  it('falls back to snapshot full cards otherwise', () => {
    const ctx = makeContext({ home: { camera_engine: 'webrtc' }, snapshot, entities });
    expect(cameraWallCards(ctx)[0]).toEqual({
      type: 'custom:quiet-luxe-camera-card',
      entity: 'camera.front',
      form: 'full',
    });
  });

  it('view sections cover the wall and the door/motion list; empty home yields none', () => {
    const sections = securityViewSections(makeContext({ snapshot, entities }));
    expect(sections).toHaveLength(2);
    expect(securityViewSections(makeContext({}))).toEqual([]);
  });
});
```

`src/strategy/sections/sensors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeEntity } from '../../testing/mock-hass';
import { makeContext, mockArea, mockRegEntity } from '../../testing/mock-registry';
import { sensorsSection, sensorTiles } from './sensors';

const snapshot = {
  areas: [mockArea('living', 'Living Room')],
  devices: [],
  entities: [
    mockRegEntity('sensor.living_temp', { area_id: 'living' }),
    mockRegEntity('sensor.living_humidity', { area_id: 'living' }),
    mockRegEntity('sensor.living_aqi', { area_id: 'living' }),
    mockRegEntity('binary_sensor.living_door', { area_id: 'living' }),
  ],
};
const entities = [
  makeEntity('sensor.living_temp', '24.5', { device_class: 'temperature' }),
  makeEntity('sensor.living_humidity', '61', { device_class: 'humidity' }),
  makeEntity('sensor.living_aqi', '18', { device_class: 'aqi' }),
  makeEntity('binary_sensor.living_door', 'off', { device_class: 'door' }),
];

describe('sensorTiles / sensorsSection', () => {
  it('maps device classes to sensor-tile metrics in fixed order', () => {
    const ctx = makeContext({ snapshot, entities });
    expect(sensorTiles(ctx, 'living')).toEqual([
      {
        type: 'custom:quiet-luxe-sensor-tile',
        entity: 'sensor.living_temp',
        metric: 'temp',
        grid_options: { columns: 3, rows: 1 },
      },
      {
        type: 'custom:quiet-luxe-sensor-tile',
        entity: 'sensor.living_humidity',
        metric: 'humidity',
        grid_options: { columns: 3, rows: 1 },
      },
      {
        type: 'custom:quiet-luxe-sensor-tile',
        entity: 'sensor.living_aqi',
        metric: 'aqi',
        grid_options: { columns: 3, rows: 1 },
      },
    ]);
  });

  it('appends door/motion rows and titles the section "Air & sensors"', () => {
    const ctx = makeContext({ snapshot, entities });
    const section = sensorsSection(ctx, 'living');
    expect(section?.cards[0]).toEqual({ type: 'heading', heading: 'Air & sensors' });
    expect(section?.cards).toHaveLength(5); // heading + 3 tiles + 1 door row
  });

  it('returns null for an area with neither sensors nor door/motion', () => {
    expect(sensorsSection(makeContext({ snapshot, entities }), 'nowhere')).toBeNull();
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run src/strategy/sections/security.test.ts src/strategy/sections/sensors.test.ts`
Expected: FAIL — modules and keys missing.

- [x] **Step 3: Add the i18n keys** (all five locale files):

```
en.ts:       'section.sensors': 'Air & sensors',
             'section.doors': 'Doors & motion',
zh-hant.ts:  'section.sensors': '空氣與感測',
             'section.doors': '門窗與動態',
zh-hans.ts:  'section.sensors': '空气与传感',
             'section.doors': '门窗与动态',
ms.ts:       'section.sensors': 'Udara & penderia',
             'section.doors': 'Pintu & pergerakan',
id.ts:       'section.sensors': 'Udara & sensor',
             'section.doors': 'Pintu & gerakan',
```

- [x] **Step 4: Implement `src/strategy/sections/security.ts`**

```ts
import { LABEL_PRIMARY_CAMERA } from '../registry';
import { viewUrl } from '../config';
import {
  isSection,
  PATHS,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type StrategyContext,
} from '../types';
import { headingCard, sectionOf } from './heading';

const DOOR_CLASSES = ['door', 'window', 'garage_door', 'opening'] as const;

export function orderedCameras(ctx: StrategyContext): ReadonlyArray<string> {
  const primaryRank = (id: string): number =>
    ctx.registry.hasLabel(id, LABEL_PRIMARY_CAMERA) ? 0 : 1;
  return [...ctx.registry.all('camera')].sort((a, b) => primaryRank(a) - primaryRank(b));
}

/** Home glance: two thumbnails, primary camera first (spec §6). */
export function securitySection(ctx: StrategyContext): LovelaceSectionConfig | null {
  const cards = orderedCameras(ctx)
    .slice(0, 2)
    .map((entity) => ({
      type: 'custom:quiet-luxe-camera-card',
      entity,
      form: 'glance',
      grid_options: { columns: 6 },
    }));
  return sectionOf(headingCard(ctx.locale, 'section.cameras', viewUrl(ctx.home, PATHS.security)), cards);
}

function motionRow(ctx: StrategyContext, entity: string): LovelaceCardConfig {
  const toggle = ctx.registry.siblings(entity).find((id) => id.startsWith('switch.'));
  return {
    type: 'custom:ql-row-door-motion',
    entity,
    kind: 'motion',
    toggle_entity: toggle,
    show_toggle: ctx.tier !== 'guest' && toggle !== undefined,
  };
}

export function doorMotionRows(
  ctx: StrategyContext,
  areaId?: string,
): ReadonlyArray<LovelaceCardConfig> {
  const source = (deviceClass: string): ReadonlyArray<string> =>
    areaId === undefined
      ? ctx.registry.all('binary_sensor', deviceClass)
      : ctx.registry.inArea(areaId, 'binary_sensor', deviceClass);
  const doors = DOOR_CLASSES.flatMap((deviceClass) => source(deviceClass)).map((entity) => ({
    type: 'custom:ql-row-door-motion',
    entity,
    kind: 'door',
  }));
  const motions = source('motion').map((entity) => motionRow(ctx, entity));
  return [...doors, ...motions];
}

/** Camera wall: webrtc-camera when engine + community card allow, else snapshot (D6). */
export function cameraWallCards(ctx: StrategyContext): ReadonlyArray<LovelaceCardConfig> {
  const useWebrtc = ctx.home.camera_engine === 'webrtc' && ctx.hasWebrtcCard;
  return orderedCameras(ctx).map((entity) =>
    useWebrtc
      ? { type: 'custom:webrtc-camera', entity }
      : { type: 'custom:quiet-luxe-camera-card', entity, form: 'full' },
  );
}

export function securityViewSections(ctx: StrategyContext): ReadonlyArray<LovelaceSectionConfig> {
  return [
    sectionOf(headingCard(ctx.locale, 'section.cameras'), cameraWallCards(ctx)),
    sectionOf(headingCard(ctx.locale, 'section.doors'), doorMotionRows(ctx)),
  ].filter(isSection);
}
```

- [x] **Step 5: Implement `src/strategy/sections/sensors.ts`**

```ts
import type { SensorMetric } from '../../cards/sensor-format';
import type { LovelaceCardConfig, LovelaceSectionConfig, StrategyContext } from '../types';
import { headingCard, sectionOf } from './heading';
import { doorMotionRows } from './security';

const TILE_METRICS: ReadonlyArray<{ readonly metric: SensorMetric; readonly deviceClass: string }> = [
  { metric: 'temp', deviceClass: 'temperature' },
  { metric: 'humidity', deviceClass: 'humidity' },
  { metric: 'aqi', deviceClass: 'aqi' },
];

export function sensorTiles(ctx: StrategyContext, areaId: string): ReadonlyArray<LovelaceCardConfig> {
  return TILE_METRICS.flatMap(({ metric, deviceClass }) =>
    ctx.registry.inArea(areaId, 'sensor', deviceClass).map((entity) => ({
      type: 'custom:quiet-luxe-sensor-tile',
      entity,
      metric,
      grid_options: { columns: 3, rows: 1 },
    })),
  );
}

/** Room "Air & sensors" (spec §6): tiles + door/motion rows (toggles per tier). */
export function sensorsSection(ctx: StrategyContext, areaId: string): LovelaceSectionConfig | null {
  const cards = [...sensorTiles(ctx, areaId), ...doorMotionRows(ctx, areaId)];
  return sectionOf(headingCard(ctx.locale, 'section.sensors'), cards);
}
```

- [x] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/strategy/sections/security.test.ts src/strategy/sections/sensors.test.ts src/i18n/i18n.test.ts`
Expected: PASS.

- [x] **Step 7: Lint + typecheck, then commit**

```bash
git add src/strategy/sections/security.ts src/strategy/sections/security.test.ts src/strategy/sections/sensors.ts src/strategy/sections/sensors.test.ts src/i18n/locales
git commit -m "$(cat <<'EOF'
feat(strategy): add security and room-sensor section builders

- Camera glance (primary label first) + engine-aware camera wall (D6)
- Door/motion rows with same-device toggle discovery; guests never
  get motion toggles (spec §9 generation layer)
- Room "Air & sensors" tiles + rows; i18n section.sensors/section.doors

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

---

### Task 8: Media, energy, and schedule sections

**Files:**
- Create: `src/strategy/sections/media.ts` + `media.test.ts`
- Create: `src/strategy/sections/energy.ts` + `energy.test.ts`
- Create: `src/strategy/sections/schedule.ts` + `schedule.test.ts`
- Modify: all five locale files

- [x] **Step 1: Write the failing tests**

`src/strategy/sections/media.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeEntity } from '../../testing/mock-hass';
import { makeContext, mockRegEntity } from '../../testing/mock-registry';
import { mediaSection, mediaViewSections, orderedPlayers, sonosGroupRows } from './media';

const snapshot = {
  areas: [],
  devices: [],
  entities: [
    mockRegEntity('media_player.bedroom_sonos', { platform: 'sonos' }),
    mockRegEntity('media_player.living_sonos', { platform: 'sonos' }),
    mockRegEntity('media_player.tv', { platform: 'samsungtv' }),
  ],
};
const entities = [
  makeEntity('media_player.bedroom_sonos', 'idle'),
  makeEntity('media_player.living_sonos', 'playing'),
  makeEntity('media_player.tv', 'off'),
];

describe('orderedPlayers / mediaSection', () => {
  it('puts playing players first and emits the collapsed bar for the hero', () => {
    const ctx = makeContext({ snapshot, entities });
    expect(orderedPlayers(ctx)[0]).toBe('media_player.living_sonos');
    const section = mediaSection(ctx);
    expect(section?.cards[1]).toEqual({
      type: 'custom:quiet-luxe-media-card',
      entity: 'media_player.living_sonos',
      form: 'bar',
    });
    expect(section?.cards[0]).toMatchObject({
      tap_action: { action: 'navigate', navigation_path: '/quiet-luxe/media' },
    });
  });

  it('returns null when the home has no media players', () => {
    expect(mediaSection(makeContext({}))).toBeNull();
  });
});

describe('sonosGroupRows / mediaViewSections', () => {
  it('builds group rows for every Sonos speaker with the hero as leader', () => {
    const ctx = makeContext({ home: { media_rich: true }, snapshot, entities });
    expect(sonosGroupRows(ctx)).toEqual([
      {
        type: 'custom:quiet-luxe-media-card',
        entity: 'media_player.living_sonos',
        form: 'group-row',
        leader: 'media_player.living_sonos',
      },
      {
        type: 'custom:quiet-luxe-media-card',
        entity: 'media_player.bedroom_sonos',
        form: 'group-row',
        leader: 'media_player.living_sonos',
      },
    ]);
  });

  it('media view: hero player + speakers; group builder only when media_rich', () => {
    const rich = mediaViewSections(makeContext({ home: { media_rich: true }, snapshot, entities }));
    expect(rich).toHaveLength(3);
    expect(rich[0].cards[1]).toMatchObject({ form: 'player' });
    const plain = mediaViewSections(makeContext({ snapshot, entities }));
    expect(plain).toHaveLength(2);
    expect(mediaViewSections(makeContext({}))).toEqual([]);
  });

  it('needs at least two Sonos speakers for group rows', () => {
    const ctx = makeContext({
      home: { media_rich: true },
      snapshot: { areas: [], devices: [], entities: [mockRegEntity('media_player.solo', { platform: 'sonos' })] },
      entities: [makeEntity('media_player.solo', 'idle')],
    });
    expect(sonosGroupRows(ctx)).toEqual([]);
  });
});
```

`src/strategy/sections/energy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeContext } from '../../testing/mock-registry';
import { energySection, energyViewSections } from './energy';

const energyHome = {
  energy: {
    power_entity: 'sensor.total_power',
    today_entity: 'sensor.today_energy',
    phase_entities: ['sensor.l1', 'sensor.l2', 'sensor.l3'],
  },
};

describe('energySection', () => {
  it('emits the strip card linking to the energy view', () => {
    const section = energySection(makeContext({ home: energyHome }));
    expect(section?.cards[0]).toMatchObject({
      tap_action: { action: 'navigate', navigation_path: '/quiet-luxe/energy' },
    });
    expect(section?.cards[1]).toEqual({
      type: 'custom:quiet-luxe-energy-card',
      form: 'strip',
      power_entity: 'sensor.total_power',
      today_entity: 'sensor.today_energy',
    });
  });

  it('returns null when energy is disabled', () => {
    expect(energySection(makeContext({}))).toBeNull();
  });
});

describe('energyViewSections', () => {
  it('renders strip + one ring per phase, chart only when apexcharts is installed', () => {
    const withChart = energyViewSections(makeContext({ home: energyHome, hasApexcharts: true }));
    expect(withChart).toHaveLength(1);
    const cards = withChart[0].cards;
    expect(cards).toHaveLength(6); // heading + strip + 3 rings + chart
    expect(cards[2]).toEqual({
      type: 'custom:quiet-luxe-energy-card',
      form: 'ring',
      power_entity: 'sensor.l1',
      name: 'L1',
      grid_options: { columns: 4 },
    });
    expect(cards[5]).toMatchObject({ type: 'custom:apexcharts-card' });
  });

  it('omits the chart when apexcharts-card is absent (graceful degradation)', () => {
    const sections = energyViewSections(makeContext({ home: energyHome }));
    expect(
      sections[0].cards.some((card) => card.type === 'custom:apexcharts-card'),
    ).toBe(false);
  });

  it('returns no sections when energy is disabled', () => {
    expect(energyViewSections(makeContext({}))).toEqual([]);
  });
});
```

`src/strategy/sections/schedule.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeEntity } from '../../testing/mock-hass';
import { makeContext, mockRegEntity } from '../../testing/mock-registry';
import { scheduleSection } from './schedule';

const snapshot = {
  areas: [],
  devices: [],
  entities: [
    mockRegEntity('calendar.family', { platform: 'google_calendar' }),
    mockRegEntity('todo.family_tasks', { platform: 'google_tasks' }),
  ],
};
const entities = [makeEntity('calendar.family', 'off'), makeEntity('todo.family_tasks', '3')];

describe('scheduleSection', () => {
  it('emits schedule + tasks cards from discovered calendar/todo entities', () => {
    const section = scheduleSection(makeContext({ home: { calendar: 'google' }, snapshot, entities }));
    expect(section?.cards[1]).toEqual({
      type: 'custom:quiet-luxe-schedule-card',
      calendars: ['calendar.family'],
      todo_entity: 'todo.family_tasks',
      days: 7,
    });
    expect(section?.cards[2]).toEqual({
      type: 'custom:quiet-luxe-tasks-card',
      entity: 'todo.family_tasks',
    });
  });

  it('omits the section entirely when calendar: none (Xiamen rule)', () => {
    expect(scheduleSection(makeContext({ home: { calendar: 'none' }, snapshot, entities }))).toBeNull();
  });

  it('omits the section when the integration is missing despite the flag', () => {
    expect(scheduleSection(makeContext({ home: { calendar: 'google' } }))).toBeNull();
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run src/strategy/sections/media.test.ts src/strategy/sections/energy.test.ts src/strategy/sections/schedule.test.ts`
Expected: FAIL — modules and keys missing.

- [x] **Step 3: Add the i18n keys** (all five locale files):

```
en.ts:       'section.speakers': 'Speakers',
             'section.groups': 'Speaker groups',
             'energy.history': 'History',
zh-hant.ts:  'section.speakers': '喇叭',
             'section.groups': '喇叭群組',
             'energy.history': '歷史',
zh-hans.ts:  'section.speakers': '音箱',
             'section.groups': '音箱分组',
             'energy.history': '历史',
ms.ts:       'section.speakers': 'Pembesar suara',
             'section.groups': 'Kumpulan pembesar suara',
             'energy.history': 'Sejarah',
id.ts:       'section.speakers': 'Speaker',
             'section.groups': 'Grup speaker',
             'energy.history': 'Riwayat',
```

- [x] **Step 4: Implement `src/strategy/sections/media.ts`**

```ts
import { viewUrl } from '../config';
import {
  isSection,
  PATHS,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type StrategyContext,
} from '../types';
import { headingCard, sectionOf } from './heading';

export function orderedPlayers(ctx: StrategyContext, areaId?: string): ReadonlyArray<string> {
  const ids =
    areaId === undefined ? ctx.registry.all('media_player') : ctx.registry.inArea(areaId, 'media_player');
  const playingRank = (id: string): number => (ctx.states[id]?.state === 'playing' ? 0 : 1);
  return [...ids].sort((a, b) => playingRank(a) - playingRank(b));
}

/** Home/room "Music" collapsed bar for the hero player (spec §6). */
export function mediaSection(ctx: StrategyContext, areaId?: string): LovelaceSectionConfig | null {
  const players = orderedPlayers(ctx, areaId);
  if (players.length === 0) {
    return null;
  }
  const nav = areaId === undefined ? viewUrl(ctx.home, PATHS.media) : undefined;
  return sectionOf(headingCard(ctx.locale, 'section.music', nav), [
    { type: 'custom:quiet-luxe-media-card', entity: players[0], form: 'bar' },
  ]);
}

/** Sonos group builder rows (spec §6); leader = hero Sonos speaker. */
export function sonosGroupRows(ctx: StrategyContext): ReadonlyArray<LovelaceCardConfig> {
  const sonos = orderedPlayers(ctx).filter((id) => ctx.registry.platformOf(id) === 'sonos');
  if (sonos.length < 2) {
    return [];
  }
  const leader = sonos[0];
  return sonos.map((entity) => ({
    type: 'custom:quiet-luxe-media-card',
    entity,
    form: 'group-row',
    leader,
  }));
}

/** Media page: full-player hero, per-player bars, group builder when media_rich. */
export function mediaViewSections(ctx: StrategyContext): ReadonlyArray<LovelaceSectionConfig> {
  const players = orderedPlayers(ctx);
  if (players.length === 0) {
    return [];
  }
  const hero = sectionOf(headingCard(ctx.locale, 'section.music'), [
    { type: 'custom:quiet-luxe-media-card', entity: players[0], form: 'player' },
  ]);
  const speakers = sectionOf(
    headingCard(ctx.locale, 'section.speakers'),
    players.slice(1).map((entity) => ({ type: 'custom:quiet-luxe-media-card', entity, form: 'bar' })),
  );
  const groups = ctx.home.media_rich
    ? sectionOf(headingCard(ctx.locale, 'section.groups'), sonosGroupRows(ctx))
    : null;
  return [hero, speakers, groups].filter(isSection);
}
```

- [x] **Step 5: Implement `src/strategy/sections/energy.ts`**

```ts
import { t } from '../../i18n/translate';
import { viewUrl, type EnergyConfig } from '../config';
import {
  isSection,
  PATHS,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type StrategyContext,
} from '../types';
import { headingCard, sectionOf } from './heading';

/** Home glance strip (spec §6 right rail / mobile glance row). */
export function energySection(ctx: StrategyContext): LovelaceSectionConfig | null {
  const energy = ctx.home.energy;
  if (energy === false) {
    return null;
  }
  return sectionOf(headingCard(ctx.locale, 'section.energy', viewUrl(ctx.home, PATHS.energy)), [
    {
      type: 'custom:quiet-luxe-energy-card',
      form: 'strip',
      power_entity: energy.power_entity,
      today_entity: energy.today_entity,
    },
  ]);
}

/** History chart delegated to apexcharts-card (Plan 3b D1 / spec §8). */
export function apexchartsHistoryCard(ctx: StrategyContext, energy: EnergyConfig): LovelaceCardConfig {
  return {
    type: 'custom:apexcharts-card',
    graph_span: '24h',
    header: { show: true, title: t(ctx.locale, 'energy.history') },
    series: [{ entity: energy.power_entity, name: t(ctx.locale, 'common.power'), stroke_width: 2 }],
  };
}

/** Energy page: strip + per-phase rings + chart WHEN apexcharts-card exists (D6). */
export function energyViewSections(ctx: StrategyContext): ReadonlyArray<LovelaceSectionConfig> {
  const energy = ctx.home.energy;
  if (energy === false) {
    return [];
  }
  const strip: LovelaceCardConfig = {
    type: 'custom:quiet-luxe-energy-card',
    form: 'strip',
    power_entity: energy.power_entity,
    today_entity: energy.today_entity,
  };
  const rings = (energy.phase_entities ?? []).map((entity, index) => ({
    type: 'custom:quiet-luxe-energy-card',
    form: 'ring',
    power_entity: entity,
    name: `L${index + 1}`,
    grid_options: { columns: 4 },
  }));
  const chart = ctx.hasApexcharts ? [apexchartsHistoryCard(ctx, energy)] : [];
  return [sectionOf(headingCard(ctx.locale, 'section.energy'), [strip, ...rings, ...chart])].filter(
    isSection,
  );
}
```

- [x] **Step 6: Implement `src/strategy/sections/schedule.ts`**

```ts
import type { LovelaceCardConfig, LovelaceSectionConfig, StrategyContext } from '../types';
import { headingCard, sectionOf } from './heading';

const AGENDA_DAYS = 7;

/** Omitted entirely when calendar: none (Xiamen, spec §2) or nothing discovered. */
export function scheduleSection(ctx: StrategyContext): LovelaceSectionConfig | null {
  if (ctx.home.calendar === 'none') {
    return null;
  }
  const calendars = ctx.registry.all('calendar');
  const todo = ctx.registry.all('todo')[0];
  if (calendars.length === 0 && todo === undefined) {
    return null;
  }
  const cards: LovelaceCardConfig[] = [
    { type: 'custom:quiet-luxe-schedule-card', calendars, todo_entity: todo, days: AGENDA_DAYS },
  ];
  if (todo !== undefined) {
    cards.push({ type: 'custom:quiet-luxe-tasks-card', entity: todo });
  }
  return sectionOf(headingCard(ctx.locale, 'section.schedule'), cards);
}
```

- [x] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/strategy/sections/media.test.ts src/strategy/sections/energy.test.ts src/strategy/sections/schedule.test.ts src/i18n/i18n.test.ts`
Expected: PASS.

- [x] **Step 8: Lint + typecheck, then commit**

```bash
git add src/strategy/sections/media.ts src/strategy/sections/media.test.ts src/strategy/sections/energy.ts src/strategy/sections/energy.test.ts src/strategy/sections/schedule.ts src/strategy/sections/schedule.test.ts src/i18n/locales
git commit -m "$(cat <<'EOF'
feat(strategy): add media, energy, and schedule section builders

- Media: playing-first ordering, collapsed bar, Sonos group builder
  gated on media_rich and >=2 Sonos speakers
- Energy: strip + per-phase rings; apexcharts chart only when installed
- Schedule: calendar:none or missing integration → section never renders
- i18n: section.speakers/section.groups/energy.history ×5 locales

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

---

### Task 9: Car, vacuum, and admin sections

**Files:**
- Create: `src/strategy/sections/car.ts` + `car.test.ts`
- Create: `src/strategy/sections/vacuum.ts` + `vacuum.test.ts`
- Create: `src/strategy/sections/admin.ts` + `admin.test.ts`
- Modify: all five locale files

- [x] **Step 1: Write the failing tests**

`src/strategy/sections/car.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeContext } from '../../testing/mock-registry';
import { carCard, carSection } from './car';

const carHome = {
  car: 'bmw',
  car_entities: { battery_entity: 'sensor.bmw_battery', range_entity: 'sensor.bmw_range' },
};

describe('carCard / carSection', () => {
  it('spreads car_entities into the card config', () => {
    expect(carCard(makeContext({ home: carHome }))).toEqual({
      type: 'custom:quiet-luxe-car-card',
      brand: 'bmw',
      battery_entity: 'sensor.bmw_battery',
      fuel_entity: undefined,
      range_entity: 'sensor.bmw_range',
      lock_entity: undefined,
      precondition_entity: undefined,
      location_entity: undefined,
    });
  });

  it('returns null when car: none', () => {
    expect(carCard(makeContext({}))).toBeNull();
    expect(carSection(makeContext({}))).toBeNull();
  });

  it('is admin-only on the home glance (spec §5)', () => {
    expect(carSection(makeContext({ home: carHome, tier: 'family' }))).toBeNull();
    expect(carSection(makeContext({ home: carHome, tier: 'guest' }))).toBeNull();
    const section = carSection(makeContext({ home: carHome, tier: 'admin' }));
    expect(section?.cards[0]).toMatchObject({
      tap_action: { action: 'navigate', navigation_path: '/quiet-luxe/car' },
    });
  });
});
```

`src/strategy/sections/vacuum.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeEntity } from '../../testing/mock-hass';
import { makeContext, mockRegEntity } from '../../testing/mock-registry';
import { vacuumSection } from './vacuum';

const snapshot = {
  areas: [],
  devices: [],
  entities: [mockRegEntity('vacuum.dreame_x30', { platform: 'dreame_vacuum' })],
};
const entities = [makeEntity('vacuum.dreame_x30', 'docked')];

describe('vacuumSection', () => {
  it('emits the vacuum card when the flag is on and a vacuum exists', () => {
    const section = vacuumSection(makeContext({ home: { vacuum: true }, snapshot, entities }));
    expect(section?.cards[1]).toEqual({
      type: 'custom:quiet-luxe-vacuum-card',
      entity: 'vacuum.dreame_x30',
    });
  });

  it('returns null when the flag is off', () => {
    expect(vacuumSection(makeContext({ snapshot, entities }))).toBeNull();
  });

  it('returns null when the flag is on but no vacuum entity exists (spec §8)', () => {
    expect(vacuumSection(makeContext({ home: { vacuum: true } }))).toBeNull();
  });
});
```

`src/strategy/sections/admin.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeContext } from '../../testing/mock-registry';
import { adminSection } from './admin';

const adminHome = {
  admin_flows: [
    { entity: 'switch.nr_guest_wifi', name: 'Guest Wi-Fi', description: 'UniFi guest network' },
  ],
};

describe('adminSection', () => {
  it('emits one network-flow row per configured flow', () => {
    const section = adminSection(makeContext({ home: adminHome }));
    expect(section?.cards[1]).toEqual({
      type: 'custom:ql-row-network-flow',
      entity: 'switch.nr_guest_wifi',
      name: 'Guest Wi-Fi',
      description: 'UniFi guest network',
    });
  });

  it('returns null without configured flows', () => {
    expect(adminSection(makeContext({}))).toBeNull();
  });

  it('is admin-only regardless of config (defense-in-depth)', () => {
    expect(adminSection(makeContext({ home: adminHome, tier: 'family' }))).toBeNull();
    expect(adminSection(makeContext({ home: adminHome, tier: 'guest' }))).toBeNull();
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run src/strategy/sections/car.test.ts src/strategy/sections/vacuum.test.ts src/strategy/sections/admin.test.ts`
Expected: FAIL — modules and keys missing.

- [x] **Step 3: Add the i18n keys** (all five locale files):

```
en.ts:       'section.car': 'Car',
             'section.vacuum': 'Vacuum',
             'section.network': 'Network & flows',
zh-hant.ts:  'section.car': '車輛',
             'section.vacuum': '掃地機',
             'section.network': '網絡與流程',
zh-hans.ts:  'section.car': '车辆',
             'section.vacuum': '扫地机',
             'section.network': '网络与流程',
ms.ts:       'section.car': 'Kereta',
             'section.vacuum': 'Vakum',
             'section.network': 'Rangkaian & aliran',
id.ts:       'section.car': 'Mobil',
             'section.vacuum': 'Vakum',
             'section.network': 'Jaringan & alur',
```

- [x] **Step 4: Implement `src/strategy/sections/car.ts`**

```ts
import { viewUrl } from '../config';
import {
  PATHS,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type StrategyContext,
} from '../types';
import { headingCard, sectionOf } from './heading';

export function carCard(ctx: StrategyContext): LovelaceCardConfig | null {
  if (ctx.home.car === 'none') {
    return null;
  }
  return {
    type: 'custom:quiet-luxe-car-card',
    brand: ctx.home.car,
    ...(ctx.home.car_entities ?? {}),
  };
}

/** Home glance car card — admin only (spec §5: Car is admin-only). */
export function carSection(ctx: StrategyContext): LovelaceSectionConfig | null {
  if (ctx.tier !== 'admin') {
    return null;
  }
  const card = carCard(ctx);
  if (card === null) {
    return null;
  }
  return sectionOf(headingCard(ctx.locale, 'section.car', viewUrl(ctx.home, PATHS.car)), [card]);
}
```

- [x] **Step 5: Implement `src/strategy/sections/vacuum.ts`**

```ts
import type { LovelaceSectionConfig, StrategyContext } from '../types';
import { headingCard, sectionOf } from './heading';

export function vacuumSection(ctx: StrategyContext): LovelaceSectionConfig | null {
  if (!ctx.home.vacuum) {
    return null;
  }
  const entity = ctx.registry.all('vacuum')[0];
  if (entity === undefined) {
    return null; // flag on but integration absent → never renders (spec §8)
  }
  return sectionOf(headingCard(ctx.locale, 'section.vacuum'), [
    { type: 'custom:quiet-luxe-vacuum-card', entity },
  ]);
}
```

- [x] **Step 6: Implement `src/strategy/sections/admin.ts`**

```ts
import type { LovelaceSectionConfig, StrategyContext } from '../types';
import { headingCard, sectionOf } from './heading';

/** Node-RED flow toggle rows (spec §6 Admin). Admin tier only, always. */
export function adminSection(ctx: StrategyContext): LovelaceSectionConfig | null {
  if (ctx.tier !== 'admin') {
    return null;
  }
  const cards = (ctx.home.admin_flows ?? []).map((flow) => ({
    type: 'custom:ql-row-network-flow',
    entity: flow.entity,
    name: flow.name,
    description: flow.description,
  }));
  return sectionOf(headingCard(ctx.locale, 'section.network'), cards);
}
```

- [x] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/strategy/sections/car.test.ts src/strategy/sections/vacuum.test.ts src/strategy/sections/admin.test.ts src/i18n/i18n.test.ts`
Expected: PASS.

- [x] **Step 8: Lint + typecheck, then commit**

```bash
git add src/strategy/sections/car.ts src/strategy/sections/car.test.ts src/strategy/sections/vacuum.ts src/strategy/sections/vacuum.test.ts src/strategy/sections/admin.ts src/strategy/sections/admin.test.ts src/i18n/locales
git commit -m "$(cat <<'EOF'
feat(strategy): add car, vacuum, and admin section builders

- Car glance is admin-only (spec §5); brand + car_entities spread
- Vacuum omitted when flag off OR integration absent
- Admin network-flow rows from config, admin tier only
- i18n: section.car/section.vacuum/section.network ×5 locales

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

---

### Task 10: `quiet-luxe-header-card` (D7) + `hass.user` typing

**Files:**
- Modify: `src/types/home-assistant.ts` (add `user`)
- Modify: `src/testing/mock-hass.ts` (add `user` option)
- Create: `src/cards/quiet-luxe-header-card.ts` + `quiet-luxe-header-card.test.ts`
- Modify: `src/index.ts`, `src/index.test.ts`
- Modify: all five locale files

- [x] **Step 1: Write the failing test**

`src/cards/quiet-luxe-header-card.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { QlHeaderHome } from '../elements/ql-header-home';
import type { QlHeaderRoom } from '../elements/ql-header-room';
import { makeEntity, makeMockHass } from '../testing/mock-hass';
import { QuietLuxeHeaderCard, variantForWidth } from './quiet-luxe-header-card';

const HASS_ENTITIES = [
  makeEntity('weather.home', 'rainy', { temperature: 30.6 }),
  makeEntity('sensor.aqi', '42', { device_class: 'aqi' }),
  makeEntity('person.steven', 'home', { friendly_name: 'Steven' }),
  makeEntity('person.mei', 'not_home', { friendly_name: 'Mei' }),
  makeEntity('sensor.room_temp', '24.5', { device_class: 'temperature' }),
  makeEntity('sensor.room_humidity', '61', { device_class: 'humidity' }),
];

function makeCard(config: Record<string, unknown>, user?: { id: string; name: string; is_admin: boolean }): QuietLuxeHeaderCard {
  const card = document.createElement('quiet-luxe-header-card') as QuietLuxeHeaderCard;
  card.setConfig(config as never);
  card.hass = makeMockHass(HASS_ENTITIES, { user });
  document.body.append(card);
  return card;
}

describe('variantForWidth', () => {
  it('maps viewport width to the spec breakpoints', () => {
    expect(variantForWidth(390)).toBe('mobile');
    expect(variantForWidth(767)).toBe('mobile');
    expect(variantForWidth(768)).toBe('ipad');
    expect(variantForWidth(1399)).toBe('ipad');
    expect(variantForWidth(1400)).toBe('desktop');
    expect(variantForWidth(1680)).toBe('desktop');
  });
});

describe('quiet-luxe-header-card', () => {
  it('rejects malformed config loudly', () => {
    const card = document.createElement('quiet-luxe-header-card') as QuietLuxeHeaderCard;
    expect(() => card.setConfig({ type: 'x', form: 'nope', name: 'X' } as never)).toThrowError(
      /"form" must be "home" or "room"/,
    );
    expect(() => card.setConfig({ type: 'x', form: 'home', name: '' } as never)).toThrowError(
      /"name" is required/,
    );
  });

  it('home form: passes name, greeting user, meta, and presence to ql-header-home', async () => {
    const card = makeCard(
      {
        type: 'custom:quiet-luxe-header-card',
        form: 'home',
        name: 'Subang Jaya',
        weather_entity: 'weather.home',
        aqi_entity: 'sensor.aqi',
        presence_entities: ['person.steven', 'person.mei'],
      },
      { id: 'u1', name: 'Steven', is_admin: true },
    );
    await card.updateComplete;
    const header = card.shadowRoot?.querySelector('ql-header-home') as QlHeaderHome;
    expect(header.homeName).toBe('Subang Jaya');
    expect(header.userName).toBe('Steven');
    expect(header.meta).toBe('31° · AQI 42');
    expect(header.presence).toBe('Steven home');
  });

  it('suppresses the greeting when show_greeting is false (guest kiosk)', async () => {
    const card = makeCard(
      {
        type: 'custom:quiet-luxe-header-card',
        form: 'home',
        name: 'Subang Jaya',
        show_greeting: false,
      },
      { id: 'u2', name: 'kiosk', is_admin: false },
    );
    await card.updateComplete;
    const header = card.shadowRoot?.querySelector('ql-header-home') as QlHeaderHome;
    expect(header.userName).toBe('');
  });

  it('says nobody is home when presence entities exist but none are home', async () => {
    const card = makeCard({
      type: 'custom:quiet-luxe-header-card',
      form: 'home',
      name: 'X',
      presence_entities: ['person.mei'],
    });
    await card.updateComplete;
    const header = card.shadowRoot?.querySelector('ql-header-home') as QlHeaderHome;
    expect(header.presence).toBe('Nobody home');
  });

  it('room form: renders ql-header-room with formatted stats', async () => {
    const card = makeCard({
      type: 'custom:quiet-luxe-header-card',
      form: 'room',
      name: 'Living Room',
      temperature_entity: 'sensor.room_temp',
      humidity_entity: 'sensor.room_humidity',
      aqi_entity: 'sensor.aqi',
    });
    await card.updateComplete;
    const header = card.shadowRoot?.querySelector('ql-header-room') as QlHeaderRoom;
    expect(header.name).toBe('Living Room');
    expect(header.stats).toEqual(['24.5°', '61%', 'AQI 42']);
  });

  it('room form: ql-back navigates to back_path', async () => {
    const card = makeCard({
      type: 'custom:quiet-luxe-header-card',
      form: 'room',
      name: 'Living Room',
      back_path: '/quiet-luxe/home',
    });
    await card.updateComplete;
    card.shadowRoot
      ?.querySelector('ql-header-room')
      ?.dispatchEvent(new CustomEvent('ql-back', { bubbles: true, composed: true }));
    expect(window.location.pathname).toBe('/quiet-luxe/home');
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run src/cards/quiet-luxe-header-card.test.ts`
Expected: FAIL — module does not exist.

- [x] **Step 3: Add `user` to `src/types/home-assistant.ts`** — inside `interface HomeAssistant`, after the `locale` member:

```ts
  /** Current user; absent in narrow mocks. is_admin drives the RBAC admin tier. */
  readonly user?: {
    readonly id: string;
    readonly name: string;
    readonly is_admin: boolean;
  };
```

- [x] **Step 4: Add the `user` option to `src/testing/mock-hass.ts`** — in `MockHassOptions` add:

```ts
  /** hass.user double for RBAC/greeting tests. */
  readonly user?: HomeAssistant['user'];
```

and in the object returned by `makeMockHass`, after `locale: { language },` add:

```ts
    user: opts.user,
```

- [x] **Step 5: Add the i18n keys** (all five locale files):

```
en.ts:       'header.nobody_home': 'Nobody home',
             'header.home_suffix': 'home',
zh-hant.ts:  'header.nobody_home': '無人在家',
             'header.home_suffix': '在家',
zh-hans.ts:  'header.nobody_home': '无人在家',
             'header.home_suffix': '在家',
ms.ts:       'header.nobody_home': 'Tiada sesiapa di rumah',
             'header.home_suffix': 'di rumah',
id.ts:       'header.nobody_home': 'Tidak ada orang di rumah',
             'header.home_suffix': 'di rumah',
```

- [x] **Step 6: Implement `src/cards/quiet-luxe-header-card.ts`**

```ts
import { css, html, type CSSResultGroup, type TemplateResult } from 'lit';
import '../elements/ql-header-home';
import '../elements/ql-header-room';
import type { QlHeaderVariant } from '../elements/ql-header-home';
import { t } from '../i18n/translate';
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
  declare viewportWidth: number;

  constructor() {
    super();
    this.viewportWidth = window.innerWidth;
  }

  private readonly handleResize = (): void => {
    this.viewportWidth = window.innerWidth;
  };

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('resize', this.handleResize);
  }

  override disconnectedCallback(): void {
    window.removeEventListener('resize', this.handleResize);
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
      .map((id) => {
        const friendly: unknown = this.entity(id)?.attributes.friendly_name;
        return typeof friendly === 'string' ? friendly : id.split('.')[1];
      });
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
```

- [x] **Step 7: Wire into the bundle** — in `src/index.ts` add after the language-card import:

```ts
import './cards/quiet-luxe-header-card';
```

and after the language-card export block:

```ts
export {
  QuietLuxeHeaderCard,
  variantForWidth,
  type HeaderCardConfig,
} from './cards/quiet-luxe-header-card';
```

In `src/index.test.ts` add a test:

```ts
it('defines the header card without listing it in the picker', () => {
  expect(customElements.get('quiet-luxe-header-card')).toBe(bundle.QuietLuxeHeaderCard);
  expect((window.customCards ?? []).some((card) => card.type === 'quiet-luxe-header-card')).toBe(
    false,
  );
});
```

- [x] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/cards/quiet-luxe-header-card.test.ts src/index.test.ts src/i18n/i18n.test.ts`
Expected: PASS.

- [x] **Step 9: Lint + typecheck, then commit**

```bash
git add src/types/home-assistant.ts src/testing/mock-hass.ts src/cards/quiet-luxe-header-card.ts src/cards/quiet-luxe-header-card.test.ts src/index.ts src/index.test.ts src/i18n/locales
git commit -m "$(cat <<'EOF'
feat(cards): add strategy-composed header card

- Wraps ql-header-home/ql-header-room with hass-derived meta, presence,
  greeting; breakpoint variant from viewport width (D7)
- hass.user typed; mock-hass user option
- Define-only registration (not in the picker)
- i18n: header.nobody_home/header.home_suffix ×5 locales

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

---

### Task 11: Home view builder

**Files:**
- Create: `src/strategy/views/home.ts` + `home.test.ts`
- Modify: all five locale files

- [x] **Step 1: Write the failing test**

`src/strategy/views/home.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SUBANG_CONFIG } from '../reference-homes';
import { makeContext, referenceHome } from '../../testing/mock-registry';
import { homeView } from './home';

function subangContext(tier: 'admin' | 'family' | 'guest' = 'admin') {
  const { snapshot, entities } = referenceHome('subang');
  return makeContext({ home: { ...SUBANG_CONFIG }, snapshot, entities, tier });
}

describe('homeView', () => {
  it('is a sections view at path home with a full-width header first', () => {
    const view = homeView(subangContext());
    expect(view.title).toBe('Home');
    expect(view.path).toBe('home');
    expect(view.type).toBe('sections');
    expect(view.max_columns).toBe(4);
    expect(view.sections[0]).toEqual({
      type: 'grid',
      column_span: 4,
      cards: [
        {
          type: 'custom:quiet-luxe-header-card',
          form: 'home',
          name: 'Subang Jaya',
          show_greeting: true,
          weather_entity: 'weather.subang',
          aqi_entity: 'sensor.main_living_aqi',
          presence_entities: ['person.mei', 'person.steven'],
        },
      ],
    });
  });

  it('includes the Subang matrix sections: rooms, climate, music, cameras, energy, schedule, presence, car', () => {
    const view = homeView(subangContext());
    const headings = view.sections
      .flatMap((section) => section.cards)
      .filter((card) => card.type === 'heading')
      .map((card) => card.heading);
    expect(headings).toEqual([
      'Rooms',
      'Climate',
      'Music',
      'Cameras',
      'Energy',
      'Schedule',
      'Presence',
      'Car',
    ]);
  });

  it('caps the climate row at three cards', () => {
    const view = homeView(subangContext());
    const climate = view.sections.find((section) =>
      section.cards.some((card) => card.type === 'custom:quiet-luxe-climate-card'),
    );
    expect(
      climate?.cards.filter((card) => card.type === 'custom:quiet-luxe-climate-card'),
    ).toHaveLength(3);
  });

  it('guest tier: no greeting, no car section', () => {
    const view = homeView(subangContext('guest'));
    expect(view.sections[0].cards[0]).toMatchObject({ show_greeting: false });
    const headings = view.sections
      .flatMap((section) => section.cards)
      .filter((card) => card.type === 'heading')
      .map((card) => card.heading);
    expect(headings).not.toContain('Car');
  });

  it('an empty home still yields a valid view with just the header', () => {
    const view = homeView(makeContext({}));
    expect(view.sections).toHaveLength(1);
  });
});
```

Note on `presence_entities` order: the registry index sorts alphabetically, so `person.mei` precedes `person.steven`.

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run src/strategy/views/home.test.ts`
Expected: FAIL — module and `view.home` key missing.

- [x] **Step 3: Add the i18n key** (all five locale files):

```
en.ts:       'view.home': 'Home',
zh-hant.ts:  'view.home': '首頁',
zh-hans.ts:  'view.home': '首页',
ms.ts:       'view.home': 'Utama',
id.ts:       'view.home': 'Beranda',
```

- [x] **Step 4: Implement `src/strategy/views/home.ts`**

```ts
import { t } from '../../i18n/translate';
import { carSection } from '../sections/car';
import { climateSection } from '../sections/climate';
import { energySection } from '../sections/energy';
import { mediaSection } from '../sections/media';
import { presenceSection } from '../sections/presence';
import { roomsSection } from '../sections/rooms';
import { scheduleSection } from '../sections/schedule';
import { securitySection } from '../sections/security';
import { vacuumSection } from '../sections/vacuum';
import {
  isSection,
  PATHS,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type LovelaceViewConfig,
  type StrategyContext,
} from '../types';

export function headerCardConfig(ctx: StrategyContext): LovelaceCardConfig {
  return {
    type: 'custom:quiet-luxe-header-card',
    form: 'home',
    name: ctx.home.name,
    show_greeting: ctx.tier !== 'guest',
    weather_entity: ctx.registry.all('weather')[0],
    aqi_entity: ctx.registry.all('sensor', 'aqi')[0],
    presence_entities: ctx.registry.all('person'),
  };
}

/**
 * Home view (spec §6). One sections view serves all breakpoints: HA's sections
 * layout collapses max_columns: 4 to a single column on phones; the rooms grid
 * spans 2 of 4 columns (≈ the iPad 64% left zone), the rest fill the rail.
 * Section order follows the mobile priority (Decision 10): rooms → climate →
 * music → cameras/energy → schedule → presence → vacuum/car glance.
 */
export function homeView(ctx: StrategyContext): LovelaceViewConfig {
  const header: LovelaceSectionConfig = {
    type: 'grid',
    column_span: 4,
    cards: [headerCardConfig(ctx)],
  };
  const sections = [
    header,
    roomsSection(ctx),
    climateSection(ctx, { limit: 3 }),
    mediaSection(ctx),
    securitySection(ctx),
    energySection(ctx),
    scheduleSection(ctx),
    presenceSection(ctx),
    vacuumSection(ctx),
    carSection(ctx),
  ].filter(isSection);
  return {
    title: t(ctx.locale, 'view.home'),
    path: PATHS.home,
    icon: 'mdi:home-variant-outline',
    type: 'sections',
    max_columns: 4,
    sections,
  };
}
```

- [x] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/strategy/views/home.test.ts src/i18n/i18n.test.ts`
Expected: PASS. If the heading-order assertion fails, fix the *builder order in `homeView`* (the assertion encodes spec Decision 10), not the test.

- [x] **Step 6: Lint + typecheck, then commit**

```bash
git add src/strategy/views/home.ts src/strategy/views/home.test.ts src/i18n/locales
git commit -m "$(cat <<'EOF'
feat(strategy): add home view builder

- Full-width header section + spec Decision 10 section order
- Climate row capped at 3; guest tier loses greeting and car glance
- i18n: view.home ×5 locales

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

---

### Task 12: Per-room view builders

**Files:**
- Create: `src/strategy/views/room.ts` + `room.test.ts`
- Modify: all five locale files

- [x] **Step 1: Write the failing test**

`src/strategy/views/room.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SUBANG_CONFIG } from '../reference-homes';
import { makeContext, referenceHome } from '../../testing/mock-registry';
import { roomViews } from './room';

function subangContext(tier: 'admin' | 'family' | 'guest' = 'admin') {
  const { snapshot, entities } = referenceHome('subang');
  return makeContext({ home: { ...SUBANG_CONFIG }, snapshot, entities, tier });
}

describe('roomViews', () => {
  it('creates one subview per populated area in room_order', () => {
    const views = roomViews(subangContext());
    expect(views.map((view) => view.path)).toEqual([
      'room-main_living',
      'room-side_living',
      'room-master_bedroom',
    ]);
    expect(views[0].subview).toBe(true);
    expect(views[0].max_columns).toBe(2);
    expect(views[0].title).toBe('Main Living');
  });

  it('leads with a room header carrying stats entities and the back path', () => {
    const view = roomViews(subangContext())[0];
    expect(view.sections[0]).toEqual({
      type: 'grid',
      column_span: 2,
      cards: [
        {
          type: 'custom:quiet-luxe-header-card',
          form: 'room',
          name: 'Main Living',
          temperature_entity: 'sensor.main_living_temp',
          humidity_entity: 'sensor.main_living_humidity',
          aqi_entity: 'sensor.main_living_aqi',
          back_path: '/quiet-luxe/home',
        },
      ],
    });
  });

  it('renders room sections in the fixed spec §6 priority, only what exists', () => {
    const view = roomViews(subangContext())[0];
    const headings = view.sections
      .flatMap((section) => section.cards)
      .filter((card) => card.type === 'heading')
      .map((card) => card.heading);
    expect(headings).toEqual([
      'Lights',
      'Climate',
      'Covers',
      'Music',
      'Air & sensors',
      'Switches',
    ]);
  });

  it('the switches section excludes admin flows and motion-toggle switches', () => {
    const view = roomViews(subangContext())[0];
    const switches = view.sections
      .flatMap((section) => section.cards)
      .filter((card) => card.type === 'custom:quiet-luxe-device-cutout-card')
      .map((card) => card.entity);
    expect(switches).toEqual(['switch.living_fan_rf']);
  });

  it('a bathroom-like sparse area renders only its own sections', () => {
    const views = roomViews(subangContext());
    const sideLiving = views.find((view) => view.path === 'room-side_living');
    const headings = sideLiving?.sections
      .flatMap((section) => section.cards)
      .filter((card) => card.type === 'heading')
      .map((card) => card.heading);
    expect(headings).toEqual(['Climate']); // fan only → just the climate section
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run src/strategy/views/room.test.ts`
Expected: FAIL — module and keys missing.

- [x] **Step 3: Add the i18n keys** (all five locale files):

```
en.ts:       'section.lights': 'Lights',
             'section.covers': 'Covers',
             'section.switches': 'Switches',
zh-hant.ts:  'section.lights': '燈光',
             'section.covers': '窗簾',
             'section.switches': '開關',
zh-hans.ts:  'section.lights': '灯光',
             'section.covers': '窗帘',
             'section.switches': '开关',
ms.ts:       'section.lights': 'Lampu',
             'section.covers': 'Langsir',
             'section.switches': 'Suis',
id.ts:       'section.lights': 'Lampu',
             'section.covers': 'Tirai',
             'section.switches': 'Sakelar',
```

- [x] **Step 4: Implement `src/strategy/views/room.ts`**

```ts
import { viewUrl } from '../config';
import type { AreaEntry } from '../registry';
import { climateSection } from '../sections/climate';
import { headingCard, sectionOf } from '../sections/heading';
import { mediaSection } from '../sections/media';
import { orderedAreas, roomName } from '../sections/rooms';
import { sensorsSection } from '../sections/sensors';
import {
  isSection,
  PATHS,
  roomPath,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type LovelaceViewConfig,
  type StrategyContext,
} from '../types';

function roomHeaderSection(ctx: StrategyContext, area: AreaEntry): LovelaceSectionConfig {
  const areaId = area.area_id;
  return {
    type: 'grid',
    column_span: 2,
    cards: [
      {
        type: 'custom:quiet-luxe-header-card',
        form: 'room',
        name: roomName(ctx.home, area),
        temperature_entity: ctx.registry.inArea(areaId, 'sensor', 'temperature')[0],
        humidity_entity: ctx.registry.inArea(areaId, 'sensor', 'humidity')[0],
        aqi_entity: ctx.registry.inArea(areaId, 'sensor', 'aqi')[0],
        back_path: viewUrl(ctx.home, PATHS.home),
      },
    ],
  };
}

function lightCards(ctx: StrategyContext, areaId: string): ReadonlyArray<LovelaceCardConfig> {
  return ctx.registry.inArea(areaId, 'light').map((entity) => ({
    type: 'custom:quiet-luxe-light-card',
    entity,
    grid_options: { columns: 6 },
  }));
}

function coverCards(ctx: StrategyContext, areaId: string): ReadonlyArray<LovelaceCardConfig> {
  return ctx.registry.inArea(areaId, 'cover').map((entity) => ({
    type: 'custom:quiet-luxe-cover-card',
    entity,
    grid_options: { columns: 6 },
  }));
}

/** Switches already surfaced as admin flows or motion toggles stay out (D9). */
function excludedSwitchIds(ctx: StrategyContext): ReadonlySet<string> {
  const flowIds = (ctx.home.admin_flows ?? []).map((flow) => flow.entity);
  const motionToggleIds = ctx.registry
    .all('binary_sensor', 'motion')
    .flatMap((motion) => ctx.registry.siblings(motion).filter((id) => id.startsWith('switch.')));
  return new Set([...flowIds, ...motionToggleIds]);
}

function switchCards(ctx: StrategyContext, areaId: string): ReadonlyArray<LovelaceCardConfig> {
  const excluded = excludedSwitchIds(ctx);
  return ctx.registry
    .inArea(areaId, 'switch')
    .filter((id) => !excluded.has(id))
    .map((entity) => ({ type: 'custom:quiet-luxe-device-cutout-card', entity }));
}

/** Room drill-in (spec §6): fixed priority, rendering only what exists. */
export function roomView(ctx: StrategyContext, area: AreaEntry): LovelaceViewConfig {
  const areaId = area.area_id;
  const sections = [
    roomHeaderSection(ctx, area),
    sectionOf(headingCard(ctx.locale, 'section.lights'), lightCards(ctx, areaId)),
    climateSection(ctx, { areaId }),
    sectionOf(headingCard(ctx.locale, 'section.covers'), coverCards(ctx, areaId)),
    mediaSection(ctx, areaId),
    sensorsSection(ctx, areaId),
    sectionOf(headingCard(ctx.locale, 'section.switches'), switchCards(ctx, areaId)),
  ].filter(isSection);
  return {
    title: roomName(ctx.home, area),
    path: roomPath(areaId),
    type: 'sections',
    subview: true,
    max_columns: 2,
    sections,
  };
}

export function roomViews(ctx: StrategyContext): ReadonlyArray<LovelaceViewConfig> {
  return orderedAreas(ctx).map((area) => roomView(ctx, area));
}
```

- [x] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/strategy/views/room.test.ts src/i18n/i18n.test.ts`
Expected: PASS.

- [x] **Step 6: Lint + typecheck, then commit**

```bash
git add src/strategy/views/room.ts src/strategy/views/room.test.ts src/i18n/locales
git commit -m "$(cat <<'EOF'
feat(strategy): add per-room view builders

- Subview per populated area: header → lights → climate → covers →
  media → air & sensors → switches (spec §6 fixed priority)
- Switch section excludes admin flows and motion-toggle switches (D9)
- i18n: section.lights/section.covers/section.switches ×5 locales

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

---

### Task 13: Domain view builders

**Files:**
- Create: `src/strategy/views/domain.ts` + `domain.test.ts`
- Modify: all five locale files

- [x] **Step 1: Write the failing test**

`src/strategy/views/domain.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SUBANG_CONFIG, XIAMEN_CONFIG } from '../reference-homes';
import { makeContext, referenceHome } from '../../testing/mock-registry';
import {
  adminView,
  carView,
  climatesView,
  energyView,
  languageView,
  mediaView,
  securityView,
} from './domain';

function contextFor(name: 'subang' | 'xiamen', tier: 'admin' | 'family' | 'guest' = 'admin') {
  const home = name === 'subang' ? SUBANG_CONFIG : XIAMEN_CONFIG;
  const { snapshot, entities } = referenceHome(name);
  return makeContext({ home: { ...home }, snapshot, entities, tier });
}

describe('domain views', () => {
  it('mediaView exists when players exist and is null otherwise', () => {
    expect(mediaView(contextFor('subang'))?.path).toBe('media');
    expect(mediaView(makeContext({}))).toBeNull();
  });

  it('securityView covers wall + doors/motion', () => {
    const view = securityView(contextFor('subang'));
    expect(view?.path).toBe('security');
    expect(view?.sections).toHaveLength(2);
    expect(securityView(makeContext({}))).toBeNull();
  });

  it('energyView exists only for energy homes', () => {
    expect(energyView(contextFor('subang'))?.path).toBe('energy');
    expect(energyView(contextFor('xiamen'))).toBeNull();
  });

  it('climatesView groups climate devices under area-name headings', () => {
    const view = climatesView(contextFor('subang'));
    const headings = view?.sections.map((section) => section.cards[0].heading);
    expect(headings).toEqual(['Main Living', 'Side Living', 'Master Bedroom']);
    expect(climatesView(makeContext({}))).toBeNull();
  });

  it('carView carries the per-home brand and is null for car: none', () => {
    const subangCar = carView(contextFor('subang'));
    expect(subangCar?.sections[0].cards[0]).toMatchObject({ brand: 'bmw' });
    const xiamenCar = carView(contextFor('xiamen'));
    expect(xiamenCar?.sections[0].cards[0]).toMatchObject({ brand: 'liauto' });
    expect(carView(makeContext({}))).toBeNull();
  });

  it('adminView exists only with configured flows and admin tier', () => {
    expect(adminView(contextFor('subang'))?.path).toBe('admin');
    expect(adminView(contextFor('subang', 'family'))).toBeNull();
    expect(adminView(makeContext({}))).toBeNull();
  });

  it('languageView always exists with the language card', () => {
    const view = languageView(makeContext({}));
    expect(view.path).toBe('language');
    expect(view.sections[0].cards[0]).toEqual({ type: 'custom:quiet-luxe-language-card' });
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run src/strategy/views/domain.test.ts`
Expected: FAIL — module and keys missing.

- [x] **Step 3: Add the i18n keys** (all five locale files):

```
en.ts:       'view.media': 'Media',
             'view.security': 'Security',
             'view.energy': 'Energy',
             'view.climates': 'All climates',
             'view.car': 'Car',
             'view.admin': 'Admin',
             'view.language': 'Language',
zh-hant.ts:  'view.media': '媒體',
             'view.security': '安全',
             'view.energy': '能源',
             'view.climates': '全部氣候設備',
             'view.car': '車輛',
             'view.admin': '管理',
             'view.language': '語言',
zh-hans.ts:  'view.media': '媒体',
             'view.security': '安全',
             'view.energy': '能源',
             'view.climates': '全部气候设备',
             'view.car': '车辆',
             'view.admin': '管理',
             'view.language': '语言',
ms.ts:       'view.media': 'Media',
             'view.security': 'Keselamatan',
             'view.energy': 'Tenaga',
             'view.climates': 'Semua peranti iklim',
             'view.car': 'Kereta',
             'view.admin': 'Pentadbir',
             'view.language': 'Bahasa',
id.ts:       'view.media': 'Media',
             'view.security': 'Keamanan',
             'view.energy': 'Energi',
             'view.climates': 'Semua perangkat iklim',
             'view.car': 'Mobil',
             'view.admin': 'Admin',
             'view.language': 'Bahasa',
```

- [x] **Step 4: Implement `src/strategy/views/domain.ts`**

```ts
import type { TranslationKey } from '../../i18n/locales/en';
import { t } from '../../i18n/translate';
import { adminSection } from '../sections/admin';
import { carCard } from '../sections/car';
import { climateCards } from '../sections/climate';
import { energyViewSections } from '../sections/energy';
import { sectionOf } from '../sections/heading';
import { mediaViewSections } from '../sections/media';
import { orderedAreas, roomName } from '../sections/rooms';
import { securityViewSections } from '../sections/security';
import {
  isSection,
  PATHS,
  type LovelaceSectionConfig,
  type LovelaceViewConfig,
  type StrategyContext,
} from '../types';

function view(
  ctx: StrategyContext,
  key: TranslationKey,
  path: string,
  icon: string,
  sections: ReadonlyArray<LovelaceSectionConfig>,
  maxColumns = 3,
): LovelaceViewConfig | null {
  if (sections.length === 0) {
    return null;
  }
  return { title: t(ctx.locale, key), path, icon, type: 'sections', max_columns: maxColumns, sections };
}

export function mediaView(ctx: StrategyContext): LovelaceViewConfig | null {
  return view(ctx, 'view.media', PATHS.media, 'mdi:music', mediaViewSections(ctx));
}

export function securityView(ctx: StrategyContext): LovelaceViewConfig | null {
  return view(ctx, 'view.security', PATHS.security, 'mdi:shield-home-outline', securityViewSections(ctx));
}

export function energyView(ctx: StrategyContext): LovelaceViewConfig | null {
  return view(ctx, 'view.energy', PATHS.energy, 'mdi:lightning-bolt-outline', energyViewSections(ctx));
}

/** All Climates (spec §6): devices grouped by room; area names are proper nouns. */
export function climatesView(ctx: StrategyContext): LovelaceViewConfig | null {
  const sections = orderedAreas(ctx)
    .map((area) =>
      sectionOf(
        { type: 'heading', heading: roomName(ctx.home, area) },
        climateCards(ctx, area.area_id),
      ),
    )
    .filter(isSection);
  return view(ctx, 'view.climates', PATHS.climates, 'mdi:thermostat', sections);
}

export function carView(ctx: StrategyContext): LovelaceViewConfig | null {
  const card = carCard(ctx);
  const sections: ReadonlyArray<LovelaceSectionConfig> =
    card === null ? [] : [{ type: 'grid', cards: [card] }];
  return view(ctx, 'view.car', PATHS.car, 'mdi:car-outline', sections, 2);
}

export function adminView(ctx: StrategyContext): LovelaceViewConfig | null {
  const sections = [adminSection(ctx)].filter(isSection);
  return view(ctx, 'view.admin', PATHS.admin, 'mdi:tune', sections, 2);
}

/** Language page always exists (spec §5) — kiosk-friendly full-page switcher. */
export function languageView(ctx: StrategyContext): LovelaceViewConfig {
  return {
    title: t(ctx.locale, 'view.language'),
    path: PATHS.language,
    icon: 'mdi:translate',
    type: 'sections',
    max_columns: 2,
    sections: [{ type: 'grid', cards: [{ type: 'custom:quiet-luxe-language-card' }] }],
  };
}
```

- [x] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/strategy/views/domain.test.ts src/i18n/i18n.test.ts`
Expected: PASS.

- [x] **Step 6: Lint + typecheck, then commit**

```bash
git add src/strategy/views/domain.ts src/strategy/views/domain.test.ts src/i18n/locales
git commit -m "$(cat <<'EOF'
feat(strategy): add domain view builders

- Media/Security/Energy/All-Climates/Car/Admin views, each null when
  its home has nothing to show (spec §8)
- Language view always present (spec §5)
- i18n: seven view.* keys ×5 locales

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

---

### Task 14: RBAC tier resolution + view filtering

> **Restated (spec §9):** what this module does is *generation-side omission* — defense-in-depth, **NOT the security boundary**. The boundary is HA-side: the kiosk account is non-admin, lacks access to admin entities, and restricted actions are scripts whose automations verify the calling user. Plan 5 configures that layer.

**Files:**
- Create: `src/strategy/rbac.ts` + `rbac.test.ts`

- [x] **Step 1: Write the failing test**

`src/strategy/rbac.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateHomeConfig } from './config';
import { resolveTier, viewsForTier } from './rbac';
import type { LovelaceViewConfig } from './types';

const home = validateHomeConfig({
  name: 'X',
  users: { family: ['mei'], guests: ['kiosk'] },
});

describe('resolveTier', () => {
  it('is admin for HA admins regardless of lists', () => {
    expect(resolveTier({ id: 'u1', name: 'kiosk', is_admin: true }, home)).toBe('admin');
  });

  it('matches guest and family lists by name (case-insensitive) or id', () => {
    expect(resolveTier({ id: 'u2', name: 'Kiosk', is_admin: false }, home)).toBe('guest');
    expect(resolveTier({ id: 'u3', name: 'Mei', is_admin: false }, home)).toBe('family');
    expect(resolveTier({ id: 'mei', name: 'Other', is_admin: false }, home)).toBe('family');
  });

  it('defaults unknown non-admins and missing users to guest (least privilege, D5)', () => {
    expect(resolveTier({ id: 'u4', name: 'stranger', is_admin: false }, home)).toBe('guest');
    expect(resolveTier(undefined, home)).toBe('guest');
  });
});

describe('viewsForTier', () => {
  const views = ['home', 'media', 'car', 'admin', 'language'].map(
    (path): LovelaceViewConfig => ({
      title: path,
      path,
      type: 'sections',
      sections: [],
    }),
  );

  it('admin keeps everything', () => {
    expect(viewsForTier(views, 'admin').map((view) => view.path)).toEqual([
      'home',
      'media',
      'car',
      'admin',
      'language',
    ]);
  });

  it('family loses admin and car (spec §5, D4)', () => {
    expect(viewsForTier(views, 'family').map((view) => view.path)).toEqual([
      'home',
      'media',
      'language',
    ]);
  });

  it('guest loses admin and car too', () => {
    expect(viewsForTier(views, 'guest').map((view) => view.path)).toEqual([
      'home',
      'media',
      'language',
    ]);
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run src/strategy/rbac.test.ts`
Expected: FAIL — module does not exist.

- [x] **Step 3: Implement `src/strategy/rbac.ts`**

```ts
import type { HomeAssistant } from '../types/home-assistant';
import type { HomeConfig } from './config';
import { PATHS, type LovelaceViewConfig, type Tier } from './types';

/**
 * Generation-side RBAC (spec §9 layer 1). This is defense-in-depth, NOT the
 * security boundary — HA user permissions are (Plan 5 configures those).
 */
const EXCLUDED_PATHS: Readonly<Record<Tier, ReadonlyArray<string>>> = {
  admin: [],
  family: [PATHS.admin, PATHS.car],
  guest: [PATHS.admin, PATHS.car],
};

export function resolveTier(user: HomeAssistant['user'], home: HomeConfig): Tier {
  if (user === undefined) {
    return 'guest';
  }
  if (user.is_admin) {
    return 'admin';
  }
  const matches = (list: ReadonlyArray<string> | undefined): boolean =>
    list?.some((item) => item === user.id || item.toLowerCase() === user.name.toLowerCase()) ??
    false;
  if (matches(home.users?.guests)) {
    return 'guest';
  }
  if (matches(home.users?.family)) {
    return 'family';
  }
  return 'guest'; // unknown non-admin → least privilege (D5)
}

export function viewsForTier(
  views: ReadonlyArray<LovelaceViewConfig>,
  tier: Tier,
): ReadonlyArray<LovelaceViewConfig> {
  const excluded = EXCLUDED_PATHS[tier];
  return views.filter((view) => !excluded.includes(view.path));
}
```

Tier differences beyond view paths live in the builders via `ctx.tier` (already tested): guest loses the greeting (Task 11) and motion toggles (Task 7); family keeps motion toggles; admin-only sections (car glance, admin flows) check the tier themselves.

- [x] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/strategy/rbac.test.ts`
Expected: PASS.

- [x] **Step 5: Lint + typecheck, then commit**

```bash
git add src/strategy/rbac.ts src/strategy/rbac.test.ts
git commit -m "$(cat <<'EOF'
feat(strategy): add RBAC tier resolution and view filtering

- resolveTier: is_admin → admin; users.guests/family by id or
  case-insensitive name; unknown → guest (least privilege)
- viewsForTier drops admin+car for family/guest (spec §5/§9)
- Generation-side omission only; HA permissions remain the boundary

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

---

### Task 15: Strategy element `ll-strategy-dashboard-quiet-luxe`

**Files:**
- Create: `src/strategy/quiet-luxe-strategy.ts` + `quiet-luxe-strategy.test.ts`
- Modify: `src/index.ts`, `src/index.test.ts`
- Modify: all five locale files

- [x] **Step 1: Write the failing test**

`src/strategy/quiet-luxe-strategy.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMockHass } from '../testing/mock-hass';
import { referenceHome, type ReferenceHomeName } from '../testing/mock-registry';
import { SUBANG_CONFIG, TUNGCHUNG_CONFIG } from './reference-homes';
import type { HomeConfig } from './config';
import { QuietLuxeStrategy, STRATEGY_ELEMENT_TAG } from './quiet-luxe-strategy';

function hassFor(
  name: ReferenceHomeName,
  user: { id: string; name: string; is_admin: boolean } | undefined = {
    id: 'admin-1',
    name: 'Steven',
    is_admin: true,
  },
) {
  const { snapshot, entities } = referenceHome(name);
  return makeMockHass(entities, {
    user,
    wsResponses: {
      'config/area_registry/list': snapshot.areas,
      'config/device_registry/list': snapshot.devices,
      'config/entity_registry/list': snapshot.entities,
    },
  });
}

function strategyConfig(home: HomeConfig | unknown) {
  return { type: 'custom:quiet-luxe', home };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('QuietLuxeStrategy.generate', () => {
  it('produces the full admin dashboard for Subang', async () => {
    const dashboard = await QuietLuxeStrategy.generate(strategyConfig(SUBANG_CONFIG), hassFor('subang'));
    expect(dashboard.title).toBe('Subang Jaya');
    expect(dashboard.views.map((view) => view.path)).toEqual([
      'home',
      'room-main_living',
      'room-side_living',
      'room-master_bedroom',
      'media',
      'security',
      'energy',
      'climates',
      'car',
      'admin',
      'language',
    ]);
  });

  it('filters views for the guest kiosk user and applies the kiosk language', async () => {
    const kiosk = { id: 'k1', name: 'kiosk', is_admin: false };
    const dashboard = await QuietLuxeStrategy.generate(
      strategyConfig(TUNGCHUNG_CONFIG),
      hassFor('tungchung', kiosk),
    );
    const paths = dashboard.views.map((view) => view.path);
    expect(paths).not.toContain('admin');
    expect(paths).not.toContain('car');
    const home = dashboard.views[0];
    expect(home.title).toBe('首頁'); // kiosk default zh-Hant wins for guests
    expect(home.sections[0].cards[0]).toMatchObject({ show_greeting: false });
  });

  it('falls back to a diagnostic view on malformed config, logging loudly', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const dashboard = await QuietLuxeStrategy.generate(
      strategyConfig({ name: 'X', engery: true }),
      hassFor('subang'),
    );
    expect(error).toHaveBeenCalledOnce();
    expect(dashboard.views).toHaveLength(1);
    const card = dashboard.views[0].sections[0].cards[0];
    expect(card.type).toBe('markdown');
    expect(String(card.content)).toContain('engery'); // admin sees the message
  });

  it('hides error detail from non-admins in the fallback view', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const dashboard = await QuietLuxeStrategy.generate(
      strategyConfig({ name: 'X', engery: true }),
      hassFor('subang', { id: 'k1', name: 'kiosk', is_admin: false }),
    );
    expect(String(dashboard.views[0].sections[0].cards[0].content)).not.toContain('engery');
  });

  it('falls back when the registry read fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const hass = makeMockHass([], { user: { id: 'a', name: 'Steven', is_admin: true } });
    const dashboard = await QuietLuxeStrategy.generate(strategyConfig(SUBANG_CONFIG), hass);
    expect(error).toHaveBeenCalledOnce();
    expect(dashboard.views).toHaveLength(1); // never a white screen
  });

  it('registers the strategy element and picker metadata', () => {
    expect(customElements.get(STRATEGY_ELEMENT_TAG)).toBe(QuietLuxeStrategy);
    expect(window.customStrategies?.some((entry) => entry.type === 'quiet-luxe')).toBe(true);
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run src/strategy/quiet-luxe-strategy.test.ts`
Expected: FAIL — module and keys missing.

- [x] **Step 3: Add the i18n keys** (all five locale files):

```
en.ts:       'strategy.error.title': 'Dashboard failed to generate',
             'strategy.error.body': 'Check the browser console for details.',
zh-hant.ts:  'strategy.error.title': '儀表板產生失敗',
             'strategy.error.body': '請查看瀏覽器主控台了解詳情。',
zh-hans.ts:  'strategy.error.title': '仪表板生成失败',
             'strategy.error.body': '请查看浏览器控制台了解详情。',
ms.ts:       'strategy.error.title': 'Papan pemuka gagal dijana',
             'strategy.error.body': 'Semak konsol pelayar untuk butiran.',
id.ts:       'strategy.error.title': 'Dasbor gagal dibuat',
             'strategy.error.body': 'Periksa konsol peramban untuk detail.',
```

- [x] **Step 4: Implement `src/strategy/quiet-luxe-strategy.ts`**

```ts
import { resolveLocale } from '../i18n/resolve';
import { t } from '../i18n/translate';
import type { HomeAssistant } from '../types/home-assistant';
import { validateHomeConfig } from './config';
import { buildRegistryIndex, fetchRegistrySnapshot } from './registry';
import { resolveTier, viewsForTier } from './rbac';
import type {
  LovelaceDashboardConfig,
  LovelaceViewConfig,
  StrategyContext,
} from './types';
import {
  adminView,
  carView,
  climatesView,
  energyView,
  languageView,
  mediaView,
  securityView,
} from './views/domain';
import { homeView } from './views/home';
import { roomViews } from './views/room';

export const STRATEGY_ELEMENT_TAG = 'll-strategy-dashboard-quiet-luxe';

export interface QuietLuxeStrategyConfig {
  readonly type: string;
  /** The per-home config block from the dashboard YAML. */
  readonly home?: unknown;
}

/**
 * English-only by design (D8): when generation fails the config itself may be
 * broken, so locale resolution is not trusted. Error detail is admin-only
 * (spec §8: diagnostic card admin-visible only).
 */
export function fallbackDashboard(error: unknown, isAdmin: boolean): LovelaceDashboardConfig {
  const message = error instanceof Error ? error.message : String(error);
  const detail = isAdmin ? `\n\n\`${message}\`` : '';
  return {
    title: 'Quiet Luxe',
    views: [
      {
        title: t('en', 'strategy.error.title'),
        path: 'home',
        type: 'sections',
        sections: [
          {
            type: 'grid',
            cards: [
              {
                type: 'markdown',
                content: `## ${t('en', 'strategy.error.title')}\n\n${t('en', 'strategy.error.body')}${detail}`,
              },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Custom dashboard strategy (HA contract verified 2026-08-01):
 * `ll-strategy-dashboard-quiet-luxe`, referenced as `custom:quiet-luxe`,
 * static async generate(config, hass) → dashboard config.
 */
export class QuietLuxeStrategy extends HTMLElement {
  static async generate(
    config: QuietLuxeStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceDashboardConfig> {
    try {
      const home = validateHomeConfig(config.home);
      const tier = resolveTier(hass.user, home);
      const haLanguage = hass.locale?.language ?? hass.language;
      // Spec §10: user profile language → kiosk default → en. Guests are the
      // kiosk, so the home's kiosk default outranks the shared account locale.
      const locale = resolveLocale(
        tier === 'guest' ? [home.kiosk?.language, haLanguage] : [haLanguage, home.kiosk?.language],
      );
      const snapshot = await fetchRegistrySnapshot(hass);
      const ctx: StrategyContext = {
        home,
        registry: buildRegistryIndex(snapshot, hass.states),
        states: hass.states,
        locale,
        tier,
        hasApexcharts: customElements.get('apexcharts-card') !== undefined,
        hasWebrtcCard: customElements.get('webrtc-camera') !== undefined,
      };
      const views = [
        homeView(ctx),
        ...roomViews(ctx),
        mediaView(ctx),
        securityView(ctx),
        energyView(ctx),
        climatesView(ctx),
        carView(ctx),
        adminView(ctx),
        languageView(ctx),
      ].filter((view): view is LovelaceViewConfig => view !== null);
      return { title: home.name, views: [...viewsForTier(views, tier)] };
    } catch (error) {
      console.error('[quiet-luxe] dashboard generation failed:', error);
      return fallbackDashboard(error, hass.user?.is_admin === true);
    }
  }
}

declare global {
  interface Window {
    /** HA ≥2026.5 strategy picker metadata (UNCONFIRMED shape; harmless no-op earlier). */
    customStrategies?: Array<{ type: string; name: string; description: string }>;
  }
}

customElements.define(STRATEGY_ELEMENT_TAG, QuietLuxeStrategy);
window.customStrategies = window.customStrategies ?? [];
window.customStrategies.push({
  type: 'quiet-luxe',
  name: 'Quiet Luxe',
  description: 'Generates the Quiet Luxe dashboard from HA registries and a per-home config.',
});
```

- [x] **Step 5: Wire into the bundle** — in `src/index.ts` add after the header-card import:

```ts
import './strategy/quiet-luxe-strategy';
```

and after the header-card export block:

```ts
export {
  fallbackDashboard,
  QuietLuxeStrategy,
  STRATEGY_ELEMENT_TAG,
  type QuietLuxeStrategyConfig,
} from './strategy/quiet-luxe-strategy';
export {
  DEFAULT_DASHBOARD_PATH,
  DEFAULT_PHOTO_BASE,
  QuietLuxeConfigError,
  validateHomeConfig,
  viewUrl,
  type HomeConfig,
} from './strategy/config';
export { SUBANG_CONFIG, TUNGCHUNG_CONFIG, XIAMEN_CONFIG } from './strategy/reference-homes';
export {
  buildRegistryIndex,
  fetchRegistrySnapshot,
  LABEL_FAVORITE,
  LABEL_HIDDEN,
  LABEL_PRIMARY_CAMERA,
  QuietLuxeRegistryError,
  type RegistryIndex,
  type RegistrySnapshot,
} from './strategy/registry';
```

In `src/index.test.ts` add:

```ts
it('registers the dashboard strategy element and metadata', () => {
  expect(customElements.get('ll-strategy-dashboard-quiet-luxe')).toBe(bundle.QuietLuxeStrategy);
  expect(window.customStrategies?.some((entry) => entry.type === 'quiet-luxe')).toBe(true);
});
```

- [x] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/strategy/quiet-luxe-strategy.test.ts src/index.test.ts src/i18n/i18n.test.ts`
Expected: PASS.

- [x] **Step 7: Lint + typecheck, then commit**

```bash
git add src/strategy/quiet-luxe-strategy.ts src/strategy/quiet-luxe-strategy.test.ts src/index.ts src/index.test.ts src/i18n/locales
git commit -m "$(cat <<'EOF'
feat(strategy): register quiet-luxe dashboard strategy element

- ll-strategy-dashboard-quiet-luxe with static generate(config, hass)
  per the verified HA contract; wires config → registry → views → RBAC
- Guest locale: kiosk default outranks shared-account language (spec §10)
- Loud console error + admin-detail fallback view; never a white screen
- window.customStrategies metadata (guarded); bundle exports

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

---

### Task 16: Dev-harness strategy inspector + README usage docs

**Files:**
- Modify: `dev/main.ts`
- Modify: `README.md`

- [x] **Step 1: Add the strategy inspector to `dev/main.ts`** — append to the existing import block:

```ts
import { QuietLuxeStrategy } from '../src/strategy/quiet-luxe-strategy';
import type { HomeConfig } from '../src/strategy/config';
import {
  SUBANG_CONFIG,
  TUNGCHUNG_CONFIG,
  XIAMEN_CONFIG,
} from '../src/strategy/reference-homes';
import { referenceHome, type ReferenceHomeName } from '../src/testing/mock-registry';
```

and append at the end of the file (after the `document.querySelector('#dark')` line):

```ts
const STRATEGY_HOMES: ReadonlyArray<{
  readonly key: ReferenceHomeName;
  readonly home: HomeConfig;
}> = [
  { key: 'subang', home: SUBANG_CONFIG },
  { key: 'tungchung', home: TUNGCHUNG_CONFIG },
  { key: 'xiamen', home: XIAMEN_CONFIG },
];

/** JSON tree inspection of generate() output — not a full Lovelace render. */
async function buildStrategyPane(): Promise<HTMLElement> {
  const pane = document.createElement('section');
  pane.id = 'strategy';
  pane.style.cssText = 'padding:24px;display:flex;flex-direction:column;gap:16px;';
  pane.append(el('h2', {}, 'Strategy output — reference homes'));
  for (const { key, home } of STRATEGY_HOMES) {
    const { snapshot, entities } = referenceHome(key);
    const mock = makeMockHass(entities, {
      user: { id: 'dev-admin', name: 'Steven', is_admin: true },
      wsResponses: {
        'config/area_registry/list': snapshot.areas,
        'config/device_registry/list': snapshot.devices,
        'config/entity_registry/list': snapshot.entities,
      },
    });
    const dashboard = await QuietLuxeStrategy.generate({ type: 'custom:quiet-luxe', home }, mock);
    const details = document.createElement('details');
    details.append(el('summary', {}, `${home.name} — ${dashboard.views.length} views`));
    for (const view of dashboard.views) {
      const viewDetails = document.createElement('details');
      viewDetails.style.cssText = 'margin-left:16px;';
      viewDetails.append(el('summary', {}, `${view.title} (${view.path}, ${view.sections.length} sections)`));
      const pre = document.createElement('pre');
      pre.style.cssText = 'font-size:11px;overflow:auto;max-height:400px;';
      pre.textContent = JSON.stringify(view, null, 2);
      viewDetails.append(pre);
      details.append(viewDetails);
    }
    pane.append(details);
  }
  return pane;
}

void buildStrategyPane().then((pane) => document.body.append(pane));
```

- [x] **Step 2: Verify the harness compiles and renders**

Run: `npm run typecheck && npm run lint`
Expected: clean.
Run: `npm run dev`, open the printed URL, scroll below the dark pane.
Expected: "Strategy output — reference homes" with three expandable homes; Subang shows 11 views (incl. `energy`), Xiamen shows no `energy` view, no Schedule section, a Vacuum section, and `brand: "liauto"` inside the car view JSON. Stop the dev server.

- [x] **Step 3: Update `README.md`** — replace the line

```
4. (From Plan 4) Create a dashboard with `strategy: custom:quiet-luxe` and your
   per-home config.
```

with

```
4. Create a dashboard (Settings → Dashboards → Add, url path `quiet-luxe`),
   open its raw configuration editor, and paste your per-home strategy config
   (see "Dashboard strategy" below).
```

and append this section at the end of the file:

````markdown
## Dashboard strategy

The bundle registers `ll-strategy-dashboard-quiet-luxe`. A dashboard whose
entire config is the snippet below generates every view from your HA
area/device/entity registries plus the `home:` block — no per-home view YAML.

```yaml
strategy:
  type: custom:quiet-luxe
  home:
    name: Subang Jaya
    dashboard_path: quiet-luxe   # must match the dashboard's URL path
    energy:
      power_entity: sensor.shelly_3em_total_power
      today_entity: sensor.shelly_3em_total_energy_today
      phase_entities:
        - sensor.shelly_3em_phase_a_power
        - sensor.shelly_3em_phase_b_power
        - sensor.shelly_3em_phase_c_power
      tariff: 0.516
    car: bmw                     # bmw | audi | liauto | none
    car_entities:
      battery_entity: sensor.bmw_battery
      range_entity: sensor.bmw_range
      lock_entity: binary_sensor.bmw_lock
      location_entity: device_tracker.bmw
    calendar: google             # google | none (none on Xiamen)
    vacuum: false
    media_rich: true             # Sonos group builder on the Media page
    camera_engine: webrtc        # webrtc | snapshot
    broadlink: true
    room_order: [main_living, side_living, master_bedroom]
    rooms:
      guest_toilet: { hidden: true }
      main_living: { photo: /local/quiet-luxe/rooms/main-living.jpg }
    admin_flows:
      - entity: switch.nr_guest_wifi
        name: Guest Wi-Fi
        description: UniFi guest network
    kiosk: { language: en }      # guest/kiosk session language
    users:
      family: [mei]              # HA user name or id
      guests: [kiosk]
```

Conventions the strategy reads from HA itself: areas = rooms; entities bucket
per area by domain and device class; labels refine — `ql-favorite` (sort
first), `ql-hidden` (never rendered), `ql-primary-camera` (leads camera
sections). Room photos resolve override → area picture →
`/local/quiet-luxe/rooms/<area_id>.jpg`.

Missing integrations never render (no energy config → no Energy view; no
calendar entities or `calendar: none` → no Schedule). apexcharts-card and the
WebRTC camera card are used only when installed.

RBAC tiers: `admin` (HA admins) / `family` / `guest` (default for unknown
users; use it for the shared iPad kiosk account). Family and guests never see
the Admin or Car views; guests additionally lose the personal greeting and
motion-detection toggles. **This UI-level omission is convenience, not
security** — keep the kiosk account non-admin and gate consequential actions
HA-side (Plan 5).

A malformed `home:` block renders a single diagnostic card (error detail for
admins only) and logs `[quiet-luxe]` errors to the browser console.
````

- [x] **Step 4: Full suite, then commit**

Run: `npm test && npm run lint && npm run typecheck`
Expected: all pass.

```bash
git add dev/main.ts README.md
git commit -m "$(cat <<'EOF'
feat(strategy): dev-harness strategy inspector and README usage docs

- Harness renders generate() JSON trees for the three reference homes
- README: dashboard YAML example, config reference, labels, RBAC note

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

---

### Task 17: Final gate — reference-home snapshots + full verification

**Files:**
- Create: `src/strategy/reference-dashboards.test.ts`

- [x] **Step 1: Write the reference-home matrix test**

`src/strategy/reference-dashboards.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeMockHass } from '../testing/mock-hass';
import { referenceHome, type ReferenceHomeName } from '../testing/mock-registry';
import type { HomeConfig } from './config';
import { QuietLuxeStrategy } from './quiet-luxe-strategy';
import { SUBANG_CONFIG, TUNGCHUNG_CONFIG, XIAMEN_CONFIG } from './reference-homes';
import type { LovelaceDashboardConfig } from './types';

const ADMIN = { id: 'admin-1', name: 'Steven', is_admin: true };

async function generateFor(
  name: ReferenceHomeName,
  home: HomeConfig,
  user: { id: string; name: string; is_admin: boolean } = ADMIN,
): Promise<LovelaceDashboardConfig> {
  const { snapshot, entities } = referenceHome(name);
  const hass = makeMockHass(entities, {
    user,
    wsResponses: {
      'config/area_registry/list': snapshot.areas,
      'config/device_registry/list': snapshot.devices,
      'config/entity_registry/list': snapshot.entities,
    },
  });
  return QuietLuxeStrategy.generate({ type: 'custom:quiet-luxe', home }, hass);
}

function cardTypes(dashboard: LovelaceDashboardConfig): ReadonlyArray<string> {
  return dashboard.views.flatMap((view) =>
    view.sections.flatMap((section) => section.cards.map((card) => card.type)),
  );
}

function carBrand(dashboard: LovelaceDashboardConfig): unknown {
  const carView = dashboard.views.find((view) => view.path === 'car');
  return carView?.sections[0].cards.find((card) => card.type === 'custom:quiet-luxe-car-card')
    ?.brand;
}

describe('reference-home dashboards (spec §2 matrix)', () => {
  it('energy view exists only for Subang', async () => {
    const subang = await generateFor('subang', SUBANG_CONFIG);
    const tungchung = await generateFor('tungchung', TUNGCHUNG_CONFIG);
    const xiamen = await generateFor('xiamen', XIAMEN_CONFIG);
    expect(subang.views.map((view) => view.path)).toContain('energy');
    expect(tungchung.views.map((view) => view.path)).not.toContain('energy');
    expect(xiamen.views.map((view) => view.path)).not.toContain('energy');
  });

  it('schedule cards exist for Subang and Tung Chung, never for Xiamen', async () => {
    expect(cardTypes(await generateFor('subang', SUBANG_CONFIG))).toContain(
      'custom:quiet-luxe-schedule-card',
    );
    expect(cardTypes(await generateFor('tungchung', TUNGCHUNG_CONFIG))).toContain(
      'custom:quiet-luxe-schedule-card',
    );
    expect(cardTypes(await generateFor('xiamen', XIAMEN_CONFIG))).not.toContain(
      'custom:quiet-luxe-schedule-card',
    );
  });

  it('vacuum card exists only for Xiamen', async () => {
    expect(cardTypes(await generateFor('xiamen', XIAMEN_CONFIG))).toContain(
      'custom:quiet-luxe-vacuum-card',
    );
    expect(cardTypes(await generateFor('subang', SUBANG_CONFIG))).not.toContain(
      'custom:quiet-luxe-vacuum-card',
    );
  });

  it('car brands follow the matrix', async () => {
    expect(carBrand(await generateFor('subang', SUBANG_CONFIG))).toBe('bmw');
    expect(carBrand(await generateFor('tungchung', TUNGCHUNG_CONFIG))).toBe('audi');
    expect(carBrand(await generateFor('xiamen', XIAMEN_CONFIG))).toBe('liauto');
  });

  it('Sonos group rows only for the media_rich home', async () => {
    const withGroups = (dashboard: LovelaceDashboardConfig): boolean =>
      dashboard.views.some((view) =>
        view.sections.some((section) =>
          section.cards.some((card) => card.form === 'group-row'),
        ),
      );
    expect(withGroups(await generateFor('subang', SUBANG_CONFIG))).toBe(true);
    expect(withGroups(await generateFor('tungchung', TUNGCHUNG_CONFIG))).toBe(false);
  });

  it('guest kiosk dashboards never contain admin/car views or motion toggles', async () => {
    const kiosk = { id: 'k1', name: 'kiosk', is_admin: false };
    for (const [name, home] of [
      ['subang', SUBANG_CONFIG],
      ['tungchung', TUNGCHUNG_CONFIG],
      ['xiamen', XIAMEN_CONFIG],
    ] as const) {
      const dashboard = await generateFor(name, home, kiosk);
      const paths = dashboard.views.map((view) => view.path);
      expect(paths).not.toContain('admin');
      expect(paths).not.toContain('car');
      const motionRows = dashboard.views.flatMap((view) =>
        view.sections.flatMap((section) =>
          section.cards.filter((card) => card.kind === 'motion'),
        ),
      );
      expect(motionRows.every((row) => row.show_toggle === false)).toBe(true);
    }
  });

  it('full dashboards match their snapshots', async () => {
    expect(await generateFor('subang', SUBANG_CONFIG)).toMatchSnapshot('subang');
    expect(await generateFor('tungchung', TUNGCHUNG_CONFIG)).toMatchSnapshot('tungchung');
    expect(await generateFor('xiamen', XIAMEN_CONFIG)).toMatchSnapshot('xiamen');
  });
});
```

- [x] **Step 2: Run to verify red → green**

Run: `npx vitest run src/strategy/reference-dashboards.test.ts`
Expected: first run PASSES the matrix assertions and WRITES `src/strategy/__snapshots__/reference-dashboards.test.ts.snap`. Rerun the same command: PASS with snapshots stable. If any matrix assertion fails, fix the builder — the matrix is spec §2, not negotiable.

- [x] **Step 3: Full verification gate**

```bash
npm test && npm run lint && npm run typecheck && npm run build
ls dist/quiet-luxe.js
```

Expected: all green; `dist/quiet-luxe.js` exists as the single bundle (fonts copied beside it by `build-fonts.mjs`). Call out any pre-existing failure not introduced by this plan.

- [x] **Step 4: Commit**

```bash
git add src/strategy/reference-dashboards.test.ts src/strategy/__snapshots__
git commit -m "$(cat <<'EOF'
test(strategy): reference-home dashboard snapshots and final gate

- generate() asserted across Subang/TungChung/Xiamen for every spec §2
  matrix difference: energy, schedule, vacuum, car brand, Sonos groups
- Guest kiosk dashboards verified free of admin/car/motion toggles
- Full-dashboard snapshots per home; suite/lint/typecheck/build green

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

- [x] **Step 5: Finish the branch**

Use the superpowers:finishing-a-development-branch skill to choose merge/PR/cleanup for `feat/dashboard-strategy`.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-01-dashboard-strategy.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task with review between tasks (superpowers:subagent-driven-development).
2. **Inline Execution** — execute tasks in one session with checkpoints (superpowers:executing-plans).







