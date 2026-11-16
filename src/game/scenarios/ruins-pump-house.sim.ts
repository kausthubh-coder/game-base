// The Pump House played by the rules: across the marsh to its door, in, the lever that drains the stair, down to
// the sluice chamber, the Sluice Keeper fought by the rule-made player, the keystone and the memory stone on the
// dais, and out to Calla waiting at the door.
import { FLAG } from '../content/flags.ts';
import type { Play } from '../play/harness.sim.ts';
import type { Input } from '../play/inputs.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';
import { roomOf, roomPoint, type RoomId } from '../ruins/rooms.sim.ts';

/** Stands the hero at a spot of a room, or so many blocks from it. */
export const toSpot = (room: RoomId, spot: string, dx = 0, dz = 0): Input => {
  const r = roomOf(room), s = r.spots[spot]!;
  const at = roomPoint(r, s[0] + dx, s[1] + dz);
  return { do: 'teleport', to: { x: at.x, z: at.z } };
};

export const roomIs = (room: string | null): Input => ({ do: 'check', what: `the hero is in ${room ?? 'the world'}`, that: (p: Play) => p.sys.ruins.view!().room === room });

export const ruinsPumpHouse: Scenario = {
  name: 'ruins-pump-house',
  about: 'Into the Pump House, the lever, down the drained stair, the Sluice Keeper shut down, the first keystone and its stone, and Calla at the door.',
  seed: 26,
  start: { quest: 'pump' },
  inputs: [
    { do: 'teleport', to: { place: 'pumphouse', dz: 2 } },
    { do: 'wait', seconds: 0.5 },
    { do: 'check', what: 'the marsh is crossed', that: (p) => p.game.flags.is(FLAG.step('pump', 'marsh')) },
    { do: 'interact', prompt: 'Go into the Pump House' },
    { do: 'wait', seconds: 0.3 },
    roomIs('pump-upper'),
    toSpot('pump-upper', 'stair'),
    { do: 'interact', prompt: 'The stair is under water' },
    roomIs('pump-upper'),
    toSpot('pump-upper', 'lever'),
    { do: 'interact', prompt: 'Pull the lever' },
    { do: 'wait', seconds: 0.3 },
    { do: 'check', what: 'the stair ran dry', that: (p) => p.sys.ruins.view!().lever },
    toSpot('pump-upper', 'stair'),
    { do: 'interact', prompt: 'Go down the stair' },
    { do: 'wait', seconds: 0.3 },
    roomIs('pump-lower'),
    { do: 'check', what: 'down the half-flooded halls', that: (p) => p.game.flags.is(FLAG.step('pump', 'halls')) },
    // Off the landing and into the chamber: the keeper wakes.
    toSpot('pump-lower', 'arrive', -3, 4),
    { do: 'wait', seconds: 0.5 },
    { do: 'check', what: 'the Sluice Keeper wakes in its room', that: (p) => p.sys.fights.active() === 7 && p.sys.fights.running!()!.keeper?.kind === 'sluice' },
    { do: 'check', what: 'its room has three channels and gates', that: (p) => p.sys.fights.running!()!.keeper!.room.channels!.length === 3 },
    { do: 'run', name: 'the rule-made player fights', run: (p) => p.sys.fights.autoplay!('perfect') },
    { do: 'wait', until: (p) => p.game.flags.is(FLAG.fightWon(7)), seconds: 300 },
    { do: 'wait', seconds: 20, until: (p) => p.sys.fights.running!() === null },
    toSpot('pump-lower', 'keystone'),
    { do: 'interact', prompt: 'Take the keystone' },
    { do: 'check', what: 'the first keystone', that: (p) => p.game.flags.is(FLAG.keystone(1)) && p.sys.ruins.keystones() === 1 },
    toSpot('pump-lower', 'memory'),
    { do: 'interact', prompt: 'Touch the stone' },
    { do: 'wait', seconds: 0.2 },
    { do: 'check', what: 'the stone remembers the pails', that: (p) => p.sys.talk.current()?.scene === 26 },
    { do: 'run', name: 'the Echo is watched', run: (p) => p.talkThrough() },
    { do: 'check', what: 'the stone is remembered', that: (p) => p.game.flags.is(FLAG.memory('pumphouse')) && p.game.flags.is(FLAG.scene(26)) },
    toSpot('pump-lower', 'up'),
    { do: 'interact', prompt: 'Go up the stair' },
    roomIs('pump-upper'),
    toSpot('pump-upper', 'out'),
    { do: 'interact', prompt: 'Go out to the river' },
    { do: 'wait', seconds: 0.3 },
    roomIs(null),
    { do: 'check', what: 'the vault is cleared and sealed', that: (p) => p.game.flags.is(FLAG.vaultCleared('pumphouse')) && p.game.flags.is(FLAG.vaultSealed('pumphouse')) },
    { do: 'wait', seconds: 5, until: (p) => p.sys.talk.active },
    { do: 'check', what: 'Calla is at the door', that: (p) => p.sys.talk.current()?.npc === 'calla' && p.sys.talk.current()?.scene === 25 },
    { do: 'run', name: 'show her the stone', run: (p) => p.talkThrough(0) },
  ],
  expect: (p) => [
    ['the keeper was shut down in its room', p.game.flags.is(FLAG.fightWon(7))],
    ['the steps the Pump House finishes are done', ['marsh', 'halls'].every((s) => p.game.flags.is(FLAG.step('pump', s)))],
    ['the first keystone is held and its scene played', p.game.flags.is(FLAG.keystone(1)) && p.game.flags.is(FLAG.scene(26))],
    ['Calla took the stone', p.game.flags.get(FLAG.choice('calla')) === 'shown'],
    ['the door is sealed behind you', p.sys.ruins.state('pumphouse') === 'cleared' && p.sys.ruins.view!().room === null],
  ],
};
