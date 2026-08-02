import { afterEach, describe, expect, it } from 'vitest';
import { QuietLuxeFanCard, type FanCardConfig } from './quiet-luxe-fan-card';
import { makeEntity, makeMockHass, sensorEntity, type MockHass } from '../testing/mock-hass';
import type { QlDialButton } from '../elements/ql-dial-button';
import type { QlPresetRow } from '../elements/ql-preset-row';
import type { QlSweepDial } from '../elements/ql-sweep-dial';
import type { QlSheet } from '../elements/ql-sheet';
import type { HassEntity } from '../types/home-assistant';

afterEach(() => {
  document.body.innerHTML = '';
});

/** Live Tung Chung TP09 (HA 2026.7.1, probed 2026-08-02). */
function dysonFan(overrides: Record<string, unknown> = {}, state = 'on'): HassEntity {
  return makeEntity('fan.tp09', state, {
    preset_modes: ['Auto', 'Normal'],
    direction: 'forward',
    oscillating: true,
    percentage: 20,
    percentage_step: 10,
    preset_mode: 'Normal',
    angle_low: 135,
    angle_high: 225,
    friendly_name: 'TP09',
    supported_features: 63,
    ...overrides,
  });
}

function dysonClimate(state = 'cool'): HassEntity {
  return makeEntity('climate.tp09', state, {
    hvac_modes: ['off', 'cool', 'heat'],
    min_temp: 1,
    max_temp: 37,
    current_temperature: 24.2,
    temperature: 27,
    friendly_name: 'TP09',
    supported_features: 385,
  });
}

const SERVICES = { dyson_local: { set_angle: {}, set_timer: {} }, fan: { turn_on: {} } };

const FULL_CONFIG: FanCardConfig = {
  type: 'custom:quiet-luxe-fan-card',
  entity: 'fan.tp09',
  climate_entity: 'climate.tp09',
  night_mode_entity: 'switch.tp09_night_mode',
  temperature_entity: 'sensor.tp09_temperature',
  aqi_entity: 'sensor.tp09_pm_2_5',
  platform: 'dyson_local',
  form: 'full',
};

async function mount(
  config: Partial<FanCardConfig> = {},
  entities = [
    dysonFan(),
    dysonClimate(),
    makeEntity('switch.tp09_night_mode', 'off'),
    sensorEntity('sensor.tp09_temperature', '21.9', { device_class: 'temperature' }),
    sensorEntity('sensor.tp09_pm_2_5', '12', { device_class: 'pm25' }),
  ],
): Promise<{ card: QuietLuxeFanCard; hass: MockHass }> {
  const card = document.createElement('quiet-luxe-fan-card') as QuietLuxeFanCard;
  card.setConfig({ ...FULL_CONFIG, ...config });
  const hass = makeMockHass(entities) as MockHass & { services?: unknown };
  hass.services = SERVICES;
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return { card, hass };
}

function dials(card: QuietLuxeFanCard): QlDialButton[] {
  return [...(card.shadowRoot?.querySelectorAll<QlDialButton>('ql-dial-button') ?? [])];
}

function dialByLabel(card: QuietLuxeFanCard, label: string): QlDialButton {
  const found = dials(card).find((dial) => dial.label === label);
  if (found === undefined) {
    throw new Error(`no dial labelled ${label}; got ${dials(card).map((d) => d.label).join(', ')}`);
  }
  return found;
}

function tap(dial: QlDialButton): void {
  dial.shadowRoot?.querySelector('button')?.click();
}

async function openSheet(card: QuietLuxeFanCard, label: string): Promise<void> {
  tap(dialByLabel(card, label));
  await card.updateComplete;
}

function sheetButton(card: QuietLuxeFanCard, text: string): HTMLElement {
  const buttons = [...(card.shadowRoot?.querySelectorAll<HTMLElement>('ql-sheet-button') ?? [])];
  const found = buttons.find((b) => b.textContent?.trim() === text);
  if (found === undefined) {
    throw new Error(`no sheet button "${text}"`);
  }
  return found;
}

