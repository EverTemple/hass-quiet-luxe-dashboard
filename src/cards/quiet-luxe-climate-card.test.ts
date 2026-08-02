import { afterEach, describe, expect, it, vi } from 'vitest';
import { climateEntity, makeEntity, makeMockHass, sensorEntity } from '../testing/mock-hass';
import type { QlSegmented } from '../elements/ql-segmented';
import type { QlSlider } from '../elements/ql-slider';
import { STEPPER_COMMIT_MS, type QlStepper } from '../elements/ql-stepper';
import type { QlToggle } from '../elements/ql-toggle';
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

/*
 * Inline controls, exercised against the exact entity shapes the live Tung
 * Chung instance returns (HA 2026.7.1) — a Sensibo AC, both halves of a Dyson
 * TP09, and a Xiaomi dehumidifier.
 */

const SENSIBO = makeEntity('climate.steven_bedroom', 'cool', {
  hvac_modes: ['cool', 'heat', 'fan_only', 'dry', 'heat_cool', 'off'],
  min_temp: 17,
  max_temp: 30,
  target_temp_step: 1,
  fan_modes: ['quiet', 'low', 'medium', 'high', 'auto', 'strong'],
  current_temperature: 21.9,
  temperature: 23,
  fan_mode: 'low',
  friendly_name: 'Steven Bedroom',
  supported_features: 937,
});

const DYSON_CLIMATE = makeEntity('climate.tp09', 'off', {
  hvac_modes: ['off', 'cool', 'heat'],
  min_temp: 1,
  max_temp: 37,
  current_temperature: 22.7,
  temperature: 27.0,
  friendly_name: 'TP09',
  supported_features: 385,
});

const DYSON_FAN = makeEntity('fan.tp09', 'off', {
  preset_modes: ['Auto', 'Normal'],
  direction: 'forward',
  oscillating: true,
  percentage: 0,
  percentage_step: 10.0,
  preset_mode: 'Normal',
  angle_low: 142,
  angle_high: 187,
  friendly_name: 'TP09',
  supported_features: 63,
});

const DEHUMIDIFIER = makeEntity('humidifier.dmaker_22ht_b0bf_dehumidifier', 'on', {
  min_humidity: 40,
  max_humidity: 70,
  available_modes: ['Off', 'Smart', 'Sleep', 'Clothes Drying'],
  current_humidity: 63,
  humidity: 60,
  mode: 'Clothes Drying',
  device_class: 'dehumidifier',
  friendly_name: 'Xiaomi Smart Dehumidifier Dehumidifier',
  supported_features: 1,
});

function controlLabels(card: QuietLuxeClimateCard): string[] {
  return [...(card.shadowRoot?.querySelectorAll('.ql-control-label') ?? [])].map(
    (node) => node.textContent?.trim() ?? '',
  );
}

function segmentedFor(card: QuietLuxeClimateCard, label: string): QlSegmented | undefined {
  return [...(card.shadowRoot?.querySelectorAll<QlSegmented>('ql-segmented') ?? [])].find(
    (node) => node.label === label,
  );
}

