import { describe, expect, it } from 'vitest';
import { sensorEntity } from '../../testing/mock-hass';
import { makeContext } from '../../testing/mock-registry';
import { energySection, energyViewSections } from './energy';

const energyHome = {
  energy: {
    power_entity: 'sensor.total_power',
    today_entity: 'sensor.today_energy',
    phase_entities: ['sensor.l1', 'sensor.l2', 'sensor.l3'],
  },
};

const meters = [
  sensorEntity('sensor.total_power', '1236'),
  sensorEntity('sensor.today_energy', '8.6'),
  sensorEntity('sensor.l1', '400'),
  sensorEntity('sensor.l2', '500'),
  sensorEntity('sensor.l3', '336'),
];

describe('energySection', () => {
  it('emits the strip card linking to the energy view', () => {
    const section = energySection(makeContext({ home: energyHome, entities: meters }));
    expect(section?.cards[0]).toMatchObject({
      tap_action: { action: 'navigate', navigation_path: '/quiet-luxe/energy' },
    });
    expect(section?.cards[1]).toEqual({
      type: 'custom:quiet-luxe-energy-card',
      form: 'strip',
      power_entity: 'sensor.total_power',
      today_entity: 'sensor.today_energy',
    });
  });

  it('returns null when energy is disabled', () => {
    expect(energySection(makeContext({}))).toBeNull();
  });

  it('returns null when the configured meter does not exist (spec §8)', () => {
    expect(energySection(makeContext({ home: energyHome }))).toBeNull();
  });
});

describe('energyViewSections', () => {
  it('renders strip + one ring per phase, chart only when apexcharts is installed', () => {
    const withChart = energyViewSections(
      makeContext({ home: energyHome, entities: meters, hasApexcharts: true }),
    );
    /* now 1 track · charts 2 — the chart is the only card that needs width. */
    expect(withChart).toHaveLength(2);
    expect(withChart.map((section) => section.column_span)).toEqual([1, 2]);
    const cards = withChart[0]?.cards ?? [];
    expect(cards).toHaveLength(5); // heading + strip + 3 rings
    expect(cards[2]).toEqual({
      type: 'custom:quiet-luxe-energy-card',
      form: 'ring',
      power_entity: 'sensor.l1',
      name: 'L1',
    });
    expect(withChart[1]?.cards[1]).toMatchObject({ type: 'custom:apexcharts-card' });
  });

  it('omits the chart when apexcharts-card is absent (graceful degradation)', () => {
    const sections = energyViewSections(makeContext({ home: energyHome, entities: meters }));
    expect(
      sections[0]?.cards.some((card) => card.type === 'custom:apexcharts-card'),
    ).toBe(false);
  });

  it('drops phase rings whose sensors do not exist', () => {
    const sections = energyViewSections(
      makeContext({ home: energyHome, entities: [sensorEntity('sensor.total_power', '1236')] }),
    );
    expect(sections[0]?.cards).toHaveLength(2); // heading + strip only
  });

  it('returns no sections when energy is disabled', () => {
    expect(energyViewSections(makeContext({}))).toEqual([]);
  });

  it('returns no sections when the meter does not exist', () => {
    expect(energyViewSections(makeContext({ home: energyHome }))).toEqual([]);
  });
});
