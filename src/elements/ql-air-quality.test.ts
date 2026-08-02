import { afterEach, describe, expect, it } from 'vitest';
import type { AirReading } from '../cards/air-quality';
import { QlAirQuality } from './ql-air-quality';

const READINGS: ReadonlyArray<AirReading> = [
  { id: 'pm25', label: 'PM2.5', value: 4, text: '4', band: 'good' },
  { id: 'pm10', label: 'PM10', value: 6, text: '6', band: 'good' },
  { id: 'voc', label: 'VOC', value: 6.4, text: '6.4', band: 'very-poor' },
  { id: 'no2', label: 'NO₂', value: 0.2, text: '0.2', band: 'good' },
];

async function mount(props: Partial<QlAirQuality> = {}): Promise<QlAirQuality> {
  const el = document.createElement('ql-air-quality') as QlAirQuality;
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

function cells(el: QlAirQuality): HTMLElement[] {
  return [...(el.shadowRoot?.querySelectorAll<HTMLElement>('.cell') ?? [])];
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ql-air-quality', () => {
  it('registers as a custom element', () => {
    expect(customElements.get('ql-air-quality')).toBe(QlAirQuality);
  });

  it('draws one label/value pair per pollutant, in order', async () => {
    const el = await mount({ readings: READINGS });
    expect(cells(el).map((cell) => cell.dataset.pollutant)).toEqual([
      'pm25',
      'pm10',
      'voc',
      'no2',
    ]);
    expect(cells(el)[2]?.textContent?.replace(/\s+/g, '')).toBe('VOC6.4');
  });

  it('colours each value by its own band', async () => {
    const el = await mount({ readings: READINGS });
    const value = (index: number): string =>
      cells(el)[index]?.querySelector<HTMLElement>('.value')?.style.getPropertyValue(
        '--ql-air-band',
      ) ?? '';
    expect(value(0)).toContain('--ql-status-good');
    expect(value(2)).toContain('--ql-status-alert');
  });

  it('leaves fair at ink/muted so nothing-to-report reads as neutral', async () => {
    const el = await mount({
      readings: [{ id: 'pm25', label: 'PM2.5', value: 42, text: '42', band: 'fair' }],
    });
    const tint = cells(el)[0]
      ?.querySelector<HTMLElement>('.value')
      ?.style.getPropertyValue('--ql-air-band');
    expect(tint).toContain('--ql-ink-muted');
  });

  it('summarises to the worst pollutant, not the first', async () => {
    const el = await mount({ readings: READINGS, bandLabel: 'Very poor' });
    const band = el.shadowRoot?.querySelector<HTMLElement>('.band');
    expect(band?.dataset.band).toBe('very-poor');
    expect(band?.textContent).toBe('Very poor');
  });

  it('pairs the summary word with an 8px dot', async () => {
    const el = await mount({ readings: READINGS, bandLabel: 'Very poor' });
    expect(el.shadowRoot?.querySelector('.summary .dot')).not.toBeNull();
    expect(QlAirQuality.styles.toString()).toMatch(/\.dot\s*\{[^}]*width:\s*8px/);
  });

  it('carries no background, box or radius of its own', async () => {
    await mount({ readings: READINGS });
    const styles = QlAirQuality.styles.toString();
    expect(styles).not.toMatch(/\.readout\s*\{[^}]*background/);
    expect(styles).not.toMatch(/\.readout\s*\{[^}]*border/);
    expect(styles).not.toMatch(/\.grid\s*\{[^}]*background/);
  });

  it('degrades to a single cell for a device that reports only PM2.5', async () => {
    const el = await mount({
      readings: [{ id: 'pm25', label: 'PM2.5', value: 4, text: '4', band: 'good' }],
    });
    expect(cells(el)).toHaveLength(1);
    expect(el.shadowRoot?.querySelector('.grid')?.classList.contains('single')).toBe(true);
  });

  it('renders nothing at all when the device reports no air sensors', async () => {
    const el = await mount({ readings: [] });
    expect(el.shadowRoot?.querySelector('.readout')).toBeNull();
  });

  it('names the readout for assistive technology', async () => {
    const el = await mount({ readings: READINGS, groupLabel: 'Air quality' });
    expect(el.shadowRoot?.querySelector('.readout')?.getAttribute('aria-label')).toBe(
      'Air quality',
    );
  });
});
