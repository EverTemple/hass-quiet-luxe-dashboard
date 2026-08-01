import { describe, expect, it } from 'vitest';
import { makeEntity, makeMockHass, type MockHass } from '../testing/mock-hass';
import { QlRowDoorMotion, type DoorMotionRowConfig } from './ql-row-door-motion';

async function mount(
  config: Omit<DoorMotionRowConfig, 'type'>,
  hass: MockHass,
): Promise<QlRowDoorMotion> {
  const row = document.createElement('ql-row-door-motion') as QlRowDoorMotion;
  row.setConfig({ type: 'custom:ql-row-door-motion', ...config });
  row.hass = hass;
  document.body.append(row);
  await row.updateComplete;
  return row;
}

describe('ql-row-door-motion', () => {
  it('is registered without a picker entry and requires an entity', () => {
    expect(customElements.get('ql-row-door-motion')).toBe(QlRowDoorMotion);
    expect((window.customCards ?? []).some((c) => c.type === 'ql-row-door-motion')).toBe(false);
    const row = new QlRowDoorMotion();
    expect(() => row.setConfig({ type: 'x', entity: '' })).toThrow('"entity" is required');
  });

  it('renders door open/closed from state with status dots', async () => {
    const open = await mount(
      { entity: 'binary_sensor.front_door' },
      makeMockHass([
        makeEntity('binary_sensor.front_door', 'on', {
          friendly_name: 'Front Door',
          device_class: 'door',
        }),
      ]),
    );
    expect(open.shadowRoot?.textContent).toContain('Open');
    expect(open.shadowRoot?.querySelector('ql-status-dot')?.getAttribute('status')).toBe('warn');
    open.remove();
    const closed = await mount(
      { entity: 'binary_sensor.front_door' },
      makeMockHass(
        [
          makeEntity('binary_sensor.front_door', 'off', {
            friendly_name: 'Front Door',
            device_class: 'door',
          }),
        ],
        'zh-Hant',
      ),
    );
    expect(closed.shadowRoot?.textContent).toContain('已關');
    expect(closed.shadowRoot?.querySelector('ql-status-dot')?.getAttribute('status')).toBe('good');
    closed.remove();
  });

  it('detects motion kind from device_class and localizes detected/clear', async () => {
    const row = await mount(
      { entity: 'binary_sensor.hall_motion' },
      makeMockHass([
        makeEntity('binary_sensor.hall_motion', 'on', {
          friendly_name: 'Hall Motion',
          device_class: 'motion',
        }),
      ]),
    );
    expect(row.shadowRoot?.textContent).toContain('Motion');
    row.remove();
  });

  it('shows the detection toggle only when configured and calls the toggle service', async () => {
    const hass = makeMockHass([
      makeEntity('binary_sensor.hall_motion', 'off', { device_class: 'motion' }),
      makeEntity('switch.hall_motion_detection', 'on'),
    ]);
    const bare = await mount({ entity: 'binary_sensor.hall_motion' }, hass);
    expect(bare.shadowRoot?.querySelector('ql-toggle')).toBeNull();
    bare.remove();
    const withToggle = await mount(
      {
        entity: 'binary_sensor.hall_motion',
        toggle_entity: 'switch.hall_motion_detection',
        show_toggle: true,
      },
      hass,
    );
    const toggle = withToggle.shadowRoot?.querySelector('ql-toggle');
    expect(toggle).not.toBeNull();
    toggle?.dispatchEvent(
      new CustomEvent('ql-change', { detail: { checked: false }, bubbles: true, composed: true }),
    );
    expect(hass.calls).toEqual([
      { domain: 'switch', service: 'toggle', data: { entity_id: 'switch.hall_motion_detection' } },
    ]);
    withToggle.remove();
  });

  it('unavailable sensor renders muted with a neutral dot', async () => {
    const row = await mount(
      { entity: 'binary_sensor.front_door' },
      makeMockHass([makeEntity('binary_sensor.front_door', 'unavailable')]),
    );
    expect(row.shadowRoot?.querySelector('.ql-unavailable')).not.toBeNull();
    expect(row.shadowRoot?.querySelector('ql-status-dot')?.getAttribute('status')).toBe('neutral');
    row.remove();
  });
});
