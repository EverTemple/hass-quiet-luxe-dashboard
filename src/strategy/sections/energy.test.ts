import { describe, expect, it } from 'vitest';
import { makeContext } from '../../testing/mock-registry';
import { energySection, energyViewSections } from './energy';

const energyHome = {
  energy: {
    power_entity: 'sensor.total_power',
    today_entity: 'sensor.today_energy',
    phase_entities: ['sensor.l1', 'sensor.l2', 'sensor.l3'],
  },
};

describe('energySection', () => {
  it('emits the strip card linking to the energy view', () => {
    const section = energySection(makeContext({ home: energyHome }));
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
});

describe('energyViewSections', () => {
  it('renders strip + one ring per phase, chart only when apexcharts is installed', () => {
    const withChart = energyViewSections(makeContext({ home: energyHome, hasApexcharts: true }));
    expect(withChart).toHaveLength(1);
    const cards = withChart[0]?.cards ?? [];
    expect(cards).toHaveLength(6); // heading + strip + 3 rings + chart
    expect(cards[2]).toEqual({
      type: 'custom:quiet-luxe-energy-card',
      form: 'ring',
      power_entity: 'sensor.l1',
      name: 'L1',
      grid_options: { columns: 4 },
    });
    expect(cards[5]).toMatchObject({ type: 'custom:apexcharts-card' });
  });

  it('omits the chart when apexcharts-card is absent (graceful degradation)', () => {
    const sections = energyViewSections(makeContext({ home: energyHome }));
    expect(
      sections[0]?.cards.some((card) => card.type === 'custom:apexcharts-card'),
    ).toBe(false);
  });

  it('returns no sections when energy is disabled', () => {
    expect(energyViewSections(makeContext({}))).toEqual([]);
  });
});
