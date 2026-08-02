import { isUsable } from '../availability';
import { viewUrl } from '../config';
import {
  isSection,
  PATHS,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  type StrategyContext,
} from '../types';
import { headingCard, sectionOf } from './heading';

/**
 * Players worth showing: a player that is merely idle is a speaker the home
 * has, a player that reads unavailable is one it does not (spec §8). Playing
 * first, then whatever is on.
 */
export function orderedPlayers(ctx: StrategyContext, areaId?: string): ReadonlyArray<string> {
  const ids =
    areaId === undefined ? ctx.registry.all('media_player') : ctx.registry.inArea(areaId, 'media_player');
  const playingRank = (id: string): number => (ctx.states[id]?.state === 'playing' ? 0 : 1);
  return ids.filter((id) => isUsable(ctx, id)).sort((a, b) => playingRank(a) - playingRank(b));
}

/** Home/room "Music" collapsed bar for the hero player (spec §6). */
export function mediaSection(ctx: StrategyContext, areaId?: string): LovelaceSectionConfig | null {
  const players = orderedPlayers(ctx, areaId);
  if (players.length === 0) {
    return null;
  }
  const nav = areaId === undefined ? viewUrl(ctx.home, PATHS.media) : undefined;
  return sectionOf(headingCard(ctx.locale, 'section.music', nav), [
    { type: 'custom:quiet-luxe-media-card', entity: players[0], form: 'bar' },
  ]);
}

/** Sonos group builder rows (spec §6); leader = hero Sonos speaker. */
export function sonosGroupRows(ctx: StrategyContext): ReadonlyArray<LovelaceCardConfig> {
  const sonos = orderedPlayers(ctx).filter((id) => ctx.registry.platformOf(id) === 'sonos');
  if (sonos.length < 2) {
    return [];
  }
  const leader = sonos[0];
  return sonos.map((entity) => ({
    type: 'custom:quiet-luxe-media-card',
    entity,
    form: 'group-row',
    leader,
  }));
}

/** Media page: full-player hero, per-player bars, group builder when media_rich. */
export function mediaViewSections(ctx: StrategyContext): ReadonlyArray<LovelaceSectionConfig> {
  const players = orderedPlayers(ctx);
  if (players.length === 0) {
    return [];
  }
  const hero = sectionOf(headingCard(ctx.locale, 'section.music'), [
    { type: 'custom:quiet-luxe-media-card', entity: players[0], form: 'player' },
  ]);
  const speakers = sectionOf(
    headingCard(ctx.locale, 'section.speakers'),
    players.slice(1).map((entity) => ({ type: 'custom:quiet-luxe-media-card', entity, form: 'bar' })),
  );
  const groups = ctx.home.media_rich
    ? sectionOf(headingCard(ctx.locale, 'section.groups'), sonosGroupRows(ctx))
    : null;
  return [hero, speakers, groups].filter(isSection);
}
