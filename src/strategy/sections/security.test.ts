import { describe, expect, it } from 'vitest';
import { makeEntity } from '../../testing/mock-hass';
import {
  labelId,
  makeContext,
  mockArea,
  mockDevice,
  mockLabel,
  mockRegEntity,
} from '../../testing/mock-registry';
import {
  cameraWallCards,
  dedupeCamerasByDevice,
  doorMotionRows,
  motionCompanion,
  orderedCameras,
  securitySection,
  securityViewSections,
} from './security';

const snapshot = {
  areas: [mockArea('living', 'Living Room')],
  devices: [mockDevice('dev-motion', 'living')],
  labels: [mockLabel('ql-primary-camera')],
  entities: [
    mockRegEntity('camera.back', {}),
    mockRegEntity('camera.front', {
      labels: [labelId('ql-primary-camera')],
      device_id: 'dev-motion',
    }),
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
  /* The glance used to be a 60x34 thumbnail nobody could read. It is now a
     room-card footprint, two per row in a two-column section. */
  it('puts the ql-primary-camera first and shows two room-sized cards', () => {
    const ctx = makeContext({ snapshot, entities });
    expect(orderedCameras(ctx)).toEqual(['camera.front', 'camera.back', 'camera.side']);
    const section = securitySection(ctx);
    expect(section?.cards).toHaveLength(3); // heading + 2 cards
    expect(section?.column_span).toBe(2);
    expect(section?.cards[1]).toEqual({
      type: 'custom:quiet-luxe-camera-card',
      entity: 'camera.front',
      size: 'm',
      motion_entity: 'binary_sensor.hall_motion',
    });
    expect(section?.cards[2]).toEqual({
      type: 'custom:quiet-luxe-camera-card',
      entity: 'camera.back',
      size: 'm',
    });
  });

  it('wires the camera to a motion sensor only when they share a device', () => {
    const ctx = makeContext({ snapshot, entities });
    expect(motionCompanion(ctx, 'camera.front')).toBe('binary_sensor.hall_motion');
    expect(motionCompanion(ctx, 'camera.back')).toBeUndefined();
  });

  it('returns null when there are no cameras', () => {
    expect(securitySection(makeContext({}))).toBeNull();
  });
});

describe('dedupeCamerasByDevice', () => {
  const siblingsFrom = (groups: Readonly<Record<string, ReadonlyArray<string>>>) =>
    (id: string): ReadonlyArray<string> => groups[id] ?? [];
  const firstWins = (ids: ReadonlyArray<string>) => (id: string): number =>
    -ids.indexOf(id);

  it('keeps one entity per device when two devices are present', () => {
    const ids = ['camera.dining_room_main', 'camera.dining_room_sub', 'camera.living_room_main'];
    const groups = {
      'camera.dining_room_main': ['camera.dining_room_sub'],
      'camera.dining_room_sub': ['camera.dining_room_main'],
      'camera.living_room_main': [],
    };
    expect(dedupeCamerasByDevice(ids, siblingsFrom(groups), firstWins(ids))).toEqual([
      'camera.dining_room_main',
      'camera.living_room_main',
    ]);
  });

  it('keeps entities with no device untouched', () => {
    const ids = ['camera.dining_room_main', 'camera.parking'];
    expect(dedupeCamerasByDevice(ids, siblingsFrom({}), firstWins(ids))).toEqual(ids);
  });

  it('picks the highest-scored member of a device, tie-breaking on the caller order', () => {
    const ids = ['camera.a', 'camera.b', 'camera.c'];
    const groups = {
      'camera.a': ['camera.b', 'camera.c'],
      'camera.b': ['camera.a', 'camera.c'],
      'camera.c': ['camera.a', 'camera.b'],
    };
    const score = (id: string): number => (id === 'camera.b' ? 5 : 0);
    expect(dedupeCamerasByDevice(ids, siblingsFrom(groups), score)).toEqual(['camera.b']);
  });
});

