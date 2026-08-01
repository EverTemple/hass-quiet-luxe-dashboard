import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMockHass, type MockHass } from '../testing/mock-hass';
import { referenceHome, type ReferenceHomeName } from '../testing/mock-registry';
import { SUBANG_CONFIG, TUNGCHUNG_CONFIG } from './reference-homes';
import {
  QuietLuxeStrategy,
  STRATEGY_ELEMENT_TAG,
  type QuietLuxeStrategyConfig,
} from './quiet-luxe-strategy';

function hassFor(
  name: ReferenceHomeName,
  user: { id: string; name: string; is_admin: boolean } | undefined = {
    id: 'admin-1',
    name: 'Steven',
    is_admin: true,
  },
): MockHass {
  const { snapshot, entities } = referenceHome(name);
  return makeMockHass(entities, {
    user,
    wsResponses: {
      'config/area_registry/list': snapshot.areas,
      'config/device_registry/list': snapshot.devices,
      'config/entity_registry/list': snapshot.entities,
    },
  });
}

function strategyConfig(home: unknown): QuietLuxeStrategyConfig {
  return { type: 'custom:quiet-luxe', home };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('QuietLuxeStrategy.generate', () => {
  it('produces the full admin dashboard for Subang', async () => {
    const dashboard = await QuietLuxeStrategy.generate(
      strategyConfig(SUBANG_CONFIG),
      hassFor('subang'),
    );
    expect(dashboard.title).toBe('Subang Jaya');
    expect(dashboard.views.map((view) => view.path)).toEqual([
      'home',
      'room-main_living',
      'room-side_living',
      'room-master_bedroom',
      'media',
      'security',
      'energy',
      'climates',
      'car',
      'admin',
      'language',
    ]);
  });

  it('filters views for the guest kiosk user and applies the kiosk language', async () => {
    const kiosk = { id: 'k1', name: 'kiosk', is_admin: false };
    const dashboard = await QuietLuxeStrategy.generate(
      strategyConfig(TUNGCHUNG_CONFIG),
      hassFor('tungchung', kiosk),
    );
    const paths = dashboard.views.map((view) => view.path);
    expect(paths).not.toContain('admin');
    expect(paths).not.toContain('car');
    const home = dashboard.views[0];
    expect(home?.title).toBe('首頁'); // kiosk default zh-Hant wins for guests
    expect(home?.sections[0]?.cards[0]).toMatchObject({ show_greeting: false });
  });

  it('falls back to a diagnostic view on malformed config, logging loudly', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const dashboard = await QuietLuxeStrategy.generate(
      strategyConfig({ name: 'X', engery: true }),
      hassFor('subang'),
    );
    expect(error).toHaveBeenCalledOnce();
    expect(dashboard.views).toHaveLength(1);
    const card = dashboard.views[0]?.sections[0]?.cards[0];
    expect(card?.type).toBe('markdown');
    expect(String(card?.content)).toContain('engery'); // admin sees the message
  });

  it('hides error detail from non-admins in the fallback view', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const dashboard = await QuietLuxeStrategy.generate(
      strategyConfig({ name: 'X', engery: true }),
      hassFor('subang', { id: 'k1', name: 'kiosk', is_admin: false }),
    );
    expect(String(dashboard.views[0]?.sections[0]?.cards[0]?.content)).not.toContain('engery');
  });

  it('falls back when the registry read fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const hass = makeMockHass([], { user: { id: 'a', name: 'Steven', is_admin: true } });
    const dashboard = await QuietLuxeStrategy.generate(strategyConfig(SUBANG_CONFIG), hass);
    expect(error).toHaveBeenCalledOnce();
    expect(dashboard.views).toHaveLength(1); // never a white screen
  });

  it('registers the strategy element and picker metadata', () => {
    expect(customElements.get(STRATEGY_ELEMENT_TAG)).toBe(QuietLuxeStrategy);
    expect(window.customStrategies?.some((entry) => entry.type === 'quiet-luxe')).toBe(true);
  });
});
