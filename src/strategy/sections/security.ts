import { LABEL_PRIMARY_CAMERA } from '../registry';
import { viewUrl } from '../config';
import {
  isSection,
  PATHS,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type StrategyContext,
} from '../types';
import { headingCard, sectionOf } from './heading';

const DOOR_CLASSES = ['door', 'window', 'garage_door', 'opening'] as const;

export function orderedCameras(ctx: StrategyContext): ReadonlyArray<string> {
  const primaryRank = (id: string): number =>
    ctx.registry.hasLabel(id, LABEL_PRIMARY_CAMERA) ? 0 : 1;
  return [...ctx.registry.all('camera')].sort((a, b) => primaryRank(a) - primaryRank(b));
}

/** Home glance: two thumbnails, primary camera first (spec §6). */
export function securitySection(ctx: StrategyContext): LovelaceSectionConfig | null {
  const cards = orderedCameras(ctx)
    .slice(0, 2)
    .map((entity) => ({
      type: 'custom:quiet-luxe-camera-card',
      entity,
      form: 'glance',
      grid_options: { columns: 6 },
    }));
  return sectionOf(headingCard(ctx.locale, 'section.cameras', viewUrl(ctx.home, PATHS.security)), cards);
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
    useWebrtc
      ? { type: 'custom:webrtc-camera', entity }
      : { type: 'custom:quiet-luxe-camera-card', entity, form: 'full' },
  );
}

export function securityViewSections(ctx: StrategyContext): ReadonlyArray<LovelaceSectionConfig> {
  return [
    sectionOf(headingCard(ctx.locale, 'section.cameras'), cameraWallCards(ctx)),
    sectionOf(headingCard(ctx.locale, 'section.doors'), doorMotionRows(ctx)),
  ].filter(isSection);
}
