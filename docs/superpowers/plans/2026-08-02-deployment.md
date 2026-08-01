# Deployment + Live Validation Implementation Plan (Plan 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the Quiet Luxe package to GitHub/HACS and deploy + validate it live on the three real HA instances (Subang Jaya, Tung Chung, Xiamen), resolving every UNCONFIRMED item from the design spec with real data.

**Architecture:** Phase A is repo/release work that needs no instance (GitHub repo, dist-size fix via `zip_release`, first tagged release, HACS validation). Phase B repeats a per-instance sequence three times with per-home specifics (reachability → version check → HACS installs → theme → registry audit → dashboard → RBAC users → device checks → cameras). Phase C is cross-home validation, research tasks (Li Auto, version floor), and documentation/memory updates. This is an **operational** plan: "tests" are verification checklists with exact commands and expected outputs.

**Tech Stack:** gh CLI, curl against the HA REST API (`/api/`, `/api/config`, `/api/states`, `/api/template`, `/api/services/...`), Node 22 (audit script), HACS UI, HA UI. No new runtime dependencies.

---

## Conventions for every task in this plan

**Secrets.** Credentials and tokens NEVER enter the repo, the plan, terminal echo, or logs. Per-instance secrets live in `.ai/secrets/<home>.env` (`.ai/` is already in `.gitignore` — Task A1 verifies). The user types tokens themselves via interactive `!` commands with `read -s`.

**Interactive user steps.** Steps marked **USER:** can only be performed by the user (browser logins, HA admin UI, physical devices, credentials). Prompt the user, wait, then run the verification command yourself. Interactive shell commands are prefixed `!` so the user runs them in their own terminal.

**Instance access.** Preferred URL per instance is the Nabu Casa remote URL (`https://<id>.ui.nabu.casa`) — it bypasses Cloudflare Access. If the user supplies a Cloudflare-Access hostname instead, the user must also create a CF Access **service token** and add two extra lines to the same env file (`CF_ACCESS_CLIENT_ID=...`, `CF_ACCESS_CLIENT_SECRET=...`); then append `-H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET"` to every curl in that home's tasks.

**Reachability gate.** Every instance-touching task begins with the reachability check for its home. If it fails, STOP that home's remaining tasks, log the failure (below), and continue with other homes / Phase A-C work that doesn't need the instance.

**STOP-and-report protocol.** On any STOP criterion: append an entry to `docs/deployment/deployment-log.md` (`## YYYY-MM-DD — <task id>` + symptom + exact command output/evidence + what is blocked), report it to the user in the session, and do not execute steps that depend on the stopped step. Create the file on first use with heading `# Deployment log`.

**Security boundary reminder (spec §9).** UI-level RBAC omission is convenience. The actual boundary is: kiosk/family HA accounts are **non-admin**, and consequential actions are guarded HA-side (Task B-SJ-7 pattern). Never mark an RBAC task done on UI hiding alone.

---

## Phase A — Repo, release, and package hygiene (no instance required)

### Task A1: Preflight and secrets scaffolding

**Files:**
- Inspect: `.gitignore`, `package.json`

- [ ] **Step 1: Verify clean tree on main at the expected commit**

Run: `git -C /Users/evertemple/Documents/Projects/home_assistant_dashboard_redesign status --porcelain && git log --oneline -1`
Expected: no porcelain output; latest commit is the Plan 5 plan commit (or `e91ac1e` if the plan commit is not yet made).
STOP: dirty tree → report; do not stash or discard anything without the user.

- [ ] **Step 2: Verify `.ai/` is gitignored and create the secrets dir**

```bash
cd /Users/evertemple/Documents/Projects/home_assistant_dashboard_redesign
mkdir -p .ai/secrets && chmod 700 .ai/secrets
git check-ignore .ai/secrets && echo IGNORED
```

Expected: prints `.ai/secrets` then `IGNORED`.
STOP: not ignored → add `.ai/` to `.gitignore` first and commit `chore: ignore .ai scratch dir` before any secret is written.

- [ ] **Step 3: Verify gh CLI is installed and authenticated**

Run: `gh --version && gh auth status`
Expected: version line; `Logged in to github.com` for the user's account.
**USER:** if not logged in, the user runs `! gh auth login --web --git-protocol https` interactively.
STOP: gh missing → propose `brew install gh` to the user; do not install without approval.

- [ ] **Step 4: Verify the local build is green (the release workflow will run these)**

Run: `npm ci && npm run lint && npm run typecheck && npm run test && npm run build`
Expected: all pass; `dist/quiet-luxe.js` and `dist/fonts/fonts.css` exist.
STOP: any failure → fix is out of Plan 5 scope; report which gate failed.

### Task A2: Create the GitHub repository and push

**Files:** none changed (remote operation).

**DONE 2026-08-02.** Outcome differs from the plan below: the user chose a **private** repo, created as `EverTemple/hass-quiet-luxe-dashboard` with `main` pushed. HACS cannot use private custom repositories (verified against the hacs.xyz FAQ, 2026-08-02), so the manual-copy fallback in Step 1 was explicitly chosen: download the release `quiet-luxe.zip` → extract to `/config/www/quiet-luxe/` per instance → register the Lovelace resource `/local/quiet-luxe/quiet-luxe.js` (JavaScript module). Phase B package-install tasks below are amended accordingly; kiosk-mode and apexcharts-card (public community repos) still install via HACS. Topics (old Step 3) skipped — they existed only for HACS validation.

- [x] **Step 1: USER decision — repo name and public visibility** — decided: **private**, name `hass-quiet-luxe-dashboard`; manual install path explicitly chosen (see DONE note above).

