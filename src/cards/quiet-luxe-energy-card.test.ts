import { describe, expect, it } from 'vitest';
import { makeMockHass, sensorEntity, type MockHass } from '../testing/mock-hass';
import {
  DEFAULT_RING_MAX_W,
  QuietLuxeEnergyCard,
  type EnergyCardConfig,
} from './quiet-luxe-energy-card';

async function mount(
  config: Omit<EnergyCardConfig, 'type'>,
  hass: MockHass,
): Promise<QuietLuxeEnergyCard> {
  const card = document.createElement('quiet-luxe-energy-card') as QuietLuxeEnergyCard;
  card.setConfig({ type: 'custom:quiet-luxe-energy-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

describe('quiet-luxe-energy-card', () => {
  it('is registered and validates config', () => {
    expect(customElements.get('quiet-luxe-energy-card')).toBe(QuietLuxeEnergyCard);
    const card = new QuietLuxeEnergyCard();
    expect(() => card.setConfig({ type: 'x', power_entity: '' })).toThrow(
      '"power_entity" is required',
    );
    expect(() =>
      card.setConfig({
        type: 'x',
        power_entity: 'sensor.p',
        form: 'chart' as unknown as 'strip',
      }),
    ).toThrow('apexcharts-card');
  });

  it('strip renders formatted power and localized today energy', async () => {
    const hass = makeMockHass([
      sensorEntity('sensor.power_total', '1236'),
      sensorEntity('sensor.energy_today', '8.61'),
    ]);
    const card = await mount(
      { power_entity: 'sensor.power_total', today_entity: 'sensor.energy_today' },
      hass,
    );
    const text = card.shadowRoot?.textContent ?? '';
    expect(text).toContain('1.24 kW');
    expect(text).toContain('8.6 kWh');
    expect(text).toContain('Today');
    card.remove();
  });

  it('localizes the today label', async () => {
    const hass = makeMockHass(
      [sensorEntity('sensor.power_total', '400'), sensorEntity('sensor.energy_today', '2')],
      'zh-Hant',
    );
    const card = await mount(
      { power_entity: 'sensor.power_total', today_entity: 'sensor.energy_today' },
      hass,
    );
    expect(card.shadowRoot?.textContent).toContain('今日');
    card.remove();
  });

  it('ring renders the phase donut with exact dasharray at 50% of default max', async () => {
    const hass = makeMockHass([sensorEntity('sensor.phase_l1', '2300')]);
    const card = await mount({ form: 'ring', power_entity: 'sensor.phase_l1', name: 'L1' }, hass);
    expect(DEFAULT_RING_MAX_W).toBe(4600);
    const progress = card.shadowRoot?.querySelector('circle.progress');
    expect(progress?.getAttribute('stroke-dasharray')).toBe('62.83 125.66');
    expect(card.shadowRoot?.textContent).toContain('L1');
    expect(card.shadowRoot?.textContent).toContain('2.30 kW');
    card.remove();
  });

  it('unavailable power renders muted placeholders', async () => {
    const hass = makeMockHass([sensorEntity('sensor.power_total', 'unavailable')]);
    const card = await mount({ power_entity: 'sensor.power_total' }, hass);
    expect(card.shadowRoot?.querySelector('.ql-unavailable')).not.toBeNull();
    expect(card.shadowRoot?.textContent).toContain('—');
    card.remove();
  });

  it('the strip reading opens HA’s more-info dialog for the power entity', async () => {
    const hass = makeMockHass([
      sensorEntity('sensor.power_total', '1236'),
      sensorEntity('sensor.energy_today', '8.61'),
    ]);
    const card = await mount(
      { power_entity: 'sensor.power_total', today_entity: 'sensor.energy_today' },
      hass,
    );
    const seen: Array<CustomEvent<{ entityId: string }>> = [];
    const record = (event: Event): void => {
      seen.push(event as CustomEvent<{ entityId: string }>);
    };
    document.body.addEventListener('hass-more-info', record);
    card.shadowRoot?.querySelector<HTMLButtonElement>('.ql-info')?.click();
    document.body.removeEventListener('hass-more-info', record);
    expect(seen.map((event) => event.detail.entityId)).toEqual(['sensor.power_total']);
    expect(seen[0]?.bubbles).toBe(true);
    expect(seen[0]?.composed).toBe(true);
    card.remove();
  });

  it('the ring reading opens more-info for its own phase entity', async () => {
    const hass = makeMockHass([sensorEntity('sensor.phase_l1', '2300')]);
    const card = await mount({ form: 'ring', power_entity: 'sensor.phase_l1', name: 'L1' }, hass);
    const seen: string[] = [];
    const record = (event: Event): void => {
      seen.push((event as CustomEvent<{ entityId: string }>).detail.entityId);
    };
    document.body.addEventListener('hass-more-info', record);
    card.shadowRoot?.querySelector<HTMLButtonElement>('.ql-info')?.click();
    document.body.removeEventListener('hass-more-info', record);
    expect(seen).toEqual(['sensor.phase_l1']);
    card.remove();
  });
});
