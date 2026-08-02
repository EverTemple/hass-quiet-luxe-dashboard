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

/** Primary camera first; cameras that are unavailable at generation are dropped. */
export function orderedCameras(ctx: StrategyContext): ReadonlyArray<string> {
  const primaryRank = (id: string): number =>
    ctx.registry.hasLabel(id, LABEL_PRIMARY_CAMERA) ? 0 : 1;
  return ctx.registry
    .all('camera')
    .filter((id) => isUsable(ctx, id))
    .sort((a, b) => primaryRank(a) - primaryRank(b));
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
