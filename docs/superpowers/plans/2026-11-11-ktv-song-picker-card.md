# Plan: KTV song picker card (Phase 2)

Spec: `docs/superpowers/specs/2026-11-11-ktv-song-picker-design.md` (approved 2026-11-11).
Backend contract (deployed): `sensor.ktv_box` and `text.ktv_command`; catalogue JSON at the sensor's `catalogue_url`.

## Design contract (impeccable, Operate mode, extends the Quiet Luxe surface)

- **Thesis:** a song is three keystrokes and one tap away. The card is a search instrument first, and a now-playing and queue display second. It refuses the karaoke-bar aesthetic (neon, glow, cover art) and the spreadsheet song table.
- **Own world:** Quiet Luxe, unchanged.
  - Warm `--ql-*` surfaces, a champagne accent for the primary action and current state only, and the card radius.
  - `TYPE.title`/`body`/`caption` only. 56 px touch floor, calm 150–250 ms state transitions.
  - One new token, added during review: `--ql-on-accent` (palette `onAccent`), for text and glyphs on the champagne fill. Cream on champagne measured 2.72:1 in light; ink gives 4.85:1. The shared `ql-chip` active state uses it too.
- **Story:** someone at the party opens the dashboard on a phone, types `yldb` or `月亮`, taps **+**, and sees the song land in "Up next". The host on the iPad sees the same queue and can move a song to the top or remove it.
- **First viewport (phone, about 390 px):**
  - A compact now-playing strip: title (clamp 1), singer (muted), play/pause and next icon buttons, with the vocal toggle on its own line below.
  - The search field directly below it: full width, 56 px, with search glyph and clear button.
  - A single row of language chips under the field.
  - Then results (while a query is present) or "Up next" (when it is empty).
- **Wide (≥ 700 px of card width, via container query):**
  - Left column (≈ 60 %): search, chips, results.
  - Right column: now playing (larger) and the queue.
- **Signature interaction:** tapping **+** turns the row's button into a check for 1.5 s ("Added"). The queue row then appears when `sensor.ktv_box` updates. There is no optimistic insert into the queue: the queue always shows the truth.

## Behaviour

- **Config:** `{ type, entity?: 'sensor.ktv_box', command_entity?: 'text.ktv_command', title?: string }`. The defaults are those ids. `setConfig` throws on non-string ids.
- **Commands:**
  - Sent as `hass.callService('text', 'set_value', { entity_id: command_entity, value: '<cmd>#<nonce>' })`.
  - The nonce is `Date.now().toString(36)` plus a counter.
  - Commands used:
    - `selectsong:<no>`, `insertsong:<no>`, `insertorder:<no>`, `delorder:<no>`
    - `play`, `pause`, `next`, `yuanchang`, `banchang`, `volup`, `voldn`
- **State:** read only through `this.entity(entity)` (re-render gating). Attributes used:
  - `state`, `volume`, `vocal`
  - `now_playing {no,title,singer}`
  - `queue [{no,title,singer}]`, `queue_count`
  - `catalogue_url`, `catalogue_version`, `catalogue_error`
- **Toggles:**
  - Play/pause sends `pause` when state is `playing`, otherwise `play`.
  - Vocal: a 2-option `ql-segmented` (Original / Backing) sends `yuanchang`/`banchang`.
- **Volume:** − / + icon buttons with the numeric `volume` between them, sending `voldn`/`volup`.
- **Catalogue:**
  - Loaded lazily on first focus of the search input, or on first keystroke.
  - `fetch(catalogue_url)` is same-origin. The response is validated: `fields` must match the expected order and `rows` must be an array.
  - Cached in a module-level `Map<version, Promise<Catalogue>>`. A version change refetches.
  - States: idle, loading ("Loading 56,000 songs…" with a skeleton row), ready, error (message plus a retry button).
