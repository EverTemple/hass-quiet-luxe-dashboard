# KTV song picker card: design

Status: **approved by the user 2026-11-11** (no Figma phase; design via the impeccable + hallmark skills)
Scope: Isola (MY) only, for the Inandon KTV_H6 box in the Main Living Room. Other homes have no box, so the card is never placed there.

## 1. Goal

Search the box's catalogue (about 56k songs) by title, singer or pinyin initials. Add a result to the queue or to the top of it. See what is playing now and what is queued, and use the basic transport controls. All of this from the Quiet Luxe dashboard, for any dashboard user, including non-admin household members.

Acceptance criteria:
1. Typing `yldb`, `月亮代表` or `dlj` / `邓丽君` finds 月亮代表我的心 / 邓丽君 within 200 ms of the last keystroke on an iPad. The catalogue has no English singer aliases, so `Teresa` will not match.
2. **Add** and **Add to top** put the song in the box's queue. The queue list updates within 3 s.
3. Now playing shows title and singer, plus play/pause, next, original/backing vocal and volume.
4. It works for a non-admin HA user.
5. If the box is offline or the catalogue hasn't loaded, the card says so in plain words. It never shows an empty list without explanation.
6. Light and dark themes look right at 390 px, 1180 px and 1680 px, verified with Playwright screenshots against the live Isola dashboard.

## 2. What already exists (verified 2026-11-11)

- **Protocol:** the JustLink legacy protocol, documented in the gitignored working notes under `.ai/`, together with all network details.
  - Commands are short UDP text datagrams.
  - The box broadcasts state events to its subnet.
  - The catalogue is a binary file of 228-byte records, fetched over TCP from the box.
- **Node-RED tab "Room - KTV Box"** on Isola, built by `.ai/isola-ktv-build.mjs`:
  - 19 `button.ktv_*` entities;
  - `sensor.ktv_box` (state, volume, muted, vocal, ip, last_seen);
  - a 60 s heartbeat;
  - the link-in "KTV command".
- HA and the box share a subnet, and the box has a DHCP reservation.

## 3. Architecture

```
box ──UDP/TCP──► Node-RED (HA host) ──► sensor.ktv_box (now playing, queue, catalogue_version)
                       │                 /local/ktv/catalogue.<ver>.json (search index)
                       ◄── text.ktv_command ◄── card (text.set_value, any user)
```

1. **Catalogue and search index are built in Node-RED and searched in the browser.**
   - Node-RED fetches `jlink/song.txt` over TCP 19969: daily, on demand, and when `synclist*` events suggest a change.
   - It parses the 228-byte records and computes pinyin initials (no full pinyin) for title and singer, using the `pinyin-pro` npm module.
     - Function-node external modules are enabled in the add-on (`functionExternalModules: true`, verified 2026-11-11), so this needs no add-on option change.
   - It writes a compact JSON array to `www/ktv/catalogue.json` in HA's config (written atomically; the URL carries `?v=<version>` for cache-busting), then publishes `catalogue_version` and `catalogue_url` as sensor attributes.
     - `www/` exists because HACS uses `www/community` (inferred). The add-on's mount path for HA's config is UNCONFIRMED; verify it in Phase 1.
   - The card downloads the file lazily (on first search focus), keeps one parsed copy per version in memory, and searches in memory. An IndexedDB cache is deferred; the browser HTTP cache covers reloads.
   - *Why:* 56k rows search in a few ms locally, with no per-keystroke round trips. Node-RED cannot answer HA WebSocket queries with data for non-admins.
   - *Trade-off:* the file is public under `/local/`. A song list is not sensitive. Expected size is about 3–4 MB raw and well under 1 MB gzipped (UNCONFIRMED; measure).
2. **Commands go from card to HA to Node-RED through a `text.ktv_command` entity.** Node-RED creates it with its `ha-text` node (available in node-red-contrib-home-assistant-websocket 0.80.3, verified).
   - The card calls `text.set_value` with `selectsong:<no>#<nonce>`. Node-RED strips the nonce, checks the command against an allow-list, and sends it.
   - *Why:* firing events needs admin, but a service call on an entity is allowed for every user. The nonce makes repeated identical commands still register.
3. **Now playing and the queue are published by Node-RED.**
   - On `synclistorder`/`synclistplayed`, and after any queue command, Node-RED sends `jlink:listorder`. The reply is `client:listorder:|<cur>|<no>|…`.
   - Node-RED resolves the numbers against its catalogue and publishes `now_playing {no,title,singer}` and `queue [{no,title,singer}]` (capped at 50) on `sensor.ktv_box`.
   - 50 short rows stay under the recorder's 16 KB attribute limit, so no recorder exclusion is planned. That would need a `configuration.yaml` change and an HA restart.
4. **Vocal and pause have no toggle on the box.** The card sends the explicit opposite command based on `sensor.ktv_box` attributes (`vocal`, `state`).

## 4. Card (`quiet-luxe-ktv-card`)

- **Layout, top to bottom:**
  - Now playing: title, singer, transport controls, vocal toggle, volume.
  - Search field, with a language filter chip row: All / 国语 / 粤语 / English / other.
  - Results list: title, singer and language tag, with **+** and **Top** actions.
  - Queue list, with remove and move-to-top.
- **Rules:**
  - Built only from Quiet Luxe tokens and existing elements.
  - New visual pieces (result row, queue row, transport bar) reuse existing Quiet Luxe elements where possible. Design direction and critique use the impeccable and hallmark skills. No Figma step for this card (user decision 2026-11-11).
  - i18n uses the existing 5-locale set. Song titles and singers are shown as-is.
- **Placement:** the strategy adds the card to the Main Living Room view only when `sensor.ktv_box` exists, with an opt-out via the strategy config.
- **Entity IDs** (`sensor.ktv_box`, `text.ktv_command`) come from the card config, with these names as defaults. No network details live in the card.

## 5. Risks and open questions

- **`pinyin-pro` in a function node** is installed by Node-RED on deploy, which needs internet from HA. Fallback: build the index offline and upload it. Catalogue refresh then stops being automatic.
- **Polyphonic characters** (e.g. 长, 重) give imperfect initials. The phone app has the same limitation. Accept this.
- **Port 19969** is only open while a client is linked. HA's heartbeat appears to keep it open (observed 2026-11-11, UNCONFIRMED over time). The refresh must handle "closed" without raising an alarm.
- **Reply routing:** whether `listorder` replies are unicast or broadcast is UNCONFIRMED. The listener on :19967 receives both.
- **Fallback if the card isn't ready:** the 19 buttons and the sensor already work with stock cards.

## 6. Delivery phases

1. **Node-RED backend:**
   - catalogue fetch, index, `/local` publish;
   - `text.ktv_command` with an allow-list;
   - the `listorder` → now playing/queue path;
   - the resume event mapping.
   - Verify live with the user watching.
2. **Card implementation (impeccable + hallmark for design and critique):** add the card and its unit tests, then Playwright screenshots in light/dark at 3 widths, plus a design review.
3. **Strategy placement and release:** ship as v0.10.0 via the documented release procedure, then a HACS update on Isola.
