import { afterEach, describe, expect, it } from 'vitest';
import {
  fireMoreInfo,
  MORE_INFO_ATTRIBUTE,
  MORE_INFO_EVENT,
  moreInfoTargetOf,
} from './more-info';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('fireMoreInfo', () => {
  it('dispatches HA’s hass-more-info event with an entityId detail', () => {
    const node = document.createElement('div');
    document.body.append(node);
    const seen: Array<{ entityId: string }> = [];
    node.addEventListener(MORE_INFO_EVENT, (event) => {
      seen.push((event as CustomEvent<{ entityId: string }>).detail);
    });

    fireMoreInfo(node, 'climate.tp09');

    expect(seen).toEqual([{ entityId: 'climate.tp09' }]);
  });

  it('bubbles and crosses shadow boundaries so it reaches <home-assistant>', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('span');
    root.append(inner);

    const seen: string[] = [];
    document.body.addEventListener(MORE_INFO_EVENT, (event) => {
      seen.push((event as CustomEvent<{ entityId: string }>).detail.entityId);
    });

    fireMoreInfo(inner, 'fan.tp09');

    expect(seen).toEqual(['fan.tp09']);
  });

  it('is not cancelable, matching HA’s fireEvent defaults', () => {
    const node = document.createElement('div');
    document.body.append(node);
    let cancelable = true;
    node.addEventListener(MORE_INFO_EVENT, (event) => {
      cancelable = event.cancelable;
    });

    fireMoreInfo(node, 'light.a');

    expect(cancelable).toBe(false);
  });
});

describe('moreInfoTargetOf', () => {
  it('reads the entity id stamped on the region that handled the event', () => {
    const node = document.createElement('div');
    node.setAttribute(MORE_INFO_ATTRIBUTE, 'humidifier.a');
    document.body.append(node);
    let found: string | undefined = 'unset';
    node.addEventListener('click', (event) => {
      found = moreInfoTargetOf(event);
    });

    node.click();

    expect(found).toBe('humidifier.a');
  });

  it('returns undefined when the region carries no entity id', () => {
    const node = document.createElement('div');
    document.body.append(node);
    let found: string | undefined = 'unset';
    node.addEventListener('click', (event) => {
      found = moreInfoTargetOf(event);
    });

    node.click();

    expect(found).toBeUndefined();
  });
});