- **Search** (pure module `src/cards/ktv-search.ts`, fully unit-tested):
  - Normalise the query: NFKC, lower-case, trimmed, whitespace collapsed.
  - Match against title, singer and singer2 (lower-cased) and the initials fields `ti`/`si`.
  - Scores, from best to worst:
    1. exact title
    2. title prefix
    3. title-initials prefix
    4. singer exact or singer-initials exact
    5. title substring
    6. singer prefix or substring
    7. initials substring
  - Ties are broken by `hot` (descending), then by shorter title.
  - Language filter: all, Mandarin (1), Cantonese (2), English (4), other (everything else).
  - Cap at 50 results. Debounce input by 120 ms, and stay under 200 ms on an iPad for 56k rows (measure in the test with a synthetic 56k catalogue: a budget assertion of < 150 ms in Node).
- **Rows:**
  - Text: title (clamp 1, `lang` attribute omitted, since CJK fonts are already set by HA), then singer and singer2 joined with " · " (muted, clamp 1), plus the language as muted text in the same line when the filter is "all" or "other" (changed from a badge in design review). A status in accent text follows it: "Playing", or "Queued #n" from the box's real queue.
  - Actions on result rows: **+** (Add) and **to-top** (Add to top).
  - Actions on queue rows: **to-top** (Move to top) and **×** (Remove).
- **Empty and error states:**
  - Box offline (`state` = `offline`/`unknown`/`unavailable`): the card is muted and says "The KTV box is off". Search stays usable if the catalogue is cached; actions are disabled.
  - No results: "No songs match “q”. Try fewer letters, or pinyin initials like yldb."
  - Empty queue: "Nothing queued. Search above to add a song."
  - Nothing playing: "Nothing playing".
- **Accessibility:**
  - Every icon button has an aria-label (i18n).
  - The results list is `role="list"` with an `aria-live="polite"` result-count caption.
  - Focus ring per base styles.
  - `prefers-reduced-motion` turns off transitions.

## Added in review (2026-11-11)

- **Remove → Add back:** a 5 s affordance in the "Up next" head row, which never shifts the list. It re-adds the song at the end of the queue, because the protocol has no positional insert.
- **Pending rows:** the removed row stays visible but disabled until the box's queue drops it.
- **Feedback:** "Added" and "Removed" confirm only after the service call succeeds; a failure shows an alert line. One persistent live region announces counts and confirmations.
- **Unknown songs:** a song number that isn't in the catalogue renders as "Song #<no>".
- **`catalogue_error` from the sensor** is shown when the catalogue can't load.
- **Search:** multi-word queries (every token must match some field), and singer-initials prefix ranking.

## Tasks

1. `src/cards/ktv-search.ts` + test: catalogue type, `parseCatalogue` validation, `normalise`, `search(catalogue, query, lang, limit)`, and the 56k performance test.
2. `src/cards/ktv-catalogue.ts` + test: lazy loader with a version-keyed cache and an injectable fetch, so tests can use `vi.stubGlobal`.
3. `src/elements/ql-glyphs.ts`: add authored SVG glyphs (play, pause, next, plus, to-top, remove, search, check, minus) in the existing glyph style.
4. `src/cards/quiet-luxe-ktv-card.ts` + test (copy the media-card test patterns):
   - registration
   - setConfig
   - commands
   - toggles
   - offline state
   - search flow with a stubbed catalogue
   - add-button feedback
   - queue actions
   - locale switch
   - `super.willUpdate`
5. i18n: `ktv.*` keys in all 5 locales.
   - zh-Hans/zh-Hant use the natural KTV terms: 原唱 / 伴唱 / 点歌 / 置顶 / 已点.
   - ms/id: best effort, flagged for native review like the existing ones.
6. Wire-up: `src/index.ts` import + export, `src/index.test.ts` CARD_TAGS, and the dev harness section with fixture entities and a small sample catalogue under `dev/`.
7. Verify:
   - `npm run lint && npm run typecheck && npm test && npm run build`
   - Playwright screenshots: harness at 390 px light and dark, plus a wide page at 1180 and 1680 px light and dark.
   - Detector: `node ~/.claude/skills/impeccable/scripts/detect.mjs --json`.
8. Review:
   - design-reviewer (opus) on the screenshots
   - hallmark audit
   - one fix batch, one confirm round
   - code-reviewer on the diff
9. Phase 3 (separate): strategy placement and release v0.10.0.

## Out of scope for this phase

Guest access without an HA login, the IndexedDB cache, pinyin full-spelling search, and song previews.
