# Quiet Luxe Figma Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Additional required skills per task:** `frontend-design:frontend-design` (user mandate: load before ANY design work), `figma:figma-use` (MANDATORY before every `use_figma` call), `figma:figma-generate-library` (library-building method). Load all three at the start of every task in this plan.

**Goal:** Build the complete "Quiet Luxe" design system in the user's Figma file — foundations, component library, and all screen frames for 3 breakpoints × 2 modes — such that every screen is composed exclusively of library component instances.

**Architecture:** Library-first Figma structure: page `00 Foundations` (variables + styles), page `01 Components` (the only page where anything is drawn), pages `02 Mobile / 03 iPad / 04 Desktop` (instance-only screen frames), page `05 Reference Homes`. Color variables use one collection with Light/Dark modes so components theme by mode switch.

**Tech Stack:** Figma MCP (`use_figma`, `get_screenshot`, `get_metadata`, `upload_assets`, `create_new_file` not needed — existing file), fonts: Marcellus, Outfit, Noto Serif TC/SC, Noto Sans TC/SC.

**Source spec:** `docs/superpowers/specs/2026-08-01-ha-dashboard-redesign-design.md` (sections 4–7, 11)

**Target file:** <https://www.figma.com/design/vaDrJjhYuziE1lVvNvJqwP/Untitled?node-id=0-1>

---

## Design token reference (single source for all tasks)

Inline copy from spec §4 — use these exact values; do not invent new ones.

**Color variables** (collection `ql/color`, modes `light` / `dark`):

| Variable | light | dark |
| --- | --- | --- |
| `bg/base` | `#F4F0E8` | `#161310` |
| `bg/glow-center` | `#FAF7F0` | `#1E1A15` |
| `surface/card` | `#FDFBF6` | `#FFFAF0` @ 5.5% |
| `surface/border` | `#E4DCCB` | `#EDE6D8` @ 10% |
| `ink/primary` | `#2B2620` | `#EDE6D8` |
| `ink/muted` | `#8C8578` | `#8A8172` |
| `accent/champagne` | `#B08D57` | `#C9A86A` |
| `status/good` | `#7E8B6F` | `#93A183` |
| `status/warn` | `#C08552` | `#D09A6A` |
| `status/alert` | `#A85B4E` | `#C07A6E` |
| `glow/lamp-inner` | `#FFD98A` | `#FFE3A6` |
| `glow/lamp-outer` | `#E0B263` | `#C98F3E` |

**Number variables** (collection `ql/dimension`): `radius/card = 18`, `radius/chip = 999`, `radius/thumb = 12`, `space/xs = 4`, `space/s = 8`, `space/m = 12`, `space/l = 16`, `space/xl = 24`, `touch/min = 56`.

**Effect styles:** `shadow/card-light` (0 1 6 rgba(80,65,40,.08)); `glass/card-dark` (1px inside border `surface/border` + background blur 24); `glow/light-on` (drop shadow 0 0 18 rgba(224,178,99,.45)).

**Gradient styles (paint styles):** `scrim/top` (linear 180°, rgba(8,6,4,.62) → transparent, stops 0%/45%); `scrim/bottom` (linear 0°, rgba(8,6,4,.82) → transparent, stops 0%/50%); `bg/radial-light` (radial at 50% 18%, `bg/glow-center` → `bg/base`); `bg/radial-dark` (radial at 50% 12%, `bg/glow-center` → `bg/base`).

**Text styles** (Latin set; duplicate as `…/tc` with Noto Serif TC light / Noto Sans TC, `…/sc` with Noto Serif SC / Noto Sans SC):

| Style | Font | Size/LH | Tracking | Case |
| --- | --- | --- | --- | --- |
| `display/home` | Marcellus 400 | 34/40 | 4% | as-typed |
| `display/room` | Marcellus 400 | 24/30 | 4% | as-typed |
| `numeral/xl` | Outfit 300 | 44/48 | 1% | — |
| `numeral/m` | Outfit 300 | 26/30 | 1% | — |
| `title/card` | Outfit 500 | 16/22 | 0 | sentence |
| `body` | Outfit 400 | 14/20 | 0 | sentence |
| `caption` | Outfit 400 | 12/16 | 2% | sentence |
| `label/eyebrow` | Outfit 500 | 11/14 | 14% | UPPERCASE |