HACS does **not** support private custom repositories, so the repo must be **public**. Confirm with the user: repo name `quiet-luxe` (recommended — it becomes the `/hacsfiles/quiet-luxe/` install path), public. If the user refuses public visibility: STOP — HACS install path is unavailable; the fallback (manual copy of release zips to each instance's `www/`) must be explicitly chosen by the user before continuing.

- [x] **Step 2: Create the repo and push main** — done: `✓ Created repository EverTemple/hass-quiet-luxe-dashboard` (private), `main` pushed, `origin` set.

- [x] **Step 3: Add repo topics (HACS validation checks these)** — skipped as n/a: HACS is not used with a private repo.

- [x] **Step 4: Verify the remote matches local**

Run: `git ls-remote origin main | awk '{print $1}' && git rev-parse main`
Expected: the two SHAs are identical.

### Task A3: Dist-size mitigation — decision + implementation

**Files:**
- Modify: `.github/workflows/release.yml`
- Modify: `hacs.json`
- Modify: `scripts/build-fonts.mjs:34-36`
- Modify: `README.md:9-28`

**Decision record (evaluate then implement — this is the analysis, keep it in the commit body):**

1. *Keep committing `dist/` per release* — 60 MB per release commit balloons the repo permanently, **and it doesn't even work**: HACS "Dashboard" installs with `filename: quiet-luxe.js` download only that single file, so `dist/fonts/` (the entire China-safe bundled-font mechanism, spec §2) never reaches any instance. Rejected.
2. *GitHub release zip asset + `zip_release: true`* — HACS downloads the zip attached to the release and extracts all of it (JS + fonts) into `www/community/<repo>/`. Zero dist commits; repo stays small; fonts actually ship. **Chosen.**
3. *Font slimming* — `dist/fonts` is 33 MB legacy `.woff` + 26 MB `.woff2`. Every browser HA supports handles `.woff2` (@fontsource CSS lists woff2 first; browsers never fetch the woff fallback). Dropping `.woff` halves the artifact with zero user-visible change. **Chosen as complement.** Deeper unicode-subsetting of the Noto CJK families is NOT done now: @fontsource already ships unicode-range slices so browsers only download the slices a page uses — further build-time subsetting risks missing glyphs in user-entered room names. Deferred.

Result: no dist in git history; release asset `quiet-luxe.zip` ≈ 26 MB; per-page font transfer stays small (unicode-range slices).

- [ ] **Step 1: Restrict font copying to `.woff2`**

In `scripts/build-fonts.mjs`, change the slice filter (currently lines 34-36):

```js
    const sliceFiles = readdirSync(join(srcDir, 'files')).filter(
      (f) => f.includes(`-${weight}-normal`) && f.endsWith('.woff2'),
    );
```

- [ ] **Step 2: Rebuild and verify the size drop**

Run: `npm run build && du -sh dist && find dist -name '*.woff' | wc -l`
Expected: `dist` ≈ 27M (was 60M); woff count `0`.
STOP: build-fonts throws "no font files for" → the filter removed a weight that only ships woff; report (do not silently relax the filter).

- [ ] **Step 3: Switch `hacs.json` to zip_release**

Replace the full contents of `hacs.json` with:

```json
{
  "name": "Quiet Luxe",
  "filename": "quiet-luxe.zip",
  "zip_release": true,
  "render_readme": true,
  "homeassistant": "2025.6.0"
}
```

(The `homeassistant` floor stays until Task C2 replaces it with the verified value.)

- [ ] **Step 4: Rewrite the release workflow — zip asset, no dist commit**

Replace the full contents of `.github/workflows/release.yml` with:

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
      - name: Package release zip
        run: cd dist && zip -r quiet-luxe.zip quiet-luxe.js fonts
      - name: Tag
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git tag "v${{ inputs.version }}"
          git push origin "v${{ inputs.version }}"
      - name: Create GitHub release
        env:
          GH_TOKEN: ${{ github.token }}
        run: >
          gh release create "v${{ inputs.version }}"
          --title "v${{ inputs.version }}" --generate-notes
          dist/quiet-luxe.zip
```

- [ ] **Step 5: Verify the zip locally (same commands the workflow runs)**

```bash
cd /Users/evertemple/Documents/Projects/home_assistant_dashboard_redesign/dist
zip -r quiet-luxe.zip quiet-luxe.js fonts
unzip -l quiet-luxe.zip | head -6 && du -h quiet-luxe.zip
rm quiet-luxe.zip
```

Expected: listing shows `quiet-luxe.js` and `fonts/fonts.css` at archive root (NOT nested under `dist/`); size ≈ 26M.
STOP: paths nested under `dist/` → the `cd dist` in the workflow step is wrong; fix before releasing.

- [ ] **Step 6: Update README install docs to match zip_release**

In `README.md`, replace install step 2 (line 12) with:

```markdown
2. Install **Quiet Luxe**. HACS downloads the release asset `quiet-luxe.zip`
   and extracts it (bundle + fonts) to `www/community/quiet-luxe/`. Check
   Settings → Dashboards → ⋮ → Resources contains
   `/hacsfiles/quiet-luxe/quiet-luxe.js` (JavaScript module); add it manually
   if HACS did not register it.
```

And replace the Development bullet `dist/ is committed only by the release workflow.` (line 28) with:

```markdown
- `dist/` is never committed; releases attach `quiet-luxe.zip` (bundle +
  woff2 fonts) as a GitHub release asset which HACS installs (`zip_release`).
```

- [ ] **Step 7: Commit and push**

```bash
git add scripts/build-fonts.mjs hacs.json .github/workflows/release.yml README.md
git commit -m "build(infra): ship releases as zip asset with woff2-only fonts

- hacs.json zip_release: HACS installs quiet-luxe.zip (bundle + fonts);
  committed-dist would never have delivered dist/fonts via HACS
- release workflow attaches the zip to the GitHub release instead of
  committing 60 MB of dist per release
- build-fonts copies woff2 slices only (33 MB of legacy woff dropped;
  all HA-supported browsers use woff2)"
git push origin main
```

Expected: push succeeds; `git status --porcelain` empty.

### Task A4: HACS validation workflow

**SUPERSEDED 2026-08-02:** the repo is private (Task A2), HACS is unused, so `.github/workflows/validate.yml` was removed — the hacs/action run and its weekly cron only wasted minutes. Re-add this workflow only if the repo is ever made public and HACS install is re-adopted.

**Files:**
- Create: `.github/workflows/validate.yml`

- [ ] **Step 1: Create the workflow**

Write `.github/workflows/validate.yml`:

```yaml
name: Validate

on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: "0 4 * * 0"

jobs:
  hacs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hacs/action@main
        with:
          category: plugin
```

(HACS category for a "Dashboard" repo is `plugin`.)

- [ ] **Step 2: Commit and push**

```bash
git add .github/workflows/validate.yml
git commit -m "ci: add HACS repository validation workflow"
git push origin main
```

- [ ] **Step 3: Check the run — expected partial failure before first release**

Run: `gh run list --workflow Validate --limit 1` then `gh run view <run-id> --log-failed | tail -40`
Expected: the run may FAIL now with a releases-related check (no release exists yet). That is acceptable **only** for release checks; any `hacs.json`/topics/description failure must be fixed now.
STOP: failures other than missing-release → fix `hacs.json`/repo metadata, re-push, re-check.

### Task A5: First tagged release v0.1.0

- [ ] **Step 1: Confirm version**

Run: `node -p "require('./package.json').version"`
Expected: `0.1.0`.

- [ ] **Step 2: Dispatch the release workflow and watch it**

```bash
gh workflow run Release -f version=0.1.0
sleep 10 && gh run list --workflow Release --limit 1
gh run watch "$(gh run list --workflow Release --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
```

Expected: run completes with `✓`; exit code 0.
STOP: red run → `gh run view --log-failed`; fix, push, re-dispatch. Do not hand-create tags/releases.

- [ ] **Step 3: Verify the release and its asset**

```bash
gh release view v0.1.0 --json tagName,assets -q '{tag: .tagName, assets: [.assets[].name]}'
git fetch --tags && git tag -l v0.1.0
```

Expected: `{"tag":"v0.1.0","assets":["quiet-luxe.zip"]}`; local tag `v0.1.0` exists.

- [ ] **Step 4: Re-run Validate — must now be fully green**

```bash
gh workflow run Validate
sleep 10 && gh run watch "$(gh run list --workflow Validate --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
```

Expected: `✓` success. This is the "HACS custom-repository install docs verified" gate: hacs.json, zip_release, release asset, and repo metadata all pass HACS's own validator.
STOP: still failing → fix findings before any Phase B HACS install.

### Task A6: HA version-floor research (resolves half of the 2025.6.0 UNCONFIRMED)

**Files:**
- Create: `docs/deployment/version-floor.md`

- [ ] **Step 1: Research feature floors from primary sources (WebSearch/WebFetch)**

The bundle depends on these HA frontend/backend features. For each, find the HA release (release notes at `https://www.home-assistant.io/blog/` or developer docs at `https://developers.home-assistant.io/`) that shipped it, and record the version + source URL:

1. Custom dashboard strategies via `ll-strategy-dashboard-*` custom elements (`custom:quiet-luxe`). Search: `site:developers.home-assistant.io custom strategy ll-strategy-dashboard`.
2. Sections view type generally available (strategy emits sections views). Search: `home-assistant release notes sections view generally available`.
3. Built-in go2rtc / WebRTC camera streaming (Subang + Tung Chung `camera_engine: webrtc` without extra add-ons; expected 2024.11). Search: `home assistant 2024.11 go2rtc built-in WebRTC`.
4. `frontend.set_theme` service (used in Phase B theme tasks). Search: `home assistant frontend.set_theme service docs`.

- [ ] **Step 2: Write `docs/deployment/version-floor.md`**

Structure (fill every cell with the researched version + link; no cell may be left "TBD"):

```markdown
# HA version floor — evidence

| Feature we require | Min HA version | Source |
| --- | --- | --- |
| ll-strategy-dashboard-* custom strategies | <researched> | <url> |
| Sections view GA | <researched> | <url> |
| Built-in go2rtc WebRTC | <researched> | <url> |
| frontend.set_theme | <researched> | <url> |

Tentative floor = max of column 2: **<version>**.
Final floor decided in Task C2 = max(tentative floor) verified against the
three instances' actual versions (Tasks B-SJ-2 / B-TC-2 / B-XM-2).
`hacs.json` currently declares 2025.6.0 (UNCONFIRMED from Plan 1).
```

- [ ] **Step 3: Commit**

```bash
git add docs/deployment/version-floor.md
git commit -m "docs(deploy): record evidence-based HA version floor candidates"
git push origin main
```

### Task A7: Registry-audit script

**Files:**
- Create: `scripts/audit-registry.mjs`

- [ ] **Step 1: Write the script**

```js
// Dumps one HA instance's live area/entity registry to JSON via the REST API
// (template endpoint — no websocket dependency).
// Usage: HA_URL=https://... HA_TOKEN=... node scripts/audit-registry.mjs <out.json>
import { writeFileSync } from 'node:fs';

const url = process.env.HA_URL?.replace(/\/+$/, '');
const token = process.env.HA_TOKEN;
const outPath = process.argv[2];

if (!url || !token || !outPath) {
  console.error('usage: HA_URL=... HA_TOKEN=... node scripts/audit-registry.mjs <output.json>');
  process.exit(1);
}

const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function getJson(path) {
  const res = await fetch(`${url}${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} -> HTTP ${res.status}`);
  return res.json();
}

async function template(tpl) {
  const res = await fetch(`${url}/api/template`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ template: tpl }),
  });
  if (!res.ok) throw new Error(`template ${tpl} -> HTTP ${res.status}`);
  return JSON.parse(await res.text());
}

const config = await getJson('/api/config');
const states = await getJson('/api/states');
const areaIds = await template('{{ areas() | list | tojson }}');

const areas = {};
const assigned = new Set();
for (const id of areaIds) {
  const name = await template(`{{ area_name('${id}') | tojson }}`);
  const entities = await template(`{{ area_entities('${id}') | list | tojson }}`);
  for (const e of entities) assigned.add(e);
  areas[id] = { name, entities: entities.sort() };
}

const unassigned = states
  .map((s) => s.entity_id)
  .filter((e) => !assigned.has(e))
  .sort();

writeFileSync(
  outPath,
  `${JSON.stringify(
    {
      fetched_at: new Date().toISOString(),
      ha_version: config.version,
      location_name: config.location_name,
      areas,
      unassigned,
    },
    null,
    2,
  )}\n`,
);
console.log(
  `audit-registry: ${config.location_name} (HA ${config.version}) — ${areaIds.length} areas, ${states.length} states -> ${outPath}`,
);
```

- [ ] **Step 2: Verify it fails loudly without credentials**

Run: `node scripts/audit-registry.mjs`
Expected: prints the usage line to stderr, exit code 1 (`echo $?` → `1`).

- [ ] **Step 3: Commit**

```bash
git add scripts/audit-registry.mjs
git commit -m "feat(infra): add live registry audit script for deployment validation"
git push origin main
```

---

## Phase B — Per-instance deployment (×3)

Phase B is the same nine-step sequence per home with home-specific configs, camera engines, and languages. Homes are independent: if one is unreachable, continue with the others. Do the homes in order Subang Jaya → Tung Chung → Xiamen (Xiamen has the most research risk).

### Task B-SJ-1: Subang Jaya — access + reachability

- [ ] **Step 1: USER — create a long-lived token and store it locally**

The user: open the Subang Jaya HA (Nabu Casa URL) → user profile → Security → Long-lived access tokens → Create token (name `claude-deploy`). Then run interactively:

```bash
! zsh -c 'cd /Users/evertemple/Documents/Projects/home_assistant_dashboard_redesign && mkdir -p .ai/secrets && chmod 700 .ai/secrets && printf "HA_URL: " && read url && printf "HA_TOKEN: " && read -s tok && printf "HA_URL=%s\nHA_TOKEN=%s\n" "$url" "$tok" > .ai/secrets/subang.env && chmod 600 .ai/secrets/subang.env && echo && echo saved'
```

Expected: `saved`; `git status --porcelain` shows nothing (secrets ignored).

- [ ] **Step 2: Reachability check**

```bash
cd /Users/evertemple/Documents/Projects/home_assistant_dashboard_redesign
source .ai/secrets/subang.env
curl -sS -m 15 -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/"
```

Expected: `{"message":"API running."}`
STOP: timeout/connection error → instance offline; `401` → token invalid (redo Step 1). Log per protocol; skip all remaining B-SJ tasks until reachable.

### Task B-SJ-2: Subang Jaya — HA version + capability verification

- [ ] **Step 1: Reachability gate** — repeat Task B-SJ-1 Step 2; expect `{"message":"API running."}`.

- [ ] **Step 2: Read the HA version**

```bash
source .ai/secrets/subang.env
curl -sS -m 15 -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/config" | jq -r '.version, .location_name'
```

Expected: a version string (e.g. `2025.x.y`) and the location name. Record both in `docs/deployment/deployment-log.md` under `## Instance versions`.
STOP: version < the tentative floor from `docs/deployment/version-floor.md` → **USER** must upgrade HA on this instance before dashboard tasks; log and pause this home at Task B-SJ-4.

- [ ] **Step 3: Verify template/registry API capability (the strategy's data source)**

```bash
curl -sS -m 15 -X POST -H "Authorization: Bearer $HA_TOKEN" -H "Content-Type: application/json" \
  -d '{"template": "{{ areas() | count }}"}' "$HA_URL/api/template"
```

Expected: a number ≥ 1 (area registry populated).
STOP: `0` → no areas defined; **USER** must assign areas in Settings → Areas before Task B-SJ-5 is meaningful.

### Task B-SJ-3: Subang Jaya — package install (manual) + HACS community cards

*(Amended 2026-08-02: repo is private → Quiet Luxe installs manually from the release zip, not via HACS. kiosk-mode and apexcharts-card are public community repos and still install via HACS.)*

- [ ] **Step 1: Reachability gate** — repeat Task B-SJ-1 Step 2.

- [ ] **Step 2: USER — install the package manually from the release zip**

Download the release asset locally: `gh release download v0.1.0 -p quiet-luxe.zip` (repo `EverTemple/hass-quiet-luxe-dashboard`), unzip, and copy the contents to the instance path `/config/www/quiet-luxe/` (File editor add-on, Samba, or SSH) so `/config/www/quiet-luxe/quiet-luxe.js` and `/config/www/quiet-luxe/fonts/fonts.css` exist.
STOP: release or asset missing → re-check Task A5 release exists.

- [ ] **Step 3: USER — install the community cards for this home**

HACS default store → Download: **kiosk-mode** (shared iPad chrome) and **apexcharts-card** (Energy page charts — Subang is the only Shelly 3EM home). Reload the browser when HACS prompts.

- [ ] **Step 4: Verify installed files over HTTP**

```bash
source .ai/secrets/subang.env
for f in local/quiet-luxe/quiet-luxe.js local/quiet-luxe/fonts/fonts.css hacsfiles/kiosk-mode/kiosk-mode.js hacsfiles/apexcharts-card/apexcharts-card.js; do
  printf "%s " "$f"
  curl -sS -m 15 -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/$f"
done
```

Expected: `200` for all four lines (fonts line proves the zip layout + copy worked — this was impossible with committed-dist).
STOP: `404` on quiet-luxe fonts → zip layout or copy problem; inspect `/config/www/quiet-luxe/` contents with the user before continuing.

- [ ] **Step 5: USER — register the dashboard resource**

Settings → Dashboards → ⋮ → Resources: add `/local/quiet-luxe/quiet-luxe.js` as **JavaScript module** (manual installs are never auto-registered).

### Task B-SJ-4: Subang Jaya — theme install + set default

- [ ] **Step 1: Reachability gate** — repeat Task B-SJ-1 Step 2.

- [ ] **Step 2: USER — copy the theme file to the instance**

Copy repo file `themes/quiet-luxe.yaml` to the instance path `/config/themes/quiet-luxe.yaml` (File editor add-on, Samba, or SSH — whatever this instance has). Ensure `configuration.yaml` contains:

```yaml
frontend:
  themes: !include_dir_merge_named themes
```

- [ ] **Step 3: Reload themes via API**

```bash
source .ai/secrets/subang.env
curl -sS -m 15 -X POST -H "Authorization: Bearer $HA_TOKEN" -H "Content-Type: application/json" \
  -d '{}' "$HA_URL/api/services/frontend/reload_themes"
```

Expected: `[]` (HTTP 200).
STOP: HTTP 400/500 → theme YAML or include line invalid; fetch `curl -sS -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/error_log" | grep -i theme | tail -5` and report.

- [ ] **Step 4: Set quiet-luxe as the instance default theme**

```bash
curl -sS -m 15 -X POST -H "Authorization: Bearer $HA_TOKEN" -H "Content-Type: application/json" \
  -d '{"name": "quiet-luxe"}' "$HA_URL/api/services/frontend/set_theme"
```

Expected: `[]`. **USER** verifies: profile → Theme shows Backend-selected → quiet-luxe; light/dark follows device mode.

### Task B-SJ-5: Subang Jaya — registry audit + config reconciliation

**Files:**
- Create: `docs/deployment/registry/subang-jaya.json`
- Modify: `src/strategy/reference-homes.ts` (SUBANG_CONFIG entity ids/room ids as needed)
- Modify: `README.md` (strategy example, only if ids changed)

- [ ] **Step 1: Reachability gate** — repeat Task B-SJ-1 Step 2.

- [ ] **Step 2: Dump the live registry**

```bash
source .ai/secrets/subang.env
mkdir -p docs/deployment/registry
node scripts/audit-registry.mjs docs/deployment/registry/subang-jaya.json
```

Expected: `audit-registry: <name> (HA <version>) — N areas, M states -> docs/deployment/registry/subang-jaya.json` with N ≥ 5 (spec: main living, side living, bedrooms, storage, helper's room, toilets...).

- [ ] **Step 3: Check every entity id SUBANG_CONFIG assumes**

```bash
for e in sensor.shelly_3em_total_power sensor.shelly_3em_total_energy_today \
         sensor.shelly_3em_phase_a_power sensor.shelly_3em_phase_b_power sensor.shelly_3em_phase_c_power \
         sensor.bmw_battery sensor.bmw_range binary_sensor.bmw_lock device_tracker.bmw \
         switch.nr_guest_wifi switch.nr_plex_forward; do
  printf "%-45s " "$e"
  curl -sS -m 15 -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/states/$e"
done
```

Expected: `200` per line. For each `404`, find the real id by grepping the audit JSON (e.g. `jq -r '.areas[].entities[], .unassigned[]' docs/deployment/registry/subang-jaya.json | grep -i shelly`).

- [ ] **Step 4: Check calendar + room ids**

```bash
curl -sS -m 15 -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/states" | jq -r '[.[] | select(.entity_id | startswith("calendar.")) | .entity_id]'
jq -r '.areas | keys[]' docs/deployment/registry/subang-jaya.json
```

Expected: at least one `calendar.*` entity (Google Calendar authorized — spec §13 assumption); area ids include real equivalents of `main_living`, `side_living`, `master_bedroom`.
STOP (calendar empty): **USER** must authorize the Google Calendar + Tasks integrations on this instance (Settings → Devices & services → Add integration → Google Calendar, browser OAuth) — pause Task B-SJ-6 schedule verification until done; everything else proceeds.

- [ ] **Step 5: Update `SUBANG_CONFIG` in `src/strategy/reference-homes.ts` with the real ids**

Replace every id that returned 404 (and `room_order` area ids that don't exist) with the real ids found in the audit JSON. Also update the matching ids in the README strategy example if they changed. Then:

Run: `npm run test && npm run lint && npm run typecheck`
Expected: all pass (snapshot updates via `npx vitest run -u` are acceptable **only** for id-string changes — review the snapshot diff line-by-line).

- [ ] **Step 6: Commit**

```bash
git add docs/deployment/registry/subang-jaya.json src/strategy/reference-homes.ts README.md src/strategy/__snapshots__
git commit -m "feat(strategy): reconcile Subang Jaya config with live registry audit"
git push origin main
```

### Task B-SJ-6: Subang Jaya — dashboard creation

- [ ] **Step 1: Reachability gate** — repeat Task B-SJ-1 Step 2.

- [ ] **Step 2: USER — create the dashboard and paste the config**

Settings → Dashboards → + Add dashboard → New dashboard from scratch → Title `Quiet Luxe`, URL `quiet-luxe` → open it → pencil (edit) → ⋮ → Raw configuration editor → replace ALL content with the block below, **after substituting any entity/area ids Task B-SJ-5 corrected** (the block must match the committed `SUBANG_CONFIG`):

```yaml
strategy:
  type: custom:quiet-luxe
  home:
    name: Subang Jaya
    dashboard_path: quiet-luxe
    energy:
      power_entity: sensor.shelly_3em_total_power
      today_entity: sensor.shelly_3em_total_energy_today
      phase_entities:
        - sensor.shelly_3em_phase_a_power
        - sensor.shelly_3em_phase_b_power
        - sensor.shelly_3em_phase_c_power
      tariff: 0.516
    car: bmw
    car_entities:
      battery_entity: sensor.bmw_battery
      range_entity: sensor.bmw_range
      lock_entity: binary_sensor.bmw_lock
      location_entity: device_tracker.bmw
    calendar: google
    vacuum: false
    media_rich: true
    camera_engine: webrtc
    broadlink: true
    room_order: [main_living, side_living, master_bedroom]
    admin_flows:
      - entity: switch.nr_guest_wifi
        name: Guest Wi-Fi
        description: UniFi guest network
      - entity: switch.nr_plex_forward
        name: Plex port forward
        description: pfSense NAT rule
    kiosk: { language: en }
    users:
      guests: [kiosk]
kiosk_mode:
  user_settings:
    - users: ["kiosk"]
      hide_header: true
      hide_sidebar: true
```

Save.

- [ ] **Step 3: USER + verify — render check (desktop browser, admin account)**

Expected: Home view renders — header, Rooms grid with photos/scrims, Climate row, Media bar, Schedule card, glance row; sidebar shows Media/Security/Energy/All Climates/Car/Admin/Language views. **No diagnostic card.** Browser console has no `[quiet-luxe]` errors.
STOP: diagnostic card visible → it prints the config error (admin-visible per spec §12); fix the YAML, save, re-check. White screen or missing custom element → resource missing (redo Task B-SJ-3 Step 5); log per protocol.

- [ ] **Step 4: Optional USER — room photo overrides**

Copy per-room photos to instance path `/config/www/quiet-luxe/rooms/<area_id>.jpg`. Verify one:
`curl -sS -m 15 -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/local/quiet-luxe/rooms/main_living.jpg"` → `200`. (Skippable — bundled placeholders render otherwise.)

### Task B-SJ-7: Subang Jaya — RBAC users + HA-side enforcement

- [ ] **Step 1: Reachability gate** — repeat Task B-SJ-1 Step 2.

- [ ] **Step 2: USER — create the HA users**

Settings → People → Users tab:
1. Family members (e.g. `mei`): Administrator **off**.
2. `kiosk`: Administrator **off**; enable "Can only log in from the local network" if the iPads are LAN-only.
Add the family usernames to the dashboard config `users.family` list (raw editor) and to `SUBANG_CONFIG` if not present.

- [ ] **Step 3: Fetch the admin's user_id (needed by the guard automation)**

```bash
source .ai/secrets/subang.env
curl -sS -m 15 -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/states" | \
  jq -r '.[] | select(.entity_id | startswith("person.")) | "\(.entity_id) \(.attributes.user_id)"'
```

Expected: one line per person; note the admin's `user_id` (32-hex string).

- [ ] **Step 4: USER — install the guard automation (the actual security boundary)**

Add to the instance's automations (Settings → Automations → new → edit in YAML), substituting `ADMIN_USER_ID` with the id printed in Step 3:

```yaml
alias: "Quiet Luxe — revert admin flow toggles from non-admin users"
mode: queued
triggers:
  - trigger: state
    entity_id:
      - switch.nr_guest_wifi
      - switch.nr_plex_forward
conditions:
  - condition: template
    value_template: "{{ trigger.to_state.context.user_id is not none }}"
  - condition: template
    value_template: "{{ trigger.to_state.context.user_id != 'ADMIN_USER_ID' }}"
actions:
  - action: "switch.turn_{{ 'off' if trigger.to_state.state == 'on' else 'on' }}"
    target:
      entity_id: "{{ trigger.entity_id }}"
  - action: persistent_notification.create
    data:
      title: Blocked admin action
      message: "{{ trigger.entity_id }} was toggled by a non-admin user and reverted."
```

(Entity list = this home's `admin_flows`. Node-RED flows behind these switches should additionally ignore reverted toggles — flow authoring itself is out of scope, spec §14.)

- [ ] **Step 5: Verify enforcement as the kiosk user**

**USER:** log in as `kiosk` in a private browser window; from Developer Tools — expect Settings/Developer Tools to be absent entirely (non-admin). On the dashboard: no Admin view, no Car view, no personal greeting, no motion toggles. Then as a **family** user, toggle `switch.nr_guest_wifi` from the HA UI (Overview search): expect it to revert within seconds + a "Blocked admin action" notification.
STOP: toggle does not revert → guard automation broken; fix before calling RBAC done. UI hiding alone is NOT completion.

### Task B-SJ-8: Subang Jaya — per-device checks

**USER dependency: physical iPhone/Android, iPad on tabletop stand, desktop.** Record each line's pass/fail in `docs/deployment/deployment-log.md` under `## Subang Jaya device checks`.

- [ ] **Step 1: Mobile (admin account, companion app):** Home order = header → greeting (Marcellus) → scene chips → Rooms (2-up, top 4 + "all rooms") → Climate → collapsed Music bar (expands to full player) → Schedule (Google events + Tasks) → glance row with ⚡ energy and 🚘 car. Admin + Car pages reachable.
- [ ] **Step 2: Mobile (family account):** same minus Admin and Car; greeting shows that member's name.
- [ ] **Step 3: iPad (kiosk account, landscape):** no personal greeting (home-level header); 2-per-row room grid, vertical swipe; right rail (scenes → now-playing → cameras glance → energy strip → next event); bottom pill nav; kiosk-mode hides HA header/sidebar; idles to clock face (clock + weather + AQI), tap wakes; touch targets comfortably ≥56px.
- [ ] **Step 4: Desktop (admin):** dense multi-column layout, hover states, full energy chart, camera wall shortcut, Admin page.
- [ ] **Step 5: Language:** switch a test user's profile language to each of `zh-Hant`, `zh-Hans`, `ms`, `id`, back to `en` — all card strings translate (no raw keys), CJK renders in Noto faces, dates localize. Language page + header globe chip switch the session; kiosk iPad reverts to `en` (this home's kiosk default) after idle.
- [ ] **Step 6: Both modes:** light and dark render per theme (dark = glass cards, light = warm shadows); backgrounds are radial, never flat.

STOP: any broken layout/missing translation → log with screenshot; continue checks, then report the full list (fixes are follow-up work, not silent).

### Task B-SJ-9: Subang Jaya — camera engine (Dahua NVR → WebRTC)

- [ ] **Step 1: Reachability gate** — repeat Task B-SJ-1 Step 2.

- [ ] **Step 2: Confirm built-in go2rtc support**

From Task B-SJ-2 the HA version is known; per `docs/deployment/version-floor.md` confirm it ≥ the built-in-go2rtc version (expected 2024.11).
STOP: older → WebRTC needs the go2rtc add-on; **USER** decision to install add-on vs `camera_engine: snapshot`.

- [ ] **Step 3: USER — integrate the Dahua NVR**

Settings → Devices & services → Add integration → **ONVIF** → host = NVR LAN IP, port 80, NVR credentials (entered in the HA UI only — never stored here). Each NVR channel becomes a `camera.*` entity. If ONVIF discovery fails, fall back to **Generic Camera** per channel with stream URL `rtsp://<user>:<pass>@<nvr-ip>:554/cam/realmonitor?channel=<n>&subtype=1` (Dahua's standard RTSP path; HA validates the stream on submit).

- [ ] **Step 4: Verify camera entities + streams**

```bash
source .ai/secrets/subang.env
curl -sS -m 15 -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/states" | jq -r '[.[] | select(.entity_id | startswith("camera.")) | .entity_id]'
```

Expected: one entity per channel. **USER:** open the Security page — camera wall shows live WebRTC streams (sub-second to ~2s latency, not 10s+ HLS lag); iPad cameras-glance thumbnails update.
STOP: black tiles / errors → check NVR reachable from the HA host (`ping` from SSH add-on), RTSP port 554 open; log findings.

- [ ] **Step 5: USER — label the lead camera**

Settings → Devices & services → Entities → the main camera → add label `ql-primary-camera` (leads camera sections per README conventions).

### Task B-TC-1: Tung Chung — access + reachability

- [ ] **Step 1: USER — token + env file** — same interactive pattern as Subang but for the Tung Chung Nabu Casa URL, writing `.ai/secrets/tungchung.env`:

```bash
! zsh -c 'cd /Users/evertemple/Documents/Projects/home_assistant_dashboard_redesign && mkdir -p .ai/secrets && chmod 700 .ai/secrets && printf "HA_URL: " && read url && printf "HA_TOKEN: " && read -s tok && printf "HA_URL=%s\nHA_TOKEN=%s\n" "$url" "$tok" > .ai/secrets/tungchung.env && chmod 600 .ai/secrets/tungchung.env && echo && echo saved'
```

- [ ] **Step 2: Reachability check**

```bash
cd /Users/evertemple/Documents/Projects/home_assistant_dashboard_redesign
source .ai/secrets/tungchung.env
curl -sS -m 15 -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/"
```

Expected: `{"message":"API running."}`
STOP: unreachable/401 → log; skip remaining B-TC tasks until reachable.

### Task B-TC-2: Tung Chung — HA version + capability verification

- [ ] **Step 1: Reachability gate** — repeat Task B-TC-1 Step 2.
- [ ] **Step 2: Version:** `source .ai/secrets/tungchung.env && curl -sS -m 15 -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/config" | jq -r '.version, .location_name'` → record in the deployment log `## Instance versions`. STOP if below the tentative floor (USER upgrade required before B-TC-6).
- [ ] **Step 3: Areas:** `curl -sS -m 15 -X POST -H "Authorization: Bearer $HA_TOKEN" -H "Content-Type: application/json" -d '{"template": "{{ areas() | count }}"}' "$HA_URL/api/template"` → ≥ 1. STOP at 0: USER assigns areas first.

### Task B-TC-3: Tung Chung — package install (manual) + HACS community cards

*(Amended 2026-08-02: private repo → manual Quiet Luxe install; kiosk-mode still via HACS.)*

- [ ] **Step 1: Reachability gate** — repeat Task B-TC-1 Step 2.
- [ ] **Step 2: USER:** download `quiet-luxe.zip` from release v0.1.0 (`gh release download v0.1.0 -p quiet-luxe.zip`, repo `EverTemple/hass-quiet-luxe-dashboard`), unzip, copy contents to instance `/config/www/quiet-luxe/`.
- [ ] **Step 3: USER:** HACS default store → install **kiosk-mode**. (No apexcharts-card — no energy hardware here; spec §2.)
- [ ] **Step 4: Verify files:**

```bash
source .ai/secrets/tungchung.env
for f in local/quiet-luxe/quiet-luxe.js local/quiet-luxe/fonts/fonts.css hacsfiles/kiosk-mode/kiosk-mode.js; do
  printf "%s " "$f"
  curl -sS -m 15 -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/$f"
done
```

Expected: three `200`s. STOP on fonts 404 (zip layout or copy issue — inspect `/config/www/quiet-luxe/` with the user).
- [ ] **Step 5: USER:** Settings → Dashboards → ⋮ → Resources: add `/local/quiet-luxe/quiet-luxe.js` (JavaScript module) — manual installs are never auto-registered.

### Task B-TC-4: Tung Chung — theme install + set default

- [ ] **Step 1: Reachability gate** — repeat Task B-TC-1 Step 2.
- [ ] **Step 2: USER:** copy `themes/quiet-luxe.yaml` → instance `/config/themes/quiet-luxe.yaml`; ensure `configuration.yaml` has `frontend: themes: !include_dir_merge_named themes`.
- [ ] **Step 3: Reload:** `source .ai/secrets/tungchung.env && curl -sS -m 15 -X POST -H "Authorization: Bearer $HA_TOKEN" -H "Content-Type: application/json" -d '{}' "$HA_URL/api/services/frontend/reload_themes"` → `[]`. STOP on 400/500 (check `/api/error_log`).
- [ ] **Step 4: Default:** `curl -sS -m 15 -X POST -H "Authorization: Bearer $HA_TOKEN" -H "Content-Type: application/json" -d '{"name": "quiet-luxe"}' "$HA_URL/api/services/frontend/set_theme"` → `[]`; USER confirms Backend-selected theme in profile.

### Task B-TC-5: Tung Chung — registry audit + config reconciliation

**Files:**
- Create: `docs/deployment/registry/tung-chung.json`
- Modify: `src/strategy/reference-homes.ts` (TUNGCHUNG_CONFIG)

- [ ] **Step 1: Reachability gate** — repeat Task B-TC-1 Step 2.
- [ ] **Step 2: Dump:** `source .ai/secrets/tungchung.env && node scripts/audit-registry.mjs docs/deployment/registry/tung-chung.json` → summary line with N areas.
- [ ] **Step 3: Check assumed entity ids:**

```bash
for e in sensor.audi_battery sensor.audi_range switch.nr_cam_uplink; do
  printf "%-35s " "$e"
  curl -sS -m 15 -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/states/$e"
done
```

Expected: `200` each; for `404`s find real ids via `jq -r '.areas[].entities[], .unassigned[]' docs/deployment/registry/tung-chung.json | grep -i audi` (and `grep -i nr_`).
- [ ] **Step 4: Calendar check:** `curl -sS -m 15 -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/states" | jq -r '[.[] | select(.entity_id | startswith("calendar.")) | .entity_id]'` → ≥ 1 entity. STOP if empty: USER authorizes Google Calendar + Tasks; pause only the Schedule verification.
- [ ] **Step 5: Update `TUNGCHUNG_CONFIG`** in `src/strategy/reference-homes.ts` with corrected ids; `npm run test && npm run lint && npm run typecheck` all green (snapshot updates only for id strings).
- [ ] **Step 6: Commit:**

```bash
git add docs/deployment/registry/tung-chung.json src/strategy/reference-homes.ts src/strategy/__snapshots__
git commit -m "feat(strategy): reconcile Tung Chung config with live registry audit"
git push origin main
```

### Task B-TC-6: Tung Chung — dashboard creation

- [ ] **Step 1: Reachability gate** — repeat Task B-TC-1 Step 2.
- [ ] **Step 2: USER — create dashboard** (Settings → Dashboards → + Add → from scratch → Title `Quiet Luxe`, URL `quiet-luxe` → Raw configuration editor) and paste, with ids as corrected in Task B-TC-5:

```yaml
strategy:
  type: custom:quiet-luxe
  home:
    name: Tung Chung
    dashboard_path: quiet-luxe
    car: audi
    car_entities:
      battery_entity: sensor.audi_battery
      range_entity: sensor.audi_range
    calendar: google
    camera_engine: webrtc
    broadlink: true
    admin_flows:
      - entity: switch.nr_cam_uplink
        name: Camera uplink
        description: UniFi port
    kiosk: { language: zh-Hant }
    users:
      guests: [kiosk]
kiosk_mode:
  user_settings:
    - users: ["kiosk"]
      hide_header: true
      hide_sidebar: true
```

- [ ] **Step 3: Render check (USER, desktop admin):** Home renders; **no Energy view exists anywhere** (no energy config — acceptance criterion 3: absent hardware leaves no trace); no vacuum trace; LG TV appears in Media; no diagnostic card; console clean of `[quiet-luxe]` errors. STOP: diagnostic card → fix config per its message.
- [ ] **Step 4: Optional USER — room photos** to `/config/www/quiet-luxe/rooms/<area_id>.jpg` (verify one URL returns 200 as in B-SJ-6).

### Task B-TC-7: Tung Chung — RBAC users + HA-side enforcement

- [ ] **Step 1: Reachability gate** — repeat Task B-TC-1 Step 2.
- [ ] **Step 2: USER — users:** family users (Administrator off) + `kiosk` (Administrator off, local-only login if iPads are LAN-only). Add family usernames to the dashboard config + `TUNGCHUNG_CONFIG` `users.family`.
- [ ] **Step 3: Admin user_id:** `source .ai/secrets/tungchung.env && curl -sS -m 15 -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/states" | jq -r '.[] | select(.entity_id | startswith("person.")) | "\(.entity_id) \(.attributes.user_id)"'` → note the admin id.
- [ ] **Step 4: USER — guard automation** (Settings → Automations → new → YAML), `ADMIN_USER_ID` from Step 3:

```yaml
alias: "Quiet Luxe — revert admin flow toggles from non-admin users"
mode: queued
triggers:
  - trigger: state
    entity_id:
      - switch.nr_cam_uplink
conditions:
  - condition: template
    value_template: "{{ trigger.to_state.context.user_id is not none }}"
  - condition: template
    value_template: "{{ trigger.to_state.context.user_id != 'ADMIN_USER_ID' }}"
actions:
  - action: "switch.turn_{{ 'off' if trigger.to_state.state == 'on' else 'on' }}"
    target:
      entity_id: "{{ trigger.entity_id }}"
  - action: persistent_notification.create
    data:
      title: Blocked admin action
      message: "{{ trigger.entity_id }} was toggled by a non-admin user and reverted."
```

- [ ] **Step 5: Verify (USER):** kiosk login → no Settings/Dev Tools, no Admin/Car views, no greeting, no motion toggles. Family user toggles `switch.nr_cam_uplink` → reverts + notification. STOP if it does not revert.

### Task B-TC-8: Tung Chung — per-device checks

**USER dependency: physical devices on site.** Record results in `docs/deployment/deployment-log.md` under `## Tung Chung device checks`.

- [ ] **Step 1: Mobile admin:** spec §6 mobile order incl. Schedule (Google) and 🚘 car glance (Audi); Admin + Car reachable; **no ⚡ energy glance** (no energy config).
- [ ] **Step 2: Mobile family:** no Admin/Car; personal greeting correct.
- [ ] **Step 3: iPad kiosk (landscape):** room-level header, 2-per-row rooms, right rail without energy strip, bottom pill nav **without Energy**, kiosk-mode chrome hidden, idle clock face, ≥56px targets. Kiosk idle language reverts to **zh-Hant** (this home's kiosk default).
- [ ] **Step 4: Desktop admin:** dense layout + hover states + Admin page.
- [ ] **Step 5: Languages:** all five switch correctly; zh-Hant renders Noto Serif/Sans TC.
- [ ] **Step 6: Light + dark modes** render per theme.

STOP: log any failure with screenshot; report the full list.

### Task B-TC-9: Tung Chung — camera engine (SriHome RTSP → WebRTC)

- [ ] **Step 1: Reachability gate** — repeat Task B-TC-1 Step 2.
- [ ] **Step 2: go2rtc floor:** confirm this instance's HA version ≥ built-in go2rtc version per `docs/deployment/version-floor.md`. STOP if older: USER chooses go2rtc add-on vs `camera_engine: snapshot`.
- [ ] **Step 3: USER — integrate SriHome cameras:** Settings → Devices & services → Add integration → **Generic Camera** per camera. Common SriHome RTSP paths: main stream `rtsp://<cam-ip>:554/11`, sub stream `rtsp://<cam-ip>:554/12` (verify against the camera's app/manual — HA validates the stream on submit, so a wrong path fails immediately at this step).
- [ ] **Step 4: Verify:** `source .ai/secrets/tungchung.env && curl -sS -m 15 -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/states" | jq -r '[.[] | select(.entity_id | startswith("camera.")) | .entity_id]'` → one per camera. USER: Security page camera wall streams live via WebRTC (low latency). STOP: no stream → camera unreachable from HA host / wrong path; log findings.
- [ ] **Step 5: USER — label** the lead camera `ql-primary-camera`.

### Task B-XM-1: Xiamen — access + reachability

**China constraint reminder:** every service this home's tasks add must be reachable from mainland China (spec §2). No Google anything.

- [ ] **Step 1: USER — token + env file** for the Xiamen Nabu Casa URL, writing `.ai/secrets/xiamen.env`:

```bash
! zsh -c 'cd /Users/evertemple/Documents/Projects/home_assistant_dashboard_redesign && mkdir -p .ai/secrets && chmod 700 .ai/secrets && printf "HA_URL: " && read url && printf "HA_TOKEN: " && read -s tok && printf "HA_URL=%s\nHA_TOKEN=%s\n" "$url" "$tok" > .ai/secrets/xiamen.env && chmod 600 .ai/secrets/xiamen.env && echo && echo saved'
```

- [ ] **Step 2: Reachability check**

```bash
cd /Users/evertemple/Documents/Projects/home_assistant_dashboard_redesign
source .ai/secrets/xiamen.env
curl -sS -m 15 -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/"
```

Expected: `{"message":"API running."}`
STOP: unreachable/401 → log; skip remaining B-XM tasks until reachable.

### Task B-XM-2: Xiamen — HA version + capability verification

- [ ] **Step 1: Reachability gate** — repeat Task B-XM-1 Step 2.
- [ ] **Step 2: Version:** `source .ai/secrets/xiamen.env && curl -sS -m 15 -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/config" | jq -r '.version, .location_name'` → record in the deployment log. STOP if below tentative floor (USER upgrade — note HA updates download from GitHub/containers which may be slow from CN; the user may need their own network arrangements, which are out of this plan's scope).
- [ ] **Step 3: Areas:** `curl -sS -m 15 -X POST -H "Authorization: Bearer $HA_TOKEN" -H "Content-Type: application/json" -d '{"template": "{{ areas() | count }}"}' "$HA_URL/api/template"` → ≥ 1. STOP at 0: USER assigns areas first.
- [ ] **Step 4: Weather provider check (China-reachable):** `curl -sS -m 15 -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/states" | jq -r '[.[] | select(.entity_id | startswith("weather.")) | {e: .entity_id, s: .state}]'` → at least one weather entity with a real state (not `unavailable`). STOP if unavailable: USER must configure a China-reachable weather integration before header/idle-face weather works.

### Task B-XM-3: Xiamen — package install (manual) + HACS community cards

*(Amended 2026-08-02: private repo → manual Quiet Luxe install everywhere — which also sidesteps the HACS-from-China download problem for the package itself. kiosk-mode and dreame-vacuum still via HACS.)*

- [ ] **Step 1: Reachability gate** — repeat Task B-XM-1 Step 2.
- [ ] **Step 2: USER:** download `quiet-luxe.zip` from release v0.1.0 (`gh release download v0.1.0 -p quiet-luxe.zip`, repo `EverTemple/hass-quiet-luxe-dashboard`), unzip, copy contents to instance `/config/www/quiet-luxe/` via file access. Then HACS default store → install **kiosk-mode**. **CN caveat (kiosk-mode only):** HACS downloads from GitHub, which is unreliable from mainland China — retry on failure.
- [ ] **Step 3: USER — Dreame vacuum integration** (`vacuum: true`, Dreame X30 Pro): HACS → Custom repositories → `https://github.com/Tasshack/dreame-vacuum`, type Integration → install → restart HA → Settings → Devices & services → Add integration → Dreame Vacuum → Xiaomi/Dreame account login (China server region — credentials entered in HA UI only).
- [ ] **Step 4: Verify files:**

```bash
source .ai/secrets/xiamen.env
for f in local/quiet-luxe/quiet-luxe.js local/quiet-luxe/fonts/fonts.css hacsfiles/kiosk-mode/kiosk-mode.js; do
  printf "%s " "$f"
  curl -sS -m 15 -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/$f"
done
curl -sS -m 15 -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/states" | jq -r '[.[] | select(.entity_id | startswith("vacuum.")) | .entity_id]'
```

Expected: three `200`s; at least one `vacuum.*` entity.
STOP: fonts 404 (zip layout or copy problem) or no vacuum entity (integration login failed — USER retries).
- [ ] **Step 5: USER:** Resources list: add `/local/quiet-luxe/quiet-luxe.js` (JavaScript module) — manual installs are never auto-registered.

### Task B-XM-4: Xiamen — theme install + set default

- [ ] **Step 1: Reachability gate** — repeat Task B-XM-1 Step 2.
- [ ] **Step 2: USER:** copy `themes/quiet-luxe.yaml` → `/config/themes/quiet-luxe.yaml`; ensure the `frontend: themes:` include line exists in `configuration.yaml`.
- [ ] **Step 3: Reload:** `source .ai/secrets/xiamen.env && curl -sS -m 15 -X POST -H "Authorization: Bearer $HA_TOKEN" -H "Content-Type: application/json" -d '{}' "$HA_URL/api/services/frontend/reload_themes"` → `[]`. STOP on error (check `/api/error_log`).
- [ ] **Step 4: Default:** `curl -sS -m 15 -X POST -H "Authorization: Bearer $HA_TOKEN" -H "Content-Type: application/json" -d '{"name": "quiet-luxe"}' "$HA_URL/api/services/frontend/set_theme"` → `[]`; USER confirms in profile. **Font sanity (China rule):** with the dashboard open, browser dev tools → Network → filter `font` → every font request is served from `$HA_URL/local/quiet-luxe/fonts/...`; zero requests to any external CDN. STOP if any external font request appears — that violates spec §2 and must be fixed in the bundle, not worked around.

### Task B-XM-5: Xiamen — registry audit + config reconciliation

**Files:**
- Create: `docs/deployment/registry/xiamen.json`
- Modify: `src/strategy/reference-homes.ts` (XIAMEN_CONFIG)

- [ ] **Step 1: Reachability gate** — repeat Task B-XM-1 Step 2.
- [ ] **Step 2: Dump:** `source .ai/secrets/xiamen.env && node scripts/audit-registry.mjs docs/deployment/registry/xiamen.json` → summary line.
- [ ] **Step 3: Check assumed entity ids** (Li Auto ids are expected to 404 until Task C3 — record but don't stop):

```bash
for e in sensor.liauto_battery sensor.liauto_fuel sensor.liauto_range; do
  printf "%-30s " "$e"
  curl -sS -m 15 -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/states/$e"
done
jq -r '.areas | keys[]' docs/deployment/registry/xiamen.json
```

Expected: probably `404` ×3 (no Li Auto integration yet — Task C3 resolves); area ids listed.
- [ ] **Step 4: Update `XIAMEN_CONFIG`** with any corrected room/vacuum ids from the audit; leave `car: 'liauto'` untouched until Task C3 decides. `npm run test && npm run lint && npm run typecheck` green.
- [ ] **Step 5: Commit:**

```bash
git add docs/deployment/registry/xiamen.json src/strategy/reference-homes.ts src/strategy/__snapshots__
git commit -m "feat(strategy): reconcile Xiamen config with live registry audit"
git push origin main
```

### Task B-XM-6: Xiamen — dashboard creation

- [ ] **Step 1: Reachability gate** — repeat Task B-XM-1 Step 2.
- [ ] **Step 2: USER — create dashboard** (Title `Quiet Luxe`, URL `quiet-luxe`, Raw configuration editor) and paste, with ids as corrected in Task B-XM-5:

```yaml
strategy:
  type: custom:quiet-luxe
  home:
    name: Xiamen
    dashboard_path: quiet-luxe
    car: liauto
    car_entities:
      battery_entity: sensor.liauto_battery
      fuel_entity: sensor.liauto_fuel
      range_entity: sensor.liauto_range
    calendar: none
    vacuum: true
    camera_engine: snapshot
    broadlink: false
    kiosk: { language: zh-Hans }
    users:
      guests: [kiosk]
kiosk_mode:
  user_settings:
    - users: ["kiosk"]
      hide_header: true
      hide_sidebar: true
```

(`car:` may become `none` and `camera_engine:` may become `webrtc` after Tasks C3 / B-XM-9 — re-edit then.)

- [ ] **Step 3: Render check (USER, desktop admin):** Home renders; **no Schedule card anywhere** (`calendar: none`); no Energy view; vacuum card present (docked state, battery); car page shows muted/offline car values (entities 404 until C3) — muted, **never** an error box (spec §12); no diagnostic card; console clean. STOP: diagnostic card or error boxes → fix before proceeding.
- [ ] **Step 4: Optional USER — room photos** to `/config/www/quiet-luxe/rooms/<area_id>.jpg`.

### Task B-XM-7: Xiamen — RBAC users + HA-side enforcement

- [ ] **Step 1: Reachability gate** — repeat Task B-XM-1 Step 2.
- [ ] **Step 2: USER — users:** family users (Administrator off) + `kiosk` (Administrator off, local-only if applicable). Add family usernames to dashboard config + `XIAMEN_CONFIG`.
- [ ] **Step 3: Guard automation:** Xiamen's config has **no `admin_flows`** (no Node-RED network toggles here), so no guard automation is needed. The enforced boundary here is: kiosk/family are non-admin, and the Car view (admin-only) has no entities to act on until C3. Verify there is genuinely nothing consequential exposed: as the kiosk user, the dashboard offers no network/car/motion-toggle controls.
- [ ] **Step 4: Verify (USER):** kiosk login → no Settings/Dev Tools, no Admin/Car views, no greeting, no motion toggles; zh-Hans strings by default.

### Task B-XM-8: Xiamen — per-device checks

**USER dependency: physical devices on site.** Record results under `## Xiamen device checks` in the deployment log.

- [ ] **Step 1: Mobile admin:** spec §6 order **without** Schedule (calendar none) and without ⚡ energy; 🚘 car glance present (muted until C3); vacuum reachable from room/All-Climates surfaces per design.
- [ ] **Step 2: Mobile family:** no Admin/Car.
- [ ] **Step 3: iPad kiosk (landscape):** kiosk chrome hidden; right rail without energy strip and without calendar event slot; idle clock face with China-reachable weather + AQI; idle reverts language to **zh-Hans**.
- [ ] **Step 4: Desktop admin:** Admin page shows instance health (HA version, pending updates, unavailable-entity count).
- [ ] **Step 5: Languages:** all five switch; zh-Hans renders Noto Serif/Sans SC.
- [ ] **Step 6: Light + dark modes** render per theme.

STOP: log failures with screenshots; report the full list.

### Task B-XM-9: Xiamen — camera path research (大华云联) + setup

This is the spec §13 research task. Decision order (stop at the first that works):

- [ ] **Step 1: Reachability gate** — repeat Task B-XM-1 Step 2.
- [ ] **Step 2: USER — establish the facts:** which Dahua camera/NVR models, and are they on the Xiamen LAN with RTSP/ONVIF enabled, or cloud-only via the 大华云联 app? (Check the app's device settings for "local access"/RTSP options.)
- [ ] **Step 3: Option 1 — local RTSP/ONVIF (preferred):** if the devices answer on the LAN, integrate exactly as Subang (ONVIF integration, or Generic Camera with `rtsp://<user>:<pass>@<ip>:554/cam/realmonitor?channel=1&subtype=1`), then change the dashboard config + `XIAMEN_CONFIG` to `camera_engine: 'webrtc'` (HA built-in go2rtc; version gate per `docs/deployment/version-floor.md`), run `npm run test`, and commit `feat(strategy): switch Xiamen to webrtc camera engine` — WebRTC is fully local, no China-reachability issue.
- [ ] **Step 4: Option 2 — cloud integrations research (WebSearch, primary sources = the GitHub repos):** evaluate in this order, for: 大华云联/Imou account compatibility, mainland-China API reachability, maintenance (commits within ~12 months), and stream vs snapshot support:
  1. `github.com/user2684/imou_life` (Imou Life custom integration — Imou is Dahua's consumer cloud; verify the 大华云联 account logs into Imou's China region)
  2. `github.com/rroller/dahua` (local-first Dahua integration — only if Step 3 was partially possible)
  3. go2rtc restream of any cloud stream type these devices expose
  Record the comparison in `docs/deployment/deployment-log.md` under `## Xiamen camera research` (candidate, verdict, evidence link each).
- [ ] **Step 5: Install the chosen option (USER for logins)** via HACS custom repository (type Integration) → restart → configure. Verify: `source .ai/secrets/xiamen.env && curl -sS -m 15 -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/states" | jq -r '[.[] | select(.entity_id | startswith("camera.")) | .entity_id]'` → ≥ 1 entity; Security page shows snapshot-refresh tiles (`camera_engine: snapshot` is designed exactly for this — spec §6 Security).
- [ ] **Step 6: Option 3 — documented fallback:** if no option yields camera entities, leave `camera_engine: snapshot` with zero cameras: the Security page renders doors/motion only and shows **no camera section at all** (graceful degradation, spec §8). Record the outcome + retry conditions in the deployment log. This is a valid, non-blocking end state.
- [ ] **Step 7: USER — label** the lead camera `ql-primary-camera` (if any cameras exist).

---

## Phase C — Cross-home validation, research closure, documentation

### Task C1: Cross-home validation matrix

**Files:**
- Create: `docs/deployment/validation-matrix.md`

- [ ] **Step 1: Create the checklist mirroring spec §2 + acceptance criteria**

Write `docs/deployment/validation-matrix.md` with this exact table, then fill every cell with ✅ / ❌ / n/a + a one-line note, using evidence already gathered in Phase B (re-run the referenced checks where memory is stale):

```markdown
# Cross-home validation matrix (spec §2 / acceptance §1)

| Check | Subang Jaya | Tung Chung | Xiamen |
| --- | --- | --- | --- |
| Same bundle version installed (HACS v0.1.0) | | | |
| Theme active, light+dark | | | |
| Sonos group builder on Media page | | (n/a expected) | (n/a expected) |
| TV cards (Samsung / LG / TCL) | | | |
| Covers control (shades+curtains / curtains / curtains) | | | |
| Energy view (Shelly 3EM) | | (absent expected) | (absent expected) |
| Car page (BMW / Audi / Li Auto per C3) | | | |
| Cameras (NVR-WebRTC / RTSP-WebRTC / per B-XM-9) | | | |
| Vacuum card (Dreame) | (absent expected) | (absent expected) | |
| Broadlink RF fan controls | | | (absent expected) |
| Schedule card (Google) | | | (absent expected) |
| Absent features leave NO trace (acceptance 3) | | | |
| RBAC: kiosk sees no admin/car/motion toggles (acceptance 4) | | | |
| Kiosk HA-side boundary verified (guard/non-admin) | | | |
| Five languages render (acceptance 5) | | | |
| Kiosk idle language (en / zh-Hant / zh-Hans) | | | |
| No per-home view YAML (config-only dashboards, acceptance 1) | | | |
```

- [ ] **Step 2: Every ❌ gets a deployment-log entry** (per the STOP protocol) — the matrix must not hide failures.
- [ ] **Step 3: Commit**

```bash
git add docs/deployment/validation-matrix.md docs/deployment/deployment-log.md
git commit -m "docs(deploy): record cross-home validation matrix results"
git push origin main
```

### Task C2: Resolve the HA version floor (closes the hacs.json UNCONFIRMED)

**Files:**
- Modify: `hacs.json`
- Modify: `docs/deployment/version-floor.md`

- [ ] **Step 1: Compute the final floor:** floor = the max feature version from `docs/deployment/version-floor.md` Step 1 research. Confirm all three recorded instance versions (deployment log `## Instance versions`) are ≥ floor — they must be, since Phase B rendered successfully.
- [ ] **Step 2: Update `hacs.json`** — set `"homeassistant"` to the computed floor (replacing the unverified `2025.6.0`). Append to `version-floor.md`: `Final floor: <version> — verified against Subang <v>, Tung Chung <v>, Xiamen <v> on <date>.`
- [ ] **Step 3: Commit + validate**

```bash
git add hacs.json docs/deployment/version-floor.md
git commit -m "fix(infra): set verified HA version floor in hacs.json

- floor derived from documented feature requirements (custom strategies,
  sections GA, built-in go2rtc) and verified against all three live
  instances; closes the 2025.6.0 UNCONFIRMED from Plan 1"
git push origin main
gh run watch "$(gh run list --workflow Validate --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
```

Expected: Validate green.

### Task C3: Li Auto L7 integration research + Xiamen car outcome

**Files:**
- Modify: `src/strategy/reference-homes.ts` (XIAMEN_CONFIG car block, either outcome)

- [ ] **Step 1: Research (WebSearch + GitHub, primary sources = the repos):** queries: `Li Auto Home Assistant integration`, `理想汽车 Home Assistant 集成`, `lixiang home-assistant github`; plus `gh search repos --topic home-assistant lixiang` and `gh search repos "li auto" home assistant`. Evaluation criteria: exposes battery/fuel/range/lock/location entities; works against Li Auto's China API from the Xiamen network; commits within ~12 months; installable via HACS custom repository. Record candidates + verdicts in `docs/deployment/deployment-log.md` under `## Li Auto research`.
- [ ] **Step 2 (outcome A — viable integration found): USER installs it** on Xiamen via HACS custom repository (type Integration) → restart → configure with Li Auto credentials (HA UI only). Verify entities: `source .ai/secrets/xiamen.env && curl -sS -m 15 -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/states" | jq -r '[.[] | select(.entity_id | test("liauto|lixiang|li_auto")) | .entity_id]'` → non-empty. Update `XIAMEN_CONFIG.car_entities` and the Xiamen dashboard YAML with the real ids; USER confirms the Car page shows the L7 cutout hero + battery/fuel/range/lock.
- [ ] **Step 3 (outcome B — none viable):** set `car: 'none'` in `XIAMEN_CONFIG`, delete its `car_entities` block, and edit the Xiamen dashboard YAML the same way; USER verifies the Car view and 🚘 glance vanish without a trace (acceptance 3). Document the fallback + re-evaluation trigger (a maintained integration appearing) in the deployment log.
- [ ] **Step 4: Test + commit (either outcome)**

```bash
npm run test && npm run lint && npm run typecheck
git add src/strategy/reference-homes.ts src/strategy/__snapshots__ docs/deployment/deployment-log.md
git commit -m "feat(strategy): resolve Xiamen Li Auto car config from integration research"
git push origin main
```

### Task C4: Documentation + memory updates

**Files:**
- Modify: `README.md`
- Modify: `/Users/evertemple/.claude/projects/-Users-evertemple-Documents-Projects-home-assistant-dashboard-redesign/memory/ha-homes-context.md`

- [ ] **Step 1: Add a "Reference homes (live)" section to `README.md`** (after the Dashboard strategy section): one bullet per home — HA version, area count (from the registry JSONs), camera engine outcome, car outcome, kiosk language, and a pointer to `docs/deployment/registry/<home>.json` + `docs/deployment/validation-matrix.md`.
- [ ] **Step 2: Update the memory file** `ha-homes-context.md`: replace assumed-entity guesses with the real inventory summary per home (area lists, key entity ids for energy/car/cameras/vacuum, resolved camera + car paths, verified HA versions) and note that full dumps live in the repo under `docs/deployment/registry/`.
- [ ] **Step 3: Commit the repo part**

```bash
git add README.md
git commit -m "docs: add live reference-home notes from deployment validation"
git push origin main
```

### Task C5: Locale review handoff

**Files:**
- Create: `docs/deployment/locale-review.md`

- [ ] **Step 1: Write the handoff note**

```markdown
# Locale review handoff

The non-English UI strings were machine-authored and need native review
before they're considered final (spec §10: all card strings come from these
files — no hardcoded text).

| Locale | File | Reviewer needed |
| --- | --- | --- |
| zh-Hant (繁體中文) | src/i18n/locales/zh-hant.ts | native Traditional-Chinese speaker (Tung Chung household) |
| zh-Hans (简体中文) | src/i18n/locales/zh-hans.ts | native Simplified-Chinese speaker (Xiamen household) |
| ms (Bahasa Melayu) | src/i18n/locales/ms.ts | native Malay speaker (Subang Jaya household) |
| id (Bahasa Indonesia) | src/i18n/locales/id.ts | native Indonesian speaker |

How to review: each file is a flat `key: "string"` map mirroring
`src/i18n/locales/en.ts`. Edit strings in place (do not rename keys —
`npm run test` includes an i18n key-completeness check), then commit or hand
the edits back. Domain terms to watch: cover/curtain vs blind, dehumidifier,
purifier, kiosk idle strings, date formats.
```

- [ ] **Step 2: Commit and tell the user** — this is a **USER** follow-up (recruiting native reviewers); Plan 5 only delivers the handoff.

```bash
git add docs/deployment/locale-review.md
git commit -m "docs(i18n): add native locale review handoff note"
git push origin main
```

### Task C6: Wrap-up

- [ ] **Step 1: Sweep the deployment log:** every STOP entry is either resolved (note how) or listed as an open follow-up with an owner (user vs future plan). No silent failures.
- [ ] **Step 2: Final verification:** `npm run test && npm run lint && npm run typecheck` green; `git status --porcelain` empty; `gh run list --limit 3` all green; `gh release view v0.1.0` still lists `quiet-luxe.zip` (plus any newer release cut during Phase B/C fixes — if code changed since v0.1.0, bump `package.json` to `0.1.1`, commit `chore: bump version to 0.1.1`, run Task A5's dispatch steps with `version=0.1.1`, and have the user update via HACS on all three homes before signing off the matrix).
- [ ] **Step 3: Mark this plan's checkboxes** and commit:

```bash
git add docs/superpowers/plans/2026-08-02-deployment.md docs/deployment
git commit -m "docs(plans): mark plan 5 deployment tasks complete"
git push origin main
```

---

## Hard user-dependencies (cannot be automated)

1. GitHub interactive auth (`gh auth login`) and the public-visibility decision (A1/A2).
2. Long-lived HA tokens per instance, typed interactively into `.ai/secrets/*.env` (B-*-1).
3. All HA admin UI work: HACS installs, theme file copy, dashboard creation, user creation, integration logins (Google OAuth, Dreame/Xiaomi, Dahua/Imou, Li Auto), guard-automation install.
4. Physical devices on site: iPads on stands, phones with companion apps, desktops (B-*-8).
5. Camera/NVR credentials and 大华云联 account facts (B-SJ-9, B-TC-9, B-XM-9).
6. Native-speaker locale review (C5).
7. Instance HA upgrades if any version is below the verified floor (B-*-2).
