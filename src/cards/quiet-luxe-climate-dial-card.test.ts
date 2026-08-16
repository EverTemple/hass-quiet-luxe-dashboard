import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QlRingDial } from '../elements/ql-ring-dial';
import { STEPPER_COMMIT_MS, type QlStepper } from '../elements/ql-stepper';
import { makeEntity, makeMockHass, type MockHass } from '../testing/mock-hass';
import type { HassEntity } from '../types/home-assistant';
import { QUICK_ADJUST_COMMIT_DELAY_MS } from './quick-adjust';
import { QuietLuxeClimateDialCard, type ClimateDialCardConfig } from './quiet-luxe-climate-dial-card';
import '../elements/ql-quick-adjust';

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

  it('passes the entity’s own humidity through to the dial', async () => {
    const humid = SENSIBO();
    const card = await mount(
      makeEntity(humid.entity_id, 'cool', { ...humid.attributes, current_humidity: 65 }),
    );
    expect(dial(card)?.humidityText).toBe('65%');
  });

  it('omits the humidity row rather than a placeholder when the entity reports none', async () => {
    const card = await mount(SENSIBO());
    expect(dial(card)?.humidityText).toBe('');
  });

  it('drops the humidity reading when the entity is unavailable', async () => {
    const humid = SENSIBO();
    const card = await mount(
      makeEntity(humid.entity_id, 'unavailable', { ...humid.attributes, current_humidity: 65 }),
    );
    expect(dial(card)?.humidityText).toBe('');
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

  it('carries the dial, the mode row and the fan row, with the rest behind More controls', async () => {
    const card = await mount(SENSIBO());
    // Mode and fan on the card; swing, humidity and preset in the sheet.
    expect(card.shadowRoot?.querySelectorAll('ql-preset-row')).toHaveLength(2);
    expect(card.shadowRoot?.querySelector('ql-toggle')).toBeNull();
    expect(card.shadowRoot?.querySelector('.more')).not.toBeNull();
    expect(card.shadowRoot?.querySelector('ql-sheet')).toBeNull();
  });

  it('draws the header as weather glyph, mode glyph and menu glyph around the eyebrow', async () => {
    const card = await mount(SENSIBO());
    expect(card.shadowRoot?.querySelector('.head-slot-left svg.glyph')).not.toBeNull();
    expect(card.shadowRoot?.querySelector('.head-mode svg.glyph')).not.toBeNull();
    expect(card.shadowRoot?.querySelector('.head-slot-right svg.glyph')).not.toBeNull();
  });

  it('keeps the static weather glyph when the config has no weather_entity', async () => {
    const card = await mount(SENSIBO());
    expect(card.shadowRoot?.querySelector('.head-slot-left svg.glyph')).not.toBeNull();
  });

  it('drives the header weather glyph off weather_entity’s own condition, when the card is given one', async () => {
    const withWeather = document.createElement('quiet-luxe-climate-dial-card') as QuietLuxeClimateDialCard;
    withWeather.setConfig({
      type: 'custom:quiet-luxe-climate-dial-card',
      entity: 'climate.steven_bedroom',
      weather_entity: 'weather.home',
    });
    withWeather.hass = makeMockHass([SENSIBO(), makeEntity('weather.home', 'rainy')]);
    document.body.append(withWeather);
    await withWeather.updateComplete;

    const withoutWeather = await mount(SENSIBO());

    const weatherMarkup = withWeather.shadowRoot?.querySelector('.head-slot-left svg.glyph')?.innerHTML;
    const staticMarkup = withoutWeather.shadowRoot?.querySelector('.head-slot-left svg.glyph')?.innerHTML;
    expect(weatherMarkup).not.toBe(staticMarkup);
    withWeather.remove();
  });

  it('falls back to the static weather glyph when weather_entity is unavailable', async () => {
    const card = document.createElement('quiet-luxe-climate-dial-card') as QuietLuxeClimateDialCard;
    card.setConfig({
      type: 'custom:quiet-luxe-climate-dial-card',
      entity: 'climate.steven_bedroom',
      weather_entity: 'weather.missing',
    });
    card.hass = makeMockHass([SENSIBO()]);
    document.body.append(card);
    await card.updateComplete;

    const withoutWeather = await mount(SENSIBO());
    const fallbackMarkup = card.shadowRoot?.querySelector('.head-slot-left svg.glyph')?.innerHTML;
    const staticMarkup = withoutWeather.shadowRoot?.querySelector('.head-slot-left svg.glyph')?.innerHTML;
    expect(fallbackMarkup).toBe(staticMarkup);
    card.remove();
  });

  it('redraws the mode glyph for the entity’s own hvac mode', async () => {
    const cool = await mount(SENSIBO());
    const coolPath = cool.shadowRoot?.querySelector('.head-mode path')?.getAttribute('d');

    const heating = SENSIBO();
    const heat = await mount(makeEntity(heating.entity_id, 'heat', heating.attributes));
    const heatPath = heat.shadowRoot?.querySelector('.head-mode path')?.getAttribute('d');

    const offEntity = SENSIBO();
    const off = await mount(makeEntity(offEntity.entity_id, 'off', offEntity.attributes));
    const offPaths = [...(off.shadowRoot?.querySelectorAll('.head-mode path') ?? [])].map((el) =>
      el.getAttribute('d'),
    );

    expect(coolPath).not.toBe(heatPath);
    expect(offPaths).not.toContain(coolPath);
    expect(offPaths).not.toContain(heatPath);
  });

  it('truncates the eyebrow to one line instead of wrapping', async () => {
    const card = await mount(SENSIBO());
    const eyebrow = card.shadowRoot?.querySelector('.eyebrow-text');
    expect(eyebrow).not.toBeNull();
    expect(card.shadowRoot?.querySelector('.eyebrow.ql-clamp-2')).toBeNull();
  });

  it('flanks the dial with a minus and a plus', async () => {
    const card = await mount(SENSIBO());
    const glyphs = [...(card.shadowRoot?.querySelectorAll('ql-quick-adjust') ?? [])];
    expect(glyphs.map((glyph) => glyph.getAttribute('dir'))).toEqual(['minus', 'plus']);
  });

  it('drives the entity’s own step from a quick-adjust press, as one call', async () => {
    vi.useFakeTimers();
    const card = await mount(SENSIBO());
    const plus = card.shadowRoot?.querySelectorAll('ql-quick-adjust')[1];
    // Three rapid taps are one intention, not three round trips to the device.
    for (let tap = 0; tap < 3; tap += 1) {
      plus?.dispatchEvent(
        new CustomEvent('ql-adjust', { detail: { direction: 1 }, bubbles: true, composed: true }),
      );
    }
    vi.advanceTimersByTime(QUICK_ADJUST_COMMIT_DELAY_MS);
    expect(calls(card)).toEqual([
      ['climate', 'set_temperature', { entity_id: 'climate.steven_bedroom', temperature: 26 }],
    ]);
    vi.useRealTimers();
  });

  it('disables the glyph that would push the setpoint past its band', async () => {
    const card = await mount(
      makeEntity('climate.steven_bedroom', 'cool', {
        ...SENSIBO().attributes,
        temperature: 30,
        max_temp: 30,
      }),
    );
    const glyphs = [...(card.shadowRoot?.querySelectorAll('ql-quick-adjust') ?? [])];
    expect(glyphs[0]?.hasAttribute('disabled')).toBe(false);
    expect(glyphs[1]?.hasAttribute('disabled')).toBe(true);
  });

  it('drives the fan row from the entity’s own fan_modes', async () => {
    const card = await mount(SENSIBO());
    const fanRow = card.shadowRoot?.querySelectorAll('ql-preset-row')[1];
    fanRow?.dispatchEvent(
      new CustomEvent('ql-change', { detail: { value: 'high' }, bubbles: true, composed: true }),
    );
    expect(calls(card)).toEqual([
      ['climate', 'set_fan_mode', { entity_id: 'climate.steven_bedroom', fan_mode: 'high' }],
    ]);
  });

  it('lets the fan row wrap instead of truncating six speeds at a narrow width', async () => {
    const card = await mount(SENSIBO());
    const fanRow = card.shadowRoot?.querySelectorAll('ql-preset-row')[1];
    expect(fanRow?.hasAttribute('wrap')).toBe(true);
    // The hvac mode row never truncates at 2–4 segments, so it keeps its
    // default single-line behaviour.
    const modeRow = card.shadowRoot?.querySelectorAll('ql-preset-row')[0];
    expect(modeRow?.hasAttribute('wrap')).toBe(false);
  });

  it('draws no fan row for a device that reports no fan modes', async () => {
    const card = await mount(
      makeEntity('climate.plain', 'heat', {
        hvac_modes: ['heat', 'cool', 'off'],
        temperature: 21,
        min_temp: 7,
        max_temp: 35,
        supported_features: 1,
      }),
    );
    expect(card.shadowRoot?.querySelectorAll('ql-preset-row')).toHaveLength(1);
  });

  it('draws More controls with the smaller 14×14 chevron and still opens the sheet', async () => {
    const card = await mount(SENSIBO());
    const more = card.shadowRoot?.querySelector<HTMLButtonElement>('.more');
    const chevron = more?.querySelector('svg.chevron');
    expect(chevron?.getAttribute('width')).toBe('14');
    expect(chevron?.getAttribute('height')).toBe('14');
    more?.click();
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector('ql-sheet')).not.toBeNull();
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
    card.shadowRoot
      ?.querySelector('ql-sheet-button[emphasis="primary"]')
      ?.dispatchEvent(new Event('click', { bubbles: true }));
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector('ql-sheet')).toBeNull();
  });

  it('drops the mode row and the dial’s grips when the device is not answering', async () => {
    const card = await mount(makeEntity('climate.tp09', 'unavailable', {}));
    expect(card.shadowRoot?.querySelector('.ql-card')?.classList.contains('ql-unavailable')).toBe(true);
    expect(card.shadowRoot?.querySelector('ql-preset-row')).toBeNull();
    expect(dial(card)?.disabled).toBe(true);
  });

  /* The compact card used to be a read-mostly tile: a smaller ring and nothing
     else. It now carries the same controls as the full card at a smaller
     diameter, which is the only thing "compact" should ever have meant. */
  it('gives the compact dial the same full control at a smaller diameter', async () => {
    const card = await mount(SENSIBO(), { form: 'compact' });
    expect(dial(card)?.size).toBe('compact');
    expect(card.shadowRoot?.querySelectorAll('ql-preset-row')).toHaveLength(2);
    expect(card.shadowRoot?.querySelectorAll('ql-quick-adjust')).toHaveLength(2);
    expect(card.shadowRoot?.querySelector('.more')).not.toBeNull();
  });

  it('opens the control sheet from the card’s name', async () => {
    const card = await mount(SENSIBO());
    card.shadowRoot?.querySelector<HTMLButtonElement>('.ql-info')?.click();
    await card.updateComplete;
    expect(card.shadowRoot?.querySelector('ql-sheet')).not.toBeNull();
  });

  it('puts the dial itself inside the sheet, so one surface carries everything', async () => {
    const card = await mount(SENSIBO());
    card.shadowRoot?.querySelector<HTMLButtonElement>('.more')?.click();
    await card.updateComplete;
    const dials = [...(card.shadowRoot?.querySelectorAll('ql-ring-dial') ?? [])];
    expect(dials.map((node) => node.getAttribute('size'))).toEqual(['full', 'sheet']);
    expect(card.shadowRoot?.querySelectorAll('ql-quick-adjust')).toHaveLength(4);
  });

  it('keeps HA’s own more-info one tap away, from inside the sheet', async () => {
    const card = await mount(SENSIBO());
    let fired = '';
    card.addEventListener('hass-more-info', (event) => {
      fired = (event as CustomEvent<{ entityId: string }>).detail.entityId;
    });
    card.shadowRoot?.querySelector<HTMLButtonElement>('.more')?.click();
    await card.updateComplete;
    card.shadowRoot
      ?.querySelector('ql-sheet-button[emphasis="secondary"]')
      ?.dispatchEvent(new Event('click', { bubbles: true }));
    expect(fired).toBe('climate.steven_bedroom');
  });
});

describe('quiet-luxe-climate-dial-card sizing', () => {
  /* The compact card is 292px at its narrowest and half a view column is about
     171px, so neither form can share a column any more. */
  it('gives both forms the whole view column', async () => {
    const full = await mount(SENSIBO());
    expect(full.getGridOptions()).toEqual({ columns: 12, rows: 'auto' });
    const compact = await mount(SENSIBO(), { form: 'compact' });
    expect(compact.getGridOptions()).toEqual({ columns: 12, rows: 'auto' });
  });

  it('never pins a row count, so the dial is never clipped', async () => {
    const card = await mount(SENSIBO());
    expect(card.getGridOptions().rows).toBe('auto');
  });
});
