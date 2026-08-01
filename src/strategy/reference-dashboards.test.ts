import { describe, expect, it } from 'vitest';
import { makeMockHass } from '../testing/mock-hass';
import { referenceHome, type ReferenceHomeName } from '../testing/mock-registry';
import type { HomeConfig } from './config';
import { QuietLuxeStrategy } from './quiet-luxe-strategy';
import { SUBANG_CONFIG, TUNGCHUNG_CONFIG, XIAMEN_CONFIG } from './reference-homes';
import type { LovelaceDashboardConfig } from './types';

const ADMIN = { id: 'admin-1', name: 'Steven', is_admin: true };

async function generateFor(
  name: ReferenceHomeName,
  home: HomeConfig,
  user: { id: string; name: string; is_admin: boolean } = ADMIN,
): Promise<LovelaceDashboardConfig> {
  const { snapshot, entities } = referenceHome(name);
  const hass = makeMockHass(entities, {
    user,
    wsResponses: {
      'config/area_registry/list': snapshot.areas,
      'config/device_registry/list': snapshot.devices,
      'config/entity_registry/list': snapshot.entities,
    },
  });
  return QuietLuxeStrategy.generate({ type: 'custom:quiet-luxe', home }, hass);
}

function cardTypes(dashboard: LovelaceDashboardConfig): ReadonlyArray<string> {
  return dashboard.views.flatMap((view) =>
    view.sections.flatMap((section) => section.cards.map((card) => card.type)),
  );
}

function carBrand(dashboard: LovelaceDashboardConfig): unknown {
  const carView = dashboard.views.find((view) => view.path === 'car');
  return carView?.sections[0]?.cards.find((card) => card.type === 'custom:quiet-luxe-car-card')
    ?.brand;
}

describe('reference-home dashboards (spec §2 matrix)', () => {
  it('energy view exists only for Subang', async () => {
    const subang = await generateFor('subang', SUBANG_CONFIG);
    const tungchung = await generateFor('tungchung', TUNGCHUNG_CONFIG);
    const xiamen = await generateFor('xiamen', XIAMEN_CONFIG);
    expect(subang.views.map((view) => view.path)).toContain('energy');
    expect(tungchung.views.map((view) => view.path)).not.toContain('energy');
    expect(xiamen.views.map((view) => view.path)).not.toContain('energy');
  });

  it('schedule cards exist for Subang and Tung Chung, never for Xiamen', async () => {
    expect(cardTypes(await generateFor('subang', SUBANG_CONFIG))).toContain(
      'custom:quiet-luxe-schedule-card',
    );
    expect(cardTypes(await generateFor('tungchung', TUNGCHUNG_CONFIG))).toContain(
      'custom:quiet-luxe-schedule-card',
    );
    expect(cardTypes(await generateFor('xiamen', XIAMEN_CONFIG))).not.toContain(
      'custom:quiet-luxe-schedule-card',
    );
  });

  it('vacuum card exists only for Xiamen', async () => {
    expect(cardTypes(await generateFor('xiamen', XIAMEN_CONFIG))).toContain(
      'custom:quiet-luxe-vacuum-card',
    );
    expect(cardTypes(await generateFor('subang', SUBANG_CONFIG))).not.toContain(
      'custom:quiet-luxe-vacuum-card',
    );
  });

  it('car brands follow the matrix', async () => {
    expect(carBrand(await generateFor('subang', SUBANG_CONFIG))).toBe('bmw');
    expect(carBrand(await generateFor('tungchung', TUNGCHUNG_CONFIG))).toBe('audi');
    expect(carBrand(await generateFor('xiamen', XIAMEN_CONFIG))).toBe('liauto');
  });

  it('Sonos group rows only for the media_rich home', async () => {
    const withGroups = (dashboard: LovelaceDashboardConfig): boolean =>
      dashboard.views.some((view) =>
        view.sections.some((section) =>
          section.cards.some((card) => card.form === 'group-row'),
        ),
      );
    expect(withGroups(await generateFor('subang', SUBANG_CONFIG))).toBe(true);
    expect(withGroups(await generateFor('tungchung', TUNGCHUNG_CONFIG))).toBe(false);
  });

  it('guest kiosk dashboards never contain admin/car views or motion toggles', async () => {
    const kiosk = { id: 'k1', name: 'kiosk', is_admin: false };
    for (const [name, home] of [
      ['subang', SUBANG_CONFIG],
      ['tungchung', TUNGCHUNG_CONFIG],
      ['xiamen', XIAMEN_CONFIG],
    ] as const) {
      const dashboard = await generateFor(name, home, kiosk);
      const paths = dashboard.views.map((view) => view.path);
      expect(paths).not.toContain('admin');
      expect(paths).not.toContain('car');
      const motionRows = dashboard.views.flatMap((view) =>
        view.sections.flatMap((section) =>
          section.cards.filter((card) => card.kind === 'motion'),
        ),
      );
      expect(motionRows.every((row) => row.show_toggle === false)).toBe(true);
    }
  });

  it('full dashboards match their snapshots', async () => {
    expect(await generateFor('subang', SUBANG_CONFIG)).toMatchSnapshot('subang');
    expect(await generateFor('tungchung', TUNGCHUNG_CONFIG)).toMatchSnapshot('tungchung');
    expect(await generateFor('xiamen', XIAMEN_CONFIG)).toMatchSnapshot('xiamen');
  });
});
