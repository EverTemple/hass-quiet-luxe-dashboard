import { afterEach, describe, expect, it } from 'vitest';
import { makeMockHass, sensorEntity } from '../testing/mock-hass';
import type { QlStatusDot } from '../elements/ql-status-dot';
import { QuietLuxeSensorTile, type SensorTileConfig } from './quiet-luxe-sensor-tile';

async function mount(
  config: Partial<SensorTileConfig> & { entity: string; metric: SensorTileConfig['metric'] },
  hass = makeMockHass(),
): Promise<QuietLuxeSensorTile> {
  const tile = document.createElement('quiet-luxe-sensor-tile') as QuietLuxeSensorTile;
  tile.setConfig({ type: 'custom:quiet-luxe-sensor-tile', ...config });
  tile.hass = hass;
  document.body.append(tile);
  await tile.updateComplete;
  return tile;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('quiet-luxe-sensor-tile', () => {
  it('registers element + picker entry; requires entity and a valid metric', () => {
    expect(customElements.get('quiet-luxe-sensor-tile')).toBe(QuietLuxeSensorTile);
    expect((window.customCards ?? []).map((e) => e.type)).toContain('quiet-luxe-sensor-tile');
    const tile = new QuietLuxeSensorTile();
    expect(() =>
      tile.setConfig({ type: 'custom:quiet-luxe-sensor-tile', entity: '', metric: 'aqi' }),
    ).toThrow(/entity/);
    expect(() =>
      tile.setConfig({
        type: 'custom:quiet-luxe-sensor-tile',
        entity: 'sensor.a',
        metric: 'speed' as never,
      }),
    ).toThrow(/metric/);
  });

  it('renders localized metric eyebrow, formatted value, and threshold dot', async () => {
    const tile = await mount(
      { entity: 'sensor.living_aqi', metric: 'aqi' },
      makeMockHass([sensorEntity('sensor.living_aqi', '18')], 'zh-Hans'),
    );
    expect(tile.shadowRoot?.querySelector('.eyebrow')?.textContent?.trim()).toBe('空气质量');
    expect(tile.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('18');
    expect(tile.shadowRoot?.querySelector<QlStatusDot>('ql-status-dot')?.status).toBe('good');
  });

  /**
   * The label wrapped as "TEMPERATU / RE" on the live room view because the
   * card's own `display: block` outranked the clamp's `-webkit-box`. The class
   * is the whole contract, so assert it is still on the element.
   */
  it('clamps the eyebrow to one line and declares no display of its own', async () => {
    const tile = await mount(
      { entity: 'sensor.living_temp', metric: 'temp' },
      makeMockHass([sensorEntity('sensor.living_temp', '21.4')]),
    );
    expect(tile.shadowRoot?.querySelector('.eyebrow')?.classList.contains('ql-clamp-1')).toBe(true);
    const sheet = QuietLuxeSensorTile.styles.toString();
    expect(/\.eyebrow\s*\{[^}]*display\s*:/.test(sheet), 'eyebrow must not set display').toBe(false);
  });

  it('config name overrides the metric label', async () => {
    const tile = await mount(
      { entity: 'sensor.uv', metric: 'uv', name: 'UV Index' },
      makeMockHass([sensorEntity('sensor.uv', '7')]),
    );
    expect(tile.shadowRoot?.querySelector('.eyebrow')?.textContent?.trim()).toBe('UV Index');
    expect(tile.shadowRoot?.querySelector<QlStatusDot>('ql-status-dot')?.status).toBe('warn');
  });

  it('unavailable and missing render the muted placeholder with a neutral dot', async () => {
    const unavailable = await mount(
      { entity: 'sensor.a', metric: 'temp' },
      makeMockHass([sensorEntity('sensor.a', 'unavailable')]),
    );
    expect(
      unavailable.shadowRoot?.querySelector('.ql-card')?.classList.contains('ql-unavailable'),
    ).toBe(true);
    expect(unavailable.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('—');
    expect(unavailable.shadowRoot?.querySelector<QlStatusDot>('ql-status-dot')?.status).toBe(
      'neutral',
    );
    const missing = await mount({ entity: 'sensor.ghost', metric: 'humidity' }, makeMockHass());
    expect(missing.shadowRoot?.querySelector('.value')?.textContent?.trim()).toBe('—');
    expect(missing.getCardSize()).toBe(1);
    expect(missing.getGridOptions()).toEqual({ rows: 'auto', columns: 6 });
  });

  it('the identity region opens HA’s more-info dialog for the tile entity', async () => {
    const tile = await mount(
      { entity: 'sensor.living_aqi', metric: 'aqi' },
      makeMockHass([sensorEntity('sensor.living_aqi', '18')]),
    );
    const seen: Array<CustomEvent<{ entityId: string }>> = [];
    const record = (event: Event): void => {
      seen.push(event as CustomEvent<{ entityId: string }>);
    };
    document.body.addEventListener('hass-more-info', record);
    tile.shadowRoot?.querySelector<HTMLButtonElement>('.ql-info')?.click();
    document.body.removeEventListener('hass-more-info', record);
    expect(seen.map((event) => event.detail.entityId)).toEqual(['sensor.living_aqi']);
    expect(seen[0]?.bubbles).toBe(true);
    expect(seen[0]?.composed).toBe(true);
  });

  it('still opens more-info for an entity that is missing entirely', async () => {
    const tile = await mount({ entity: 'sensor.ghost', metric: 'temp' }, makeMockHass());
    const seen: string[] = [];
    const record = (event: Event): void => {
      seen.push((event as CustomEvent<{ entityId: string }>).detail.entityId);
    };
    document.body.addEventListener('hass-more-info', record);
    const info = tile.shadowRoot?.querySelector<HTMLButtonElement>('.ql-info');
    expect(info?.disabled).toBe(false);
    info?.click();
    document.body.removeEventListener('hass-more-info', record);
    expect(seen).toEqual(['sensor.ghost']);
  });
});
