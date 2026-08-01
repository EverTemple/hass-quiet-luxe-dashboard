import { describe, expect, it } from 'vitest';
import { makeEntity } from '../../testing/mock-hass';
import { makeContext, mockArea, mockDevice, mockRegEntity } from '../../testing/mock-registry';
import {
  cameraWallCards,
  doorMotionRows,
  orderedCameras,
  securitySection,
  securityViewSections,
} from './security';

const snapshot = {
  areas: [mockArea('living', 'Living Room')],
  devices: [mockDevice('dev-motion', 'living')],
  entities: [
    mockRegEntity('camera.back', {}),
    mockRegEntity('camera.front', { labels: ['ql-primary-camera'] }),
    mockRegEntity('camera.side', {}),
    mockRegEntity('binary_sensor.front_door', {}),
    mockRegEntity('binary_sensor.hall_motion', { device_id: 'dev-motion' }),
    mockRegEntity('switch.hall_motion_detection', { device_id: 'dev-motion' }),
  ],
};
const entities = [
  makeEntity('camera.back', 'idle'),
  makeEntity('camera.front', 'idle'),
  makeEntity('camera.side', 'idle'),
  makeEntity('binary_sensor.front_door', 'off', { device_class: 'door' }),
  makeEntity('binary_sensor.hall_motion', 'off', { device_class: 'motion' }),
  makeEntity('switch.hall_motion_detection', 'on'),
];

describe('orderedCameras / securitySection', () => {
  it('puts the ql-primary-camera first and shows two glance thumbs', () => {
    const ctx = makeContext({ snapshot, entities });
    expect(orderedCameras(ctx)).toEqual(['camera.front', 'camera.back', 'camera.side']);
    const section = securitySection(ctx);
    expect(section?.cards).toHaveLength(3); // heading + 2 thumbs
    expect(section?.cards[1]).toEqual({
      type: 'custom:quiet-luxe-camera-card',
      entity: 'camera.front',
      form: 'glance',
      grid_options: { columns: 6 },
    });
  });

  it('returns null when there are no cameras', () => {
    expect(securitySection(makeContext({}))).toBeNull();
  });
});

describe('doorMotionRows', () => {
  it('emits door rows and motion rows with discovered same-device toggles', () => {
    const ctx = makeContext({ snapshot, entities });
    expect(doorMotionRows(ctx)).toEqual([
      { type: 'custom:ql-row-door-motion', entity: 'binary_sensor.front_door', kind: 'door' },
      {
        type: 'custom:ql-row-door-motion',
        entity: 'binary_sensor.hall_motion',
        kind: 'motion',
        toggle_entity: 'switch.hall_motion_detection',
        show_toggle: true,
      },
    ]);
  });

  it('hides motion toggles from the guest tier (spec §9)', () => {
    const ctx = makeContext({ snapshot, entities, tier: 'guest' });
    const motion = doorMotionRows(ctx).find((row) => row.kind === 'motion');
    expect(motion?.show_toggle).toBe(false);
  });

  it('scopes to an area when given', () => {
    const ctx = makeContext({ snapshot, entities });
    expect(doorMotionRows(ctx, 'living').map((row) => row.entity)).toEqual([
      'binary_sensor.hall_motion',
    ]);
  });
});

describe('cameraWallCards / securityViewSections', () => {
  it('uses webrtc-camera when the engine is webrtc AND the card is installed', () => {
    const ctx = makeContext({
      home: { camera_engine: 'webrtc' },
      snapshot,
      entities,
      hasWebrtcCard: true,
    });
    expect(cameraWallCards(ctx)[0]).toEqual({ type: 'custom:webrtc-camera', entity: 'camera.front' });
  });

  it('falls back to snapshot full cards otherwise', () => {
    const ctx = makeContext({ home: { camera_engine: 'webrtc' }, snapshot, entities });
    expect(cameraWallCards(ctx)[0]).toEqual({
      type: 'custom:quiet-luxe-camera-card',
      entity: 'camera.front',
      form: 'full',
    });
  });

  it('view sections cover the wall and the door/motion list; empty home yields none', () => {
    const sections = securityViewSections(makeContext({ snapshot, entities }));
    expect(sections).toHaveLength(2);
    expect(securityViewSections(makeContext({}))).toEqual([]);
  });
});
