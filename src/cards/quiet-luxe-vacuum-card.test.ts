import { describe, expect, it } from 'vitest';
import { makeEntity, makeMockHass, type MockHass } from '../testing/mock-hass';
import {
  DEFAULT_ROOM_COMMAND,
  QuietLuxeVacuumCard,
  type VacuumCardConfig,
} from './quiet-luxe-vacuum-card';

function vacuumEntity(state = 'cleaning'): ReturnType<typeof makeEntity> {
  return makeEntity('vacuum.robot', state, { friendly_name: 'Robot', battery_level: 76 });
}

const ROOMS_CONFIG: Omit<VacuumCardConfig, 'type'> = {
  entity: 'vacuum.robot',
  rooms: [
    { name: 'Living', params: { segments: [3] } },
    { name: 'Kitchen', command: 'app_zoned_clean', params: { zones: [[1, 2, 3, 4]] } },
  ],
};

async function mount(
  config: Omit<VacuumCardConfig, 'type'>,
  hass: MockHass,
): Promise<QuietLuxeVacuumCard> {
  const card = document.createElement('quiet-luxe-vacuum-card') as QuietLuxeVacuumCard;
  card.setConfig({ type: 'custom:quiet-luxe-vacuum-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

describe('quiet-luxe-vacuum-card', () => {
  it('is registered and requires an entity', () => {
    expect(customElements.get('quiet-luxe-vacuum-card')).toBe(QuietLuxeVacuumCard);
    const card = new QuietLuxeVacuumCard();
    expect(() => card.setConfig({ type: 'x', entity: '' })).toThrow('"entity" is required');
  });

  it('localizes the known vacuum states', async () => {
    const cases: ReadonlyArray<[string, string]> = [
      ['docked', 'Docked'],
      ['cleaning', 'Cleaning'],
      ['returning', 'Returning'],
      ['paused', 'Paused'],
      ['error', 'Error'],
      ['idle', 'Idle'],
    ];
    for (const [state, label] of cases) {
      const card = await mount({ entity: 'vacuum.robot' }, makeMockHass([vacuumEntity(state)]));
      expect(card.shadowRoot?.textContent).toContain(label);
      card.remove();
    }
    const zh = await mount(
      { entity: 'vacuum.robot' },
      makeMockHass([vacuumEntity('cleaning')], 'zh-Hant'),
    );
    expect(zh.shadowRoot?.textContent).toContain('清掃中');
    zh.remove();
  });

  it('shows battery with the localized label', async () => {
    const card = await mount({ entity: 'vacuum.robot' }, makeMockHass([vacuumEntity()]));
    expect(card.shadowRoot?.textContent).toContain('76%');
    expect(card.shadowRoot?.textContent).toContain('Battery');
    card.remove();
  });

  it('room chips send config-driven vacuum.send_command payloads', async () => {
    const hass = makeMockHass([vacuumEntity('docked')]);
    const card = await mount(ROOMS_CONFIG, hass);
    const chips = [...(card.shadowRoot?.querySelectorAll('ql-chip') ?? [])];
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(['Living', 'Kitchen']);
    (chips[0] as HTMLElement).click();
    (chips[1] as HTMLElement).click();
    expect(DEFAULT_ROOM_COMMAND).toBe('app_segment_clean');
    expect(hass.calls).toEqual([
      {
        domain: 'vacuum',
        service: 'send_command',
        data: {
          entity_id: 'vacuum.robot',
          command: 'app_segment_clean',
          params: { segments: [3] },
        },
      },
      {
        domain: 'vacuum',
        service: 'send_command',
        data: {
          entity_id: 'vacuum.robot',
          command: 'app_zoned_clean',
          params: { zones: [[1, 2, 3, 4]] },
        },
      },
    ]);
    card.remove();
  });

  it('unavailable vacuum renders muted with no chips', async () => {
    const card = await mount(
      ROOMS_CONFIG,
      makeMockHass([makeEntity('vacuum.robot', 'unavailable')]),
    );
    expect(card.shadowRoot?.querySelector('.ql-unavailable')).not.toBeNull();
    expect(card.shadowRoot?.querySelectorAll('ql-chip')).toHaveLength(0);
    expect(card.shadowRoot?.textContent).toContain('Unavailable');
    card.remove();
  });
});
