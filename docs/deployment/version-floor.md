# HA version floor — evidence

Researched against primary sources on 2026-08-02.

| Feature we require | Min HA version | Source |
| --- | --- | --- |
| ll-strategy-dashboard-* custom strategies | 2023.10 | Strategies exist since 2021.5 (<https://developers.home-assistant.io/docs/frontend/custom-ui/custom-strategy/>); the split `ll-strategy-dashboard-*` / `ll-strategy-view-*` element naming shipped with frontend PR "Refactor strategy foundation" merged 2023-09-21 (<https://github.com/home-assistant/frontend/pull/17921>), first included in HA 2023.10 |
| Sections view GA | 2024.11 | Introduced experimental in 2024.3 (<https://www.home-assistant.io/blog/2024/03/06/release-20243/>); "out of its experimental phase, and ready for primetime" in 2024.11 (<https://www.home-assistant.io/blog/2024/11/06/release-202411/>) |
| Built-in go2rtc WebRTC | 2024.11 | 2024.11 "Slick dashboards and speedy cameras": camera streams "now try to use WebRTC whenever possible" via built-in go2rtc (<https://www.home-assistant.io/blog/2024/11/06/release-202411/>) |
| frontend.set_theme | 0.49 | Themes + `frontend.set_theme` service introduced in 0.49, 2017-07-15 (<https://www.home-assistant.io/blog/2017/07/15/release-49/>) |

Tentative floor = max of column 2: **2024.11**.
Final floor decided in Task C2 = max(tentative floor) verified against the
three instances' actual versions (Tasks B-SJ-2 / B-TC-2 / B-XM-2).
`hacs.json` currently declares 2025.6.0 (UNCONFIRMED from Plan 1).

Notes (verified 2026-08-02):

- The strategy-split frontend PR kept backwards compatibility with the pre-split
  element naming, so 2023.10 is the safe floor for the `ll-strategy-dashboard-*`
  registration path our bundle uses; older HA would need the legacy naming we do
  not ship.
- HA 2026.5 additionally lets custom dashboard strategies register for the
  "Community dashboards" picker
  (<https://developers.home-assistant.io/blog/2026/04/21/registering-custom-dashboard-strategies/>).
  That is discoverability only — not a floor requirement.
