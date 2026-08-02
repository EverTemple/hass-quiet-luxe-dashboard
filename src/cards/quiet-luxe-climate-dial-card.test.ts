import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QlRingDial } from '../elements/ql-ring-dial';
import { STEPPER_COMMIT_MS, type QlStepper } from '../elements/ql-stepper';
import { makeEntity, makeMockHass, type MockHass } from '../testing/mock-hass';
import type { HassEntity } from '../types/home-assistant';
import { QuietLuxeClimateDialCard, type ClimateDialCardConfig } from './quiet-luxe-climate-dial-card';

/** The live Tung Chung devices, at the masks and attributes they actually report. */
const SENSIBO = (): HassEntity =>
  makeEntity('climate.steven_bedroom', 'cool', {
    supported_features: 937,
    hvac_modes: ['cool', 'heat', 'fan_only', 'dry', 'heat_cool', 'off'],
    min_temp: 17,
    max_temp: 30,
    target_temp_step: 1,
    fan_modes: ['quiet', 'low', 'medium', 'high', 'auto', 'strong'],
    swing_modes: ['stopped', 'rangefull'],
    swing_horizontal_modes: ['stopped', 'rangefull'],
    current_temperature: 21.9,
    temperature: 23,
    fan_mode: 'low',
    swing_mode: 'rangefull',
    swing_horizontal_mode: 'rangefull',
    friendly_name: 'Steven Bedroom',
  });

const TP09 = (): HassEntity =>
  makeEntity('climate.tp09', 'cool', {
    supported_features: 385,
    hvac_modes: ['off', 'cool', 'heat'],
    min_temp: 1,
    max_temp: 37,
    current_temperature: 24.2,
    temperature: 27,
    friendly_name: 'TP09',
  });

async function mount(
  entity: HassEntity,
  config: Partial<ClimateDialCardConfig> = {},
): Promise<QuietLuxeClimateDialCard> {
  const card = document.createElement('quiet-luxe-climate-dial-card') as QuietLuxeClimateDialCard;
  card.setConfig({ type: 'custom:quiet-luxe-climate-dial-card', entity: entity.entity_id, ...config });
  card.hass = makeMockHass([entity]);
  document.body.append(card);
  await card.updateComplete;
  return card;
}

/** The service calls the card has made, in order. */
function calls(card: QuietLuxeClimateDialCard): Array<[string, string, unknown]> {
  return (card.hass as MockHass).calls.map((c) => [c.domain, c.service, c.data]);
}

