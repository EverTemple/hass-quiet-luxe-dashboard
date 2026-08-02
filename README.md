# Quiet Luxe

Warm, quiet, image-rich Home Assistant dashboard system: theme + custom card
library + dashboard strategy in one package. Runs the same bundle on all
homes from a small per-home config.

Design source of truth: Figma file `vaDrJjhYuziE1lVvNvJqwP`.

## Install (per instance)

The bundle is self-sufficient: it carries its own Latin webfonts and its own
`--ql-*` design tokens, so it renders correctly with **no files copied into
`/config` and no theme installed**. Everything under "Optional enhancements"
below is a refinement, not a requirement.

### HACS (recommended)

1. HACS → ⋮ (top right) → **Custom repositories** → Repository
   `https://github.com/EverTemple/hass-quiet-luxe-dashboard`, type
   **Dashboard** → Add.
2. Search for **Quiet Luxe** in HACS and install it. HACS places the bundle
   at `/config/www/community/hass-quiet-luxe-dashboard/quiet-luxe.js` and
   auto-registers the dashboard resource
   (`/hacsfiles/hass-quiet-luxe-dashboard/quiet-luxe.js`) — no manual
   resource step needed on storage-mode dashboards.
3. Create a dashboard (Settings → Dashboards → Add, url path `quiet-luxe`),
   open its raw configuration editor, and paste your per-home strategy config
   (see "Dashboard strategy" below).

That is the whole install. Marcellus and Outfit are embedded in the bundle,
Chinese text uses the CJK fonts already on your devices, and the cards define
their own light and dark palettes.

### Manual (alternative)

1. Download `quiet-luxe.zip` from the latest GitHub release
   (`gh release download -p quiet-luxe.zip` or the Releases page).
2. Extract it into `/config/www/quiet-luxe/` on the instance so that
   `/config/www/quiet-luxe/quiet-luxe.js` exists.
3. Register the resource: Settings → Dashboards → ⋮ (top right) →
   Resources → Add resource → URL `/local/quiet-luxe/quiet-luxe.js`, type
   **JavaScript module**.
4. Continue with the dashboard step (3) above. Extracting the zip also places
   `fonts/` next to the bundle, which the optional CJK webfont upgrade below
   picks up automatically.

No external font CDN is contacted at runtime, in any install mode.

## Using the cards

**Tap a card's name or its reading** to open everything that device can be
told. For most cards that is Home Assistant's own more-info dialog. Climate
devices instead open the Quiet Luxe control sheet — one surface carrying the
dial, the modes, fan, swing, humidity and presets — and that sheet has a **Show
details** button that hands you on to more-info. Either way the settings,
history and related entities the cards leave out are always one tap away.

**The controls on the card are the everyday ones.** Each card reads what its
entity actually reports and draws only what that device supports, so no two
devices get the same control set:

| Device | On the card |
| --- | --- |
| Air conditioner, heater (`climate`) | Dial with − / + either side, mode and fan-speed rows, preset |
| Dehumidifier, humidifier (`humidifier`) | Target humidity, mode |
| Fan, purifier (`fan`) | Speed, preset, oscillation, airflow direction, rotation; air quality per pollutant, coloured by band |
| Curtain, blind (`cover`) | Position, open/stop/close, and tilt where fitted |
| Light | On/off, brightness |

A control a device does not support is simply absent — never shown greyed out
or broken. Setpoints stay adjustable while a device is off, and a change you
make shows immediately in champagne until the device confirms it.

Explicit controls keep their own gestures: the power button, the sliders and
the toggles never open a dialog, and tapping the name never changes anything.

## Optional enhancements

Both are genuinely optional — skipping them leaves a correct dashboard.

### Optional: the `quiet-luxe` theme (recommended)

The cards style themselves. The theme exists to extend the same palette to
**Home Assistant's own chrome** — sidebar, toolbars, dialogs, the more-info
panel — so the surrounding frontend matches the dashboard.

