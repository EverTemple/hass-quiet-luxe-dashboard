# Home Assistant Dashboard Redesign — "Quiet Luxe" Design Spec

**Date:** 2026-08-01
**Status:** Approved section-by-section in brainstorming; pending final user review of this document
**Figma file:** https://www.figma.com/design/vaDrJjhYuziE1lVvNvJqwP/Untitled?node-id=0-1

## 1. Goal

Design (in Figma) and implement (in Home Assistant) a cohesive, modern, image-rich dashboard system that runs on three heterogeneous HA instances — Xiamen (CN), Tung Chung (HK), Subang Jaya 47500 (MY) — across three device variants (mobile, iPad tabletop console, desktop), in light and dark mode, in five languages, with per-user permissions.

### Acceptance criteria

1. One HACS-installable package (theme + custom cards + dashboard strategy) produces a working dashboard on any of the three instances from a small per-home config; no per-home view YAML.
2. All screens in Figma are assembled exclusively from a component library (no one-off elements in page frames); implemented cards match the Figma components per breakpoint per mode.
3. All features in §6–§8 function for the homes that have the underlying hardware; homes without it show no trace of the feature.
4. RBAC: guests on shared iPads cannot see or trigger admin/network/car/motion-toggle functionality, enforced at both UI-generation and HA-permission layers.
5. UI renders correctly in en, zh-Hant, zh-Hans, ms, id — switchable per user profile and via the Language page.

## 2. Context

### Homes and per-home matrix

| | Subang Jaya | Tung Chung | Xiamen |
|---|---|---|---|
| Speakers | Sonos + nearly all speakers (Bose portables) | minimal | minimal |
| TV | Samsung (multiple) | LG | TCL |
| Covers | Vertical shades + horizontal curtains | Horizontal curtains | Horizontal curtains |
| Energy | Shelly 3EM | — | — |
| Car | BMW (CarData) | Audi | Li Auto L7 (integration UNCONFIRMED) |
| Cameras | Dahua NVR | Generic RTSP (SriHome) | Dahua via 大华云联 cloud (integration path TBD: Dahua/Imou integration or go2rtc) |
| Vacuum | — | — | Dreame X30 Pro |

All homes: Philips Hue + WiZ lights, Z2M light switches, ACs/fans/exhausts, Xiaomi dehumidifiers, Dyson purifiers, Broadlink RF fans, motion + door sensors, air-quality sensors per room. Rooms include storage room, helper's room; Subang has a main living room and a side living room; some toilets are ensuite, some dedicated; bathrooms have controllable lighting. Actual entity inventories are **UNCONFIRMED** (instances unreachable during design); the architecture treats rooms/entities as discovered data, so validation happens at implementation time via Nabu Casa or the Cloudflare-Access tunnels.

Calendar/tasks source: Google Calendar + Google Tasks. Weather: HA-configured provider per home (incl. rain probability + UV index).

### Users and devices

- **Mobile (personal companion):** the user and family members via HA companion apps, each with their own account. Personal greeting allowed.
- **iPad (shared room console):** tabletop stands (Nest-Hub style), always-on, shared by family and guests. Logs in as a dedicated non-admin kiosk user. Room/home-level header — never a personal greeting. Idles to a clock face (clock + weather + AQI); tap to wake. Large touch targets (≥56px).
- **Desktop/laptop:** power admin — full content plus Admin page, dense grid, hover states.

## 3. Decisions log

| # | Decision | Choice |
|---|---|---|
| 1 | Entity discovery | Assume + mark UNCONFIRMED; validate later against live instances |
| 2 | Multi-home model | One shared design system + per-home configuration |
| 3 | Variant roles | Mobile personal / iPad shared kiosk / desktop admin |
| 4 | Shared-device permissions | Three RBAC tiers; iPads on restricted guest account |
| 5 | Visual direction | "Quiet Luxe" — warm A+C hybrid, Champagne & Ivory pairing |
| 6 | Typography | Marcellus (display moment) + Outfit; no weight above 500 |
| 7 | Navigation | Hybrid: Home + room drill-ins + domain pages |
| 8 | Implementation | Custom card library + dashboard strategy (TS/Lit), community cards where best-in-class |
| 9 | iPad room layout | 2-per-row grid, vertical swipe within zone |
| 10 | Mobile section order | Rooms → Climate → Music (collapsible) → Schedule |
| 11 | Backgrounds | Subtle radial gradients, never flat |
| 12 | Photo-card text | Top + bottom gradient scrims baked into room-card component |
| 13 | Figma method | Library-first; screens are instances only |
| 14 | Design workflow | frontend-design skill for all frontend design work |

