import { describe, expect, it } from 'vitest';
import { makeEntity, makeMockHass, type MockHass } from '../testing/mock-hass';
import { QlRowPresence, type PresenceRowConfig } from './ql-row-presence';

function people(): ReturnType<typeof makeEntity>[] {
  return [
    makeEntity('person.steven', 'home', { friendly_name: 'Steven' }),
    makeEntity('person.mei', 'not_home', {
      friendly_name: 'Mei',
      entity_picture: '/api/image/serve/mei/512x512',
    }),
  ];
}

async function mount(
  config: Omit<PresenceRowConfig, 'type'>,
  hass: MockHass,
): Promise<QlRowPresence> {
  const row = document.createElement('ql-row-presence') as QlRowPresence;
  row.setConfig({ type: 'custom:ql-row-presence', ...config });
  row.hass = hass;
  document.body.append(row);
  await row.updateComplete;
  return row;
}

describe('ql-row-presence', () => {
  it('is registered without a customCards picker entry', () => {
    expect(customElements.get('ql-row-presence')).toBe(QlRowPresence);
    expect((window.customCards ?? []).some((c) => c.type === 'ql-row-presence')).toBe(false);
  });

  it('requires a non-empty entities list', () => {
    const row = new QlRowPresence();
    expect(() => row.setConfig({ type: 'x', entities: [] })).toThrow('"entities" is required');
  });

  it('renders picture avatars when available and initials otherwise', async () => {
    const row = await mount({ entities: ['person.steven', 'person.mei'] }, makeMockHass(people()));
    expect(row.shadowRoot?.querySelector('.initial')?.textContent?.trim()).toBe('S');
    expect(row.shadowRoot?.querySelector('img.avatar')?.getAttribute('src')).toBe(
      '/api/image/serve/mei/512x512',
    );
    row.remove();
  });

  it('localizes home/away states and accents who is home', async () => {
    const row = await mount(
      { entities: ['person.steven', 'person.mei'] },
      makeMockHass(people(), 'zh-Hant'),
    );
    const persons = [...(row.shadowRoot?.querySelectorAll('.person') ?? [])];
    expect(persons[0]?.textContent).toContain('在家');
    expect(persons[0]?.classList.contains('away')).toBe(false);
    expect(persons[1]?.textContent).toContain('外出');
    expect(persons[1]?.classList.contains('away')).toBe(true);
    row.remove();
  });

  it('shows offline for unavailable person entities', async () => {
    const row = await mount(
      { entities: ['person.steven'] },
      makeMockHass([makeEntity('person.steven', 'unavailable', { friendly_name: 'Steven' })]),
    );
    expect(row.shadowRoot?.textContent).toContain('Offline');
    row.remove();
  });

  it('each person row opens more-info for that person, not the first one', async () => {
    const row = await mount({ entities: ['person.steven', 'person.mei'] }, makeMockHass(people()));
    const seen: Array<CustomEvent<{ entityId: string }>> = [];
    const record = (event: Event): void => {
      seen.push(event as CustomEvent<{ entityId: string }>);
    };
    document.body.addEventListener('hass-more-info', record);
    const persons = [...(row.shadowRoot?.querySelectorAll<HTMLButtonElement>('.ql-info') ?? [])];
    expect(persons).toHaveLength(2);
    persons[1]?.click();
    persons[0]?.click();
    document.body.removeEventListener('hass-more-info', record);
    expect(seen.map((event) => event.detail.entityId)).toEqual(['person.mei', 'person.steven']);
    expect(seen[0]?.bubbles).toBe(true);
    expect(seen[0]?.composed).toBe(true);
    row.remove();
  });
});