**Breakpoint frames:** mobile 390×844, iPad 1180×820 (landscape), desktop 1680×1050.

---

### Task 1: File audit and page scaffolding

**Figma targets:** file root

- [ ] **Step 1:** Load skills `frontend-design:frontend-design`, `figma:figma-use`. Call `whoami`, then `get_metadata` on the target file URL to confirm access and inspect existing content.
- [ ] **Step 2:** Via `use_figma`: rename the file's default page structure into pages, in order: `00 Foundations`, `01 Components`, `02 Mobile`, `03 iPad`, `04 Desktop`, `05 Reference Homes`. Preserve (move to a page `zz Archive`) any existing user content rather than deleting it.
- [ ] **Step 3:** Verify with `get_metadata` that all 6 pages (+ optional archive) exist. Report the page node IDs for later tasks.

### Task 2: Foundations — variables, styles, font check

**Figma targets:** page `00 Foundations`

- [ ] **Step 1:** Load `figma:figma-generate-library` + `figma:figma-use`. Confirm fonts available via `find_fonts`: Marcellus, Outfit (300/400/500), Noto Serif TC, Noto Sans TC, Noto Serif SC, Noto Sans SC. If a font is missing, stop and report — do not substitute silently.
- [ ] **Step 2:** Create variable collection `ql/color` with modes `light` and `dark`; add every variable from the token table above with exact values (alpha variants as rgba).
- [ ] **Step 3:** Create collection `ql/dimension` with the number variables listed above.
- [ ] **Step 4:** Create the text styles table (Latin set), then TC and SC duplicates.
- [ ] **Step 5:** Create effect styles and paint styles (scrims, radial backgrounds) exactly as specified.
- [ ] **Step 6:** On `00 Foundations`, lay out a token sheet: swatch grid bound to the variables (both modes shown), type ramp specimens (Latin + TC + SC), effect demos, scrim demo over a placeholder photo. `get_screenshot` and verify every swatch/style renders and is bound to a variable (not hardcoded).

### Task 3: Primitive components

**Figma targets:** page `01 Components`, section "Primitives"

Build as components/component sets with auto-layout, all fills/strokes/radii/text bound to `ql/*` variables and shared styles. Variants axis `mode` is NOT needed — mode comes from variable modes; build once, verify in both modes.

- [ ] **Step 1:** `chip/device` — auto-layout pill (icon 16 + label `caption`), variants: `state=off` (fill rgba(22,19,16,.55) dark-glass style, border `surface/border`, text `#F3EDE1`) / `state=on` (fill `accent/champagne` @ 85%, text `ink/primary`-on-light). Min height 28.
- [ ] **Step 2:** `chip/scene` — pill, variants `emphasis=primary` (fill `ink/primary`, text `bg/base`) / `emphasis=secondary` (fill `surface/card`, border `surface/border`, text `ink/primary`). Height 36 (56 on iPad usage via size variant `size=touch`).
- [ ] **Step 3:** `control/toggle` (on/off; track 44×26, thumb 22, on-fill `accent/champagne`), `control/slider` (track 4, fill `accent/champagne`, thumb 16 `surface/card` + border), `control/segmented` (2–4 segments, selected = `ink/primary` pill with `bg/base` text, others `ink/muted` text), `status/dot` (8px; variants good/warn/alert/neutral bound to status colors), `badge/count` (caption text in 999-radius `surface/card` pill).
- [ ] **Step 4:** Screenshot the Primitives section in light and dark variable modes; verify every color changes with mode (nothing hardcoded). Fix any unbound fills.

### Task 4: Structure components

**Figma targets:** page `01 Components`, section "Structure"

