# ruins

Act 1's exploring: the three vaults with their keepers, the keystones, Calla's seals, the memory stones (Echoes),
the six shrines, the five small ruins, the Old Gate, the Rootworks, the Stag's hall and the Hall's second level
(handbook chapters 22, 23, 26 and 27; `RuinsApi` in the "act 1: ruins" section of `src/game/api.sim.ts`).

| File | What it holds |
|---|---|
| `rooms.sim.ts` | The rooms as block plans, from the approved sheets in `assets-src/concept/rooms/`: their spots, props and keepers |
| `land.sim.ts` | The rooms' ground: the land they are sunk in and their blocks, asked by the terrain as it makes a chunk |
| `index.sim.ts` | The system: doors, rooms, rules, shrines, stones, ruins, the Old Gate and the Rootworks |
| `../views/world-ruins.view.ts` | The picture: the room in its state, stones, keystones, the trench's water, the open gate, the dark gallery, the shrine's pick |
| `../views/ruins-kits.ts` | Where each piece of the vault kits stands in the Pump House's two floors, the Lamp Gallery and the Seed Vault |

## Where the rooms are

A vault's interior is not under its door. Every room stands in the rooms' own ground far south of the map
(`ROOMS` in `rooms.sim.ts`, x -600 to about 20, z 2400), as Saltgate does: a door in the world moves the hero into
its room (`ruins.moved`), and the room's way out brings them back. Each room is a court open to the sky, sunk in rock
on its north and west sides, low on its south and east sides so the camera sees in. (The three vaults are drawn
as underground rooms over that same ground: see below.) The land and the blocks are made
from the plans, so nothing of a room is in a save; what a room opens as it is played (the gallery's bars, the root
locks, the drained stair, the gallery's lamps) the system lays on top from its state, again after a load.

## How each place plays

| Place | What the player does | What it sets |
|---|---|---|
| The Pump House | E at the door. Pull the lever: the stair drains. Down to the sluice chamber: the Sluice Keeper (fight 7) starts off the landing. Take the keystone, touch the stone (scene 26). Out: cleared, sealed, and Calla (scene 25) at the first vault. | `step.pump.marsh` on reaching the door, `step.pump.halls` down the stair, `keystone.1`, `memory.pumphouse`, `vault.pumphouse.cleared` and `.sealed` |
| The Lamp Gallery | Needs a lamp in the bag (`LIGHTS`). Six glass eyes each see the hero within 2.6 blocks once the one before is lit; they stand on alternate walls, so the walkway's middle wakes none. All six lift the bars: the Lamplighter (fight 9). | `step.gallery.lamps`, `keystone.2`, `memory.lampgallery` |
| The Seed Vault | Sealed by Calla once `seeds` starts. Wren walks you down the forest stair (`ruin-stair`); then the root gap north of the door lets you in. The Wild Harvester (fight 10). Out by the roots, or push the doors open once the keystone is yours. | `vault.seedvault.sealed`, `step.seeds.stair`, `step.seeds.seal`, `keystone.3`, `memory.seedvault` |
| The Old Gate | With three keystones, E plays scene 32. Open, it takes your own rope the first time (a rope ladder, or two vine rope). | (scene 32 is the dialogue's) |
| The Rootworks | Three levels. Each has a dead machine rebuilt from parts in the pack (`MACHINES`: a gear shaft; a sensor and a switch lamp; a harvester arm), which opens its root lock and the rope down. A waystone on each takes you home; the terraces' waystone brings you back to the deepest level. | `step.keystones.climb`, `step.keystones.machines` |
| The Stag's hall | The Custodian's words (`scene.33.before`), then `startStag` at the hall's middle. Out under the sky once it is free. | (fight 12 and scene 33 are the fights' and dialogue's) |
| The Hall's second level | Opens in the court after the Stag: a room with the table of eight chairs. | `step.green.level` |
| The shrines | E with the Mark: `shrine.asked`, and the view asks heart or stamina (`restore`). | `shrine.<id>`; `step.echo.shrine` for the oak shrine |
| The small ruins | The sunk tower and the forest stair have a memory stone each (lines in `RUIN_ECHOES`); the mill gives two old brass after fight 6; the south wall's mural and the watch post (under Calla's seal) give a look. | `memory.ruin-tower`, `memory.ruin-stair` |
| The first Echo | The dull stone under the mural plays scene 24; it waits for the stone interaction, even while the quest step is open. A stone touched again gives its `memory.<id>.again` line. | `memory.hall` |

A vault's scene set any other way (`skipTo`, the bots) also sets its keystone and its memory, so the act still plays a
flag at a time. A keeper that ended in a fall or a walk-out waits three seconds before it starts again; nothing in a
room can be used while its fight runs.

## Seams

- The fights system owns the keepers and the Stag; this one builds their rooms as `KeeperRoom`s and starts them.
- The story director plays scene 25 when the first vault is cleared, and may play `scene.33.before`
  itself as their steps open; this system starts them too, from the stone and the hall.
- The landmarks view (`world-landmarks.view.ts`) shows a shrine restored, the Seed Vault's doors open once it is
  cleared, the Old Gate hidden while this view draws it open, and the terraces' waystone awake.
- Not built: map pins by story (the three vaults in quest 10, Mina's ruin a day), waystone travel between the
  world's waystones, the first Gate waking in quest 17 (the Hall's), the stone Calla burns as an item.

## The three vaults are kits

The Pump House's two floors, the Lamp Gallery and the Seed Vault are drawn from their sheets
(`assets-src/concept/rooms/`) with the kit in `src/features/props/builders/rooms.ts`: walls with their arched bays,
paving, the dark rock round the room, and what stands in it. `../views/ruins-kits.ts` says where each piece stands,
reading every place the rules use from `rooms.sim.ts`. While the hero is in one of them the view draws nothing of the
world above (the land, the sky, the block world), and lights the room for itself.

- The plans are unchanged: collision is still the plan's blocks. The kit rooms' walls are laid as invisible barriers
  (`stampRooms`), because the kit draws them.
- What the kit draws with no block under it can be walked through: the gallery's sight-break piers, the sluice
  frames, the lamp posts, the planters, the chairs. A plan cell (`x`) for each is the fix, with the scenarios run again.
- The trench is drawn sunk and full of water, but the plan keeps its bed at the floor's height, because the Sluice
  Keeper and the hero cross it. The hero wades.
- The view moves: the wheel's shaft and its gears, the three sluice gates and their flumes, the water (still, flooded,
  falling at the inlet and the outlet), the flooded stair, the gallery's bars (they sink into the floor) and the Wild
  Harvester's arm, which turns the way the keeper faces. `vaultMovingParts` in the builder file lists each part's pivot.

## Stand-ins that need a model

The rope, the Rootworks' root locks (`giantRoot` scaled down) and the Stag's ring of boulders (`boulders` scaled
down). The Rootworks, the Stag's hall and the Hall's second level are still blocks laid from their plans. The three
keepers are sprites of other beasts, tinted (`src/game/fightview/world.ts`); the Wild Harvester's is hidden behind
its modelled arm.

## Checks

`bun test src/game/ruins`, and the scenarios `ruins-pump-house`, `ruins-gallery-and-seeds`, `ruins-rootworks` and
`ruins-shrines` (`bun tools/sim.ts scenarios <name>`).
