// The Lamp Gallery and the Seed Vault played by the rules. The gallery is dark without a lamp; with one, its six
// glass eyes wake one after another only for a hero who crosses from wall to wall, and the bars lift for the
// Lamplighter. The Seed Vault is sealed before you; Wren walks you down the forest stair and in by the roots, and
// once the Harvester is down you push its doors open from inside.
import { FLAG } from '../content/flags.ts';
import type { Input } from '../play/inputs.sim.ts';
import type { Scenario } from '../play/scenario.sim.ts';
import { pointOf } from '../ruins/index.sim.ts';
import { GALLERY_EYES, roomOf, roomPoint } from '../ruins/rooms.sim.ts';
import { roomIs, toSpot } from './ruins-pump-house.sim.ts';

const gallery = roomOf('gallery');
/** Stands the hero at a point of the gallery. */
const inGallery = (x: number, z: number): Input => { const at = roomPoint(gallery, x, z); return { do: 'teleport', to: { x: at.x, z: at.z } }; };

export const ruinsGalleryAndSeeds: Scenario = {
  name: 'ruins-gallery-and-seeds',
  about: 'The Lamp Gallery wants a lamp, wakes eye by eye, opens for the Lamplighter and gives the second keystone; the Seed Vault is sealed, entered by the roots with Wren, and opened from inside.',
  seed: 28,
  start: { quest: 'pump' },
  inputs: [
    // ---------------------------------------------------------------- the Lamp Gallery
    { do: 'teleport', to: { place: 'lampgallery', dz: 2 } },
    { do: 'wait', seconds: 0.3 },
    { do: 'interact', prompt: 'Go into the Lamp Gallery' },
    roomIs(null),
    { do: 'run', name: 'a lamp in the bag', run: (p) => { p.sys.inventory.add('lantern', 1); } },
    { do: 'interact', prompt: 'Go into the Lamp Gallery' },
    { do: 'wait', seconds: 0.3 },
    roomIs('gallery'),
    // Straight up the middle of the walkway: no eye sees you.
    ...[28, 25, 22, 19].map((z) => inGallery(7.5, z)),
    { do: 'wait', seconds: 0.3 },
    { do: 'check', what: 'no eye sees a hero in the middle', that: (p) => p.sys.ruins.view!().eyes === 0 },
    // The second eye first: it waits for the first.
    inGallery(GALLERY_EYES[1].x - 1, GALLERY_EYES[1].z),
    { do: 'wait', seconds: 0.3 },
    { do: 'check', what: 'an eye waits for the one before it', that: (p) => p.sys.ruins.view!().eyes === 0 },
    // Wall to wall, one after another.
    ...GALLERY_EYES.flatMap((e): Input[] => [inGallery(e.x < 8 ? e.x + 1.2 : e.x - 1.2, e.z), { do: 'wait', seconds: 0.2 }]),
    { do: 'check', what: 'all six eyes are lit, and the bars are up', that: (p) => p.sys.ruins.view!().eyes === 6 && p.game.flags.is(FLAG.step('gallery', 'lamps')) },
    inGallery(7.5, 15),
    { do: 'wait', seconds: 0.5 },
    { do: 'check', what: 'the Lamplighter wakes in its room', that: (p) => p.sys.fights.active() === 9 && p.sys.fights.running!()!.keeper?.room.lamps?.length === 4 },
    { do: 'run', name: 'the rule-made player fights', run: (p) => p.sys.fights.autoplay!('perfect') },
    { do: 'wait', until: (p) => p.game.flags.is(FLAG.fightWon(9)), seconds: 300 },
    { do: 'wait', seconds: 20, until: (p) => p.sys.fights.running!() === null },
    toSpot('gallery', 'keystone'),
    { do: 'interact', prompt: 'Take the keystone' },
    toSpot('gallery', 'memory'),
    { do: 'interact', prompt: 'Touch the stone' },
    { do: 'wait', seconds: 0.2 },
    { do: 'check', what: 'eight chairs', that: (p) => p.sys.talk.current()?.scene === 28 },
    { do: 'run', name: 'the Echo is watched', run: (p) => p.talkThrough() },
    toSpot('gallery', 'out'),
    { do: 'interact', prompt: 'Go out of the gallery' },
    { do: 'wait', seconds: 0.3 },
    roomIs(null),
    { do: 'wait', seconds: 5, until: (p) => p.sys.talk.active },
    { do: 'run', name: 'say nothing to Calla', run: (p) => p.talkThrough(1) },

    // ---------------------------------------------------------------- the Seed Vault
    { do: 'run', name: 'on to the Seed Vault', run: (p) => { p.sys.quests.track?.('seeds'); p.game.flags.set(FLAG.step('seeds', 'brass'), true); p.advance(0.5); } },
    { do: 'check', what: 'Calla got there first', that: (p) => p.game.flags.is(FLAG.vaultSealed('seedvault')) },
    { do: 'teleport', to: pointOf('roots') },
    { do: 'wait', seconds: 0.3 },
    { do: 'interact', prompt: 'Roots, thick as a cart' },
    roomIs(null),
    { do: 'teleport', to: 'ruin-stair' },
    { do: 'wait', seconds: 0.3 },
    { do: 'interact', prompt: 'Go down the forest stair with Wren' },
    { do: 'check', what: 'Wren walked you down', that: (p) => p.game.flags.is(FLAG.step('seeds', 'stair')) },
    { do: 'teleport', to: pointOf('roots') },
    { do: 'wait', seconds: 0.3 },
    { do: 'interact', prompt: 'Go in through the roots' },
    { do: 'wait', seconds: 0.3 },
    roomIs('seedvault'),
    { do: 'check', what: 'in through the roots', that: (p) => p.game.flags.is(FLAG.step('seeds', 'seal')) },
    toSpot('seedvault', 'arrive', 4, 0),
    { do: 'wait', seconds: 0.5 },
    { do: 'check', what: 'the Wild Harvester wakes', that: (p) => p.sys.fights.active() === 10 && (p.sys.fights.running!()!.keeper?.room.beds?.length ?? 0) === 8 },
    { do: 'run', name: 'the rule-made player fights', run: (p) => p.sys.fights.autoplay!('perfect') },
    { do: 'wait', until: (p) => p.game.flags.is(FLAG.fightWon(10)), seconds: 400 },
    { do: 'wait', seconds: 20, until: (p) => p.sys.fights.running!() === null },
    toSpot('seedvault', 'door'),
    { do: 'check', what: 'the doors stay shut until the keystone is taken', that: (p) => p.prompt() !== 'Push the doors open' },
    toSpot('seedvault', 'keystone'),
    { do: 'interact', prompt: 'Take the keystone' },
    toSpot('seedvault', 'memory'),
    { do: 'interact', prompt: 'Touch the stone' },
    { do: 'run', name: 'the Echo is watched', run: (p) => { p.advance(0.2); p.talkThrough(); } },
    toSpot('seedvault', 'door'),
    { do: 'interact', prompt: 'Push the doors open' },
    { do: 'wait', seconds: 0.3 },
    roomIs(null),
  ],
  expect: (p) => [
    ['the gallery and the vault are cleared', p.sys.ruins.state('lampgallery') === 'cleared' && p.sys.ruins.state('seedvault') === 'cleared'],
    ['two keystones', p.sys.ruins.keystones() === 2 && p.game.flags.is(FLAG.keystone(2)) && p.game.flags.is(FLAG.keystone(3))],
    ['their stones remembered', p.game.flags.is(FLAG.memory('lampgallery')) && p.game.flags.is(FLAG.memory('seedvault'))],
    ['the stone was kept from Calla', p.game.flags.get(FLAG.choice('calla')) === 'kept'],
    ['the steps the rooms finish are done', p.game.flags.is(FLAG.step('gallery', 'lamps')) && ['stair', 'seal'].every((s) => p.game.flags.is(FLAG.step('seeds', s)))],
    ['the seeds quest is done', p.game.flags.is(FLAG.questDone('seeds'))],
  ],
};
