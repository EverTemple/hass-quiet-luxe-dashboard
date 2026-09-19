import { isUsable } from '../availability';
import { LABEL_PRIMARY_CAMERA } from '../registry';
import { viewUrl } from '../config';
import { REGION_SPAN } from '../layout';
import {
  isSection,
  PATHS,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type StrategyContext,
} from '../types';
import { headingCard, sectionOf } from './heading';

const DOOR_CLASSES = ['door', 'window', 'garage_door', 'opening'] as const;

/**
 * Matches a sub-stream entity id or friendly name — "sub", "substream",
 * "sub2", …, bounded by a separator or the string edge so "Sub" doesn't also
 * swallow something like "Suburb". Dahua-style multi-entity cameras (e.g.
 * "Dining Room CCTV Main" / "Dining Room CCTV Sub") are the motivating case
 * (spec §6 "cameras").
 */
const SUB_STREAM = /(^|[_\s-])sub(stream)?(\d*)?($|[_\s-])/i;

/**
 * One entity per camera device: multi-entity camera integrations (Dahua's
 * Main/Sub/Sub 2/Sub 3) register several `camera.*` entities against the same
 * device, and every card that lists cameras must show one tile per physical
 * camera, not one per stream.
 *
 * Groups ids that share a device (via `siblingsOf`, which is device
 * membership scoped to the ids passed in) and keeps the highest-`score`
 * member of each group, breaking ties by the caller's existing order.
 * Entities with no device (an empty sibling set) pass through untouched.
 */
export function dedupeCamerasByDevice(
  ids: ReadonlyArray<string>,
  siblingsOf: (entityId: string) => ReadonlyArray<string>,
  score: (entityId: string) => number,
): ReadonlyArray<string> {
  const idSet = new Set(ids);
  /* representative id per device, and the device's members in `ids` order —
     built in a single pass so no id triggers a re-filter of the whole list. */
  const representativeOf = new Map<string, string>();
  const membersByRepresentative = new Map<string, string[]>();
  for (const id of ids) {
    let representative = representativeOf.get(id);
    if (representative === undefined) {
      representative = id;
      representativeOf.set(id, representative);
      membersByRepresentative.set(representative, []);
      for (const mate of siblingsOf(id)) {
        if (idSet.has(mate) && !representativeOf.has(mate)) {
          representativeOf.set(mate, representative);
        }
      }
    }
    membersByRepresentative.get(representative)?.push(id);
  }
  return [...membersByRepresentative.values()].map((members) =>
    members.reduce((bestId, candidate) => (score(candidate) > score(bestId) ? candidate : bestId)),
  );
}

/**
 * Per-device pick order for `dedupeCamerasByDevice`: among the usable
 * entities, a labelled primary camera wins, then a non-sub-stream entity,
 * then any usable one; unusable entities score lowest so a device whose
 * preferred stream is offline still renders through a healthy sibling.
 * Ties fall to the caller's existing order.
 */
function cameraPickScore(ctx: StrategyContext, id: string): number {
  if (!isUsable(ctx, id)) {
    return 0;
  }
  if (ctx.registry.hasLabel(id, LABEL_PRIMARY_CAMERA)) {
    return 3;
  }
  const name = ctx.states[id]?.attributes.friendly_name;
  const isSubStream = SUB_STREAM.test(id) || (typeof name === 'string' && SUB_STREAM.test(name));
  return isSubStream ? 1 : 2;
}

/** Primary camera first; cameras that are unavailable at generation are dropped. */
export function orderedCameras(ctx: StrategyContext): ReadonlyArray<string> {
  const primaryRank = (id: string): number =>
    ctx.registry.hasLabel(id, LABEL_PRIMARY_CAMERA) ? 0 : 1;
  const deduped = dedupeCamerasByDevice(
    ctx.registry.all('camera'),
    (id) => ctx.registry.siblings(id),
    (id) => cameraPickScore(ctx, id),
  );
  return deduped.filter((id) => isUsable(ctx, id)).sort((a, b) => primaryRank(a) - primaryRank(b));
}

/**
 * The camera's own motion sensor, when the integration ships one on the same
 * device — it is what promotes the card to state=motion.
 */
export function motionCompanion(ctx: StrategyContext, cameraId: string): string | undefined {
  const motions = new Set(ctx.registry.all('binary_sensor', 'motion'));
  return ctx.registry.siblings(cameraId).find((id) => motions.has(id));
}

function cameraCard(
  ctx: StrategyContext,
  entity: string,
  size: 'm' | 'l',
): LovelaceCardConfig {
  const motion = motionCompanion(ctx, entity);
  return {
    type: 'custom:quiet-luxe-camera-card',
    entity,
    size,
    ...(motion === undefined ? {} : { motion_entity: motion }),
  };
}

/**
 * Home glance: two cameras at the room-card footprint, primary first (spec §6).
 * The section spans two view columns so the pair sits 2-up exactly like the
 * Rooms grid — the old glance thumbnails were too small to read.
 */
export function securitySection(ctx: StrategyContext): LovelaceSectionConfig | null {
  const cards = orderedCameras(ctx)
    .slice(0, 2)
    .map((entity) => cameraCard(ctx, entity, 'm'));
  return sectionOf(
    headingCard(ctx.locale, 'section.cameras', viewUrl(ctx.home, PATHS.security)),
    cards,
    2,
  );
}

function motionRow(ctx: StrategyContext, entity: string): LovelaceCardConfig {
  const toggle = ctx.registry.siblings(entity).find((id) => id.startsWith('switch.'));
  return {
    type: 'custom:ql-row-door-motion',
    entity,
    kind: 'motion',
    toggle_entity: toggle,
    show_toggle: ctx.tier !== 'guest' && toggle !== undefined,
  };
}

export function doorMotionRows(
  ctx: StrategyContext,
  areaId?: string,
): ReadonlyArray<LovelaceCardConfig> {
  const source = (deviceClass: string): ReadonlyArray<string> =>
    areaId === undefined
      ? ctx.registry.all('binary_sensor', deviceClass)
      : ctx.registry.inArea(areaId, 'binary_sensor', deviceClass);
  const doors = DOOR_CLASSES.flatMap((deviceClass) => source(deviceClass)).map((entity) => ({
    type: 'custom:ql-row-door-motion',
    entity,
    kind: 'door',
  }));
  const motions = source('motion').map((entity) => motionRow(ctx, entity));
  return [...doors, ...motions];
}

/** Camera wall: webrtc-camera when engine + community card allow, else snapshot (D6). */
export function cameraWallCards(ctx: StrategyContext): ReadonlyArray<LovelaceCardConfig> {
  const useWebrtc = ctx.home.camera_engine === 'webrtc' && ctx.hasWebrtcCard;
  return orderedCameras(ctx).map((entity) =>
    useWebrtc ? { type: 'custom:webrtc-camera', entity } : cameraCard(ctx, entity, 'l'),
  );
}

export function securityViewSections(ctx: StrategyContext): ReadonlyArray<LovelaceSectionConfig> {
  return [
    /* Every band spans the whole content width (Figma 04 Desktop, Security
       107:3184): the cameras run 4 across at 1440+, 3 across at 1024, 2 on a
       tablet and 1 on a phone, because HA clamps the span to the tracks the
       view actually has. The door rows and sensors follow the same band. */
    sectionOf(headingCard(ctx.locale, 'section.cameras'), cameraWallCards(ctx), REGION_SPAN.securityBand),
    sectionOf(headingCard(ctx.locale, 'section.doors'), doorMotionRows(ctx), REGION_SPAN.securityBand),
  ].filter(isSection);
}
