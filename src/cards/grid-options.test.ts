import { describe, expect, it } from 'vitest';
import '../index';
import { COLUMNS_FULL, COLUMNS_HALF, contentGrid } from './grid-options';

/**
 * A numeric `rows` makes HA pin the card to `rows × 64 − 8` pixels and lets
 * anything taller spill over the card below it — which is how the room, climate
 * and tasks cards came to overlap on the live dashboard. This is the invariant
 * that keeps that from coming back.
 */
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
  'quiet-luxe-header-card',
  'ql-row-presence',
  'ql-row-door-motion',
  'ql-row-network-flow',
] as const;

const CONFIG_FOR: Readonly<Record<string, Record<string, unknown>>> = {
  'quiet-luxe-room-card': { name: 'Living Room' },
  'quiet-luxe-header-card': { form: 'home', name: 'Home' },
  'quiet-luxe-media-card': { entity: 'media_player.a', form: 'bar' },
  'quiet-luxe-car-card': { brand: 'bmw' },
  'quiet-luxe-energy-card': { power_entity: 'sensor.a' },
  'quiet-luxe-sensor-tile': { entity: 'sensor.a', metric: 'temp' },
  'ql-row-presence': { entities: ['person.a'] },
};

interface GridCard extends HTMLElement {
  setConfig(config: Record<string, unknown>): void;
  getGridOptions(): { columns: number | 'full'; rows: number | 'auto' };
}

describe('card grid options', () => {
  it('contentGrid never pins a row count', () => {
    expect(contentGrid(COLUMNS_HALF)).toEqual({ columns: 6, rows: 'auto' });
    expect(contentGrid('full')).toEqual({ columns: 'full', rows: 'auto' });
  });

  it.each(CARD_TAGS)('%s sizes itself by content, never by row count', (tag) => {
    const card = document.createElement(tag) as GridCard;
    card.setConfig({ type: `custom:${tag}`, entity: 'sensor.a', ...(CONFIG_FOR[tag] ?? {}) });
    const options = card.getGridOptions();
    expect(options.rows).toBe('auto');
    expect(options.columns === 'full' || options.columns <= COLUMNS_FULL).toBe(true);
  });
});