describe('quiet-luxe-fan-card config', () => {
  it('is registered and listed for the card picker', () => {
    expect(customElements.get('quiet-luxe-fan-card')).toBe(QuietLuxeFanCard);
    expect(window.customCards?.some((c) => c.type === 'quiet-luxe-fan-card')).toBe(true);
  });

  it('requires an entity', () => {
    const card = document.createElement('quiet-luxe-fan-card') as QuietLuxeFanCard;
    expect(() => card.setConfig({ type: 'x', entity: '' })).toThrow(/"entity" is required/);
  });

  it('rejects a non-fan entity rather than rendering a broken card', () => {
    const card = document.createElement('quiet-luxe-fan-card') as QuietLuxeFanCard;
    expect(() => card.setConfig({ type: 'x', entity: 'climate.tp09' })).toThrow(/must be a fan/);
  });

  it('defaults to the compact form and sizes accordingly', () => {
    const card = document.createElement('quiet-luxe-fan-card') as QuietLuxeFanCard;
    card.setConfig({ type: 'x', entity: 'fan.tp09' });
    expect(card.form()).toBe('compact');
    expect(card.getGridOptions()).toEqual({ columns: 6, rows: 'auto' });
    card.setConfig({ type: 'x', entity: 'fan.tp09', form: 'full' });
    expect(card.getGridOptions()).toEqual({ columns: 12, rows: 'auto' });
  });
});

describe('quiet-luxe-fan-card header', () => {
  it('reads the device name, its temperature and its air quality', async () => {
    const { card } = await mount();
    expect(card.shadowRoot?.querySelector('.eyebrow')?.textContent?.trim()).toBe('TP09');
    const numerals = [...(card.shadowRoot?.querySelectorAll('.numeral') ?? [])].map((n) =>
      n.textContent?.trim(),
    );
    expect(numerals).toEqual(['21.9°', '12']);
  });

  it('falls back to the climate entity’s reading with no temperature sensor', async () => {
    const { card } = await mount({ temperature_entity: undefined });
    expect(card.shadowRoot?.querySelector('.numeral')?.textContent?.trim()).toBe('24.2°');
  });

  it('tones the status dot from the air-quality reading', async () => {
    const { card } = await mount();
    expect(card.shadowRoot?.querySelector('ql-status-dot')?.getAttribute('status')).toBe('good');
  });

  it('omits the air-quality block when the device has no such sensor', async () => {
    const { card } = await mount({ aqi_entity: undefined });
    expect(card.shadowRoot?.querySelector('.air')).toBeNull();
  });

  it('appends the room only when one is configured', async () => {
    const { card } = await mount({ area: 'Bedroom' });
    expect(card.shadowRoot?.querySelector('.eyebrow')?.textContent?.trim()).toBe('TP09 · Bedroom');
  });
});

describe('quiet-luxe-fan-card capability gating', () => {
  it('draws the full nine-dial grid for a fully featured device', async () => {
    const { card } = await mount();
    expect(dials(card).map((d) => d.label)).toEqual([
      'Power',
      'Cooling',
      'Auto',
      'Speed',
      'Heating',
      'Oscillation',
      'Timer',
      'Night',
      'Direction',
    ]);
  });

  it('drops climate dials when there is no climate sibling', async () => {
    const { card } = await mount({ climate_entity: undefined });
    const labels = dials(card).map((d) => d.label);
    expect(labels).not.toContain('Cooling');
    expect(labels).not.toContain('Heating');
  });

  it('drops night mode when the device has no such switch', async () => {
    const { card } = await mount({ night_mode_entity: undefined });
    expect(dials(card).map((d) => d.label)).not.toContain('Night');
  });

  /** The timer service is the only evidence the timer exists — it is write-only. */
  it('drops the timer when the integration never registered the service', async () => {
    const card = document.createElement('quiet-luxe-fan-card') as QuietLuxeFanCard;
    card.setConfig(FULL_CONFIG);
    card.hass = makeMockHass([dysonFan(), dysonClimate()]);
    document.body.append(card);
    await card.updateComplete;
    expect(dials(card).map((d) => d.label)).not.toContain('Timer');
  });

  /**
   * hass.services is instance-wide. A timer dial on every fan in the house
   * because one integration happens to offer set_timer would be a dead control
   * on all but the device that integration provides.
   */
  it('does not lend one integration’s timer to a fan from another', async () => {
    const { card } = await mount({ platform: 'esphome' });
    expect(dials(card).map((d) => d.label)).not.toContain('Timer');
  });

  it('drops speed, oscillation and direction for a bare fan', async () => {
    const { card } = await mount(
      { climate_entity: undefined, night_mode_entity: undefined, platform: undefined },
      [dysonFan({ supported_features: 48, preset_modes: undefined })],
    );
    expect(dials(card).map((d) => d.label)).toEqual(['Power']);
  });

  it('shows three primaries and a More button in the compact form', async () => {
    const { card } = await mount({ form: 'compact' });
    expect(dials(card).map((d) => d.label)).toEqual(['Power', 'Auto', 'Oscillation', 'More']);
  });
});