## 4. Design system — "Quiet Luxe"

### Color

| Token | Light | Dark |
|---|---|---|
| Background (radial center → edge) | warm luminous ivory → `#F4F0E8` | faint warm glow → `#161310` |
| Card surface | `#FDFBF6` + soft warm shadow | `rgba(255,250,240,.055)` + 1px `rgba(237,230,216,.10)` border + blur (glass) |
| Ink | `#2B2620` | `#EDE6D8` |
| Muted | `#8C8578` | `#8A8172` |
| Accent (champagne-bronze) | `#B08D57` | `#C9A86A` |
| Status good/on | sage `#7E8B6F` | `#93A183` |
| Status warning | clay `#C08552` | lightened clay |
| Status alert | brick `#A85B4E` | lightened brick |

Rules: no saturated colors anywhere (charts, badges, toggles included). Warm amber glow (`radial #ffd98a → #c98f3e` + soft shadow) is reserved exclusively for lights that are on.

### Typography

- **Marcellus** — home and room names only (the single serif moment).
- **Outfit** — everything else: 300 for large numerals (temperature, kW, AQI), 400 body, 500 maximum weight. No bold.
- Card eyebrows: letterspaced uppercase micro-labels (~0.14em tracking).
- CJK pairings: zh-Hant → Noto Serif TC (light) + Noto Sans TC; zh-Hans → Noto Serif SC + Noto Sans SC. ms/id use the Latin set. Same weight rules in all scripts.

### Imagery

Three sanctioned types: (1) room photos (Unsplash-sourced placeholders acceptable; per-home overrides in `/config/www/quiet-luxe/rooms/`) with **top and bottom gradient scrims** for text legibility on any photo; (2) product cutouts on plain card surfaces (Sonos, Dyson, TVs, dehumidifiers, fans, vacuum, cars) bundled in the package as a curated set; (3) ambient glow effects for active states. No clip art, no decorative gradients.

### Shape, depth, motion

16–20px radii, generous padding. Light mode: soft warm shadows. Dark mode: glass borders. Transitions 200ms ease; glow fade-ins on state change; nothing bouncy. Idle-face dimming on iPad mitigates burn-in.

## 5. Structure and navigation

Pages (feature-flagged per home, RBAC-gated per user):

```
Home          all users
Room views    drill-in per room; sections render only what the room has
Media         all homes; Sonos group builder where Sonos exists
Security      camera wall, doors, motion (toggles: admin/family only)
Energy        Subang only (Shelly 3EM)
All Climates  target of "All climates →"
Car           admin only; per-home car type
Admin         admin only, desktop + admin mobile; never on iPads
Language      full-page switcher, globe chip in header, all variants
```

Media and climate have no permanent nav slots beyond this: media also lives as a persistent collapsed bar; climate summary lives on Home and in rooms. Nav: HA sidebar (desktop/mobile) + slim bottom pill nav on iPad (Home · Media · Security · Energy).

## 6. Screen layouts

### Home — iPad console (landscape 1180px design frame, no scrolling)

- **Header:** home name (Marcellus) · date/time · weather (temp, rain %, UV, AQI) · named presence ("Steven & Mei home").
- **Left zone (~64%):** Rooms eyebrow → 2-per-row photo room-card grid, vertical swipe within the zone; each card: top scrim (name, temp · AQI), bottom scrim (device chips: lights/AC/curtain/TV — tappable inline). Below: Climate row ("active devices first" sort) of 3 compact climate cards + "All climates →".
- **Right rail (~36%):** scene chips → now-playing (album art, track, target speakers, transport) → cameras glance (2 thumbs + all-clear line) → energy strip (Subang) → next calendar event.
- Idle → clock face. Guest RBAC. Bottom pill nav.

