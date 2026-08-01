# Quiet Luxe HACS Package Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Plan 2 of 4** (with a follow-on Plan 5): Plan 1 = Figma design system (`2026-08-01-figma-design-system.md`, complete), **Plan 2 = this plan (package foundation)**, Plan 3 = card library, Plan 4 = dashboard strategy + per-home configs, Plan 5 = live deployment to the three instances. Do not implement cards or the strategy here.
>
> **Design source of truth:** the Figma file `vaDrJjhYuziE1lVvNvJqwP` (<https://www.figma.com/design/vaDrJjhYuziE1lVvNvJqwP/>). Token values below are the LOCKED values from that file; if a value here ever disagrees with Figma, Figma wins — stop and reconcile before coding.

**Goal:** Scaffold the `quiet-luxe` HACS package (TypeScript + Lit 3 + Vite single-bundle build) with the design-token module, HA theme YAML, self-hosted font pipeline, `QlBaseCard` + `ql-canvas` base elements, i18n framework for 5 locales, and CI — the foundation Plans 3–4 build on.

**Architecture:** One npm package at repo root building to a single ES-module bundle `dist/quiet-luxe.js` plus `dist/fonts/` (HACS plugin repos serve the whole `dist/` directory when non-JS files are present — `zip_release` is integrations-only, so fonts ship as committed `dist/` content at release time). Tokens are typed TS objects (single source of truth); the theme YAML and card CSS variables (`--ql-*`) are asserted in tests to match them exactly. Fonts come from `@fontsource/*` npm packages copied into `dist/fonts/` at build time — no CDN at runtime (China constraint).

**Tech Stack** (versions verified 2026-08-01 via npm/official release pages): `lit` ^3.3 (latest 3.3.3) · `vite` ^8 (8.x stable since 2026-03, Rolldown-based, latest 8.2) · `vitest` ^4.1 (supports Vite 8) + `happy-dom` ^20 · `typescript` ^6.0 (6.0 stable 2026-03; TS 7.0.2 released 2026-07-28 is days old — too new, do not use) · `eslint` ^10 (v9 EOL 2026-08-06) + `typescript-eslint` ^8 · `home-assistant-js-websocket` ^9.6 (HA-core-maintained; used for `HassEntity` types) · `@fontsource/*` ^5 · `js-yaml` ^4 (dev, theme test only). **Rejected:** `custom-card-helpers` (last published ~2022, unmaintained — we define our own minimal `HomeAssistant` interface instead).

**Source spec:** `docs/superpowers/specs/2026-08-01-ha-dashboard-redesign-design.md` (§4 tokens, §8 architecture, §9 RBAC, §10 i18n, §12 error handling & testing)

---

## Locked design token reference (single source for all tasks)

From `docs/superpowers/plans/2026-08-01-figma-design-system.md` with two post-lock amendments: (a) the background is a **`bg/canvas` composition** = solid `bg/base` + blurred glow ellipse (`bg/glow-center`: light `#FFFDF4`, dark `#2E261A`) + neutral edge vignette `rgba(26,18,9,0.08)` radial (center at 50% / 15%, transparent to ~50% radius, full alpha at ~130% radius); (b) the old `bg/radial-light` / `bg/radial-dark` paint styles are **superseded** — do not implement them.

**Colors** (CSS var ↔ TS key ↔ light / dark):

| CSS variable | TS key | light | dark |
| --- | --- | --- | --- |
| `--ql-bg-base` | `bgBase` | `#F4F0E8` | `#161310` |
| `--ql-bg-glow-center` | `bgGlowCenter` | `#FFFDF4` | `#2E261A` |
| `--ql-bg-vignette` | `bgVignette` | `rgba(26, 18, 9, 0.08)` | `rgba(26, 18, 9, 0.08)` |
| `--ql-surface-card` | `surfaceCard` | `#FDFBF6` | `rgba(255, 250, 240, 0.055)` |
| `--ql-surface-border` | `surfaceBorder` | `#E4DCCB` | `rgba(237, 230, 216, 0.10)` |
| `--ql-ink-primary` | `inkPrimary` | `#2B2620` | `#EDE6D8` |
| `--ql-ink-muted` | `inkMuted` | `#8C8578` | `#8A8172` |
| `--ql-accent-champagne` | `accentChampagne` | `#B08D57` | `#C9A86A` |
| `--ql-status-good` | `statusGood` | `#7E8B6F` | `#93A183` |
| `--ql-status-warn` | `statusWarn` | `#C08552` | `#D09A6A` |
| `--ql-status-alert` | `statusAlert` | `#A85B4E` | `#C07A6E` |
| `--ql-glow-lamp-inner` | `glowLampInner` | `#FFD98A` | `#FFE3A6` |
| `--ql-glow-lamp-outer` | `glowLampOuter` | `#E0B263` | `#C98F3E` |

**Dimensions** (mode-independent, px): `radiusCard` 18 · `radiusChip` 999 · `radiusThumb` 12 · `spaceXs` 4 · `spaceS` 8 · `spaceM` 12 · `spaceL` 16 · `spaceXl` 24 · `touchMin` 56.

**Fonts** (bundled, never CDN — spec §2 China rule): Marcellus 400 · Outfit 300/400/500 · Noto Serif TC 300 + Noto Sans TC 400/500 (zh-Hant) · Noto Serif SC 300 + Noto Sans SC 400/500 (zh-Hans). Font stacks: display `Marcellus, "Noto Serif TC", "Noto Serif SC", serif`; body `Outfit, "Noto Sans TC", "Noto Sans SC", sans-serif`.

**Effects:** light card shadow `0 1px 6px rgba(80, 65, 40, 0.08)`; dark = glass (1px `surfaceBorder` border, no shadow).

---

## File structure (locked in by this plan)

```text
/                              repo root = npm package root
├── package.json               name "quiet-luxe", private, type module
├── tsconfig.json              strict TS
├── vite.config.ts             lib build → dist/quiet-luxe.js (single ES file)
├── vitest.config.ts           happy-dom environment
├── eslint.config.js           flat config, typescript-eslint
├── hacs.json                  HACS plugin metadata
├── README.md                  install + per-instance setup
├── themes/quiet-luxe.yaml     HA theme, light+dark modes (tested against tokens)
├── scripts/build-fonts.mjs    copies @fontsource woff2 + css → dist/fonts/
├── src/
│   ├── index.ts               bundle entry: registers elements, injects fonts
│   ├── tokens/
│   │   ├── types.ts           ColorTokens / DimensionTokens / ThemeMode
│   │   ├── palette.ts         LIGHT_COLORS / DARK_COLORS / DIMENSIONS (locked values)
│   │   ├── palette.test.ts
│   │   ├── css.ts             token objects → --ql-* custom-property maps
│   │   └── css.test.ts
│   ├── theme/theme-sync.test.ts   themes/quiet-luxe.yaml ↔ tokens parity test
│   ├── fonts/
│   │   ├── load-fonts.ts      idempotent <link> injection, URL from import.meta.url
│   │   └── load-fonts.test.ts
│   ├── i18n/
│   │   ├── types.ts           SUPPORTED_LOCALES, Locale
│   │   ├── locales/{en,zh-hant,zh-hans,ms,id}.ts   typed tables
│   │   ├── resolve.ts         locale resolution chain
│   │   ├── translate.ts       t(locale, key) with en fallback
│   │   └── i18n.test.ts
│   ├── types/home-assistant.ts    minimal HomeAssistant interface
│   ├── cards/
│   │   ├── ql-base-card.ts    QlBaseCard abstract base
│   │   └── ql-base-card.test.ts
│   └── elements/
│       ├── ql-canvas.ts       bg/canvas composition element
│       └── ql-canvas.test.ts
├── .github/workflows/ci.yml
└── .github/workflows/release.yml
```

Repo mode is **solo** (user-owned, greenfield). Each task ends in a commit; commit bodies use the repo convention and every commit message ends with the two footer lines shown in Task 1 Step 7 (repeated verbatim in every commit block).

---

### Task 1: Package scaffold and toolchain smoke test

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`
- Modify: `.gitignore`
- Test: `src/smoke.test.ts` (temporary, deleted in Task 2)

- [x] **Step 1: Create `package.json`**

```json
{
  "name": "quiet-luxe",
  "version": "0.1.0",
  "description": "Quiet Luxe — Home Assistant theme, custom card library, and dashboard strategy (HACS package)",
  "private": true,
  "license": "UNLICENSED",
  "type": "module",
  "scripts": {
    "build": "vite build && node scripts/build-fonts.mjs",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "home-assistant-js-websocket": "^9.6.0",
    "lit": "^3.3.0"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.0",
    "@fontsource/marcellus": "^5.0.0",
    "@fontsource/noto-sans-sc": "^5.0.0",
    "@fontsource/noto-sans-tc": "^5.0.0",
    "@fontsource/noto-serif-sc": "^5.0.0",
    "@fontsource/noto-serif-tc": "^5.0.0",
    "@fontsource/outfit": "^5.0.0",
    "@types/js-yaml": "^4.0.9",
    "eslint": "^10.0.0",
    "happy-dom": "^20.0.0",
    "js-yaml": "^4.1.0",
    "typescript": "^6.0.0",
    "typescript-eslint": "^8.65.0",
    "vite": "^8.0.0",
    "vitest": "^4.1.0"
  }
}
```

Note: `scripts/build-fonts.mjs` does not exist until Task 5 — that is fine; `npm run build` is first exercised in Task 9. Font packages are installed now so `npm ci` stays stable across tasks. If npm reports that a pinned major does not exist (versions were verified 2026-08-01 and may have moved), STOP and re-verify on npmjs.com rather than guessing.

- [x] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "useDefineForClassFields": false,
    "types": []
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"]
}
```

Decision: **no decorators** anywhere in this package — Lit properties are declared via `static properties` (see Task 7). This avoids the experimental-decorator/standard-decorator split entirely under TS 6. `useDefineForClassFields: false` is required by Lit's `static properties` pattern so class fields don't shadow reactive accessors.

- [x] **Step 3: Create `vite.config.ts` and `vitest.config.ts`**

`vite.config.ts`:

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2021',
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'quiet-luxe.js',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
});
```

Everything (including Lit) is bundled — no externals; HA loads one file. `emptyOutDir: true` is safe because `build-fonts.mjs` runs after `vite build` in the `build` script.

- [x] **Step 4: Create `eslint.config.js`**

```js
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'docs/'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
```

If ESLint v10 has changed the `tseslint.config` helper signature (typescript-eslint v8 predates ESLint 10), check <https://typescript-eslint.io/getting-started> and use the documented flat-config form — do not downgrade ESLint below 10 (v9 EOL is 2026-08-06).

- [x] **Step 5: Update `.gitignore`**

Read the existing `.gitignore` first (`cat .gitignore`), keep its contents, and ensure these lines exist (append any that are missing):

```text
node_modules/
dist/
```

`dist/` is ignored during development; the release workflow (Task 11) force-adds it on tagged release commits because HACS plugins serve committed `dist/` content and cannot use `zip_release` (integrations-only).

- [x] **Step 6: Install and run the toolchain smoke test**

Create `src/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('toolchain smoke', () => {
  it('runs TypeScript tests under happy-dom', () => {
    const el: HTMLDivElement = document.createElement('div');
    el.textContent = 'quiet-luxe';
    expect(el.textContent).toBe('quiet-luxe');
  });
});
```

Run:

```bash
npm install
npm run test
npm run lint
npm run typecheck
```

Expected: `npm install` completes without ERESOLVE errors; `test` reports `1 passed`; `lint` and `typecheck` exit 0 with no output errors.

- [x] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts eslint.config.js .gitignore src/smoke.test.ts
git commit -m "$(cat <<'EOF'
build(build): scaffold quiet-luxe package with Lit 3 + Vite 8 toolchain

- npm package quiet-luxe: TypeScript 6 strict, Lit 3.3, Vite 8 lib build to single ES bundle
- Vitest 4 + happy-dom test environment with toolchain smoke test
- ESLint 10 flat config with typescript-eslint 8
- Rejected custom-card-helpers (unmaintained since ~2022); HA types come from home-assistant-js-websocket

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 2: Design token module — typed palettes

**Files:**
- Create: `src/tokens/types.ts`, `src/tokens/palette.ts`
- Test: `src/tokens/palette.test.ts`
- Delete: `src/smoke.test.ts`

- [x] **Step 1: Write the failing test**

`src/tokens/palette.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { COLORS, DARK_COLORS, DIMENSIONS, LIGHT_COLORS } from './palette';

