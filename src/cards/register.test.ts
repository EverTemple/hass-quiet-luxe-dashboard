import { describe, expect, it } from 'vitest';
import { registerCard } from './register';

class FakeCardA extends HTMLElement {}
class FakeCardB extends HTMLElement {}
class FakeCardC extends HTMLElement {}

describe('registerCard', () => {
  it('defines the element and appends a window.customCards entry', () => {
    registerCard('ql-fake-card-a', FakeCardA, {
      name: 'Fake Card A',
      description: 'Test card',
    });
    expect(customElements.get('ql-fake-card-a')).toBe(FakeCardA);
    expect(window.customCards).toContainEqual({
      type: 'ql-fake-card-a',
      name: 'Fake Card A',
      description: 'Test card',
    });
  });

  /* Registers both cards itself: window.customCards is shared mutable state, so
     leaning on the previous test's registration made this fail under a shuffled
     run order. */
  it('preserves existing entries when registering another card', () => {
    registerCard('ql-fake-card-b', FakeCardB, {
      name: 'Fake Card B',
      description: 'Second test card',
    });
    registerCard('ql-fake-card-c', FakeCardC, {
      name: 'Fake Card C',
      description: 'Third test card',
    });
    const types = (window.customCards ?? []).map((entry) => entry.type);
    expect(types).toContain('ql-fake-card-b');
    expect(types).toContain('ql-fake-card-c');
  });
});