describe('quiet-luxe-fan-card layout', () => {
  /**
   * A 64px dial cannot shrink — it is a thumb target. In a half-width column on
   * a phone four of them overflowed the card and overlapped, and their labels
   * ran together. The grid wraps on the card's own width instead.
   */
  it('wraps the dial grid on the card’s width rather than squeezing the dials', () => {
    const cssText = QuietLuxeFanCard.styles.toString();
    expect(cssText).toContain('container-type: inline-size');
    expect(cssText).toContain('@container (max-width: 303px)');
    expect(cssText).toContain('@container (max-width: 223px)');
    expect(cssText).toContain('@container (max-width: 143px)');
  });

  /* Live at 1680 the card sat in a ~140px column and the header clamped "TP09"
     to "T…" so the fixed-width AIR QUALITY label could keep its row. */
  it('stacks the header readings before the device name can be clamped away', () => {
    const cssText = QuietLuxeFanCard.styles.toString().replace(/\s+/g, ' ');
    const narrow = cssText.slice(cssText.indexOf('@container (max-width: 223px)'));
    expect(narrow).toContain('.header { flex-direction: column; align-items: flex-start; }');
  });
});

describe('quiet-luxe-fan-card dial state', () => {
  it('lights the power dial while the fan runs', async () => {
    const { card } = await mount();
    expect(dialByLabel(card, 'Power').state).toBe('on');
    expect(dialByLabel(card, 'Power').stateWord).toBe('ON');
  });

  it('shows the sweep width on the oscillation dial', async () => {
    const { card } = await mount();
    expect(dialByLabel(card, 'Oscillation').stateWord).toBe('90°');
    expect(dialByLabel(card, 'Oscillation').state).toBe('on');
  });

  it('shows OFF on the oscillation dial when the fan is not sweeping', async () => {
    const { card } = await mount({}, [dysonFan({ oscillating: false }), dysonClimate()]);
    expect(dialByLabel(card, 'Oscillation').stateWord).toBe('OFF');
  });

  it('shows the speed as a step on the device’s own grid', async () => {
    const { card } = await mount();
    expect(dialByLabel(card, 'Speed').stateWord).toBe('2');
  });

  it('puts the auto dial into its own state only while auto is selected', async () => {
    const { card } = await mount();
    expect(dialByLabel(card, 'Auto').state).toBe('off');
    const { card: auto } = await mount({}, [dysonFan({ preset_mode: 'Auto' }), dysonClimate()]);
    expect(dialByLabel(auto, 'Auto').state).toBe('auto');
  });

  /**
   * An off dial that still reads AUTO looks like auto is running — every other
   * dial says OFF when it is off.
   */
  it('reads OFF on the auto dial while the device is on its manual preset', async () => {
    const { card } = await mount();
    expect(dialByLabel(card, 'Auto').stateWord).toBe('OFF');
    const { card: auto } = await mount({}, [dysonFan({ preset_mode: 'Auto' }), dysonClimate()]);
    expect(dialByLabel(auto, 'Auto').stateWord).toBe('AUTO');
  });

  it('mirrors the climate entity on the cooling and heating dials', async () => {
    const { card } = await mount();
    expect(dialByLabel(card, 'Cooling').state).toBe('on');
    expect(dialByLabel(card, 'Heating').state).toBe('off');
  });

  it('shows the airflow direction as a word', async () => {
    const { card } = await mount();
    expect(dialByLabel(card, 'Direction').stateWord).toBe('FRONT');
    const { card: back } = await mount({}, [dysonFan({ direction: 'reverse' }), dysonClimate()]);
    expect(dialByLabel(back, 'Direction').stateWord).toBe('BACK');
  });
});

