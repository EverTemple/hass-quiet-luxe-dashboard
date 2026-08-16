import { render } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import type { DialMode } from './climate-dial';
import { climateModeGlyph, weatherGlyph } from './climate-dial-header-glyphs';

function mount(template: ReturnType<typeof weatherGlyph>): HTMLDivElement {
  const container = document.createElement('div');
  render(template, container);
  document.body.append(container);
  return container;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('weatherGlyph', () => {
  it('falls back to the static partly-cloudy mark with no condition given', () => {
    const withNoArg = mount(weatherGlyph());
    const withUndefined = mount(weatherGlyph(undefined));
    expect(withNoArg.querySelector('svg')?.outerHTML).toBe(withUndefined.querySelector('svg')?.outerHTML);
    // Two paths: the sun-behind-cloud mark is drawn as a sun arc plus a cloud.
    expect(withNoArg.querySelectorAll('path')).toHaveLength(2);
  });

  it('falls back to the static mark for a condition it does not recognise', () => {
    const known = mount(weatherGlyph());
    const unknown = mount(weatherGlyph('not-a-real-condition'));
    expect(unknown.querySelector('svg')?.outerHTML).toBe(known.querySelector('svg')?.outerHTML);
  });

  it('maps every HA weather condition onto a mark, keeping the required eight distinguishable', () => {
    // spec: sun, night, partly-cloudy, cloud, rain, snow, storm, fog must be
    // told apart; a couple of harmless synonyms sharing a mark is fine.
    const distinctRequired: ReadonlyArray<string> = [
      'sunny',
      'clear-night',
      'partlycloudy',
      'cloudy',
      'rainy',
      'snowy',
      'lightning',
      'fog',
    ];
    const markup = distinctRequired.map((condition) => mount(weatherGlyph(condition)).innerHTML);
    expect(new Set(markup).size).toBe(distinctRequired.length);
  });

  it('never renders a blank glyph for any HA-documented condition', () => {
    const conditions: ReadonlyArray<string> = [
      'sunny',
      'clear-night',
      'partlycloudy',
      'cloudy',
      'rainy',
      'pouring',
      'snowy',
      'snowy-rainy',
      'fog',
      'lightning',
      'lightning-rainy',
      'hail',
      'windy',
      'windy-variant',
      'exceptional',
    ];
    for (const condition of conditions) {
      const el = mount(weatherGlyph(condition));
      expect(el.querySelectorAll('path, circle').length).toBeGreaterThan(0);
    }
  });

  it('is stroke-only, round-capped, in the 14×14 header box, matching the other header glyphs', () => {
    const svg = mount(weatherGlyph('rainy')).querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('14');
    expect(svg?.getAttribute('height')).toBe('14');
    expect(svg?.getAttribute('fill')).toBe('none');
    expect(svg?.getAttribute('stroke-linecap')).toBe('round');
    expect(svg?.getAttribute('stroke-linejoin')).toBe('round');
  });
});

describe('climateModeGlyph', () => {
  const MODES: ReadonlyArray<DialMode> = ['heat', 'cool', 'heat_cool', 'off', 'other'];

  it('draws heavier than the weather/menu glyphs (1.75 over their 1.3)', () => {
    for (const mode of MODES) {
      const svg = mount(climateModeGlyph(mode)).querySelector('svg');
      expect(svg?.getAttribute('stroke-width')).toBe('1.75');
    }
  });

  it('colours cool and heat/auto with the status colours the dropped mode label used', () => {
    const cool = mount(climateModeGlyph('cool')).querySelector('svg');
    expect(cool?.getAttribute('stroke')).toBe('var(--ql-status-good, #7e8b6f)');
    const heat = mount(climateModeGlyph('heat')).querySelector('svg');
    expect(heat?.getAttribute('stroke')).toBe('var(--ql-accent-champagne, #b08d57)');
    const auto = mount(climateModeGlyph('heat_cool')).querySelector('svg');
    expect(auto?.getAttribute('stroke')).toBe('var(--ql-accent-champagne, #b08d57)');
  });

  it('keeps off visually distinct from auto now that colour is the only state cue', () => {
    const off = mount(climateModeGlyph('off')).querySelector('svg');
    const auto = mount(climateModeGlyph('heat_cool')).querySelector('svg');
    expect(off?.getAttribute('stroke')).not.toBe(auto?.getAttribute('stroke'));
    expect(off?.getAttribute('stroke')).toBe('var(--ql-ink-muted, #8c8578)');
  });
});
