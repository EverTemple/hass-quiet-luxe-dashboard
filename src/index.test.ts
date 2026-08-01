import { describe, expect, it } from 'vitest';
import * as bundle from './index';

const ELEMENT_TAGS = [
  'ql-canvas',
  'ql-status-dot',
  'ql-badge',
  'ql-chip',
  'ql-toggle',
  'ql-slider',
  'ql-segmented',
  'ql-section-eyebrow',
  'ql-header-home',
  'ql-header-room',
] as const;

const CARD_TAGS = [
  'quiet-luxe-room-card',
  'quiet-luxe-climate-card',
  'quiet-luxe-light-card',
  'quiet-luxe-cover-card',
  'quiet-luxe-sensor-tile',
] as const;

describe('bundle entry', () => {
  it('registers every element and card on import', () => {
    for (const tag of [...ELEMENT_TAGS, ...CARD_TAGS]) {
      expect(customElements.get(tag), tag).toBeDefined();
    }
  });

  it('lists every card in window.customCards exactly once', () => {
    const types = (window.customCards ?? []).map((entry) => entry.type);
    for (const tag of CARD_TAGS) {
      expect(types.filter((type) => type === tag)).toHaveLength(1);
    }
  });

  it('re-exports the public API', () => {
    expect(bundle.QlChip).toBeDefined();
    expect(bundle.QlToggle).toBeDefined();
    expect(bundle.QlSlider).toBeDefined();
    expect(bundle.QlSegmented).toBeDefined();
    expect(bundle.QlStatusDot).toBeDefined();
    expect(bundle.QlBadge).toBeDefined();
    expect(bundle.QlSectionEyebrow).toBeDefined();
    expect(bundle.QlHeaderHome).toBeDefined();
    expect(bundle.QlHeaderRoom).toBeDefined();
    expect(bundle.QuietLuxeRoomCard).toBeDefined();
    expect(bundle.QuietLuxeClimateCard).toBeDefined();
    expect(bundle.QuietLuxeLightCard).toBeDefined();
    expect(bundle.QuietLuxeCoverCard).toBeDefined();
    expect(bundle.QuietLuxeSensorTile).toBeDefined();
    expect(bundle.detectClimateDeviceType('climate.a')).toBe('ac');
    expect(bundle.formatSensorValue('aqi', '18')).toBe('18');
    expect(typeof bundle.navigate).toBe('function');
    expect(typeof bundle.registerCard).toBe('function');
  });
});
