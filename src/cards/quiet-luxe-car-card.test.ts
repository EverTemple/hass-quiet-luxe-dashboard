import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeEntity, makeMockHass, sensorEntity, type MockHass } from '../testing/mock-hass';
import { CAR_BODY_PATHS } from './car-silhouettes';
import { CONFIRM_TIMEOUT_MS } from './quiet-luxe-climate-card';
import { QuietLuxeCarCard, type CarCardConfig } from './quiet-luxe-car-card';

function carEntities(): ReturnType<typeof makeEntity>[] {
  return [
    sensorEntity('sensor.car_battery', '76'),
    sensorEntity('sensor.car_fuel', '55'),
    sensorEntity('sensor.car_range', '412', { unit_of_measurement: 'km' }),
    makeEntity('binary_sensor.car_lock', 'off', { device_class: 'lock' }),
    makeEntity('switch.car_precondition', 'off'),
    sensorEntity('sensor.car_location', 'Subang Jaya'),
  ];
}

const FULL_CONFIG: Omit<CarCardConfig, 'type'> = {
  brand: 'liauto',
  name: 'Li Auto L7',
  battery_entity: 'sensor.car_battery',
  fuel_entity: 'sensor.car_fuel',
  range_entity: 'sensor.car_range',
  lock_entity: 'binary_sensor.car_lock',
  precondition_entity: 'switch.car_precondition',
  location_entity: 'sensor.car_location',
};

async function mount(
  config: Omit<CarCardConfig, 'type'>,
  hass: MockHass,
): Promise<QuietLuxeCarCard> {
  const card = document.createElement('quiet-luxe-car-card') as QuietLuxeCarCard;
  card.setConfig({ type: 'custom:quiet-luxe-car-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

describe('quiet-luxe-car-card', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is registered and validates brand', () => {
    expect(customElements.get('quiet-luxe-car-card')).toBe(QuietLuxeCarCard);
    const card = new QuietLuxeCarCard();
    expect(() =>
      card.setConfig({ type: 'x', brand: 'tesla' as unknown as 'bmw' }),
    ).toThrow('brand must be one of');
  });

  it('renders the brand silhouette in ink via currentColor', async () => {
    const card = await mount(FULL_CONFIG, makeMockHass(carEntities()));
    const path = card.shadowRoot?.querySelector('svg.hero path');
    expect(path?.getAttribute('d')).toBe(CAR_BODY_PATHS.liauto);
    expect(path?.getAttribute('fill')).toBe('currentColor');
    expect(card.shadowRoot?.querySelectorAll('svg.hero circle')).toHaveLength(2);
    card.remove();
  });

  it('renders battery, fuel, range with units and localized labels', async () => {
    const card = await mount(FULL_CONFIG, makeMockHass(carEntities()));
    const text = card.shadowRoot?.textContent ?? '';
    expect(text).toContain('76%');
    expect(text).toContain('55%');
    expect(text).toContain('412 km');
    expect(text).toContain('Battery');
    expect(text).toContain('Fuel');
    expect(text).toContain('Range');
    expect(text).toContain('Subang Jaya');
    card.remove();
  });

  it('maps binary_sensor lock semantics (off = locked)', async () => {
    const locked = await mount(FULL_CONFIG, makeMockHass(carEntities()));
    expect(locked.shadowRoot?.textContent).toContain('Locked');
    locked.remove();
    const entities = carEntities().map((entity) =>
      entity.entity_id === 'binary_sensor.car_lock' ? { ...entity, state: 'on' } : entity,
    );
    const unlocked = await mount(FULL_CONFIG, makeMockHass(entities, 'zh-Hant'));
    expect(unlocked.shadowRoot?.textContent).toContain('未上鎖');
    unlocked.remove();
  });

  it('precondition toggle arms first, then toggles the switch on confirm', async () => {
    const hass = makeMockHass(carEntities());
    const card = await mount(FULL_CONFIG, hass);
    const toggle = card.shadowRoot?.querySelector('ql-toggle');
    const change = (): boolean | undefined =>
      toggle?.dispatchEvent(
        new CustomEvent('ql-change', { detail: { checked: true }, bubbles: true, composed: true }),
      );
    change();
    await card.updateComplete;
    expect(hass.calls).toEqual([]);
    expect(card.shadowRoot?.textContent).toContain('Tap again to confirm');
    change();
    expect(hass.calls).toEqual([
      { domain: 'switch', service: 'toggle', data: { entity_id: 'switch.car_precondition' } },
    ]);
    card.remove();
  });

  it('disarms after the confirm timeout', async () => {
    const hass = makeMockHass(carEntities());
    const card = await mount(FULL_CONFIG, hass);
    card.shadowRoot
      ?.querySelector('ql-toggle')
      ?.dispatchEvent(
        new CustomEvent('ql-change', { detail: { checked: true }, bubbles: true, composed: true }),
      );
    vi.advanceTimersByTime(CONFIRM_TIMEOUT_MS);
    await card.updateComplete;
    expect(card.shadowRoot?.textContent).not.toContain('Tap again to confirm');
    expect(hass.calls).toEqual([]);
    card.remove();
  });

  it('omits unconfigured stats and placeholders unavailable ones', async () => {
    const minimal = await mount(
      { brand: 'bmw', battery_entity: 'sensor.car_battery' },
      makeMockHass([sensorEntity('sensor.car_battery', 'unavailable')]),
    );
    const text = minimal.shadowRoot?.textContent ?? '';
    expect(text).toContain('—');
    expect(text).not.toContain('Fuel');
    expect(text).not.toContain('Range');
    expect(minimal.shadowRoot?.querySelector('ql-toggle')).toBeNull();
    minimal.remove();
  });
});