### Home — mobile (390px, portrait, single column)

Order: condensed header (time · weather · AQI) → personal greeting (Marcellus) + home + named presence → scene chips → **Rooms** (2-up photo grid, top 4 + "all rooms ↓") → **Climate** row (compact cards + "All climates →") → **Music** collapsed bar (mini art, track, play/pause, chevron ⌄ → full player: large art, transport, volume, speaker picker) → **Schedule** card (segmented Agenda/Day/Week/Month; Google Calendar events with bronze timeline edge; Google Tasks with due highlights) → glance row (energy ⚡, car 🚘).

### Home — desktop (1680px)

Multi-column mission control: everything from iPad at higher density plus admin layer entry, full energy chart, camera wall shortcut, car detail. Hover states active.

### Room drill-in

Room header (name, temp/humidity/AQI micro-stats) then sections in fixed priority, rendering only what exists: Lights (per-light cards + room scenes) → Climate → Covers (position control) → Media → Air & sensors (AQI detail; motion state + detection toggle for admin/family) → Switches (Z2M, Broadlink RF fans). Bathrooms typically render Lights + Exhaust + Humidity.

### Domain pages

- **Media:** now-playing hero; card per player; Sonos group builder (tap speaker chips to join/unjoin, per-speaker volume, "party mode" groups all); TV cards with source shortcuts + remote drill-in; offline portables greyed with last-seen.
- **Security:** camera wall (WebRTC via go2rtc preferred; snapshot-refresh fallback for Dahua-cloud), door rows with history, motion rows with per-sensor toggles (RBAC), away-glance strip.
- **Energy (Subang):** three per-phase rings (3EM), live power, today/week/month charts (apexcharts-card), tariff-based cost estimate, top consumers if per-device data exists.
- **All Climates:** whole-home averages up top; ACs, fans, dehumidifiers, purifiers, exhausts grouped by room; per-category "all off" (confirm-on-tap).
- **Car:** product cutout hero of actual model; battery/fuel + range, lock state, climate precondition, location snippet, service reminders. Li Auto integration availability must be researched; if none exists, Xiamen sets `car: none`.
- **Admin:** Node-RED flow toggles (UniFi port switches, pfSense port-forward/kill states) as labeled toggle rows with confirm-on-tap; instance health (HA version, pending updates, unavailable-entity count).
- **Language:** five large language cards (en / 繁中 / 简中 / BM / ID), kiosk-friendly; iPad reverts to home default language after idle.

## 7. Component library (Figma page 01; 1:1 with implemented cards)

**Foundations:** color variables (light+dark collections), type styles (Latin/TC/SC), spacing/radius/effect tokens, icon set, radial background specs, scrim recipes, imagery rules.

**Structure:** home header (3 breakpoint variants), room header, nav pills / bottom bar, section eyebrow + "All X →" link, iPad idle clock face, language card.

**Cards:** room card (S/M/L), climate card (variants: AC / purifier / dehumidifier / fan / exhaust), light card (brightness + glow), cover card (curtain/shade), media card (collapsed bar / full player / grouping row), camera card (glance/full), sensor tile (AQI/temp/humidity/UV/rain), energy cards (live strip / per-phase ring / history chart), schedule card (agenda/day/week/month states), tasks card, car card, vacuum card (docked/cleaning/returning, battery, room-clean shortcuts), presence row, door/motion row, network-flow toggle row, device cutout card.

**Primitives:** device chip (on/off), scene chip, toggle, slider, segmented control, status dot/badge.

Every component ships variants for mode (light/dark) and, where relevant, size, state, and breakpoint. Screens on Figma pages 02–05 are instances only.

## 8. Architecture (Approach B)

**Package:** one HACS-installable repo — theme + custom Lit/TypeScript cards + dashboard **strategy** in a single JS bundle. Per-instance setup: install via HACS, add theme, create one dashboard with `strategy: custom:quiet-luxe` + per-home config. Updates roll out via HACS to all homes.