- [ ] **Step 1:** `header/home` component set, variants `breakpoint=mobile|ipad|desktop`. Content per spec §6: mobile = stacked (meta line `caption` muted → greeting `display/home` → home+presence `caption` with presence names in `accent/champagne`); ipad/desktop = single row (home name `display/home` 20–24px, date/time + weather string `caption` muted, presence names accent). Slot for globe language chip (instance of `chip/scene` secondary with 🌐 icon).
- [ ] **Step 2:** `header/room` — room name `display/room` + micro-stats row (temp · humidity · AQI as `caption` muted) + back affordance.
- [ ] **Step 3:** `nav/pills` — horizontal auto-layout of `chip/scene` instances, variants `active-item=1..4`; `section/eyebrow` — `label/eyebrow` muted text + optional right-aligned link text in `accent/champagne` ("All climates →" pattern).
- [ ] **Step 4:** `idle/clock-face` (iPad 1180×820): centered clock `numeral/xl` scaled 96px, date `body` muted, weather + AQI line `caption`, on `bg/radial-dark` — dimmed composition, no cards.
- [ ] **Step 5:** `card/language` — large tappable card (min 56 height, `title/card` language name in its own script + `caption` English gloss), variants `selected=true|false` (selected: border `accent/champagne`).
- [ ] **Step 6:** Screenshot section both modes; verify bindings.

### Task 5: Room card

**Figma targets:** page `01 Components`, section "Cards"

- [ ] **Step 1:** Upload 10 placeholder room photos via `upload_assets` (Unsplash interior images; neutral/warm; one per room type: living, side-living, dining, kitchen, master, bedroom, study, helper, storage, balcony).
- [ ] **Step 2:** Build `card/room` component set, variants `size=S|M|L`:
  - S (mobile grid, 171×110): photo fill (saturate/brightness handled by 12% black overlay), **bottom scrim** (`scrim/bottom`) with room name `caption` white + right-aligned status glyphs.
  - M (iPad grid, ~330×190): photo, **top scrim** (`scrim/top`) behind name `title/card` white + stats `caption` 75% white, **bottom scrim** behind row of `chip/device` instances.
  - L (carousel/hero, 420×260): as M plus AQI pill top-right.
  - All: radius `radius/card`, amber glow dot (ellipse w/ `glow/light-on`) shown via boolean property `lightsOn`.
- [ ] **Step 3:** Screenshot with a bright sky photo to verify top-scrim legibility (the exact failure the user flagged). Adjust scrim stop to 55% if name contrast < 4.5:1.

### Task 6: Climate, light, cover, sensor cards

**Figma targets:** page `01 Components`, section "Cards"

- [ ] **Step 1:** `card/climate` set, variants `device=ac|purifier|dehumidifier|fan|exhaust` × `state=active|idle|off`. Layout: eyebrow (device name) → `numeral/m` value (temp or AQI) with unit in `caption` → status line `caption` (active = `accent/champagne`, good-air = `status/good`, off = `ink/muted`). Surface `surface/card` + mode-appropriate effect style.
- [ ] **Step 2:** `card/light` — eyebrow (light name), brightness `numeral/m` %, slider instance, bulb ellipse with `glow/light-on` when `state=on`; variants `state=on|off`.
- [ ] **Step 3:** `card/cover` — variants `type=curtain|shade`; position % + slider + open/close/stop icon row (56px touch targets).
- [ ] **Step 4:** `tile/sensor` — variants `metric=aqi|temp|humidity|uv|rain`; eyebrow + `numeral/m` + status dot instance.
- [ ] **Step 5:** Screenshot all variants both modes; verify no hardcoded colors.

### Task 7: Media, camera, energy cards

**Figma targets:** page `01 Components`, section "Cards"

- [ ] **Step 1:** Upload 1 placeholder album-art square + 2 camera-still placeholders via `upload_assets`.
- [ ] **Step 2:** `card/media` set, variants `form=bar|player|group-row`:
  - bar: 28px art, track `caption`, source `caption` muted, 26px play circle (`ink/primary` fill), chevron.
  - player: 64px art radius `radius/thumb`, eyebrow source line, track `title/card`, artist—album `caption` muted, transport row (prev/play 34px circle/next), volume slider + %.
  - group-row: speaker name `body` + join `control/toggle` + per-speaker slider.
