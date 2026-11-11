// A placed thing with another standing on it stays where it is, as a block under a station does. Three ways
// took the lower one away and left the upper one in the air: the button held on it, a press on it in build
// mode, and undo of the stroke that set it down. Bots found the first two
// (docs/bugs/2026-11-11-placed-thing-left-floating.md).
import type { Cell } from '../play/inputs.sim.ts';
import type { Play } from '../play/harness.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';

const at = (dx: number, dy: number): Cell => ({ place: 'grant.center', dx, dy, dz: 0 });
const SOUTH = [0, 0, 1] as const;

/** The fences standing in the column `dx` blocks east of the grant's middle. */
function column(p: Play, dx: number): number {
  const c = p.sys.region.place('grant.center').at;
  return p.sys.placeables.all().filter((placed) => placed.kind === 'fence' && placed.x === Math.floor(c.x) + dx && placed.z === Math.floor(c.z)).length;
}

export const nothingLeftFloating: Scenario = {
  name: 'nothing-left-floating',
  about: 'A fence with a fence standing on it cannot be taken back: not with the button held on it, not with a press in build mode, not with undo.',
  seed: 18,
  start: { quest: 'roof', give: { fence: 4 } },
  inputs: [
    { do: 'teleport', to: { place: 'grant.center', dz: 3 } },
    // One fence on the ground and one on top of it.
    { do: 'take', item: 'fence' },
    { do: 'use', at: at(0, -1) },
    { do: 'use', at: at(0, 0) },
    { do: 'check', what: 'two fences stand, one on the other', that: (p) => column(p, 0) === 2 },
    // The button held on the lower one.
    { do: 'dig', at: at(0, 0), face: SOUTH, fails: true },
    { do: 'check', what: 'the lower fence stayed under a held button', that: (p) => column(p, 0) === 2 },
    // A press on the lower one in build mode, which takes a placed thing back into the hand.
    { do: 'build', on: true },
    {
      do: 'run', name: 'in build mode, press on the lower fence',
      run(p) {
        const c = p.sys.region.place('grant.center').at;
        p.sys.build.point({ x: Math.floor(c.x), y: c.y, z: Math.floor(c.z), nx: 0, ny: 0, nz: 1 });
        p.sys.build.press();
        p.sys.build.cancel();
      },
    },
    { do: 'check', what: 'the lower fence stayed under a press in build mode', that: (p) => column(p, 0) === 2 },
    // A fence set down by a stroke, one more put on it by hand, and undo of the stroke.
    { do: 'stroke', from: at(2, -1), to: at(2, -1), changes: 1 },
    { do: 'build', on: false },
    { do: 'use', at: at(2, 0) },
    { do: 'build', on: true },
    { do: 'undo' },
    { do: 'build', on: false },
    { do: 'wait', seconds: 1 },
  ],
  expect(p) {
    return [
      ['both fences of the first column stand', column(p, 0) === 2],
      ['both fences of the second column stand', column(p, 2) === 2],
      ['no fence went back into the bag', p.count('fence') === 0],
      ['the upper fence can still be taken back', p.dig(Math.floor(p.sys.region.place('grant.center').at.x), p.sys.region.place('grant.center').at.y + 1, Math.floor(p.sys.region.place('grant.center').at.z), SOUTH) && column(p, 0) === 1 && p.count('fence') === 1],
    ];
  },
};