describe('orderedCameras Dahua-style multi-stream de-duplication', () => {
  const dahuaSnapshot = {
    areas: [],
    devices: [mockDevice('dev-dining')],
    entities: [
      mockRegEntity('camera.dining_room_main', { device_id: 'dev-dining' }),
      mockRegEntity('camera.dining_room_sub', { device_id: 'dev-dining' }),
      mockRegEntity('camera.dining_room_sub_2', { device_id: 'dev-dining' }),
      mockRegEntity('camera.dining_room_sub_3', { device_id: 'dev-dining' }),
    ],
  };

  it('collapses a 4-entity Dahua device to its main stream', () => {
    const ctx = makeContext({
      snapshot: dahuaSnapshot,
      entities: [
        makeEntity('camera.dining_room_main', 'idle', { friendly_name: 'Dining Room CCTV Main' }),
        makeEntity('camera.dining_room_sub', 'idle', { friendly_name: 'Dining Room CCTV Sub' }),
        makeEntity('camera.dining_room_sub_2', 'idle', { friendly_name: 'Dining Room CCTV Sub 2' }),
        makeEntity('camera.dining_room_sub_3', 'idle', { friendly_name: 'Dining Room CCTV Sub 3' }),
      ],
    });
    expect(orderedCameras(ctx)).toEqual(['camera.dining_room_main']);
  });

  it('keeps the usable sub stream when the main stream is unavailable', () => {
    const ctx = makeContext({
      snapshot: dahuaSnapshot,
      entities: [
        makeEntity('camera.dining_room_main', 'unavailable'),
        makeEntity('camera.dining_room_sub', 'idle', { friendly_name: 'Dining Room CCTV Sub' }),
        makeEntity('camera.dining_room_sub_2', 'unavailable'),
        makeEntity('camera.dining_room_sub_3', 'unavailable'),
      ],
    });
    expect(orderedCameras(ctx)).toEqual(['camera.dining_room_sub']);
  });

  it('lets a user-labelled sub stream win even though it is a sub stream', () => {
    const ctx = makeContext({
      snapshot: {
        areas: [],
        devices: [mockDevice('dev-dining')],
        labels: [mockLabel('ql-primary-camera')],
        entities: [
          mockRegEntity('camera.dining_room_main', { device_id: 'dev-dining' }),
          mockRegEntity('camera.dining_room_sub', {
            device_id: 'dev-dining',
            labels: [labelId('ql-primary-camera')],
          }),
        ],
      },
      entities: [
        makeEntity('camera.dining_room_main', 'idle'),
        makeEntity('camera.dining_room_sub', 'idle', { friendly_name: 'Dining Room CCTV Sub' }),
      ],
    });
    expect(orderedCameras(ctx)).toEqual(['camera.dining_room_sub']);
  });

  it('falls back to a usable sibling when the labelled primary stream is unavailable', () => {
    const ctx = makeContext({
      snapshot: {
        areas: [],
        devices: [mockDevice('dev-dining')],
        labels: [mockLabel('ql-primary-camera')],
        entities: [
          mockRegEntity('camera.dining_room_main', {
            device_id: 'dev-dining',
            labels: [labelId('ql-primary-camera')],
          }),
          mockRegEntity('camera.dining_room_sub', { device_id: 'dev-dining' }),
        ],
      },
      entities: [
        makeEntity('camera.dining_room_main', 'unavailable'),
        makeEntity('camera.dining_room_sub', 'idle', { friendly_name: 'Dining Room CCTV Sub' }),
      ],
    });
    expect(orderedCameras(ctx)).toEqual(['camera.dining_room_sub']);
  });

  it('matches a sub stream by friendly_name alone when the entity id gives no hint', () => {
    const ctx = makeContext({
      snapshot: {
        areas: [],
        devices: [mockDevice('dev-garden')],
        entities: [
          mockRegEntity('camera.cam_1', { device_id: 'dev-garden' }),
          mockRegEntity('camera.cam_2', { device_id: 'dev-garden' }),
        ],
      },
      entities: [
        makeEntity('camera.cam_1', 'idle', { friendly_name: 'Garden CCTV Main' }),
        makeEntity('camera.cam_2', 'idle', { friendly_name: 'Garden CCTV Sub' }),
      ],
    });
    expect(orderedCameras(ctx)).toEqual(['camera.cam_1']);
  });

  it('does not treat "suburb" as a sub stream (no false positive on a substring match)', () => {
    const ctx = makeContext({
      snapshot: {
        areas: [],
        devices: [mockDevice('dev-suburb')],
        entities: [
          mockRegEntity('camera.suburb_view', { device_id: 'dev-suburb' }),
          mockRegEntity('camera.suburb_view_sub', { device_id: 'dev-suburb' }),
        ],
      },
      entities: [
        makeEntity('camera.suburb_view', 'idle', { friendly_name: 'Suburb View' }),
        makeEntity('camera.suburb_view_sub', 'idle', { friendly_name: 'Suburb View Sub' }),
      ],
    });
    // "suburb_view" must score as the non-sub-stream entity and win the
    // device slot; if the "sub" substring matched, the two entities would
    // score equally and the tie-break would pick "suburb_view" only by luck
    // of ordering, not because the regex correctly ignored "suburb".
    expect(orderedCameras(ctx)).toEqual(['camera.suburb_view']);
  });

  it('recognises a realistic Dahua NVR sub-stream channel id', () => {
    const ctx = makeContext({
      snapshot: {
        areas: [],
        devices: [mockDevice('dev-nvr')],
        entities: [
          mockRegEntity('camera.dahua_nvr_mediaprofile_channel1_mainstream', { device_id: 'dev-nvr' }),
          mockRegEntity('camera.dahua_nvr_mediaprofile_channel1_substream1', { device_id: 'dev-nvr' }),
        ],
      },
      entities: [
        makeEntity('camera.dahua_nvr_mediaprofile_channel1_mainstream', 'idle'),
        makeEntity('camera.dahua_nvr_mediaprofile_channel1_substream1', 'idle'),
      ],
    });
    expect(orderedCameras(ctx)).toEqual(['camera.dahua_nvr_mediaprofile_channel1_mainstream']);
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

  it('falls back to large snapshot cards otherwise', () => {
    const ctx = makeContext({ home: { camera_engine: 'webrtc' }, snapshot, entities });
    expect(cameraWallCards(ctx)[0]).toEqual({
      type: 'custom:quiet-luxe-camera-card',
      entity: 'camera.front',
      size: 'l',
      motion_entity: 'binary_sensor.hall_motion',
    });
  });

  it('runs every security band across the whole content width', () => {
    const sections = securityViewSections(makeContext({ snapshot, entities }));
    expect(sections.map((section) => section.column_span)).toEqual([4, 4]);
  });

  it('view sections cover the wall and the door/motion list; empty home yields none', () => {
    const sections = securityViewSections(makeContext({ snapshot, entities }));
    expect(sections).toHaveLength(2);
    expect(securityViewSections(makeContext({}))).toEqual([]);
  });

  it('drops cameras that are unavailable at generation, section and all', () => {
    const ctx = makeContext({
      snapshot: { areas: [], devices: [], entities: [mockRegEntity('camera.dead')] },
      entities: [makeEntity('camera.dead', 'unavailable')],
    });
    expect(orderedCameras(ctx)).toEqual([]);
    expect(securitySection(ctx)).toBeNull();
  });
});