**Convention over configuration:** the strategy reads HA area/device/entity registries at load: areas = rooms (floors supported), entities bucketed per area by domain and device-class. HA labels refine: `ql-favorite`, `ql-hidden`, `ql-primary-camera`.

**Per-home config:** home name, feature flags (energy, `car: bmw|audi|liauto|none`, vacuum, media-rich), room display order, camera engine (`webrtc|snapshot`), energy tariff, default/kiosk language, RBAC tier membership.

**Community cards where best-in-class:** apexcharts-card (charts), kiosk-mode (iPad chrome), go2rtc/WebRTC card (camera streams). Everything user-visible otherwise is ours.

**Graceful degradation (rule):** missing integration → section never renders; unavailable entity → muted offline state, never an error box. Failures in the strategy log loudly to console; a malformed config renders a single diagnostic card (admin-visible only) rather than a broken dashboard.

## 9. RBAC

Tiers: **admin** (the user) / **family** / **guest** (iPads via dedicated non-admin `kiosk` HA user). Enforced twice:

1. **Generation:** the strategy omits restricted views/cards per tier (Admin, Car, motion toggles, camera settings).
2. **HA-side:** restricted actions are scripts/switches whose automations verify the calling user; the kiosk account is non-admin and lacks access to admin entities — UI hiding is not the security boundary.

Confirm-on-tap for consequential actions (kill states, port toggles, category "all off") at every tier.

## 10. Internationalization

Locales: `en`, `zh-Hant`, `zh-Hans`, `ms`, `id`. All card strings from per-component translation files — no hardcoded text. Language resolution: HA user profile language → per-home kiosk default (config) → `en`. Language page + header globe chip switch session language; iPad reverts to home default after idle. Dates/times per locale and per-home timezone. Type pairings per §4.

## 11. Figma organization & pipeline

Pages: **00 Foundations** · **01 Components** (only place anything is drawn) · **02 Mobile / 03 iPad / 04 Desktop** (frames at 390/1180/1680: Home, room drill-ins ×3 examples, Media, Security, Energy, All Climates, Car, Admin, idle face, Language — light + dark each) · **05 Reference homes** (Home populated as Subang/TC/Xiamen to prove config-driven variation).

Figma variables/tokens export to CSS custom properties in the theme so design and code tokens stay 1:1. Implementation order: theme → primitives → cards → strategy → per-home configs → live-instance validation. Design QA: screenshot comparison of rendered cards vs Figma frames per breakpoint per mode. All design work uses the frontend-design skill.

## 12. Error handling & testing

- Strategy: registry-read failures → diagnostic card (admin) + console error; never a white screen.
- Cards: entity-missing and entity-unavailable states designed into every component (muted, labeled).
- Unit tests: strategy bucketing logic (registry fixtures per reference home), config parsing/validation, i18n key completeness (CI check: all five files cover all keys).
- Visual: per-card Storybook-style harness with mocked hass objects for all variants/states/locales; screenshot diffs against Figma exports.
- Integration: load the built bundle in a dev HA container with three synthetic per-home fixtures (Subang-like, TC-like, Xiamen-like) before touching real instances.

## 13. Assumptions & UNCONFIRMED

- Entity inventories, exact room lists, and area hygiene per instance — UNCONFIRMED until instances reachable; strategy design makes this safe.
- Li Auto L7 HA integration availability — research task; fallback `car: none`.
- Dahua 大华云联 camera access path (official/Imou/go2rtc restream) — research task; snapshot fallback designed.
- HA versions on the three instances support sections view + current strategy APIs — verify before implementation.
- Google Calendar/Tasks integrations authorized on each instance.

## 14. Out of scope (deferred)

- Automations/Node-RED flow authoring (we only surface existing flows).
- Voice assistants, wall-mounted hardware installation, HA OS administration.
- Per-user favorite customization UI (favorites via `ql-favorite` labels for now).
- Home-page "further optimization" round the user flagged — revisit after v1 renders on real hardware.
- Languages beyond the five listed.
