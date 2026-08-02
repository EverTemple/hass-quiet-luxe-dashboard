import { describe, expect, it } from 'vitest';
import { makeMockHass, makeEntity } from '../testing/mock-hass';
import type { HomeAssistant } from '../types/home-assistant';
import { displayName, humanizeEntityId } from './display-name';

function withRegistryNames(
  hass: HomeAssistant,
  entities: Record<string, { name?: string | null }>,
): HomeAssistant {
  return { ...hass, entities } as HomeAssistant;
}

describe('humanizeEntityId', () => {
  it('strips the domain, splits underscores, and title-cases', () => {
    expect(humanizeEntityId('cover.dooya_m1_fe9b_curtain')).toBe('Dooya M1 Fe9b Curtain');
    expect(humanizeEntityId('climate.steven_bedroom')).toBe('Steven Bedroom');
    expect(humanizeEntityId('light.bedroom')).toBe('Bedroom');
  });

  it('handles ids without a domain and collapses empty segments', () => {
    expect(humanizeEntityId('bedroom_lamp')).toBe('Bedroom Lamp');
    expect(humanizeEntityId('sensor.__odd__id__')).toBe('Odd Id');
  });

  it('falls back to the raw id only when nothing readable remains', () => {
    expect(humanizeEntityId('sensor.')).toBe('sensor.');
    expect(humanizeEntityId('')).toBe('');
  });
});

describe('displayName', () => {
  const hass = makeMockHass([
    makeEntity('climate.steven_bedroom', 'cool', { friendly_name: 'Steven Bedroom' }),
    makeEntity('cover.dooya_m1_fe9b_curtain', 'open', { friendly_name: '窗帘 Curatain' }),
    makeEntity('light.no_name_at_all', 'on'),
    makeEntity('light.blank_friendly', 'on', { friendly_name: '   ' }),
  ]);

  it('uses the state friendly_name when present', () => {
    expect(displayName(hass, 'climate.steven_bedroom')).toBe('Steven Bedroom');
    expect(displayName(hass, 'cover.dooya_m1_fe9b_curtain')).toBe('窗帘 Curatain');
  });

  it('lets an explicit config name win over friendly_name', () => {
    expect(displayName(hass, 'climate.steven_bedroom', 'Aircon')).toBe('Aircon');
  });

  it('ignores an empty or whitespace-only config name', () => {
    expect(displayName(hass, 'climate.steven_bedroom', '  ')).toBe('Steven Bedroom');
    expect(displayName(hass, 'climate.steven_bedroom', '')).toBe('Steven Bedroom');
  });

  it('falls back to the entity registry name when no friendly_name exists', () => {
    const withRegistry = withRegistryNames(hass, {
      'light.no_name_at_all': { name: 'Reading Lamp' },
    });
    expect(displayName(withRegistry, 'light.no_name_at_all')).toBe('Reading Lamp');
  });

  it('humanizes the entity id when nothing else is available', () => {
    expect(displayName(hass, 'light.no_name_at_all')).toBe('No Name At All');
    expect(displayName(hass, 'light.blank_friendly')).toBe('Blank Friendly');
    expect(displayName(undefined, 'cover.dooya_m1_fe9b_curtain')).toBe('Dooya M1 Fe9b Curtain');
  });

  it('never returns a bare entity id for a missing entity', () => {
    const name = displayName(hass, 'switch.some_missing_thing');
    expect(name).toBe('Some Missing Thing');
    expect(name).not.toContain('.');
  });
});
