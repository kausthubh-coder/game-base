// Light on the ground for the town kit's models. A model's Glow only shines on itself, so each lamp, string
// of lanterns and lit doorway also gets blocks of lantern light: the block light the terrain already
// spreads, the way a lamp block lights the cobbles around it.
import { TOWN_MODELS } from '../../../content/town-kit.ts';
import type { Fill, PlanModel } from '../region.ts';
import { glowAt, modelAt, turnedFootprint, TOWN_GROUND } from './kit.ts';

/** Turns a point of a model's own space, front toward +z, by its quarter turns. */
function turn(lx: number, lz: number, turns: number): [number, number] {
  for (let i = 0; i < turns; i++) [lx, lz] = [lz, -lx];
  return [lx, lz];
}

/** A lamp post of the kit with the light of its two lanterns, over the two blocks of its post's body. */
export function lampPostAt(fills: Fill[], models: PlanModel[], id: string, cx: number, cz: number, turns = 0): void {
  modelAt(models, id, 'lamp-post', cx, cz, turns);
  glowAt(fills, Math.floor(cx), Math.floor(cz), TOWN_GROUND + 2);
}

/** A string of lanterns of the kit, with light under its middle and either side of it. */
export function stringLightsAt(fills: Fill[], models: PlanModel[], id: string, cx: number, cz: number, turns = 0): void {
  modelAt(models, id, 'string-lights', cx, cz, turns);
  for (const along of [-1.5, 0, 1.5]) {
    const [dx, dz] = turn(along, 0, turns);
    glowAt(fills, Math.floor(cx + dx), Math.floor(cz + dz));
  }
}

/** A light over the doorstep of every building and landmark, for the lanterns by its door and the glow of its windows. */
export function porchLights(fills: Fill[], models: readonly PlanModel[]): void {
  for (const m of models) {
    const def = TOWN_MODELS[m.model];
    if (def.category === 'street') continue;
    const [w, d] = turnedFootprint(m.model, m.turns);
    const [dx, dz] = turn(0.01, def.footprint[1] / 2 + 0.5, ((m.turns % 4) + 4) % 4);
    glowAt(fills, Math.floor(m.x + w / 2 + dx), Math.floor(m.z + d / 2 + dz));
  }
}