describe('quiet-luxe-fan-card direct actions', () => {
  it('toggles the fan from the power dial', async () => {
    const { card, hass } = await mount();
    tap(dialByLabel(card, 'Power'));
    expect(hass.calls).toEqual([
      { domain: 'fan', service: 'turn_off', data: { entity_id: 'fan.tp09' } },
    ]);
  });

  it('switches between the device’s own auto and manual presets', async () => {
    const { card, hass } = await mount();
    tap(dialByLabel(card, 'Auto'));
    expect(hass.calls).toEqual([
      {
        domain: 'fan',
        service: 'set_preset_mode',
        data: { entity_id: 'fan.tp09', preset_mode: 'Auto' },
      },
    ]);
  });

  it('turns the climate entity off when its running mode is tapped again', async () => {
    const { card, hass } = await mount();
    tap(dialByLabel(card, 'Cooling'));
    expect(hass.calls).toEqual([
      {
        domain: 'climate',
        service: 'set_hvac_mode',
        data: { entity_id: 'climate.tp09', hvac_mode: 'off' },
      },
    ]);
  });

  it('selects heating from the heating dial', async () => {
    const { card, hass } = await mount();
    tap(dialByLabel(card, 'Heating'));
    expect(hass.calls[0]).toMatchObject({ data: { hvac_mode: 'heat' } });
  });

  it('toggles the night-mode switch', async () => {
    const { card, hass } = await mount();
    tap(dialByLabel(card, 'Night'));
    expect(hass.calls).toEqual([
      { domain: 'switch', service: 'turn_on', data: { entity_id: 'switch.tp09_night_mode' } },
    ]);
  });

  it('does not call a service just for opening a sheet', async () => {
    const { card, hass } = await mount();
    await openSheet(card, 'Oscillation');
    expect(hass.calls).toEqual([]);
  });
});

describe('quiet-luxe-fan-card oscillation sheet', () => {
  it('opens a modal dialog seeded from the live sweep', async () => {
    const { card } = await mount();
    await openSheet(card, 'Oscillation');
    const sheet = card.shadowRoot?.querySelector('ql-sheet');
    expect(sheet).not.toBeNull();
    expect(card.shadowRoot?.querySelector<QlSweepDial>('ql-sweep-dial')?.angle).toEqual({
      low: 135,
      high: 225,
      span: 90,
    });
  });

  it('reads the sweep out relative to the front of the fan', async () => {
    const { card } = await mount();
    await openSheet(card, 'Oscillation');
    expect(card.shadowRoot?.querySelector('.readout .numeral')?.textContent?.trim()).toBe('90°');
    const caption = card.shadowRoot?.querySelector('.readout .caption')?.textContent ?? '';
    expect(caption.replace(/\s+/g, ' ').trim()).toBe('Start -45° · End +45° from front');
  });

  /**
   * dyson_local.set_angle carries entity_id in `data` — it declares no target
   * block. Verified against GET /api/services on the live instance.
   */
  it('commits the sweep as fan.oscillate plus the integration angle service', async () => {
    const { card, hass } = await mount();
    await openSheet(card, 'Oscillation');
    sheetButton(card, 'Done').click();
    expect(hass.calls).toEqual([
      { domain: 'fan', service: 'oscillate', data: { entity_id: 'fan.tp09', oscillating: true } },
      {
        domain: 'dyson_local',
        service: 'set_angle',
        data: { entity_id: 'fan.tp09', angle_low: 135, angle_high: 225 },
      },
    ]);
  });

  it('commits what the handles were dragged to, not what the device still reports', async () => {
    const { card, hass } = await mount();
    await openSheet(card, 'Oscillation');
    const dial = card.shadowRoot?.querySelector<QlSweepDial>('ql-sweep-dial');
    dial?.dispatchEvent(
      new CustomEvent('ql-change', {
        detail: { angle: { low: 100, high: 260, span: 160 } },
        bubbles: true,
        composed: true,
      }),
    );
    await card.updateComplete;
    sheetButton(card, 'Done').click();
    expect(hass.calls[1]).toMatchObject({ data: { angle_low: 100, angle_high: 260 } });
  });

  it('keeps the current midpoint when a preset width is chosen', async () => {
    // Sweep 135..225 is centred on 180, so 180 stays the centre at any width.
    const { card, hass } = await mount();
    await openSheet(card, 'Oscillation');
    const row = card.shadowRoot?.querySelector<QlPresetRow>('ql-preset-row');
    row?.shadowRoot?.querySelectorAll('button')[4]?.click();
    await card.updateComplete;
    sheetButton(card, 'Done').click();
    expect(hass.calls[1]).toMatchObject({ data: { angle_low: 5, angle_high: 355 } });
  });

  it('slides a preset back inside the hardware range instead of clipping it', async () => {
    const { card, hass } = await mount({}, [
      dysonFan({ angle_low: 300, angle_high: 345 }),
      dysonClimate(),
    ]);
    await openSheet(card, 'Oscillation');
    const row = card.shadowRoot?.querySelector<QlPresetRow>('ql-preset-row');
    // 180° centred on 322.5 would run to 412; it slides down to end at 355.
    row?.shadowRoot?.querySelectorAll('button')[3]?.click();
    await card.updateComplete;
    sheetButton(card, 'Done').click();
    expect(hass.calls[1]).toMatchObject({ data: { angle_low: 175, angle_high: 355 } });
  });

  it('the Off preset stops oscillating without sending an angle', async () => {
    const { card, hass } = await mount();
    await openSheet(card, 'Oscillation');
    const row = card.shadowRoot?.querySelector<QlPresetRow>('ql-preset-row');
    row?.shadowRoot?.querySelectorAll('button')[0]?.click();
    await card.updateComplete;
    expect(hass.calls).toEqual([
      { domain: 'fan', service: 'oscillate', data: { entity_id: 'fan.tp09', oscillating: false } },
    ]);
  });

  it('cancel closes the sheet and calls nothing', async () => {
    const { card, hass } = await mount();
    await openSheet(card, 'Oscillation');
    sheetButton(card, 'Cancel').click();
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector('ql-sheet')).toBeNull();
    expect(hass.calls).toEqual([]);
  });
});

