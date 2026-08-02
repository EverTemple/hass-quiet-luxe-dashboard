import { afterEach, describe, expect, it, vi } from 'vitest';
import { climateEntity, makeEntity, makeMockHass, sensorEntity } from '../testing/mock-hass';
import { QuietLuxeClimateCard, type ClimateCardConfig } from './quiet-luxe-climate-card';

async function mount(
  config: Partial<ClimateCardConfig> & { entity: string },
  hass = makeMockHass(),
): Promise<QuietLuxeClimateCard> {
  const card = document.createElement('quiet-luxe-climate-card') as QuietLuxeClimateCard;
  card.setConfig({ type: 'custom:quiet-luxe-climate-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('quiet-luxe-climate-card', () => {
  it('registers element + picker entry, requires entity, sizes 2x4', () => {
    expect(customElements.get('quiet-luxe-climate-card')).toBe(QuietLuxeClimateCard);
    expect((window.customCards ?? []).map((e) => e.type)).toContain('quiet-luxe-climate-card');
    const card = new QuietLuxeClimateCard();
    expect(() =>
      card.setConfig({ type: 'custom:quiet-luxe-climate-card', entity: '' }),
    ).toThrow(/entity/);
    card.setConfig({ type: 'custom:quiet-luxe-climate-card', entity: 'climate.a' });
    expect(card.getCardSize()).toBe(2);
    expect(card.getGridOptions()).toEqual({ rows: 'auto', columns: 6 });
  });

  it('auto-detects device type from domain, with config override', async () => {
    const ac = await mount(
      { entity: 'climate.living_ac' },
      makeMockHass([climateEntity('climate.living_ac')]),
    );
    expect(ac.deviceType()).toBe('ac');
    expect(ac.shadowRoot?.querySelector<HTMLElement>('.ql-card')?.dataset.device).toBe('ac');
    const purifier = await mount(
      { entity: 'fan.dyson', device_type: 'purifier' },
      makeMockHass([makeEntity('fan.dyson', 'on')]),
    );
    expect(purifier.deviceType()).toBe('purifier');
  });

  it('shows current temperature for ACs and localized activity states', async () => {
    const hass = makeMockHass([
      climateEntity('climate.a', 'cool', { current_temperature: 24.5, hvac_action: 'cooling' }),
    ]);
    const card = await mount({ entity: 'climate.a' }, hass);
    expect(card.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('24.5°');
    expect(card.shadowRoot?.querySelector('.status')?.textContent?.trim()).toBe('Active');
    expect(card.shadowRoot?.querySelector('.status')?.classList.contains('accent')).toBe(true);
  });

  it('idle and off states render muted', async () => {
    const idle = await mount(
      { entity: 'climate.a' },
      makeMockHass([climateEntity('climate.a', 'cool', { hvac_action: 'idle' })]),
    );
    expect(idle.shadowRoot?.querySelector('.status')?.textContent?.trim()).toBe('Idle');
    const off = await mount(
      { entity: 'fan.a' },
      makeMockHass([makeEntity('fan.a', 'off')]),
    );
    expect(off.shadowRoot?.querySelector('.status')?.textContent?.trim()).toBe('Off');
    expect(off.shadowRoot?.querySelector('.status')?.classList.contains('muted')).toBe(true);
    expect(off.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('Off');
  });

  it('reads the numeral from value_entity when configured (purifier AQI)', async () => {
    const hass = makeMockHass([
      makeEntity('fan.dyson', 'on'),
      sensorEntity('sensor.dyson_aqi', '18'),
    ]);
    const card = await mount(
      { entity: 'fan.dyson', device_type: 'purifier', value_entity: 'sensor.dyson_aqi' },
      hass,
    );
    expect(card.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('18');
  });

  it('power tap toggles: climate uses turn_on/turn_off, others domain toggle', async () => {
    const offAc = makeMockHass([climateEntity('climate.a', 'off')]);
    const card = await mount({ entity: 'climate.a' }, offAc);
    card.shadowRoot?.querySelector<HTMLButtonElement>('.power')?.click();
    expect(offAc.calls).toEqual([
      { domain: 'climate', service: 'turn_on', data: { entity_id: 'climate.a' } },
    ]);
    const fanHass = makeMockHass([makeEntity('fan.a', 'on')]);
    const fanCard = await mount({ entity: 'fan.a' }, fanHass);
    fanCard.shadowRoot?.querySelector<HTMLButtonElement>('.power')?.click();
    expect(fanHass.calls).toEqual([
      { domain: 'fan', service: 'toggle', data: { entity_id: 'fan.a' } },
    ]);
  });

  it('confirm: first tap arms (no call), second tap executes, 3s disarms', async () => {
    vi.useFakeTimers();
    const hass = makeMockHass([makeEntity('switch.exhaust', 'on')]);
    const card = await mount({ entity: 'switch.exhaust', confirm: true }, hass);
    const power = (): HTMLButtonElement | null | undefined =>
      card.shadowRoot?.querySelector<HTMLButtonElement>('.power');
    power()?.click();
    await card.updateComplete;
    expect(hass.calls).toEqual([]);
    expect(card.shadowRoot?.querySelector('.status')?.textContent?.trim()).toBe(
      'Tap again to confirm',
    );
    power()?.click();
    await card.updateComplete;
    expect(hass.calls).toEqual([
      { domain: 'switch', service: 'toggle', data: { entity_id: 'switch.exhaust' } },
    ]);
    power()?.click();
    await card.updateComplete;
    vi.advanceTimersByTime(3000);
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector('.status')?.textContent?.trim()).toBe('Active');
    expect(hass.calls).toHaveLength(1);
  });

  it('unavailable renders muted with disabled power; missing renders the placeholder', async () => {
    const unavailable = await mount(
      { entity: 'climate.a' },
      makeMockHass([climateEntity('climate.a', 'unavailable')]),
    );
    expect(
      unavailable.shadowRoot?.querySelector('.ql-card')?.classList.contains('ql-unavailable'),
    ).toBe(true);
    expect(unavailable.shadowRoot?.querySelector('.status')?.textContent?.trim()).toBe(
      'Unavailable',
    );
    expect(unavailable.shadowRoot?.querySelector<HTMLButtonElement>('.power')?.disabled).toBe(
      true,
    );
    const missing = await mount({ entity: 'climate.ghost' }, makeMockHass());
    expect(missing.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('—');
    expect(
      missing.shadowRoot?.querySelector('.ql-card')?.classList.contains('ql-unavailable'),
    ).toBe(true);
  });
});