- [ ] **Step 3:** `card/camera` — variants `form=glance` (thumb 16:9 h34 + status line `status/good` "all clear") / `form=full` (16:9 live frame + name + LIVE badge `status/alert` dot).
- [ ] **Step 4:** `card/energy` set, variants `form=strip` (⚡ `numeral/m` kW + today kWh `caption` + sparkline glyph in `accent/champagne`) / `form=ring` (per-phase donut, stroke `accent/champagne` on `surface/border` track, center `numeral/m`) / `form=chart` (placeholder bar-chart frame with axis captions — implementation uses apexcharts; Figma shows visual target only, bars in `accent/champagne` + `ink/muted`).
- [ ] **Step 5:** Screenshot both modes; verify.

### Task 8: Schedule, tasks, car, vacuum, presence, rows

**Figma targets:** page `01 Components`, section "Cards"

- [ ] **Step 1:** `card/schedule` set, variants `view=agenda|day|week|month`. Agenda: header row (eyebrow "Schedule" + `control/segmented` instance) → event rows (2px left rule — next event `accent/champagne`, later `surface/border`; time+title `body`, source `caption` muted) → divider → task rows (☐ `body` + due badge `status/warn` caption). Day/week/month: calendar grids using `caption` numerals, today marked with `accent/champagne` ring — keep simple, they're view targets.
- [ ] **Step 2:** `card/tasks` — standalone list form of the task rows + "N open" footer caption.
- [ ] **Step 3:** Upload 3 car cutout placeholders (BMW sedan / Audi / Li Auto L7 silhouettes) via `upload_assets`. `card/car` — variants `brand=bmw|audi|liauto`: cutout hero on plain surface, battery/fuel `numeral/m` + range, lock status dot, precondition toggle row, location caption.
- [ ] **Step 4:** `card/vacuum` — variants `state=docked|cleaning|returning`: cutout placeholder, battery %, state line, room-clean chips row (`chip/device`).
- [ ] **Step 5:** `row/presence` (avatar circles 18px + names `caption` accent), `row/door-motion` (icon + name `body` + state `caption` + optional `control/toggle` for motion, boolean prop `showToggle`), `row/network-flow` (name `body` + description `caption` muted + `control/toggle` + confirm hint caption), `card/device-cutout` (generic: eyebrow, cutout image slot, status line — used for Sonos/Dyson/TV/dehumidifier).
- [ ] **Step 6:** Screenshot all, both modes; verify bindings and variant completeness against spec §7 inventory list — every item in spec §7 must now exist as a component. List any gap and fix.

### Task 9: Mobile screens (page `02 Mobile`)

**Instance-only rule applies from here: if a screen needs something not in the library, STOP, add it to `01 Components` first, then instance it.**

- [ ] **Step 1:** Frame `Home / light` 390×844, fill `bg/radial-light`: header/home(mobile) → scene chips row → eyebrow "Rooms" → 2×2 `card/room` S grid + "all 9 rooms ↓" caption accent → eyebrow "Climate" + "All climates →" → 3 `card/climate` row → `card/media` bar → `card/schedule` agenda → glance row (`card/energy` strip + `card/car` compact instance). Duplicate → `Home / dark` (switch variable mode).
- [ ] **Step 2:** Frames `Room — Living / light+dark`: header/room → lights section (2 `card/light`) → climate → covers → media bar → sensors (`tile/sensor` row + `row/door-motion` with toggle) → switches chips. `Room — Bathroom / light+dark`: lights + exhaust `card/climate` + humidity tile only (proves conditional rendering).
- [ ] **Step 3:** Frames light+dark for: `Media` (player + group rows + TV device-cutout cards), `Security` (camera full cards ×2, door/motion rows), `All Climates` (averages tiles + per-room climate cards + "all off" scene chip), `Car` (card/car full), `Admin` (network-flow rows + health captions), `Language` (5 `card/language`), `Energy` (ring ×3 + chart + strip).
- [ ] **Step 4:** `get_screenshot` every frame; check: no scroll-breaking overflow, spacing multiples of `space/*`, eyebrow/link pattern consistent, both modes correct. Fix and re-shoot.

