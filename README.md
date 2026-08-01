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