Copy `themes/quiet-luxe.yaml` into your `config/themes/` directory (ensure
`frontend: themes: !include_dir_merge_named themes` in `configuration.yaml`),
reload themes, then select **quiet-luxe** in your user profile (or set it
instance-wide via the `frontend.set_theme` service: `{"name": "quiet-luxe"}`).
Light/dark follows HA's mode.

Without it, the cards still render in Quiet Luxe colours; only HA's chrome
keeps whatever theme is active.

### Optional: bundled CJK webfonts

Chinese text uses the high-quality CJK fonts that ship with macOS, iOS,
Windows, Android and Linux (PingFang, Microsoft JhengHei/YaHei, Noto CJK). The
full Noto Sans/Serif TC+SC webfonts are tens of megabytes, so they are **not**
embedded in the bundle. To pin Chinese rendering to Noto instead of the local
system font, download `quiet-luxe.zip` from the latest release and copy its
`fonts/` folder to `/config/www/quiet-luxe/fonts/` so that
`/config/www/quiet-luxe/fonts/fonts.css` exists.

The bundle probes for that stylesheet and uses it when present. When it is
absent the request simply 404s and is ignored — nothing breaks, and the
Latin typography is unaffected either way.

## Development

- `npm install` then `npm run test` / `npm run lint` / `npm run typecheck`
- `npm run build` → `dist/quiet-luxe.js` + `dist/fonts/`
- `dist/` is never committed; releases attach `quiet-luxe.js` (installed by
  HACS via `hacs.json` `filename`) and `quiet-luxe.zip` (bundle + woff2
  fonts, used for the manual install and the optional CJK webfont upgrade).
- The Latin faces are inlined into `quiet-luxe.js` at build time by
  `scripts/inline-fonts-plugin.ts`, which reads the installed `@fontsource`
  packages and fails the build if a weight or subset goes missing. `dist/fonts/`
  (27 MB, built separately by `scripts/build-fonts.mjs`) serves the optional
  upgrade: the large CJK families, the same Latin faces as woff2 files, and a
  `fonts.css` that `@import`s all of them.

## Repository docs

- Design spec: `docs/superpowers/specs/2026-08-01-ha-dashboard-redesign-design.md`
- Plans: `docs/superpowers/plans/`

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
      master_bedroom: { aliases: ["Master Room"] }  # extra names to strip from labels
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
sections). Create those in Settings → Areas & Labels; HA slugifies the name you
type into the id it stores (`ql-hidden` → `ql_hidden`), and the strategy
resolves through the label registry, so either spelling — and later renames —
keep working. Room photos resolve override → area picture →
`<photo_base>/<area_id>.jpg` when the home sets `photo_base`. With none of
those, the room card draws its own warm fallback instead of pointing at a file
that may not exist.

Labels never repeat the room a card already names. Chips on a room card read as
device types (Lights, Aircon, Curtain, TV) and only fall back to entity names
when two chips would share a type; cards inside a room view drop the room name
from their own names. The room name, the HA area aliases and `rooms.<area_id>.
aliases` are all stripped, so a room whose devices are named after some other
name for it (area `Master Bedroom`, entities `Master Room …`) is fixed by
listing that name in `aliases`.

Missing integrations never render, and a flag is not evidence an integration is
installed: `car: audi` with entity ids nothing provides produces no Car card,
an `energy:` block whose meter is absent produces no Energy section or view,
no calendar entities leaves the Schedule section to the tasks card alone, and
media players and cameras that read `unavailable` at generation are dropped
(a section with nothing left is omitted). Entities that exist but are offline
still render, muted. apexcharts-card and the WebRTC camera card are used only
when installed.

RBAC tiers: `admin` (HA admins) / `family` / `guest` (default for unknown
users; use it for the shared iPad kiosk account). Family and guests never see
the Admin or Car views; guests additionally lose the personal greeting and
motion-detection toggles. **This UI-level omission is convenience, not
security** — keep the kiosk account non-admin and gate consequential actions
HA-side (Plan 5).

A malformed `home:` block renders a single diagnostic card (error detail for
admins only) and logs `[quiet-luxe]` errors to the browser console.