function dial(card: QuietLuxeClimateDialCard): QlRingDial | null {
  return card.shadowRoot?.querySelector<QlRingDial>('ql-ring-dial') ?? null;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('quiet-luxe-climate-dial-card', () => {
  it('requires an entity', () => {
    const card = document.createElement('quiet-luxe-climate-dial-card') as QuietLuxeClimateDialCard;
    expect(() => card.setConfig({ type: 'x', entity: '' })).toThrow(/entity/);
  });

  it('takes the dial’s band and step from the live Sensibo, never a constant', async () => {
    const card = await mount(SENSIBO());
    expect(dial(card)).toMatchObject({ min: 17, max: 30, step: 1, value: 23, kind: 'single' });
  });

  it('takes the TP09’s own 1–37 band and HA’s default step', async () => {
    const card = await mount(TP09());
    expect(dial(card)).toMatchObject({ min: 1, max: 37, step: 0.5, value: 27 });
  });

  it('colours the dial by the entity’s hvac mode', async () => {
    expect(dial(await mount(SENSIBO()))?.mode).toBe('cool');
    const heating = SENSIBO();
    expect(dial(await mount(makeEntity(heating.entity_id, 'heat', heating.attributes)))?.mode).toBe('heat');
  });

  it('shows the room’s own reading under the setpoint', async () => {
    const card = await mount(SENSIBO());
    expect(dial(card)?.ambientText).toBe('Now 21.9°');
  });

  it('promotes the ambient reading and demotes the setpoint when off', async () => {
    const off = SENSIBO();
    const card = await mount(makeEntity(off.entity_id, 'off', off.attributes));
    expect(dial(card)?.heroText).toBe('21.9°');
    expect(dial(card)?.ambientText).toBe('Set to 23°');
  });

  it('sends the released setpoint as climate.set_temperature', async () => {
    const card = await mount(SENSIBO());
    dial(card)?.dispatchEvent(
      new CustomEvent('ql-change', {
        detail: { handle: 'value', value: 25, low: 21, high: 25 },
        bubbles: true,
        composed: true,
      }),
    );
    expect(calls(card)).toEqual([
      ['climate', 'set_temperature', { entity_id: 'climate.steven_bedroom', temperature: 25 }],
    ]);
  });

  it('sends both ends of a range so HA cannot drop one', async () => {
    const range = makeEntity('climate.range', 'heat_cool', {
      supported_features: 3,
      min_temp: 15,
      max_temp: 30,
      target_temp_step: 0.5,
      target_temp_low: 21,
      target_temp_high: 25,
      current_temperature: 22,
      hvac_modes: ['off', 'heat_cool'],
    });
    const card = await mount(range);
    expect(dial(card)?.kind).toBe('range');
    dial(card)?.dispatchEvent(
      new CustomEvent('ql-change', {
        detail: { handle: 'low', value: 23, low: 22, high: 25 },
        bubbles: true,
        composed: true,
      }),
    );
    expect(calls(card)).toEqual([
      [
        'climate',
        'set_temperature',
        { entity_id: 'climate.range', target_temp_low: 22, target_temp_high: 25 },
      ],
    ]);
  });

  it('holds a dragged reading until the device confirms it', async () => {
    const card = await mount(SENSIBO());
    dial(card)?.dispatchEvent(
      new CustomEvent('ql-input', {
        detail: { handle: 'value', value: 26, low: 21, high: 25 },
        bubbles: true,
        composed: true,
      }),
    );
    await card.updateComplete;
    expect(dial(card)?.value).toBe(26);

    // The entity comes back with the old value: the drag still wins.
    card.hass = makeMockHass([SENSIBO()]);
    await card.updateComplete;
    expect(dial(card)?.value).toBe(26);

    // The entity comes back with the new one: the card stops overriding.
    const settled = SENSIBO();
    card.hass = makeMockHass([
      makeEntity(settled.entity_id, 'cool', { ...settled.attributes, temperature: 26 }),
    ]);
    await card.updateComplete;
    expect(dial(card)?.value).toBe(26);
    dial(card)?.dispatchEvent(
      new CustomEvent('ql-input', {
        detail: { handle: 'value', value: 26, low: 21, high: 25 },
        bubbles: true,
        composed: true,
      }),
    );
  });

  it('keeps the card row to the modes it has room to label', async () => {
    // Six equal pills in a ~230px card truncate every label to one letter, so
    // the card carries the canonical four and the sheet carries all six.
    const card = await mount(SENSIBO());
    const row = card.shadowRoot?.querySelector('ql-preset-row');
    expect((row as unknown as { options: Array<{ value: string }> }).options.map((o) => o.value)).toEqual([
      'cool',
      'heat',
      'heat_cool',
      'off',
    ]);
  });

  it('leads the card row with a mode outside the canonical four', async () => {
    const drying = SENSIBO();
    const card = await mount(makeEntity(drying.entity_id, 'dry', drying.attributes));
    const row = card.shadowRoot?.querySelector('ql-preset-row');
    expect(
      (row as unknown as { options: Array<{ value: string }> }).options.map((o) => o.value)[0],
    ).toBe('dry');
  });

  it('sets an hvac mode from the card row', async () => {
    const card = await mount(SENSIBO());
    card.shadowRoot
      ?.querySelector('ql-preset-row')
      ?.dispatchEvent(
        new CustomEvent('ql-change', { detail: { value: 'heat' }, bubbles: true, composed: true }),
      );
    expect(calls(card)).toEqual([
      ['climate', 'set_hvac_mode', { entity_id: 'climate.steven_bedroom', hvac_mode: 'heat' }],
    ]);
  });

  it('keeps the card to a dial and a mode row, with the rest behind More controls', async () => {
    const card = await mount(SENSIBO());
    // No fan row, no swing, no preset on the card itself.
    expect(card.shadowRoot?.querySelectorAll('ql-preset-row')).toHaveLength(1);
    expect(card.shadowRoot?.querySelector('ql-toggle')).toBeNull();
    expect(card.shadowRoot?.querySelector('.more')).not.toBeNull();
    expect(card.shadowRoot?.querySelector('ql-sheet')).toBeNull();
  });

  it('opens the sheet with every group the Sensibo supports', async () => {
    const card = await mount(SENSIBO());
    card.shadowRoot?.querySelector<HTMLButtonElement>('.more')?.click();
    await card.updateComplete;
    const titles = [...(card.shadowRoot?.querySelectorAll('.ql-sheet-title') ?? [])].map((el) =>
      el.textContent?.trim(),
    );
    expect(titles).toEqual(['HVAC mode', 'Temperature range', 'Fan', 'Swing']);
    // Two swing axes, drawn as switches because the device offers two positions.
    expect(card.shadowRoot?.querySelectorAll('ql-toggle')).toHaveLength(2);
  });

  it('opens a much smaller sheet for the TP09, which supports nothing else', async () => {
    const card = await mount(TP09());
    card.shadowRoot?.querySelector<HTMLButtonElement>('.more')?.click();
    await card.updateComplete;
    const titles = [...(card.shadowRoot?.querySelectorAll('.ql-sheet-title') ?? [])].map((el) =>
      el.textContent?.trim(),
    );
    expect(titles).toEqual(['HVAC mode', 'Temperature range']);
    expect(card.shadowRoot?.querySelector('ql-toggle')).toBeNull();
  });

  it('drives a swing axis from the sheet', async () => {
    const card = await mount(SENSIBO());
    card.shadowRoot?.querySelector<HTMLButtonElement>('.more')?.click();
    await card.updateComplete;
    card.shadowRoot
      ?.querySelectorAll('ql-toggle')[0]
      ?.dispatchEvent(
        new CustomEvent('ql-change', { detail: { checked: false }, bubbles: true, composed: true }),
      );
    expect(calls(card)).toEqual([
      ['climate', 'set_swing_mode', { entity_id: 'climate.steven_bedroom', swing_mode: 'stopped' }],
    ]);
  });

  it('drives the temperature stepper in the sheet', async () => {
    vi.useFakeTimers();
    const card = await mount(SENSIBO());
    card.shadowRoot?.querySelector<HTMLButtonElement>('.more')?.click();
    await card.updateComplete;
    const stepper = card.shadowRoot?.querySelector<QlStepper>('ql-stepper');
    stepper?.shadowRoot?.querySelectorAll('button')[1]?.click();
    vi.advanceTimersByTime(STEPPER_COMMIT_MS);
    expect(calls(card)).toEqual([
      ['climate', 'set_temperature', { entity_id: 'climate.steven_bedroom', temperature: 24 }],
    ]);
    vi.useRealTimers();
  });

  it('closes the sheet on Done', async () => {
    const card = await mount(SENSIBO());
    card.shadowRoot?.querySelector<HTMLButtonElement>('.more')?.click();
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector('ql-sheet')).not.toBeNull();
    card.shadowRoot?.querySelector('ql-sheet-button')?.dispatchEvent(new Event('click', { bubbles: true }));
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector('ql-sheet')).toBeNull();
  });

  it('drops the mode row and the dial’s grips when the device is not answering', async () => {
    const card = await mount(makeEntity('climate.tp09', 'unavailable', {}));
    expect(card.shadowRoot?.querySelector('.ql-card')?.classList.contains('ql-unavailable')).toBe(true);
    expect(card.shadowRoot?.querySelector('ql-preset-row')).toBeNull();
    expect(dial(card)?.disabled).toBe(true);
  });

  it('draws the compact dial without a mode row or a sheet in a room', async () => {
    const card = await mount(SENSIBO(), { form: 'compact' });
    expect(dial(card)?.size).toBe('compact');
    expect(card.shadowRoot?.querySelector('ql-preset-row')).toBeNull();
    expect(card.shadowRoot?.querySelector('.more')).toBeNull();
  });

  it('opens HA’s own more-info from the card’s name', async () => {
    const card = await mount(SENSIBO());
    const info = card.shadowRoot?.querySelector<HTMLButtonElement>('.ql-info');
    expect(info?.dataset.qlInfo).toBe('climate.steven_bedroom');
    let fired = '';
    card.addEventListener('hass-more-info', (event) => {
      fired = (event as CustomEvent<{ entityId: string }>).detail.entityId;
    });
    info?.click();
    expect(fired).toBe('climate.steven_bedroom');
  });
});

describe('quiet-luxe-climate-dial-card sizing', () => {
  it('gives the full dial the whole view column and the compact one half', async () => {
    const full = await mount(SENSIBO());
    expect(full.getGridOptions()).toEqual({ columns: 12, rows: 'auto' });
    const compact = await mount(SENSIBO(), { form: 'compact' });
    expect(compact.getGridOptions()).toEqual({ columns: 6, rows: 'auto' });
  });

  it('never pins a row count, so the dial is never clipped', async () => {
    const card = await mount(SENSIBO());
    expect(card.getGridOptions().rows).toBe('auto');
  });
});