describe('color palettes', () => {
  it('locks the exact light-mode values from the Figma token reference', () => {
    expect(LIGHT_COLORS).toEqual({
      bgBase: '#F4F0E8',
      bgGlowCenter: '#FFFDF4',
      bgVignette: 'rgba(26, 18, 9, 0.08)',
      surfaceCard: '#FDFBF6',
      surfaceBorder: '#E4DCCB',
      inkPrimary: '#2B2620',
      inkMuted: '#8C8578',
      accentChampagne: '#B08D57',
      statusGood: '#7E8B6F',
      statusWarn: '#C08552',
      statusAlert: '#A85B4E',
      glowLampInner: '#FFD98A',
      glowLampOuter: '#E0B263',
    });
  });

  it('locks the exact dark-mode values from the Figma token reference', () => {
    expect(DARK_COLORS).toEqual({
      bgBase: '#161310',
      bgGlowCenter: '#2E261A',
      bgVignette: 'rgba(26, 18, 9, 0.08)',
      surfaceCard: 'rgba(255, 250, 240, 0.055)',
      surfaceBorder: 'rgba(237, 230, 216, 0.10)',
      inkPrimary: '#EDE6D8',
      inkMuted: '#8A8172',
      accentChampagne: '#C9A86A',
      statusGood: '#93A183',
      statusWarn: '#D09A6A',
      statusAlert: '#C07A6E',
      glowLampInner: '#FFE3A6',
      glowLampOuter: '#C98F3E',
    });
  });

  it('has identical token keys in both modes (mode completeness)', () => {
    expect(Object.keys(COLORS.dark).sort()).toEqual(Object.keys(COLORS.light).sort());
  });
});

