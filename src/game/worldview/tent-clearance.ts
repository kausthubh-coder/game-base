import type { Vec3 } from '../../engine/types.ts';
import type { Game } from '../api.sim.ts';
import { clearCampTent } from '../region/ground.sim.ts';
import type { PlayerRig } from '../shell/player.ts';
import { placeAt } from './region.ts';

export function correctCampTent(game: Game, hero: PlayerRig, at: Vec3): void {
  if (!(game.flags.is('camp.pitched') || game.flags.is('quest.ground.done'))) return;
  if (!placeAt(game, 'camp')) return;
  at.x = hero.body.x; at.y = hero.body.y; at.z = hero.body.z;
  if (clearCampTent(at)) hero.correctHorizontal(at.x, at.z);
}
