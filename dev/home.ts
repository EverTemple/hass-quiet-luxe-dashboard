import '../src/index';
import { HA_GRID_CSS, renderView } from './ha-grid';
import { QuietLuxeStrategy } from '../src/strategy/quiet-luxe-strategy';
import { TUNGCHUNG_CONFIG } from '../src/strategy/reference-homes';
import type { RegistrySnapshot } from '../src/strategy/registry';
import { makeMockHass } from '../src/testing/mock-hass';
import { referenceHome } from '../src/testing/mock-registry';
import { cssVariableBlock } from '../src/tokens/css';
import type { ThemeMode } from '../src/tokens/types';
import type { HassEntity } from '../src/types/home-assistant';

/**
 * Whole-dashboard harness: renders what the strategy generates through a
 * faithful copy of HA's sections grid (dev/ha-grid.ts), so layout defects
 * (overlap, overflow, wrapping) reproduce here instead of only on the
 * instance.
 *
 * Data: `node scripts/fetch-live-snapshot.mjs` writes dev/live-snapshot.json
 * (gitignored) from a live instance. Without it the harness falls back to the
 * bundled Tung Chung fixture.
 *
 * Query params: ?view=home|room-living_room|… &mode=light|dark
 */

interface LiveSnapshot {
  readonly registry: RegistrySnapshot;
  readonly states: ReadonlyArray<HassEntity>;
}

async function loadData(): Promise<{ snapshot: RegistrySnapshot; entities: ReadonlyArray<HassEntity> }> {
  try {
    const response = await fetch('/dev/live-snapshot.json');
    if (response.ok) {
      const live = (await response.json()) as LiveSnapshot;
      return { snapshot: live.registry, entities: live.states };
    }
  } catch {
    /* fall through to the bundled fixture */
  }
  const fixture = referenceHome('tungchung');
  return { snapshot: fixture.snapshot, entities: fixture.entities };
}

function params(): { view: string; mode: ThemeMode } {
  const search = new URLSearchParams(window.location.search);
  return {
    view: search.get('view') ?? 'home',
    mode: search.get('mode') === 'light' ? 'light' : 'dark',
  };
}

async function main(): Promise<void> {
  const { view: viewPath, mode } = params();
  const { snapshot, entities } = await loadData();
  const hass = makeMockHass(entities, {
    user: { id: 'dev-admin', name: 'Steven Wong', is_admin: true },
    wsResponses: {
      'config/area_registry/list': snapshot.areas,
      'config/device_registry/list': snapshot.devices,
      'config/entity_registry/list': snapshot.entities,
      'todo/item/list': {
        items: [
          { uid: 'a1', summary: 'Buy milk', status: 'needs_action', due: '2026-08-03' },
          { uid: 'a2', summary: 'Water the plants on the west balcony', status: 'needs_action' },
        ],
      },
    },
    apiResponses: { calendars: [] },
  });

  const style = document.createElement('style');
  style.textContent = HA_GRID_CSS;
  document.head.append(style);

  const dashboard = await QuietLuxeStrategy.generate(
    { type: 'custom:quiet-luxe', home: TUNGCHUNG_CONFIG },
    hass,
  );
  const view = dashboard.views.find((candidate) => candidate.path === viewPath) ?? dashboard.views[0];

  const root = document.createElement('div');
  root.id = 'view-root';
  root.style.cssText = `position:relative;min-height:100vh;${cssVariableBlock(mode)}`;
  root.append(document.createElement('ql-canvas'));
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;padding:0 16px;';
  if (view !== undefined) {
    wrapper.append(renderView(view, hass, window.innerWidth - 32));
  }
  root.append(wrapper);
  document.body.append(root);

  const list = document.createElement('nav');
  list.style.cssText =
    'position:relative;padding:24px 16px;font:400 12px/18px sans-serif;color:var(--ql-ink-muted,#888);';
  list.innerHTML = dashboard.views
    .map((candidate) => `<a href="?view=${candidate.path}&mode=${mode}">${candidate.title}</a>`)
    .join(' · ');
  root.append(list);
  document.documentElement.dataset.qlReady = 'true';
}

void main();