### Task 10: iPad screens (page `03 iPad`)

- [ ] **Step 1:** Frame `Home / dark` 1180×820 per spec §6: header/home(ipad) row → left zone 64% (eyebrow "Rooms · swipe ↓" → 2×2 `card/room` M grid with 4th at 50% opacity → Climate eyebrow + "All climates →" → 3 `card/climate` → right rail 36% (scene chips `size=touch` → `card/media` player-compact → `card/camera` glance → `card/energy` strip → next-event row) → `nav/pills` bottom. Duplicate → light.
- [ ] **Step 2:** Frames light+dark: `Room — Living`, `Media` (with group builder), `Security` (2×2 camera wall), `Energy`, `All Climates`, `Language`, `idle/clock-face` placement frame. **No Admin, no Car frames on this page** (RBAC).
- [ ] **Step 3:** Screenshot audit: touch targets ≥56px on interactive elements, no personal greeting anywhere, Home fits without scrolling. Fix violations.

### Task 11: Desktop screens (page `04 Desktop`)

- [ ] **Step 1:** Frame `Home / light+dark` 1680×1050: 3-column mission-control grid — col 1 rooms (M cards), col 2 climate + media + schedule, col 3 cameras + energy chart + car + presence + admin shortcut row. Higher density (`space/m` gaps).
- [ ] **Step 2:** Frames light+dark: `Security` (3×2 camera wall + rows), `Energy` (full: rings + chart + consumers list), `Admin` (network-flow rows grouped UniFi/pfSense + instance health), `Car`, `Media`, `All Climates`, `Language`.
- [ ] **Step 3:** Screenshot audit as Task 9 Step 4, plus hover-state notes layer (annotations, not new drawing).

### Task 12: Reference homes (page `05 Reference Homes`)

- [ ] **Step 1:** Three iPad `Home / dark` duplicates configured per the spec §2 matrix: **Subang** (9 rooms incl. side living, Sonos player, energy strip, Samsung TV chip, shades+curtains) / **Tung Chung** (LG TV, curtains only, no energy, Audi glance on desktop-var note) / **Xiamen** (TCL TV, vacuum card in rail, no energy, no schedule card — calendar:none, no Broadlink switches section).
- [ ] **Step 2:** Screenshot all three side-by-side; verify the differences match the matrix exactly (this is the visual proof of config-driven variation). Fix mismatches.

### Task 13: Library QA gate

- [ ] **Step 1:** `get_metadata` sweep of pages 02–05: every node must be a component instance, text node inside an instance, or frame/section container. List any raw rectangles/vectors drawn on screen pages; replace with components.
- [ ] **Step 2:** Variable-binding sweep on `01 Components`: search for hardcoded hex fills; rebind or justify (photos/scrims exempt).
- [ ] **Step 3:** Mode-flip test: switch `ql/color` mode on every screen page; screenshot; confirm all frames theme correctly.
- [ ] **Step 4:** Produce a summary report: component count, variant count, screens count per page, deviations from spec §7 inventory (must be zero), open design debts. Present to user with key screenshots for final design sign-off.

---

## Self-review notes

- **Spec coverage:** §4 tokens → Task 2; §5 nav → Tasks 4/9–11; §6 layouts → Tasks 9–11; §7 inventory → Tasks 3–8 (gate in Task 8 Step 6 + Task 13); §11 Figma organization → Tasks 1, 12, 13. RBAC visibility on iPad → Task 10 Step 2. i18n type sets → Task 2 Step 4 (TC/SC styles); Language page → Tasks 4/9–11. China rule affects code phase, not Figma (fonts bundled at implementation).
- **Not in this plan (by design):** HACS package, strategy, i18n files, live-instance validation — Plan 2, written after Task 13 sign-off.
- **Placeholder scan:** none — every step names exact components, values, and verification.
- **Consistency:** component names (`card/room`, `chip/device`, …) used identically across Tasks 3–12.
