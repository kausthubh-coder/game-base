// A tree comes down whole: one hold of the button with the axe, and again with bare hands. Each gives its
// logs and fiber and leaves its ground free to walk on. An oak over the mosslings' rocks stays standing.
import type { GameEvents } from '../api.sim.ts';
import type { Play } from '../play/harness.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';

const felled = (p: Play): GameEvents['tree.felled'][] => p.heard.filter((event) => event.name === 'tree.felled').map((event) => event.data as GameEvents['tree.felled']);
/** The oak nearest the mossy rocks. The trees system keeps it for the mosslings. */
const shade = (p: Play): { x: number; y: number; z: number } => {
  const rocks = p.sys.region.place('grant.rocks').at;
  return [...p.sys.trees.all()].sort((a, b) => Math.hypot(a.x - rocks.x, a.z - rocks.z) - Math.hypot(b.x - rocks.x, b.z - rocks.z))[0];
};

export const fellATree: Scenario = {
  name: 'fell-a-tree',
  about: 'Two trees are felled whole, one with the axe and one by hand, and an oak over the mossy rocks refuses the axe.',
  seed: 14,
  start: { quest: 'roof' },
  inputs: [
    { do: 'teleport', to: 'grant.center' },
    { do: 'take', item: 'axe' },
    { do: 'fell' },
    { do: 'check', what: 'the axe felled one tree for three logs or more and some fiber', that: (p) => felled(p).length === 1 && p.count('oak_log') >= 3 && p.count('fiber') >= 1 },
    // An empty hand: the last quick slot holds nothing.
    { do: 'slot', index: 8 },
    { do: 'fell' },
    { do: 'check', what: 'bare hands felled a second tree', that: (p) => felled(p).length === 2 && p.sys.inventory.held() === null },
    // The mosslings' shade.
    { do: 'take', item: 'axe' },
    { do: 'run', name: 'walk up to the oak over the mossy rocks', run: (p) => { const oak = shade(p); p.teleport({ x: oak.x + 2.5, z: oak.z + 0.5 }); } },
    { do: 'run', name: 'hold the axe on it', run: (p) => { const oak = shade(p); if (p.dig(oak.x, oak.y, oak.z, [1, 0, 0])) throw new Error('the oak over the mossy rocks came down'); } },
  ],
  expect(p) {
    const trees = felled(p);
    const logs = trees.reduce((sum, tree) => sum + tree.logs, 0);
    const oak = shade(p);
    return [
      ['two trees came down', trees.length === 2],
      [`the bag holds their ${logs} logs (${p.count('oak_log')})`, logs >= 6 && p.count('oak_log') === logs],
      ['each gave fiber', p.count('fiber') >= 2],
      ['the trees system knows both are gone', trees.every((tree) => p.sys.trees.felled(tree.x, tree.z) && p.sys.trees.at(tree.x, tree.y, tree.z) === null)],
      ['their ground is free to stand on', trees.every((tree) => p.sys.nav.standable(tree.x, tree.y, tree.z))],
      ['the oak over the mossy rocks still stands, and the game said why', p.sys.trees.at(oak.x, oak.y, oak.z) !== null && p.said.includes('This belongs to the town.')],
    ];
  },
};
