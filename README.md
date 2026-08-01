# Quiet Luxe

Warm, quiet, image-rich Home Assistant dashboard system: theme + custom card
library + dashboard strategy in one HACS package. Runs the same bundle on all
homes from a small per-home config.

Design source of truth: Figma file `vaDrJjhYuziE1lVvNvJqwP`.

## Install (per instance)

1. HACS → Custom repositories → add this repo as type **Dashboard**.
2. Install **Quiet Luxe**. HACS downloads the release asset `quiet-luxe.zip`
   and extracts it (bundle + fonts) to `www/community/quiet-luxe/`. Check
   Settings → Dashboards → ⋮ → Resources contains
   `/hacsfiles/quiet-luxe/quiet-luxe.js` (JavaScript module); add it manually
   if HACS did not register it.
3. Copy `themes/quiet-luxe.yaml` into your `config/themes/` directory (ensure
   `frontend: themes: !include_dir_merge_named themes` in `configuration.yaml`),
   then select the **quiet-luxe** theme in your user profile. Light/dark follow
   HA's mode.
4. Create a dashboard (Settings → Dashboards → Add, url path `quiet-luxe`),
   open its raw configuration editor, and paste your per-home strategy config
   (see "Dashboard strategy" below).

Fonts (Marcellus, Outfit, Noto Sans/Serif TC+SC) are bundled and served from
your HA instance — no external font CDN is contacted at runtime.

## Development

- `npm install` then `npm run test` / `npm run lint` / `npm run typecheck`
- `npm run build` → `dist/quiet-luxe.js` + `dist/fonts/`
- `dist/` is never committed; releases attach `quiet-luxe.zip` (bundle +
  woff2 fonts) as a GitHub release asset which HACS installs (`zip_release`).

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