describe('quiet-luxe-fan-card timer sheet', () => {
  it('sends minutes through the integration timer service', async () => {
    const { card, hass } = await mount();
    await openSheet(card, 'Timer');
    const row = card.shadowRoot?.querySelector<QlPresetRow>('ql-preset-row');
    row?.shadowRoot?.querySelectorAll('button')[4]?.click();
    await card.updateComplete;
    sheetButton(card, 'Set').click();
    expect(hass.calls).toEqual([
      { domain: 'dyson_local', service: 'set_timer', data: { entity_id: 'fan.tp09', timer: 120 } },
    ]);
  });

  it('clears the timer with zero minutes', async () => {
    const { card, hass } = await mount();
    await openSheet(card, 'Timer');
    sheetButton(card, 'Set').click();
    expect(hass.calls[0]).toMatchObject({ data: { timer: 0 } });
  });

  /** Nothing on the device reports the timer back, so the dial shows what we set. */
  it('remembers what this session set, since HA reports nothing back', async () => {
    const { card } = await mount();
    expect(dialByLabel(card, 'Timer').stateWord).toBe('OFF');
    await openSheet(card, 'Timer');
    const row = card.shadowRoot?.querySelector<QlPresetRow>('ql-preset-row');
    row?.shadowRoot?.querySelectorAll('button')[5]?.click();
    await card.updateComplete;
    sheetButton(card, 'Set').click();
    await card.updateComplete;
    expect(dialByLabel(card, 'Timer').stateWord).toBe('4h');
    expect(dialByLabel(card, 'Timer').state).toBe('on');
  });
});