function segmentButton(group: QlSegmented | undefined, text: string): HTMLButtonElement | undefined {
  return [...(group?.shadowRoot?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find(
    (button) => button.textContent?.trim() === text,
  );
}

describe('quiet-luxe-climate-card more-info', () => {
  it('opens HA’s dialog from the identity region, escaping the shadow root', async () => {
    const card = await mount(
      { entity: 'climate.steven_bedroom' },
      makeMockHass([SENSIBO]),
    );
    const seen: string[] = [];
    document.body.addEventListener('hass-more-info', (event) => {
      seen.push((event as CustomEvent<{ entityId: string }>).detail.entityId);
    });

    card.shadowRoot?.querySelector<HTMLButtonElement>('.ql-info')?.click();

    expect(seen).toEqual(['climate.steven_bedroom']);
  });

  it('does not fire a service call when the identity region is tapped', async () => {
    const hass = makeMockHass([SENSIBO]);
    const card = await mount({ entity: 'climate.steven_bedroom' }, hass);

    card.shadowRoot?.querySelector<HTMLButtonElement>('.ql-info')?.click();

    expect(hass.calls).toEqual([]);
  });

  it('still opens the dialog for a device that is not answering', async () => {
    const card = await mount(
      { entity: 'climate.a' },
      makeMockHass([climateEntity('climate.a', 'unavailable')]),
    );
    const seen: string[] = [];
    document.body.addEventListener('hass-more-info', (event) => {
      seen.push((event as CustomEvent<{ entityId: string }>).detail.entityId);
    });
    const info = card.shadowRoot?.querySelector<HTMLButtonElement>('.ql-info');

    expect(info?.disabled).toBe(false);
    info?.click();
    expect(seen).toEqual(['climate.a']);
  });
});

describe('quiet-luxe-climate-card inline controls: Sensibo AC', () => {
  it('offers target temperature, mode and fan speed', async () => {
    const card = await mount({ entity: 'climate.steven_bedroom' }, makeMockHass([SENSIBO]));
    expect(controlLabels(card)).toEqual(['Target', 'Mode', 'Fan speed']);
  });

  it('sets the target temperature from the entity’s own bounds and step', async () => {
    vi.useFakeTimers();
    const hass = makeMockHass([SENSIBO]);
    const card = await mount({ entity: 'climate.steven_bedroom' }, hass);
    const stepper = card.shadowRoot?.querySelector<QlStepper>('ql-stepper');

    expect(stepper?.min).toBe(17);
    expect(stepper?.max).toBe(30);
    expect(stepper?.step).toBe(1);
    expect(stepper?.value).toBe(23);

    stepper?.shadowRoot?.querySelectorAll('button')[1]?.click();
    vi.advanceTimersByTime(STEPPER_COMMIT_MS);

    expect(hass.calls).toEqual([
      {
        domain: 'climate',
        service: 'set_temperature',
        data: { entity_id: 'climate.steven_bedroom', temperature: 24 },
      },
    ]);
  });

  it('sets an hvac mode, localizing the vocabulary it knows', async () => {
    const hass = makeMockHass([SENSIBO]);
    const card = await mount({ entity: 'climate.steven_bedroom' }, hass);
    const modes = segmentedFor(card, 'Mode');

    expect(modes?.value).toBe('cool');
    expect(
      [...(modes?.shadowRoot?.querySelectorAll('button') ?? [])].map((b) => b.textContent?.trim()),
    ).toEqual(['Cool', 'Heat', 'Fan', 'Dry', 'Auto', 'Off']);

    segmentButton(modes, 'Dry')?.click();

    expect(hass.calls).toEqual([
      {
        domain: 'climate',
        service: 'set_hvac_mode',
        data: { entity_id: 'climate.steven_bedroom', hvac_mode: 'dry' },
      },
    ]);
  });

  it('sets a fan mode, title-casing the vendor’s own vocabulary', async () => {
    const hass = makeMockHass([SENSIBO]);
    const card = await mount({ entity: 'climate.steven_bedroom' }, hass);
    const fan = segmentedFor(card, 'Fan speed');

    expect(fan?.value).toBe('low');
    segmentButton(fan, 'Strong')?.click();

    expect(hass.calls).toEqual([
      {
        domain: 'climate',
        service: 'set_fan_mode',
        data: { entity_id: 'climate.steven_bedroom', fan_mode: 'strong' },
      },
    ]);
  });
});

describe('quiet-luxe-climate-card inline controls: Dyson TP09', () => {
  it('reaches heating and cooling through the climate half', async () => {
    const hass = makeMockHass([DYSON_CLIMATE]);
    const card = await mount({ entity: 'climate.tp09' }, hass);
    const modes = segmentedFor(card, 'Mode');

    expect(
      [...(modes?.shadowRoot?.querySelectorAll('button') ?? [])].map((b) => b.textContent?.trim()),
    ).toEqual(['Off', 'Cool', 'Heat']);

    segmentButton(modes, 'Heat')?.click();

    expect(hass.calls).toEqual([
      {
        domain: 'climate',
        service: 'set_hvac_mode',
        data: { entity_id: 'climate.tp09', hvac_mode: 'heat' },
      },
    ]);
  });

  it('offers no fan speed on the climate half, which does not support one', async () => {
    const card = await mount({ entity: 'climate.tp09' }, makeMockHass([DYSON_CLIMATE]));
    expect(controlLabels(card)).toEqual(['Target', 'Mode']);
  });

  it('offers speed, preset, oscillation, airflow and rotation on the fan half', async () => {
    const card = await mount({ entity: 'fan.tp09' }, makeMockHass([DYSON_FAN]));
    expect(controlLabels(card)).toEqual([
      'Speed',
      'Preset',
      'Oscillate',
      'Airflow',
      'Rotation',
    ]);
  });

  it('sets fan speed on the entity’s own 10% step', async () => {
    const hass = makeMockHass([DYSON_FAN]);
    const card = await mount({ entity: 'fan.tp09' }, hass);
    const slider = card.shadowRoot?.querySelector<QlSlider>('ql-slider');

    expect(slider?.step).toBe(10);
    slider?.dispatchEvent(
      new CustomEvent('ql-change', { detail: { value: 40 }, bubbles: true, composed: true }),
    );

    expect(hass.calls).toEqual([
      { domain: 'fan', service: 'set_percentage', data: { entity_id: 'fan.tp09', percentage: 40 } },
    ]);
  });

  it('switches front and back venting through fan direction', async () => {
    const hass = makeMockHass([DYSON_FAN]);
    const card = await mount({ entity: 'fan.tp09' }, hass);
    const airflow = segmentedFor(card, 'Airflow');

    expect(
      [...(airflow?.shadowRoot?.querySelectorAll('button') ?? [])].map((b) =>
        b.textContent?.trim(),
      ),
    ).toEqual(['Front', 'Back']);
    expect(airflow?.value).toBe('forward');

    segmentButton(airflow, 'Back')?.click();

    expect(hass.calls).toEqual([
      {
        domain: 'fan',
        service: 'set_direction',
        data: { entity_id: 'fan.tp09', direction: 'reverse' },
      },
    ]);
  });

  it('turns oscillation off from the card', async () => {
    const hass = makeMockHass([DYSON_FAN]);
    const card = await mount({ entity: 'fan.tp09' }, hass);
    const toggle = card.shadowRoot?.querySelector<QlToggle>('ql-toggle');

    expect(toggle?.checked).toBe(true);
    toggle?.shadowRoot?.querySelector<HTMLButtonElement>('button')?.click();

    expect(hass.calls).toEqual([
      { domain: 'fan', service: 'oscillate', data: { entity_id: 'fan.tp09', oscillating: false } },
    ]);
  });

  it('widens the rotation sweep around the sweep the device reports', async () => {
    const hass = makeMockHass([DYSON_FAN]);
    const card = await mount({ entity: 'fan.tp09' }, hass);
    const rotation = segmentedFor(card, 'Rotation');

    expect(
      [...(rotation?.shadowRoot?.querySelectorAll('button') ?? [])].map((b) =>
        b.textContent?.trim(),
      ),
    ).toEqual(['45°', '90°', '180°', '350°']);
    expect(rotation?.value).toBe('45');

    segmentButton(rotation, '90°')?.click();

    expect(hass.calls).toEqual([
      {
        domain: 'dyson_local',
        service: 'set_angle',
        data: { entity_id: 'fan.tp09', angle_low: 120, angle_high: 210 },
      },
    ]);
  });

  it('omits rotation for a fan that reports no sweep', async () => {
    const plain = makeEntity('fan.plain', 'on', {
      percentage: 50,
      percentage_step: 1,
      oscillating: false,
      supported_features: 51,
    });
    const card = await mount({ entity: 'fan.plain' }, makeMockHass([plain]));
    expect(controlLabels(card)).toEqual(['Speed', 'Oscillate']);
  });
});

describe('quiet-luxe-climate-card inline controls: dehumidifier', () => {
  it('offers target humidity and mode', async () => {
    const card = await mount(
      { entity: 'humidifier.dmaker_22ht_b0bf_dehumidifier' },
      makeMockHass([DEHUMIDIFIER]),
    );
    expect(controlLabels(card)).toEqual(['Target humidity', 'Mode']);
  });

  it('sets target humidity inside the device’s 40–70% range', async () => {
    vi.useFakeTimers();
    const hass = makeMockHass([DEHUMIDIFIER]);
    const card = await mount({ entity: 'humidifier.dmaker_22ht_b0bf_dehumidifier' }, hass);
    const stepper = card.shadowRoot?.querySelector<QlStepper>('ql-stepper');

    expect(stepper?.min).toBe(40);
    expect(stepper?.max).toBe(70);
    expect(stepper?.value).toBe(60);

    stepper?.shadowRoot?.querySelectorAll('button')[0]?.click();
    vi.advanceTimersByTime(STEPPER_COMMIT_MS);

    expect(hass.calls).toEqual([
      {
        domain: 'humidifier',
        service: 'set_humidity',
        data: { entity_id: 'humidifier.dmaker_22ht_b0bf_dehumidifier', humidity: 59 },
      },
    ]);
  });

  it('sets a vendor mode by its own name', async () => {
    const hass = makeMockHass([DEHUMIDIFIER]);
    const card = await mount({ entity: 'humidifier.dmaker_22ht_b0bf_dehumidifier' }, hass);
    const modes = segmentedFor(card, 'Mode');

    expect(modes?.value).toBe('Clothes Drying');
    segmentButton(modes, 'Smart')?.click();

    expect(hass.calls).toEqual([
      {
        domain: 'humidifier',
        service: 'set_mode',
        data: { entity_id: 'humidifier.dmaker_22ht_b0bf_dehumidifier', mode: 'Smart' },
      },
    ]);
  });
});

describe('quiet-luxe-climate-card control degradation', () => {
  it('draws no controls for a device that is not answering', async () => {
    const offline = makeEntity('climate.steven_bedroom', 'unavailable', SENSIBO.attributes);
    const card = await mount({ entity: 'climate.steven_bedroom' }, makeMockHass([offline]));
    expect(card.shadowRoot?.querySelector('.ql-controls')).toBeNull();
  });

  it('draws no controls for a missing entity', async () => {
    const card = await mount({ entity: 'climate.ghost' }, makeMockHass());
    expect(card.shadowRoot?.querySelector('.ql-controls')).toBeNull();
  });

  it('keeps the card compact for a domain with no inline controls', async () => {
    const card = await mount({ entity: 'switch.exhaust' }, makeMockHass([makeEntity('switch.exhaust', 'on')]));
    expect(card.shadowRoot?.querySelector('.ql-controls')).toBeNull();
    expect(card.shadowRoot?.querySelector('.power')).not.toBeNull();
  });

  it('still lets a setpoint be changed while the device is off', async () => {
    const card = await mount({ entity: 'climate.tp09' }, makeMockHass([DYSON_CLIMATE]));
    const stepper = card.shadowRoot?.querySelector<QlStepper>('ql-stepper');
    expect(stepper?.disabled).toBe(false);
  });
});