describe('dimension tokens', () => {
  it('locks the exact dimension values', () => {
    expect(DIMENSIONS).toEqual({
      radiusCard: 18,
      radiusChip: 999,
      radiusThumb: 12,
      spaceXs: 4,
      spaceS: 8,
      spaceM: 12,
      spaceL: 16,
      spaceXl: 24,
      touchMin: 56,
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tokens/palette.test.ts`
Expected: FAIL — "Failed to resolve import ./palette".

- [x] **Step 3: Write the implementation**

`src/tokens/types.ts`:

```ts
export type ThemeMode = 'light' | 'dark';

export interface ColorTokens {
  readonly bgBase: string;
  readonly bgGlowCenter: string;
  readonly bgVignette: string;
  readonly surfaceCard: string;
  readonly surfaceBorder: string;
  readonly inkPrimary: string;
  readonly inkMuted: string;
  readonly accentChampagne: string;
  readonly statusGood: string;
  readonly statusWarn: string;
  readonly statusAlert: string;
  readonly glowLampInner: string;
  readonly glowLampOuter: string;
}

export interface DimensionTokens {
  readonly radiusCard: number;
  readonly radiusChip: number;
  readonly radiusThumb: number;
  readonly spaceXs: number;
  readonly spaceS: number;
  readonly spaceM: number;
  readonly spaceL: number;
  readonly spaceXl: number;
  readonly touchMin: number;
}
```

`src/tokens/palette.ts` — values copied verbatim from the locked token reference at the top of this plan:

```ts
import type { ColorTokens, DimensionTokens, ThemeMode } from './types';

export const LIGHT_COLORS: ColorTokens = {
  bgBase: '#F4F0E8',
  bgGlowCenter: '#FFFDF4',
  bgVignette: 'rgba(26, 18, 9, 0.08)',
  surfaceCard: '#FDFBF6',
  surfaceBorder: '#E4DCCB',
  inkPrimary: '#2B2620',
  inkMuted: '#8C8578',
  accentChampagne: '#B08D57',
  statusGood: '#7E8B6F',
  statusWarn: '#C08552',
  statusAlert: '#A85B4E',
  glowLampInner: '#FFD98A',
  glowLampOuter: '#E0B263',
};

export const DARK_COLORS: ColorTokens = {
  bgBase: '#161310',
  bgGlowCenter: '#2E261A',
  bgVignette: 'rgba(26, 18, 9, 0.08)',
  surfaceCard: 'rgba(255, 250, 240, 0.055)',
  surfaceBorder: 'rgba(237, 230, 216, 0.10)',
  inkPrimary: '#EDE6D8',
  inkMuted: '#8A8172',
  accentChampagne: '#C9A86A',
  statusGood: '#93A183',
  statusWarn: '#D09A6A',
  statusAlert: '#C07A6E',
  glowLampInner: '#FFE3A6',
  glowLampOuter: '#C98F3E',
};

export const COLORS: Readonly<Record<ThemeMode, ColorTokens>> = {
  light: LIGHT_COLORS,
  dark: DARK_COLORS,
};

export const DIMENSIONS: DimensionTokens = {
  radiusCard: 18,
  radiusChip: 999,
  radiusThumb: 12,
  spaceXs: 4,
  spaceS: 8,
  spaceM: 12,
  spaceL: 16,
  spaceXl: 24,
  touchMin: 56,
};

export const SHADOW_CARD_LIGHT = '0 1px 6px rgba(80, 65, 40, 0.08)';
```

- [x] **Step 4: Run tests to verify they pass; delete the smoke test**

Run: `rm src/smoke.test.ts && npm run test && npm run typecheck && npm run lint`
Expected: 4 tests pass; typecheck and lint clean.

- [x] **Step 5: Commit**

```bash
git add src/tokens/types.ts src/tokens/palette.ts src/tokens/palette.test.ts
git add -A src/smoke.test.ts
git commit -m "$(cat <<'EOF'
feat(tokens): add typed Quiet Luxe color and dimension token palettes

- LIGHT_COLORS/DARK_COLORS/DIMENSIONS with exact locked Figma values (incl. bg/canvas amendments)
- Tests assert every hex/rgba value verbatim and light/dark key parity
- Replaces toolchain smoke test

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 3: CSS custom-property generation

**Files:**
- Create: `src/tokens/css.ts`
- Test: `src/tokens/css.test.ts`

- [x] **Step 1: Write the failing test**

`src/tokens/css.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { colorCssVariables, cssVariableBlock, dimensionCssVariables } from './css';

describe('colorCssVariables', () => {
  it('maps every light token to a --ql-* kebab-case variable with the exact value', () => {
    const vars = colorCssVariables('light');
    expect(vars['--ql-bg-base']).toBe('#F4F0E8');
    expect(vars['--ql-bg-glow-center']).toBe('#FFFDF4');
    expect(vars['--ql-surface-card']).toBe('#FDFBF6');
    expect(vars['--ql-ink-primary']).toBe('#2B2620');
    expect(vars['--ql-accent-champagne']).toBe('#B08D57');
    expect(Object.keys(vars)).toHaveLength(13);
  });

  it('maps dark tokens with the exact dark values', () => {
    const vars = colorCssVariables('dark');
    expect(vars['--ql-bg-glow-center']).toBe('#2E261A');
    expect(vars['--ql-surface-card']).toBe('rgba(255, 250, 240, 0.055)');
    expect(vars['--ql-status-alert']).toBe('#C07A6E');
  });
});

describe('dimensionCssVariables', () => {
  it('emits px-suffixed values', () => {
    const vars = dimensionCssVariables();
    expect(vars['--ql-radius-card']).toBe('18px');
    expect(vars['--ql-space-xl']).toBe('24px');
    expect(vars['--ql-touch-min']).toBe('56px');
    expect(Object.keys(vars)).toHaveLength(9);
  });
});

describe('cssVariableBlock', () => {
  it('renders declaration lines for a mode including dimensions', () => {
    const block = cssVariableBlock('light');
    expect(block).toContain('--ql-bg-base: #F4F0E8;');
    expect(block).toContain('--ql-radius-chip: 999px;');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tokens/css.test.ts`
Expected: FAIL — "Failed to resolve import ./css".

- [x] **Step 3: Write the implementation**

`src/tokens/css.ts`:

```ts
import { COLORS, DIMENSIONS } from './palette';
import type { ThemeMode } from './types';

function kebabCase(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

export function colorCssVariables(mode: ThemeMode): Record<string, string> {
  return Object.fromEntries(
    Object.entries(COLORS[mode]).map(([key, value]) => [`--ql-${kebabCase(key)}`, value]),
  );
}

export function dimensionCssVariables(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(DIMENSIONS).map(([key, value]) => [`--ql-${kebabCase(key)}`, `${value}px`]),
  );
}

export function cssVariableBlock(mode: ThemeMode): string {
  const vars = { ...colorCssVariables(mode), ...dimensionCssVariables() };
  return Object.entries(vars)
    .map(([name, value]) => `${name}: ${value};`)
    .join('\n');
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: all tests pass (palette + css), no type or lint errors.

- [x] **Step 5: Commit**

```bash
git add src/tokens/css.ts src/tokens/css.test.ts
git commit -m "$(cat <<'EOF'
feat(tokens): generate --ql-* CSS custom properties from token palettes

- colorCssVariables(mode) / dimensionCssVariables() / cssVariableBlock(mode)
- Kebab-case naming derived mechanically from TS keys, tested against exact values
- Single source of truth: palettes drive cards, theme YAML sync test, and canvas element

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 4: HA theme YAML with light/dark modes, synced to tokens

**Files:**
- Create: `themes/quiet-luxe.yaml`
- Test: `src/theme/theme-sync.test.ts`

The theme uses only standard HA theme variables plus `ql-*` passthrough keys (HA exposes every theme key as a CSS variable `--<key>`, which is how cards receive `--ql-*` without card-mod). No card-mod anywhere.

- [x] **Step 1: Write the failing test**

`src/theme/theme-sync.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { colorCssVariables, dimensionCssVariables } from '../tokens/css';
import { COLORS, DIMENSIONS, SHADOW_CARD_LIGHT } from '../tokens/palette';

type ThemeModes = { light: Record<string, string>; dark: Record<string, string> };
type Theme = Record<string, string> & { modes: ThemeModes };

const themeFile = load(readFileSync('themes/quiet-luxe.yaml', 'utf8')) as Record<string, Theme>;
const maybeTheme = themeFile['quiet-luxe'];
if (maybeTheme === undefined) {
  throw new Error('themes/quiet-luxe.yaml does not define a quiet-luxe theme');
}
const theme: Theme = maybeTheme;

describe('themes/quiet-luxe.yaml', () => {
  it('defines the quiet-luxe theme with light and dark modes', () => {
    expect(theme).toBeDefined();
    expect(theme.modes.light).toBeDefined();
    expect(theme.modes.dark).toBeDefined();
  });

  it.each(['light', 'dark'] as const)('maps core HA variables to %s tokens', (mode) => {
    const m = theme.modes[mode];
    const c = COLORS[mode];
    expect(m['primary-background-color']).toBe(c.bgBase);
    expect(m['card-background-color']).toBe(c.surfaceCard);
    expect(m['ha-card-background']).toBe(c.surfaceCard);
    expect(m['primary-text-color']).toBe(c.inkPrimary);
    expect(m['secondary-text-color']).toBe(c.inkMuted);
    expect(m['disabled-text-color']).toBe(c.inkMuted);
    expect(m['primary-color']).toBe(c.accentChampagne);
    expect(m['accent-color']).toBe(c.accentChampagne);
    expect(m['divider-color']).toBe(c.surfaceBorder);
    expect(m['ha-card-border-color']).toBe(c.surfaceBorder);
    expect(m['success-color']).toBe(c.statusGood);
    expect(m['warning-color']).toBe(c.statusWarn);
    expect(m['error-color']).toBe(c.statusAlert);
  });

  it.each(['light', 'dark'] as const)(
    'passes through every --ql-* color token as a %s-mode theme key',
    (mode) => {
      for (const [cssVar, value] of Object.entries(colorCssVariables(mode))) {
        expect(theme.modes[mode][cssVar.slice(2)]).toBe(value);
      }
    },
  );

  it('passes through every --ql-* dimension token as a mode-independent key', () => {
    for (const [cssVar, value] of Object.entries(dimensionCssVariables())) {
      expect(theme[cssVar.slice(2)]).toBe(value);
    }
  });

  it('applies shape and depth tokens', () => {
    expect(theme['ha-card-border-radius']).toBe(`${DIMENSIONS.radiusCard}px`);
    expect(theme.modes.light['ha-card-box-shadow']).toBe(SHADOW_CARD_LIGHT);
    expect(theme.modes.dark['ha-card-box-shadow']).toBe('none');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/theme/theme-sync.test.ts`
Expected: FAIL — ENOENT reading `themes/quiet-luxe.yaml`.

- [x] **Step 3: Write `themes/quiet-luxe.yaml`**

```yaml
# Quiet Luxe — Home Assistant theme (generated values are LOCKED to src/tokens/palette.ts;
# src/theme/theme-sync.test.ts fails if this file drifts from the token source of truth).
quiet-luxe:
  # Shape & type (mode-independent)
  ha-card-border-radius: "18px"
  ha-card-border-width: "1px"
  ql-font-display: "Marcellus, 'Noto Serif TC', 'Noto Serif SC', serif"
  ql-font-body: "Outfit, 'Noto Sans TC', 'Noto Sans SC', sans-serif"
  # ql-* dimension passthrough (HA exposes each key as --<key>)
  ql-radius-card: "18px"
  ql-radius-chip: "999px"
  ql-radius-thumb: "12px"
  ql-space-xs: "4px"
  ql-space-s: "8px"
  ql-space-m: "12px"
  ql-space-l: "16px"
  ql-space-xl: "24px"
  ql-touch-min: "56px"
  modes:
    light:
      primary-color: "#B08D57"
      accent-color: "#B08D57"
      primary-background-color: "#F4F0E8"
      secondary-background-color: "#F4F0E8"
      card-background-color: "#FDFBF6"
      ha-card-background: "#FDFBF6"
      ha-card-border-color: "#E4DCCB"
      ha-card-box-shadow: "0 1px 6px rgba(80, 65, 40, 0.08)"
      primary-text-color: "#2B2620"
      secondary-text-color: "#8C8578"
      text-primary-color: "#FDFBF6"
      disabled-text-color: "#8C8578"
      divider-color: "#E4DCCB"
      state-icon-color: "#8C8578"
      switch-checked-color: "#B08D57"
      switch-checked-button-color: "#FDFBF6"
      switch-checked-track-color: "#B08D57"
      slider-color: "#B08D57"
      slider-track-color: "#E4DCCB"
      success-color: "#7E8B6F"
      warning-color: "#C08552"
      error-color: "#A85B4E"
      info-color: "#B08D57"
      # ql-* color passthrough — exact colorCssVariables('light') set
      ql-bg-base: "#F4F0E8"
      ql-bg-glow-center: "#FFFDF4"
      ql-bg-vignette: "rgba(26, 18, 9, 0.08)"
      ql-surface-card: "#FDFBF6"
      ql-surface-border: "#E4DCCB"
      ql-ink-primary: "#2B2620"
      ql-ink-muted: "#8C8578"
      ql-accent-champagne: "#B08D57"
      ql-status-good: "#7E8B6F"
      ql-status-warn: "#C08552"
      ql-status-alert: "#A85B4E"
      ql-glow-lamp-inner: "#FFD98A"
      ql-glow-lamp-outer: "#E0B263"
    dark:
      primary-color: "#C9A86A"
      accent-color: "#C9A86A"
      primary-background-color: "#161310"
      secondary-background-color: "#161310"
      card-background-color: "rgba(255, 250, 240, 0.055)"
      ha-card-background: "rgba(255, 250, 240, 0.055)"
      ha-card-border-color: "rgba(237, 230, 216, 0.10)"
      ha-card-box-shadow: "none"
      primary-text-color: "#EDE6D8"
      secondary-text-color: "#8A8172"
      text-primary-color: "#161310"
      disabled-text-color: "#8A8172"
      divider-color: "rgba(237, 230, 216, 0.10)"
      state-icon-color: "#8A8172"
      switch-checked-color: "#C9A86A"
      switch-checked-button-color: "#161310"
      switch-checked-track-color: "#C9A86A"
      slider-color: "#C9A86A"
      slider-track-color: "rgba(237, 230, 216, 0.10)"
      success-color: "#93A183"
      warning-color: "#D09A6A"
      error-color: "#C07A6E"
      info-color: "#C9A86A"
      # ql-* color passthrough — exact colorCssVariables('dark') set
      ql-bg-base: "#161310"
      ql-bg-glow-center: "#2E261A"
      ql-bg-vignette: "rgba(26, 18, 9, 0.08)"
      ql-surface-card: "rgba(255, 250, 240, 0.055)"
      ql-surface-border: "rgba(237, 230, 216, 0.10)"
      ql-ink-primary: "#EDE6D8"
      ql-ink-muted: "#8A8172"
      ql-accent-champagne: "#C9A86A"
      ql-status-good: "#93A183"
      ql-status-warn: "#D09A6A"
      ql-status-alert: "#C07A6E"
      ql-glow-lamp-inner: "#FFE3A6"
      ql-glow-lamp-outer: "#C98F3E"
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: all pass, including all theme-sync assertions.

- [x] **Step 5: Commit**

```bash
git add themes/quiet-luxe.yaml src/theme/theme-sync.test.ts
git commit -m "$(cat <<'EOF'
feat(theme): add quiet-luxe HA theme with light/dark modes synced to tokens

- Standard HA theme variables (backgrounds, text, accents, switches, status colors) per mode
- ql-* passthrough keys expose every design token as a --ql-* CSS variable, card-mod-free
- theme-sync test locks the YAML to src/tokens/palette.ts; any drift fails CI

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 5: Self-hosted font pipeline (@fontsource → dist/fonts)

**Decision:** fonts come from `@fontsource/*` npm packages (mature, versioned, includes unicode-range-sliced CJK woff2 files) rather than a custom download/subset step. A build script copies only the needed weights into `dist/fonts/` and emits an aggregating `fonts.css`. Rationale: deterministic offline builds (npm registry only, never Google Fonts CDN — spec §2 China rule), no font-tooling to maintain, and browsers fetch only the unicode-range slices a page actually uses so CJK size is a non-issue at runtime.

**Files:**
- Create: `scripts/build-fonts.mjs`, `src/fonts/load-fonts.ts`
- Test: `src/fonts/load-fonts.test.ts`

- [x] **Step 1: Write the failing test for the runtime loader**

`src/fonts/load-fonts.test.ts`:

```ts
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { injectFontStylesheet } from './load-fonts';

const MODULE_URL = 'http://ha.local/hacsfiles/quiet-luxe/quiet-luxe.js';

function freshDocument(): Document {
  return new Window().document as unknown as Document;
}

describe('injectFontStylesheet', () => {
  it('appends one stylesheet link resolved relative to the bundle URL', () => {
    const doc = freshDocument();
    injectFontStylesheet(doc, MODULE_URL);
    const link = doc.getElementById('quiet-luxe-fonts') as HTMLLinkElement | null;
    expect(link).not.toBeNull();
    expect(link?.getAttribute('rel')).toBe('stylesheet');
    expect(link?.getAttribute('href')).toBe(
      'http://ha.local/hacsfiles/quiet-luxe/fonts/fonts.css',
    );
  });

  it('is idempotent', () => {
    const doc = freshDocument();
    injectFontStylesheet(doc, MODULE_URL);
    injectFontStylesheet(doc, MODULE_URL);
    expect(doc.querySelectorAll('#quiet-luxe-fonts')).toHaveLength(1);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/fonts/load-fonts.test.ts`
Expected: FAIL — "Failed to resolve import ./load-fonts".

- [x] **Step 3: Implement the runtime loader**

`src/fonts/load-fonts.ts`:

```ts
const FONT_STYLESHEET_ID = 'quiet-luxe-fonts';

/**
 * Injects a <link> to the bundled font stylesheet, resolved relative to the
 * built bundle URL so it works from /hacsfiles/... and /local/... alike.
 * Idempotent: safe to call on every bundle evaluation.
 */
export function injectFontStylesheet(doc: Document, moduleUrl: string): void {
  if (doc.getElementById(FONT_STYLESHEET_ID) !== null) {
    return;
  }
  const link = doc.createElement('link');
  link.id = FONT_STYLESHEET_ID;
  link.rel = 'stylesheet';
  link.href = new URL('fonts/fonts.css', moduleUrl).href;
  doc.head.append(link);
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/fonts/load-fonts.test.ts`
Expected: PASS (2 tests).

- [x] **Step 5: Implement the build-time copy script**

`scripts/build-fonts.mjs`:

```js
// Copies the required @fontsource weights (css + woff2/woff slices) into
// dist/fonts/ and writes dist/fonts/fonts.css. Runs after `vite build`.
// Fails loudly if any expected fontsource file is missing.
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(pkgRoot, 'dist', 'fonts');

const FONTS = [
  { pkg: '@fontsource/marcellus', weights: [400] },
  { pkg: '@fontsource/outfit', weights: [300, 400, 500] },
  { pkg: '@fontsource/noto-serif-tc', weights: [300] },
  { pkg: '@fontsource/noto-sans-tc', weights: [400, 500] },
  { pkg: '@fontsource/noto-serif-sc', weights: [300] },
  { pkg: '@fontsource/noto-sans-sc', weights: [400, 500] },
];

const imports = [];
for (const { pkg, weights } of FONTS) {
  const family = pkg.split('/')[1];
  const srcDir = join(pkgRoot, 'node_modules', pkg);
  const destDir = join(outDir, family);
  mkdirSync(join(destDir, 'files'), { recursive: true });
  for (const weight of weights) {
    const cssName = `${weight}.css`;
    const cssPath = join(srcDir, cssName);
    if (!existsSync(cssPath)) {
      throw new Error(`build-fonts: missing ${pkg}/${cssName} — check @fontsource package layout`);
    }
    cpSync(cssPath, join(destDir, cssName));
    imports.push(`@import url("./${family}/${weight}.css");`);
    const sliceFiles = readdirSync(join(srcDir, 'files')).filter((f) =>
      f.includes(`-${weight}-normal`),
    );
    if (sliceFiles.length === 0) {
      throw new Error(`build-fonts: no font files for ${pkg} weight ${weight}`);
    }
    for (const file of sliceFiles) {
      cpSync(join(srcDir, 'files', file), join(destDir, 'files', file));
    }
  }
}
writeFileSync(join(outDir, 'fonts.css'), `${imports.join('\n')}\n`);
console.log(`build-fonts: wrote ${imports.length} @imports to dist/fonts/fonts.css`);
```

The `@fontsource` per-weight CSS references `./files/...` relatively, so copying each family's `files/` directory beside its CSS preserves working URLs. CJK packages ship unicode-range slices; all slices for a weight are copied, but browsers download only the slices they render.

- [x] **Step 6: Verify the script against real packages**

Run: `node scripts/build-fonts.mjs && ls dist/fonts && head -n 10 dist/fonts/fonts.css && ls dist/fonts/marcellus/files | head`
Expected: exits 0 printing `build-fonts: wrote 10 @imports...`; `dist/fonts` lists the 6 family directories + `fonts.css`; `fonts.css` starts with `@import url("./marcellus/400.css");`; marcellus files listing shows `marcellus-*-400-normal.woff2` entries. If a fontsource package uses a different file layout than `<weight>.css` + `files/`, STOP and inspect `node_modules/@fontsource/<family>/` — adjust the script to the actual layout, do not skip files silently.

- [x] **Step 7: Run full suite and commit**

Run: `npm run test && npm run lint && npm run typecheck`
Expected: all pass.

```bash
git add scripts/build-fonts.mjs src/fonts/load-fonts.ts src/fonts/load-fonts.test.ts
git commit -m "$(cat <<'EOF'
feat(build): add self-hosted font pipeline from @fontsource packages

- build-fonts.mjs copies Marcellus/Outfit/Noto TC+SC weights into dist/fonts with fonts.css
- Runtime injectFontStylesheet() resolves fonts.css relative to the bundle URL, idempotent
- No Google Fonts CDN at runtime (China-reachability rule); build depends only on npm registry
- Script fails loudly on missing fontsource files

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 6: i18n framework (5 locales, typed keys, fallback chain)

**Files:**
- Create: `src/i18n/types.ts`, `src/i18n/locales/en.ts`, `src/i18n/locales/zh-hant.ts`, `src/i18n/locales/zh-hans.ts`, `src/i18n/locales/ms.ts`, `src/i18n/locales/id.ts`, `src/i18n/resolve.ts`, `src/i18n/translate.ts`
- Test: `src/i18n/i18n.test.ts`

Starter key set only (common strings + section titles); Plans 3–4 extend it. Non-English strings below are working drafts — flag them for user review at plan completion, do not silently change them.

- [x] **Step 1: Write the failing test**

`src/i18n/i18n.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { en } from './locales/en';
import { id } from './locales/id';
import { ms } from './locales/ms';
import { zhHans } from './locales/zh-hans';
import { zhHant } from './locales/zh-hant';
import { resolveLocale } from './resolve';
import { t } from './translate';
import { SUPPORTED_LOCALES } from './types';

const TABLES = { en, 'zh-Hant': zhHant, 'zh-Hans': zhHans, ms, id } as const;

describe('locale tables', () => {
  it('covers all five supported locales', () => {
    expect(Object.keys(TABLES).sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });

  it.each(Object.entries(TABLES))('locale %s has exact key parity with en', (_name, table) => {
    expect(Object.keys(table).sort()).toEqual(Object.keys(en).sort());
  });

  it.each(Object.entries(TABLES))('locale %s has no empty strings', (_name, table) => {
    for (const value of Object.values(table)) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('resolveLocale', () => {
  it('returns an exact supported tag', () => {
    expect(resolveLocale(['zh-Hant'])).toBe('zh-Hant');
    expect(resolveLocale(['ms'])).toBe('ms');
  });

  it('normalizes regional Chinese tags to script tags', () => {
    expect(resolveLocale(['zh-TW'])).toBe('zh-Hant');
    expect(resolveLocale(['zh-HK'])).toBe('zh-Hant');
    expect(resolveLocale(['zh-CN'])).toBe('zh-Hans');
    expect(resolveLocale(['zh'])).toBe('zh-Hans');
  });

  it('normalizes regional Latin tags to their base language', () => {
    expect(resolveLocale(['en-GB'])).toBe('en');
    expect(resolveLocale(['id-ID'])).toBe('id');
  });

  it('walks the candidate chain: user profile → kiosk default → en', () => {
    expect(resolveLocale(['de', 'ms'])).toBe('ms');
    expect(resolveLocale([undefined, 'zh-Hans'])).toBe('zh-Hans');
    expect(resolveLocale(['de', 'fr'])).toBe('en');
    expect(resolveLocale([])).toBe('en');
  });
});

describe('t', () => {
  it('translates a key in the requested locale', () => {
    expect(t('en', 'common.on')).toBe('On');
    expect(t('zh-Hant', 'common.unavailable')).toBe('無法使用');
    expect(t('id', 'section.rooms')).toBe('Ruangan');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/i18n/i18n.test.ts`
Expected: FAIL — unresolved imports for `./locales/en` etc.

- [x] **Step 3: Write types and the English reference table**

`src/i18n/types.ts`:

```ts
export const SUPPORTED_LOCALES = ['en', 'zh-Hant', 'zh-Hans', 'ms', 'id'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];
```

`src/i18n/locales/en.ts` (defines the key shape; all other locales are type-checked against it):

```ts
export const en = {
  'common.on': 'On',
  'common.off': 'Off',
  'common.unavailable': 'Unavailable',
  'common.offline': 'Offline',
  'section.rooms': 'Rooms',
  'section.climate': 'Climate',
  'section.music': 'Music',
  'section.schedule': 'Schedule',
  'section.scenes': 'Scenes',
  'section.cameras': 'Cameras',
  'section.energy': 'Energy',
  'section.all_climates': 'All climates',
} as const;

export type TranslationKey = keyof typeof en;

export type TranslationTable = Readonly<Record<TranslationKey, string>>;
```

- [x] **Step 4: Write the four other locale tables**

`src/i18n/locales/zh-hant.ts`:

```ts
import type { TranslationTable } from './en';

export const zhHant: TranslationTable = {
  'common.on': '開',
  'common.off': '關',
  'common.unavailable': '無法使用',
  'common.offline': '離線',
  'section.rooms': '房間',
  'section.climate': '溫控',
  'section.music': '音樂',
  'section.schedule': '行程',
  'section.scenes': '情境',
  'section.cameras': '攝影機',
  'section.energy': '能源',
  'section.all_climates': '所有溫控設備',
};
```

`src/i18n/locales/zh-hans.ts`:

```ts
import type { TranslationTable } from './en';

export const zhHans: TranslationTable = {
  'common.on': '开',
  'common.off': '关',
  'common.unavailable': '不可用',
  'common.offline': '离线',
  'section.rooms': '房间',
  'section.climate': '温控',
  'section.music': '音乐',
  'section.schedule': '日程',
  'section.scenes': '情景',
  'section.cameras': '摄像头',
  'section.energy': '能源',
  'section.all_climates': '所有温控设备',
};
```

`src/i18n/locales/ms.ts`:

```ts
import type { TranslationTable } from './en';

export const ms: TranslationTable = {
  'common.on': 'Hidup',
  'common.off': 'Mati',
  'common.unavailable': 'Tidak tersedia',
  'common.offline': 'Luar talian',
  'section.rooms': 'Bilik',
  'section.climate': 'Iklim',
  'section.music': 'Muzik',
  'section.schedule': 'Jadual',
  'section.scenes': 'Suasana',
  'section.cameras': 'Kamera',
  'section.energy': 'Tenaga',
  'section.all_climates': 'Semua iklim',
};
```

`src/i18n/locales/id.ts`:

```ts
import type { TranslationTable } from './en';

export const id: TranslationTable = {
  'common.on': 'Nyala',
  'common.off': 'Mati',
  'common.unavailable': 'Tidak tersedia',
  'common.offline': 'Luring',
  'section.rooms': 'Ruangan',
  'section.climate': 'Iklim',
  'section.music': 'Musik',
  'section.schedule': 'Jadwal',
  'section.scenes': 'Suasana',
  'section.cameras': 'Kamera',
  'section.energy': 'Energi',
  'section.all_climates': 'Semua iklim',
};
```

- [x] **Step 5: Write the resolver and translator**

`src/i18n/resolve.ts`:

```ts
import { SUPPORTED_LOCALES, type Locale } from './types';

const ALIASES: Readonly<Record<string, Locale>> = {
  'zh-tw': 'zh-Hant',
  'zh-hk': 'zh-Hant',
  'zh-mo': 'zh-Hant',
  'zh-cn': 'zh-Hans',
  'zh-sg': 'zh-Hans',
  zh: 'zh-Hans',
};

function normalize(tag: string): Locale | undefined {
  const lower = tag.toLowerCase();
  const exact = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === lower);
  if (exact !== undefined) {
    return exact;
  }
  const alias = ALIASES[lower];
  if (alias !== undefined) {
    return alias;
  }
  const base = lower.split('-')[0];
  return SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === base);
}

/**
 * Resolves the first supported locale from an ordered candidate chain
 * (HA user profile language, then per-home kiosk default), falling back to en.
 * Spec §10.
 */
export function resolveLocale(candidates: ReadonlyArray<string | undefined>): Locale {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === '') {
      continue;
    }
    const resolved = normalize(candidate);
    if (resolved !== undefined) {
      return resolved;
    }
  }
  return 'en';
}
```

`src/i18n/translate.ts`:

```ts
import { en, type TranslationKey, type TranslationTable } from './locales/en';
import { id } from './locales/id';
import { ms } from './locales/ms';
import { zhHans } from './locales/zh-hans';
import { zhHant } from './locales/zh-hant';
import type { Locale } from './types';

const TABLES: Readonly<Record<Locale, TranslationTable>> = {
  en,
  'zh-Hant': zhHant,
  'zh-Hans': zhHans,
  ms,
  id,
};

/** Typed lookup; the type system guarantees key completeness per table. */
export function t(locale: Locale, key: TranslationKey): string {
  return TABLES[locale][key];
}
```

(No runtime en-fallback branch inside `t` — key completeness is enforced at compile time by `TranslationTable` and at runtime by the parity test; the en fallback in the resolution chain lives in `resolveLocale`. A missing key is a build failure, not a silent fallback.)

- [x] **Step 6: Run tests to verify they pass**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: all i18n tests pass (parity, aliases, chain, lookups); typecheck proves table completeness.

- [x] **Step 7: Commit**

```bash
git add src/i18n
git commit -m "$(cat <<'EOF'
feat(i18n): add typed 5-locale translation framework with resolution chain

- en/zh-Hant/zh-Hans/ms/id tables typed against the en key shape (compile-time completeness)
- resolveLocale: user profile → kiosk default → en, with zh regional-tag normalization
- Tests: key parity across locales, no empty strings, fallback chain, exact lookups
- Non-English strings are drafts pending user review

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 7: HomeAssistant types + QlBaseCard base class

**Files:**
- Create: `src/types/home-assistant.ts`, `src/cards/ql-base-card.ts`
- Test: `src/cards/ql-base-card.test.ts`

- [x] **Step 1: Write the failing test**

`src/cards/ql-base-card.test.ts`:

```ts
import { html, type TemplateResult } from 'lit';
import { describe, expect, it } from 'vitest';
import type { HomeAssistant } from '../types/home-assistant';
import { QlBaseCard } from './ql-base-card';

class QlTestCard extends QlBaseCard {
  protected override render(): TemplateResult {
    const cls = this.availability('light.desk') === 'available' ? 'ql-card' : 'ql-card ql-unavailable';
    return html`<div class="${cls}">test</div>`;
  }
}
customElements.define('ql-test-card', QlTestCard);

function makeHass(states: HomeAssistant['states']): HomeAssistant {
  return {
    states,
    language: 'en',
    locale: { language: 'en' },
    callService: () => Promise.resolve(undefined),
  };
}

function stubEntity(entityId: string, state: string): HomeAssistant['states'][string] {
  return {
    entity_id: entityId,
    state,
    attributes: {},
    last_changed: '',
    last_updated: '',
    context: { id: '', user_id: null, parent_id: null },
  };
}

describe('QlBaseCard availability', () => {
  it('reports available for a normal entity state', () => {
    const card = new QlTestCard();
    card.hass = makeHass({ 'light.desk': stubEntity('light.desk', 'on') });
    expect(card.availabilityOf('light.desk')).toBe('available');
  });

  it('reports unavailable for unavailable/unknown states (muted, never an error)', () => {
    const card = new QlTestCard();
    card.hass = makeHass({
      'light.desk': stubEntity('light.desk', 'unavailable'),
      'light.hall': stubEntity('light.hall', 'unknown'),
    });
    expect(card.availabilityOf('light.desk')).toBe('unavailable');
    expect(card.availabilityOf('light.hall')).toBe('unavailable');
  });

  it('reports missing when the entity is absent or hass is unset', () => {
    const card = new QlTestCard();
    expect(card.availabilityOf('light.desk')).toBe('missing');
    card.hass = makeHass({});
    expect(card.availabilityOf('light.desk')).toBe('missing');
  });

  it('applies the muted unavailable class when rendered', async () => {
    const card = new QlTestCard();
    card.hass = makeHass({ 'light.desk': stubEntity('light.desk', 'unavailable') });
    document.body.append(card);
    await card.updateComplete;
    const div = card.shadowRoot?.querySelector('div');
    expect(div?.classList.contains('ql-unavailable')).toBe(true);
    card.remove();
  });
});
```

Note: the test calls a public `availabilityOf` wrapper (below) so the protected helper stays protected in real cards.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/cards/ql-base-card.test.ts`
Expected: FAIL — unresolved import `./ql-base-card`.

- [x] **Step 3: Write the implementation**

`src/types/home-assistant.ts`:

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
}

export type { HassEntity };
```

`src/cards/ql-base-card.ts`:

```ts
import { css, LitElement, type CSSResult } from 'lit';
import type { HassEntity, HomeAssistant } from '../types/home-assistant';

export type EntityAvailability = 'available' | 'unavailable' | 'missing';

/**
 * Base class for all Quiet Luxe cards.
 * - `hass` reactive property (no decorators; static properties pattern).
 * - Graceful degradation per spec §8: unavailable/unknown/missing entities are
 *   presented muted ("offline"), never as an error box.
 * - Shared styles read --ql-* variables from the quiet-luxe theme, with
 *   light-mode literals as fallbacks so cards degrade sanely without the theme.
 */
export abstract class QlBaseCard extends LitElement {
  static properties = {
    hass: { attribute: false },
  };

  declare hass?: HomeAssistant;

  /** Public wrapper so tests and the strategy can query availability. */
  availabilityOf(entityId: string): EntityAvailability {
    return this.availability(entityId);
  }

  protected entity(entityId: string): HassEntity | undefined {
    return this.hass?.states[entityId];
  }

  protected availability(entityId: string): EntityAvailability {
    const state = this.entity(entityId)?.state;
    if (state === undefined) {
      return 'missing';
    }
    if (state === 'unavailable' || state === 'unknown') {
      return 'unavailable';
    }
    return 'available';
  }

  static qlCardStyles: CSSResult = css`
    :host {
      display: block;
      color: var(--ql-ink-primary, #2b2620);
      font-family: var(--ql-font-body, Outfit, 'Noto Sans TC', 'Noto Sans SC', sans-serif);
    }
    .ql-card {
      background: var(--ql-surface-card, #fdfbf6);
      border: 1px solid var(--ql-surface-border, #e4dccb);
      border-radius: var(--ql-radius-card, 18px);
      padding: var(--ql-space-l, 16px);
    }
    .ql-unavailable {
      color: var(--ql-ink-muted, #8c8578);
      opacity: 0.7;
    }
  `;

  static override styles: CSSResult = QlBaseCard.qlCardStyles;
}
```

Subclasses that add styles compose them: `static override styles = [QlBaseCard.qlCardStyles, css\`...\`]` (Plan 3 relies on this).

- [x] **Step 4: Run tests to verify they pass**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: all pass, including the shadow-DOM render assertion under happy-dom. If happy-dom fails on Lit rendering internals, check the vitest+lit+happy-dom combination and, only if genuinely broken, swap the test environment for `jsdom` (add `jsdom` dev dep, change `vitest.config.ts` environment) — document the swap in the commit body.

- [x] **Step 5: Commit**

```bash
git add src/types/home-assistant.ts src/cards/ql-base-card.ts src/cards/ql-base-card.test.ts
git commit -m "$(cat <<'EOF'
feat(cards): add QlBaseCard base class and minimal HomeAssistant types

- Typed hass interface over home-assistant-js-websocket HassEntity (custom-card-helpers rejected)
- availability(): available | unavailable | missing; unavailable renders muted, never an error
- Shared .ql-card styles bound to --ql-* theme variables with light-mode fallbacks
- static-properties Lit pattern (no decorators) under TS6 strict

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 8: ql-canvas background element (bg/canvas composition)

**Files:**
- Create: `src/elements/ql-canvas.ts`
- Test: `src/elements/ql-canvas.test.ts`

Implements the Figma `bg/canvas` composition in CSS: solid base + soft glow ellipse centered at 50% / 15% + edge vignette reaching full alpha at ~130% radius. The glow uses a wide radial gradient (no `filter: blur` — a full-viewport blur layer is GPU-hostile on the always-on iPads; the gradient's soft falloff is the blur).

- [x] **Step 1: Write the failing test**

`src/elements/ql-canvas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { QlCanvas } from './ql-canvas';

describe('ql-canvas', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('ql-canvas')).toBe(QlCanvas);
  });

  it('renders base, glow, and vignette layers in order', async () => {
    const el = document.createElement('ql-canvas') as QlCanvas;
    document.body.append(el);
    await el.updateComplete;
    const layers = [...(el.shadowRoot?.querySelectorAll('div') ?? [])].map((d) => d.className);
    expect(layers).toEqual(['base', 'glow', 'vignette']);
    el.remove();
  });

  it('binds every layer to --ql-bg-* variables with locked fallbacks', () => {
    const cssText = QlCanvas.styles.toString();
    expect(cssText).toContain('var(--ql-bg-base, #f4f0e8)');
    expect(cssText).toContain('var(--ql-bg-glow-center, #fffdf4)');
    expect(cssText).toContain('var(--ql-bg-vignette, rgba(26, 18, 9, 0.08))');
    expect(cssText).toContain('at 50% 15%');
    expect(cssText).toContain('130%');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/elements/ql-canvas.test.ts`
Expected: FAIL — unresolved import `./ql-canvas`.

- [x] **Step 3: Write the implementation**

`src/elements/ql-canvas.ts`:

```ts
import { css, html, LitElement, type CSSResult, type TemplateResult } from 'lit';

/**
 * Full-bleed dashboard background implementing the Figma `bg/canvas`
 * composition: solid bg/base + glow ellipse at 50%/15% + edge vignette
 * (transparent to ~50% radius, full alpha at ~130%). Colors come from the
 * quiet-luxe theme's --ql-bg-* variables so the element themes with HA
 * light/dark mode; fallbacks are the locked light-mode values.
 */
export class QlCanvas extends LitElement {
  static override styles: CSSResult = css`
    :host {
      position: absolute;
      inset: 0;
      display: block;
      overflow: hidden;
      pointer-events: none;
    }
    :host > * {
      position: absolute;
      inset: 0;
    }
    .base {
      background: var(--ql-bg-base, #f4f0e8);
    }
    .glow {
      background: radial-gradient(
        ellipse 120% 85% at 50% 15%,
        var(--ql-bg-glow-center, #fffdf4) 0%,
        transparent 65%
      );
    }
    .vignette {
      background: radial-gradient(
        circle at 50% 15%,
        transparent 50%,
        var(--ql-bg-vignette, rgba(26, 18, 9, 0.08)) 130%
      );
    }
  `;

  protected override render(): TemplateResult {
    return html`
      <div class="base"></div>
      <div class="glow"></div>
      <div class="vignette"></div>
    `;
  }
}

customElements.define('ql-canvas', QlCanvas);
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: all pass. (`QlCanvas.styles.toString()` returns the css template text in a non-browser context; if the exact-string assertions are brittle against Lit's CSSResult formatting, assert on `QlCanvas.styles.cssText` instead — same expectations.)

- [x] **Step 5: Visual spot-check (manual, no commit gate)**

Create nothing in the repo: open a scratch HTML file in the scratchpad that loads the built bundle later in Task 9's verification; the authoritative visual QA against Figma happens in Plan 3's card harness. This step is a reminder, not an action.

- [x] **Step 6: Commit**

```bash
git add src/elements/ql-canvas.ts src/elements/ql-canvas.test.ts
git commit -m "$(cat <<'EOF'
feat(cards): add ql-canvas background element implementing bg/canvas composition

- Solid bg/base + glow ellipse at 50%/15% + edge vignette to 130% radius, pure CSS gradients
- Bound to --ql-bg-* theme variables; themes with HA light/dark automatically
- No filter: blur — gradient falloff replaces it to protect always-on iPad GPUs

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 9: Bundle entry, HACS metadata, README

**Files:**
- Create: `src/index.ts`, `hacs.json`, `README.md`

- [x] **Step 1: Write `src/index.ts`**

```ts
import pkg from '../package.json';
import { injectFontStylesheet } from './fonts/load-fonts';
import './elements/ql-canvas';

export { QlBaseCard, type EntityAvailability } from './cards/ql-base-card';
export { QlCanvas } from './elements/ql-canvas';
export * from './tokens/palette';
export { colorCssVariables, cssVariableBlock, dimensionCssVariables } from './tokens/css';
export { resolveLocale } from './i18n/resolve';
export { t } from './i18n/translate';
export { SUPPORTED_LOCALES, type Locale } from './i18n/types';
export type { HomeAssistant } from './types/home-assistant';

injectFontStylesheet(document, import.meta.url);

console.info(
  `%c QUIET LUXE %c v${pkg.version} `,
  'background:#B08D57;color:#FDFBF6;font-weight:500',
  'color:#8C8578',
);
```

(The version banner is the one sanctioned console line — it is the standard HACS-plugin convention for verifying the loaded version. `resolveJsonModule` makes the `package.json` import typed; Vite inlines only the used field.)

- [x] **Step 2: Write `hacs.json`**

```json
{
  "name": "Quiet Luxe",
  "filename": "quiet-luxe.js",
  "render_readme": true,
  "homeassistant": "2025.6.0"
}
```

The `homeassistant` floor is UNCONFIRMED (spec §13: instance HA versions unverified) — revisit in Plan 5 when the three instances are reachable. `filename` frees the JS name from the repo name (`home_assistant_dashboard_redesign`).

- [x] **Step 3: Write `README.md`**

```markdown
# Quiet Luxe

Warm, quiet, image-rich Home Assistant dashboard system: theme + custom card
library + dashboard strategy in one HACS package. Runs the same bundle on all
homes from a small per-home config.

Design source of truth: Figma file `vaDrJjhYuziE1lVvNvJqwP`.

## Install (per instance)

1. HACS → Custom repositories → add this repo as type **Dashboard**.
2. Install **Quiet Luxe**; HACS registers `quiet-luxe.js` as a dashboard resource.
3. Copy `themes/quiet-luxe.yaml` into your `config/themes/` directory (ensure
   `frontend: themes: !include_dir_merge_named themes` in `configuration.yaml`),
   then select the **quiet-luxe** theme in your user profile. Light/dark follow
   HA's mode.
4. (From Plan 4) Create a dashboard with `strategy: custom:quiet-luxe` and your
   per-home config.

Fonts (Marcellus, Outfit, Noto Sans/Serif TC+SC) are bundled and served from
your HA instance — no external font CDN is contacted at runtime.

## Development

- `npm install` then `npm run test` / `npm run lint` / `npm run typecheck`
- `npm run build` → `dist/quiet-luxe.js` + `dist/fonts/`
- `dist/` is committed only by the release workflow.

## Repository docs

- Design spec: `docs/superpowers/specs/2026-08-01-ha-dashboard-redesign-design.md`
- Plans: `docs/superpowers/plans/`
```

- [x] **Step 4: Build and verify the artifact shape**

Run: `npm run build && ls dist && ls dist/*.js | wc -l && head -c 300 dist/quiet-luxe.js`
Expected: build succeeds; `dist` contains exactly `quiet-luxe.js` and `fonts/`; the JS file count is `1` (single bundle, Lit inlined, no chunks); the head shows minified ES module code. If Vite emits extra chunks, fix `rollupOptions.output.inlineDynamicImports` / imports until one file remains — do not ship multi-chunk.

- [x] **Step 5: Verify tests still pass and commit**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: all pass.

```bash
git add src/index.ts hacs.json README.md
git commit -m "$(cat <<'EOF'
feat(build): add bundle entry, HACS metadata, and install README

- index.ts registers ql-canvas, injects bundled fonts, exports public foundation API
- hacs.json: dashboard plugin, filename quiet-luxe.js, HA floor 2025.6.0 (UNCONFIRMED)
- README documents per-instance install incl. manual theme-file copy step
- Verified single-file ES bundle output (dist/quiet-luxe.js + dist/fonts)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 10: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [x] **Step 1: Write the workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build
      - name: Assert single-bundle artifact
        run: |
          test -f dist/quiet-luxe.js
          test -f dist/fonts/fonts.css
          [ "$(find dist -maxdepth 1 -name '*.js' | wc -l)" -eq 1 ]
```

- [x] **Step 2: Validate the workflow locally**

Run: `npx --yes yaml-lint .github/workflows/ci.yml 2>/dev/null || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('yaml ok')"`
Expected: `yaml ok` (or yaml-lint pass). Then run the same commands the workflow runs, in order (`npm ci && npm run lint && npm run typecheck && npm run test && npm run build`), and confirm all exit 0 — CI must never be the first place the pipeline runs.

- [x] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
ci(ci): add GitHub Actions verify workflow

- lint, typecheck, vitest, build on push to main and PRs (Node 22, npm cache)
- Asserts the built artifact is a single JS bundle plus dist/fonts
- Full command sequence validated locally before first CI run

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 11: Release workflow for HACS

**Files:**
- Create: `.github/workflows/release.yml`

HACS constraint recap (verified against hacs.xyz publish docs 2026-08-01): plugins cannot use `zip_release` (integrations-only), and a plugin needing non-JS files must serve them from `dist/`. Therefore releases work by **committing the built `dist/` on a tagged release commit** (force-added past `.gitignore`), then creating a GitHub release from that tag. HACS offers users the tagged versions.

- [x] **Step 1: Write the workflow**

`.github/workflows/release.yml`:

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      version:
        description: "Release version (e.g. 0.1.0) — must match package.json"
        required: true

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Verify version matches package.json
        run: |
          PKG_VERSION="$(node -p "require('./package.json').version")"
          if [ "$PKG_VERSION" != "${{ inputs.version }}" ]; then
            echo "package.json is $PKG_VERSION but release input is ${{ inputs.version }}" >&2
            exit 1
          fi
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build
      - name: Commit dist and tag
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add -f dist
          git commit -m "chore(build): commit dist for v${{ inputs.version }}"
          git tag "v${{ inputs.version }}"
          git push origin HEAD:main "v${{ inputs.version }}"
      - name: Create GitHub release
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh release create "v${{ inputs.version }}" --title "v${{ inputs.version }}" --generate-notes
```

- [x] **Step 2: Validate YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml')); print('yaml ok')"`
Expected: `yaml ok`. (The workflow itself is exercised in Plan 5 when the repo is pushed to GitHub and the first release is cut; do not attempt a release now.)

- [x] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "$(cat <<'EOF'
ci(ci): add manual release workflow committing dist for HACS

- workflow_dispatch with version input; fails if it mismatches package.json
- Runs full verification, builds, force-adds dist on a tagged commit, creates GH release
- Rationale: HACS zip_release is integrations-only; plugins with fonts must serve committed dist/

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

### Task 12: Final verification and wrap-up

**Files:**
- Modify: `.ai/current-plan.md` (create if absent)

- [x] **Step 1: Full clean-room verification**

Run:

```bash
rm -rf node_modules dist && npm ci && npm run lint && npm run typecheck && npm run test && npm run build && ls dist
```

Expected: every command exits 0 from a cold start; final listing shows `quiet-luxe.js` and `fonts/`. Report actual test count and bundle size (`du -h dist/quiet-luxe.js`).

- [x] **Step 2: Definition-of-done sweep**

Confirm, with evidence (command output, not assertion):
1. All tests pass (`npm run test` output).
2. No lint/type errors.
3. `git status` clean except untracked `dist/` (ignored).
4. Every commit follows the convention with body bullets and the two footer lines.
5. Deferred items recorded (see risks below) in `.ai/current-plan.md`: current state = foundation complete, next = Plan 3 card library; open items = translation review, HA version floor UNCONFIRMED, first release deferred to Plan 5.

- [x] **Step 3: Commit the plan-state update**

```bash
git add .ai/current-plan.md
git commit -m "$(cat <<'EOF'
docs(docs): record foundation completion state in current-plan

- Foundation (Plan 2) complete: tokens, theme, fonts, base elements, i18n, CI
- Next: Plan 3 card library; open items: translation review, HA floor, first release in Plan 5

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B8dsjC79vsCyFaZBcbwcNn
EOF
)"
```

---

## Self-review notes

- **Spec coverage (foundation scope):** §4 tokens/typography/effects → Tasks 2–5 (exact locked values, tested); §8 single-bundle HACS package + graceful degradation → Tasks 1, 7, 9, 11 (unavailable = muted, never error; loud failures in build scripts); §10 i18n locales/resolution/typed keys → Task 6; §12 testing (i18n completeness in CI, unit tests per module) → Tasks 2–8 + CI Task 10; §2 China rule (no Google CDN) → Task 5 + README. Cards (§7), strategy/RBAC generation (§8/§9), visual harness and HA-container integration tests (§12) are Plans 3–4 by explicit scope; RBAC's HA-side enforcement is Plan 4/5.
- **Placeholder scan:** clean — every code step carries complete code; the two STOP conditions (fontsource layout, tseslint/ESLint-10 helper) are explicit decision points with instructions, not TODOs.
- **Type consistency:** `COLORS/LIGHT_COLORS/DARK_COLORS/DIMENSIONS/SHADOW_CARD_LIGHT` (Task 2) used identically in Tasks 3, 4; `colorCssVariables/dimensionCssVariables/cssVariableBlock` (Task 3) used in Task 4 test and exported in Task 9; `TranslationTable/TranslationKey/Locale/SUPPORTED_LOCALES` consistent across Task 6 files and Task 9 exports; `QlBaseCard.availabilityOf` defined in Task 7 and used by its test; `QlCanvas` name consistent Task 8/9.
- **Known risks / open questions for the main thread:** (1) non-English strings are drafts needing user review; (2) `homeassistant: 2025.6.0` floor UNCONFIRMED until instances reachable; (3) Vitest+Lit under happy-dom has a documented escape hatch to jsdom in Task 7 Step 4; (4) HACS "Dashboard" custom-repo category naming in the HACS UI may differ ("Plugin" in older versions) — README wording to be confirmed in Plan 5; (5) repo currently has no GitHub remote — release workflow is validated but unexercised until Plan 5.
