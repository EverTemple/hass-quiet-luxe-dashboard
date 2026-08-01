import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeEntity, makeMockHass, type MockHass } from '../testing/mock-hass';
import { CONFIRM_TIMEOUT_MS } from './quiet-luxe-climate-card';
import { QlRowNetworkFlow, type NetworkFlowRowConfig } from './ql-row-network-flow';

async function mount(
  config: Omit<NetworkFlowRowConfig, 'type'>,
  hass: MockHass,
): Promise<QlRowNetworkFlow> {
  const row = document.createElement('ql-row-network-flow') as QlRowNetworkFlow;
  row.setConfig({ type: 'custom:ql-row-network-flow', ...config });
  row.hass = hass;
  document.body.append(row);
  await row.updateComplete;
  return row;
}

describe('ql-row-network-flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is registered without a picker entry and requires an entity', () => {
    expect(customElements.get('ql-row-network-flow')).toBe(QlRowNetworkFlow);
    expect((window.customCards ?? []).some((c) => c.type === 'ql-row-network-flow')).toBe(false);
    const row = new QlRowNetworkFlow();
    expect(() => row.setConfig({ type: 'x', entity: '' })).toThrow('"entity" is required');
  });

  it('always shows the localized confirm hint caption', async () => {
    const row = await mount(
      { entity: 'switch.guest_wifi', name: 'Guest Wi-Fi', description: 'UniFi guest network' },
      makeMockHass([makeEntity('switch.guest_wifi', 'on')], 'zh-Hant'),
    );
    expect(row.shadowRoot?.textContent).toContain('Guest Wi-Fi');
    expect(row.shadowRoot?.textContent).toContain('UniFi guest network');
    expect(row.shadowRoot?.textContent).toContain('點兩次以生效');
    row.remove();
  });

  it('first toggle arms without a service call; second within timeout toggles', async () => {
    const hass = makeMockHass([makeEntity('switch.guest_wifi', 'on')]);
    const row = await mount({ entity: 'switch.guest_wifi' }, hass);
    const change = (): boolean | undefined =>
      row.shadowRoot
        ?.querySelector('ql-toggle')
        ?.dispatchEvent(
          new CustomEvent('ql-change', {
            detail: { checked: false },
            bubbles: true,
            composed: true,
          }),
        );
    change();
    await row.updateComplete;
    expect(hass.calls).toEqual([]);
    expect(row.shadowRoot?.textContent).toContain('Tap again to confirm');
    change();
    expect(hass.calls).toEqual([
      { domain: 'switch', service: 'toggle', data: { entity_id: 'switch.guest_wifi' } },
    ]);
    row.remove();
  });

  it('disarms after the confirm timeout without calling the service', async () => {
    const hass = makeMockHass([makeEntity('switch.guest_wifi', 'on')]);
    const row = await mount({ entity: 'switch.guest_wifi' }, hass);
    row.shadowRoot
      ?.querySelector('ql-toggle')
      ?.dispatchEvent(
        new CustomEvent('ql-change', { detail: { checked: false }, bubbles: true, composed: true }),
      );
    vi.advanceTimersByTime(CONFIRM_TIMEOUT_MS);
    await row.updateComplete;
    expect(row.shadowRoot?.textContent).not.toContain('Tap again to confirm');
    expect(hass.calls).toEqual([]);
    row.remove();
  });

  it('unavailable switch renders muted with a disabled toggle', async () => {
    const row = await mount(
      { entity: 'switch.guest_wifi' },
      makeMockHass([makeEntity('switch.guest_wifi', 'unavailable')]),
    );
    expect(row.shadowRoot?.querySelector('.ql-unavailable')).not.toBeNull();
    const toggle = row.shadowRoot?.querySelector<HTMLElement & { disabled: boolean }>('ql-toggle');
    expect(toggle?.disabled).toBe(true);
    row.remove();
  });
});