describe('quiet-luxe-fan-card airflow sheet', () => {
  it('offers two tiles with the live direction preselected', async () => {
    const { card } = await mount();
    await openSheet(card, 'Direction');
    const tiles = [...(card.shadowRoot?.querySelectorAll('.tile') ?? [])];
    expect(tiles.map((t) => t.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
  });

  it('maps the back tile to reverse', async () => {
    const { card, hass } = await mount();
    await openSheet(card, 'Direction');
    card.shadowRoot?.querySelectorAll<HTMLButtonElement>('.tile')[1]?.click();
    await card.updateComplete;
    sheetButton(card, 'Set').click();
    expect(hass.calls).toEqual([
      {
        domain: 'fan',
        service: 'set_direction',
        data: { entity_id: 'fan.tp09', direction: 'reverse' },
      },
    ]);
  });
});

describe('quiet-luxe-fan-card speed sheet', () => {
  it('draws one bar per step the device reports', async () => {
    const { card } = await mount();
    await openSheet(card, 'Speed');
    expect(card.shadowRoot?.querySelectorAll('.step')).toHaveLength(10);
    expect(card.shadowRoot?.querySelectorAll('.step.active')).toHaveLength(2);
  });

  it('converts the chosen step back to a percentage', async () => {
    const { card, hass } = await mount();
    await openSheet(card, 'Speed');
    card.shadowRoot?.querySelectorAll<HTMLButtonElement>('.step')[6]?.click();
    await card.updateComplete;
    sheetButton(card, 'Set').click();
    expect(hass.calls).toEqual([
      {
        domain: 'fan',
        service: 'set_percentage',
        data: { entity_id: 'fan.tp09', percentage: 70 },
      },
    ]);
  });

  it('the auto toggle hands speed back to the device', async () => {
    const { card, hass } = await mount();
    await openSheet(card, 'Speed');
    const toggle = card.shadowRoot?.querySelector('ql-toggle');
    toggle?.shadowRoot?.querySelector('button')?.click();
    await card.updateComplete;
    sheetButton(card, 'Set').click();
    expect(hass.calls).toEqual([
      {
        domain: 'fan',
        service: 'set_preset_mode',
        data: { entity_id: 'fan.tp09', preset_mode: 'Auto' },
      },
    ]);
  });

  /** Auto overrides any percentage, so the device has to leave auto first. */
  it('leaves auto before setting a manual speed', async () => {
    const { card, hass } = await mount({}, [dysonFan({ preset_mode: 'Auto' }), dysonClimate()]);
    await openSheet(card, 'Speed');
    card.shadowRoot?.querySelectorAll<HTMLButtonElement>('.step')[3]?.click();
    await card.updateComplete;
    sheetButton(card, 'Set').click();
    expect(hass.calls).toEqual([
      {
        domain: 'fan',
        service: 'set_preset_mode',
        data: { entity_id: 'fan.tp09', preset_mode: 'Normal' },
      },
      {
        domain: 'fan',
        service: 'set_percentage',
        data: { entity_id: 'fan.tp09', percentage: 40 },
      },
    ]);
  });

  it('omits the auto row for a device with no auto preset', async () => {
    const { card } = await mount({}, [
      dysonFan({ preset_modes: ['Normal', 'Sleep'] }),
      dysonClimate(),
    ]);
    await openSheet(card, 'Speed');
    expect(card.shadowRoot?.querySelector('ql-toggle')).toBeNull();
  });
});

describe('quiet-luxe-fan-card More sheet', () => {
  it('opens the complete grid from the compact card', async () => {
    const { card } = await mount({ form: 'compact' });
    await openSheet(card, 'More');
    const sheet = card.shadowRoot?.querySelector<QlSheet>('ql-sheet');
    expect(sheet?.heading).toBe('Controls');
    expect(dials(card).map((d) => d.label)).toContain('Heating');
  });
});

describe('quiet-luxe-fan-card degradation', () => {
  it('mutes the card and says so rather than offering controls it cannot prove', async () => {
    const { card } = await mount({}, [
      makeEntity('fan.tp09', 'unavailable', { supported_features: 63 }),
    ]);
    expect(card.shadowRoot?.querySelector('.ql-unavailable')).not.toBeNull();
    expect(dials(card)).toEqual([]);
    expect(card.shadowRoot?.querySelector('.caption')?.textContent?.trim()).toBe('Offline');
  });

  it('renders nothing at all until configured', () => {
    const card = document.createElement('quiet-luxe-fan-card') as QuietLuxeFanCard;
    document.body.append(card);
    expect(card.shadowRoot?.querySelector('.ql-card')).toBeNull();
  });
});
