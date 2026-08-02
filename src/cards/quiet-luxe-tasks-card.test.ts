import { describe, expect, it } from 'vitest';
import { makeEntity, makeMockHass, type MockHass } from '../testing/mock-hass';
import { QuietLuxeTasksCard, type TasksCardConfig } from './quiet-luxe-tasks-card';

const WS_STUB = {
  wsResponses: {
    'todo/item/list': {
      items: [
        { uid: 'a1', summary: 'Buy milk', status: 'needs_action', due: '2026-07-31' },
        { uid: 'a2', summary: 'Water plants', status: 'needs_action' },
        { uid: 'a3', summary: 'Done thing', status: 'completed' },
      ],
    },
  },
};

function todoEntity(): ReturnType<typeof makeEntity> {
  return makeEntity('todo.family', '2', { friendly_name: 'Family Tasks' });
}

async function mount(
  config: Omit<TasksCardConfig, 'type'>,
  hass: MockHass,
): Promise<QuietLuxeTasksCard> {
  const card = document.createElement('quiet-luxe-tasks-card') as QuietLuxeTasksCard;
  card.setConfig({ type: 'custom:quiet-luxe-tasks-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  await card.refresh();
  await card.updateComplete;
  return card;
}

describe('quiet-luxe-tasks-card', () => {
  it('is registered and requires an entity', () => {
    expect(customElements.get('quiet-luxe-tasks-card')).toBe(QuietLuxeTasksCard);
    const card = new QuietLuxeTasksCard();
    expect(() => card.setConfig({ type: 'x', entity: '' })).toThrow('"entity" is required');
  });

  it('renders one checkbox row per item and the open-count footer', async () => {
    const card = await mount({ entity: 'todo.family' }, makeMockHass([todoEntity()], WS_STUB));
    const checkboxes = [
      ...(card.shadowRoot?.querySelectorAll<HTMLInputElement>("input[type='checkbox']") ?? []),
    ];
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes.map((box) => box.checked)).toEqual([false, false, true]);
    expect(card.shadowRoot?.textContent).toContain('2 open');
    expect(card.shadowRoot?.querySelector('.due')?.textContent).toContain('2026-07-31');
    card.remove();
  });

  it('localizes the footer', async () => {
    const card = await mount(
      { entity: 'todo.family' },
      makeMockHass([todoEntity()], { ...WS_STUB, language: 'zh-Hant' }),
    );
    expect(card.shadowRoot?.textContent).toContain('2 項未完成');
    card.remove();
  });

  it('checkbox change calls todo.update_item with the item uid', async () => {
    const hass = makeMockHass([todoEntity()], WS_STUB);
    const card = await mount({ entity: 'todo.family' }, hass);
    const first = card.shadowRoot?.querySelector<HTMLInputElement>("input[type='checkbox']");
    if (first === null || first === undefined) {
      throw new Error('checkbox missing');
    }
    first.checked = true;
    first.dispatchEvent(new Event('change'));
    expect(hass.calls).toEqual([
      {
        domain: 'todo',
        service: 'update_item',
        data: { entity_id: 'todo.family', item: 'a1', status: 'completed' },
      },
    ]);
    card.remove();
  });

  it('shows the all-done footer when nothing is open', async () => {
    const card = await mount(
      { entity: 'todo.family' },
      makeMockHass([todoEntity()], {
        wsResponses: {
          'todo/item/list': { items: [{ uid: 'a3', summary: 'Done', status: 'completed' }] },
        },
      }),
    );
    expect(card.shadowRoot?.textContent).toContain('All done');
    card.remove();
  });

  it('unavailable todo entity renders muted without rows', async () => {
    const card = await mount(
      { entity: 'todo.family' },
      makeMockHass([makeEntity('todo.family', 'unavailable')], WS_STUB),
    );
    expect(card.shadowRoot?.querySelector('.ql-unavailable')).not.toBeNull();
    expect(card.shadowRoot?.querySelectorAll("input[type='checkbox']")).toHaveLength(0);
    card.remove();
  });

  it('the list name opens HA’s more-info dialog without touching an item', async () => {
    const hass = makeMockHass([todoEntity()], WS_STUB);
    const card = await mount({ entity: 'todo.family' }, hass);
    const seen: Array<CustomEvent<{ entityId: string }>> = [];
    const record = (event: Event): void => {
      seen.push(event as CustomEvent<{ entityId: string }>);
    };
    document.body.addEventListener('hass-more-info', record);
    card.shadowRoot?.querySelector<HTMLButtonElement>('.ql-info')?.click();
    document.body.removeEventListener('hass-more-info', record);
    expect(seen.map((event) => event.detail.entityId)).toEqual(['todo.family']);
    expect(seen[0]?.bubbles).toBe(true);
    expect(seen[0]?.composed).toBe(true);
    expect(hass.calls).toEqual([]);
    card.remove();
  });

  it('keeps the more-info region on the unavailable branch', async () => {
    const card = await mount(
      { entity: 'todo.family' },
      makeMockHass([makeEntity('todo.family', 'unavailable')], WS_STUB),
    );
    const seen: string[] = [];
    const record = (event: Event): void => {
      seen.push((event as CustomEvent<{ entityId: string }>).detail.entityId);
    };
    document.body.addEventListener('hass-more-info', record);
    const info = card.shadowRoot?.querySelector<HTMLButtonElement>('.ql-info');
    expect(info?.disabled).toBe(false);
    info?.click();
    document.body.removeEventListener('hass-more-info', record);
    expect(seen).toEqual(['todo.family']);
    card.remove();
  });
});
