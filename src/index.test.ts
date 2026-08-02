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
  'ql-idle-clock',
  'ql-row-presence',
  'ql-row-door-motion',
  'ql-row-network-flow',
] as const;

const CARD_TAGS = [
  'quiet-luxe-room-card',
  'quiet-luxe-climate-card',
  'quiet-luxe-light-card',
  'quiet-luxe-cover-card',
  'quiet-luxe-sensor-tile',
  'quiet-luxe-media-card',
  'quiet-luxe-camera-card',
  'quiet-luxe-energy-card',
  'quiet-luxe-schedule-card',
  'quiet-luxe-tasks-card',
  'quiet-luxe-car-card',
  'quiet-luxe-vacuum-card',
  'quiet-luxe-device-cutout-card',
  'quiet-luxe-language-card',
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

  it('keeps rows and idle clock out of the card picker', () => {
    const types = (window.customCards ?? []).map((entry) => entry.type);
    for (const tag of ['ql-row-presence', 'ql-row-door-motion', 'ql-row-network-flow', 'ql-idle-clock']) {
      expect(types.includes(tag), tag).toBe(false);
    }
  });

  it('registers the dashboard strategy element and metadata', () => {
    expect(customElements.get('ll-strategy-dashboard-quiet-luxe')).toBe(bundle.QuietLuxeStrategy);
    expect(window.customStrategies?.some((entry) => entry.type === 'quiet-luxe')).toBe(true);
  });

  it('defines the header card without listing it in the picker', () => {
    expect(customElements.get('quiet-luxe-header-card')).toBe(bundle.QuietLuxeHeaderCard);
    expect((window.customCards ?? []).some((card) => card.type === 'quiet-luxe-header-card')).toBe(
      false,
    );
  });

  it('installs its own Latin webfaces on import (zero-file-copy install)', () => {
    const fonts = document.getElementById(bundle.INLINE_FONT_STYLE_ID);
    expect(fonts?.textContent).toContain('@font-face');
    expect(fonts?.textContent).toContain('data:font/woff2;base64,');
  });

  it('survives the optional font stylesheet failing to load', () => {
    // The test environment cannot fetch the resolved stylesheet URL, which is
    // the same failure path a flat HACS install takes (404 on fonts.css): the
    // link removes itself rather than lingering dead in <head>, and the inlined
    // faces still carry the typography.
    expect(document.getElementById('quiet-luxe-fonts')).toBeNull();
    expect(document.getElementById(bundle.INLINE_FONT_STYLE_ID)?.textContent).toContain(
      '@font-face',
    );
  });

  it('re-exports the Plan 3b public API', () => {
    expect(bundle.QuietLuxeMediaCard).toBeDefined();
    expect(bundle.QuietLuxeCameraCard).toBeDefined();
    expect(bundle.QuietLuxeEnergyCard).toBeDefined();
    expect(bundle.QuietLuxeScheduleCard).toBeDefined();
    expect(bundle.QuietLuxeTasksCard).toBeDefined();
    expect(bundle.QuietLuxeCarCard).toBeDefined();
    expect(bundle.QuietLuxeVacuumCard).toBeDefined();
    expect(bundle.QuietLuxeDeviceCutoutCard).toBeDefined();
    expect(bundle.QuietLuxeLanguageCard).toBeDefined();
    expect(bundle.QlRowPresence).toBeDefined();
    expect(bundle.QlRowDoorMotion).toBeDefined();
    expect(bundle.QlRowNetworkFlow).toBeDefined();
    expect(bundle.QlIdleClock).toBeDefined();
    expect(bundle.formatPower(1236)).toBe('1.24 kW');
    expect(bundle.formatEnergy(8.61)).toBe('8.6 kWh');
    expect(bundle.LANGUAGE_TILES).toHaveLength(5);
    expect(bundle.CAR_BODY_PATHS.bmw.startsWith('M')).toBe(true);
    expect(typeof bundle.fetchAgenda).toBe('function');
    expect(typeof bundle.fetchTodoItems).toBe('function');
    expect(typeof bundle.updateTodoItem).toBe('function');
  });
});
