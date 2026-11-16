# Act 1, built

Kausthubh, 2026-11-12: "Implement the whole act 1, improve the dialogue, improve the 2D and 3D skills. First
create reference and concept art for everything and take my approval. Use Sol agents for the sprites and 2D
assets to make it high quality: redo the ones for the axe, the sword and the rest. Use Astra for 3D models,
Opus agents to implement, Opus and Sol to playtest and test. Build everything out, improve and polish
everything, and deploy it. Use a swarm of subagents, and run in a loop: testing, creating assets, implementing."

The design is the handbook (`~/dev/sandbox/game-look-test/design`, shown at port 5361): act 1 is chapters 20
to 30. Quest by quest: chapter 27, made from `game-look-test/playthrough/content.js`. Scenes and lines:
chapter 22. People: chapter 28. Fights: chapter 23 and the fight lab. Building: chapter 30 and
`playthrough/farms.js`. The map: chapter 26 and `docs/greenhollow-world.md`. The opening film: chapter 29 and
the painted-layers cut on `lab/opening`. Cutscenes: `docs/cutscenes.md` on `experiment`.

## Branches

`act1` is the integration branch: the world plan (`world/greenhollow`), the fight lab (`lab/fight`), `main`
and the playtest copy's first night (`playtest`). Every helper cuts its branch from `act1` and the coordinator
merges it back. Helper branches are named `act1-<slice>`: git cannot make `act1/<slice>` while `act1` exists. Nothing goes to `main` or `playtest` without the coordinator; the release goes to the playtest
copy (`/playtest/`) first, and to `/` when Kausthubh says so.

## The stages

| Stage | What | Who | Gate |
|---|---|---|---|
| 0. Concepts | A reference sheet for everything act 1 shows: people, creatures, weapons and tools, goods, machine parts, buildings, rooms, the new interface | Sol painters | **The coordinator approves each sheet** and sends weak ones back. Kausthubh, 2026-11-12: "Don't ask me for approval, just look at it yourself and improve if needed. I want this to be grand scale, a real kingdom feel." |
| 1. Assets | Final sprites, portraits, icons and textures from the approved sheets | Sol | The asset checks pass, and the coordinator compares each with its sheet |
| 1. Models | 3D models from the approved sheets | Astra | The prop checks pass, and a picture beside its sheet |
| 1. Systems | The game's rules and screens, one system a helper | Opus | `bun run check`, `bun run lint`, and the system's own checks |
| 2. The loop | Play, file bugs, fix, polish, play again | Opus and Sol testers, then builders | Each round ends with the whole act playable from a new game |
| 3. Release | The playtest copy, then `/` on his word | Coordinator, `ship-game` | `bun run verify --full` |

Work that needs no approval (the world, the systems' rules, the dialogue's second pass) starts at once and
uses stand-in art until the approved art lands.

## Concepts

Each sheet goes in `assets-src/concept/<set>/<key>.webp`, about 1600 wide, in the painted world's style: front,
side and back or three-quarter views, colour and material names, the hero for scale, and for anything shown as
a sprite, how it reads at sprite size. The coordinator puts every sheet on the concepts page in the
playthrough site (`#concepts`), numbered, and he approves or asks for changes by number.

| Set | Folder | What |
|---|---|---|
| People, home | `people-home` | The hero (the look you pick), Hobb, Dax, Mina, Gus, Wren, Tansy, Holt |
| People, town and Order | `people-world` | Queen Maren, Tamsin, the Green Mother, Calla, Brother Aldric, Ren, townsfolk |
| The old ones | `people-old` | The Custodian, Ilara and Auren in the memories, the Verdant Stag chained and freed |
| Creatures | `creatures` | Fox (well and Blighted), thistlehog, Bramble (Blighted and well), lynx, gearling, rootsnare, mossling, burrower, lanternfly, frog, bee |
| Keepers | `keepers` | The Sluice Keeper, the Lamplighter, the Wild Harvester |
| Weapons and tools | `gear` | Sword, bow and staff at four bench steps, armour at four steps, the six fittings, the axe, hoe, spade, can and saw |
| The kit and goods | `goods` | The six kit things, every farm good and found thing, coin, keystones, memory and blessing stones, meals |
| Machine parts | `parts` | Ditch, lamp, workbench, waterwheel, gear shaft, lever, sprinkler, chute, collector chest, pusher, sensor, switchable lamp, harvester arm, saw arm, bee box, pit, clapper, hatch roof, fence |
| Your settlement | `settlement` | Camp, kitchen and oven, beds, a home, the smokehouse, seed shed, map room, beast yard, dinner table, the Heartstone's court |
| Rooms | `rooms` | The guild hall at Saltgate, Ilara's Hall inside, the Pump House, the Lamp Gallery, the Seed Vault, the Rootworks' three levels, the Stag's hall |
| The interface | `interface` | In the game's Gilded Hearth look (`docs/ui-look.md`): the field book page, the rate tag, the bench, the kit slots, the ledger, the dinner table's asks, the Heartstone gauge, a dialogue box with portraits |

### Regions

Kausthubh, 2026-11-12: "Don't we need more? We are building a city, the Old Forest, the Seed Vault, the High Road,
Ilara's Hall, the Mere, Hollowmere, south Saltgate, Lantern Marsh, the Pump House, the Lamp Gallery, east the
Aukai islands, the terraces, the Dawn, the grey forest. We need more assets and concept art." So each region gets
a package, painted before its kit is built: establishing vistas (wide, at ground level, by night, one detail), a
plan from above for anything with streets or rooms, and numbered kit sheets of everything that dresses it, each
piece with its size in blocks, so a kit sheet is Astra's build list.

| Package | Folder | What |
|---|---|---|
| Hollowmere, the city | `region-hollowmere` | Districts (the Hollow Oak and the green, the market, the granary, the quay and warehouses, the chapel quarter, homes, the edge fields with their pumps), a plan of streets, building types and their parts, market stalls, clutter, signs, people's spots |
| Saltgate and the Mere | `region-saltgate` | The port where you grew up: harbour, the guild hall outside, the quay, a lighthouse, ships and the ferry. The river from the sea to the north hills: banks, bridges, the landing, boats, reeds, the bend |
| The forests | `region-forests` | The Old Forest's groves, giant trees, undergrowth, forest ruins and the Seed Vault's surroundings; the grey forest, the same pieces drained; the edge between them |
| The north and the horizon | `region-north` | The High Road's whole length (dark and lit stretches, waystations, where paths climb to it), the terraces and the Rootworks' mouth, the Dawn up close and from afar, and the horizon: the desert of Khetara west, the Aukai islands east across the water, the sea south, mountains round the valley |
| The marsh and the caves | `region-southeast` | Lantern Marsh (pools, islands, boardwalks, stilt huts, the marsh shrine), the Pump House's river and banks, the cave hills, the root caves and the way down to the Lamp Gallery |
| Home | `region-home` | Your plot and its hill with the Hall's door, the oak hill and its shrine, the dead garden, the bridge and the road to town, the landing, the meadows round them |

The world's landmarks already have approved-to-build sheets in `assets-src/concept/1-high-road` to
`8-set-pieces`.

## Systems

One Opus helper each, starting once the gap map (`docs/act1-gaps.md`) says what exists. The coordinator writes
each brief from the gap map, with the contract between systems.

| System | What act 1 needs |
|---|---|
| The opening | Title with one button, the painted-layers film, grant day in the guild hall at Saltgate, the ferry |
| Quests and scenes | The 21 quests as data, scenes as talk, staged or film, choices that the story remembers |
| Dialogue | The second pass of every line, portraits, the box, voices for new lines |
| Fights in the world | The fight lab's fights at their twelve places, Blight depth against the Heartstone, calming, companions |
| Farms and machines | Creatures with rules, wild and beast farms, give or take, the rate tag, the parts, the bench, fittings, the kit |
| People and the settlement | Needs, wishes, jobs, the dinner table, who comes, the Heartstone, the settlement's steps |
| Ruins and vaults | Small ruins, shrines, memory stones, the three vaults with their keepers, the Rootworks and the Stag |
| Goods and coin | The granary, the market, the queen's ledger, standing orders, the pump |
| The world | `docs/greenhollow-world.md` |

## The loop

After each merge round:

1. A Sol tester plays the act from a new game with the real keys (`playtest-game` skill), as far as it goes,
   and files what a player would hit in `docs/bugs/`.
2. An Opus tester plays it for feel and story: does each scene land, is anything confusing, dull or ugly.
3. The coordinator sorts the findings: small ones it fixes, the rest go to a builder as the next brief.
4. Merge, check, play again.

The round's state is kept at the end of this page, so a fresh coordinator can pick it up.

## Polish later

- Rerunning `tools/sprites/beasts-act1.mjs` writes `fox-blighted.png` back to 6 rows: run
  `tools/sprites/camp-sprites.mjs` after it.
- Every model reads plainer than its sheet (buildings boxy, stone too regular, roots thin): an architecture
  toolkit, then a polish round with a written list of differences per model.

- The High Road (`act1-models-1`, merged): the piers are plainer, the roots thinner and the stone cleaner than
  the sheet. Weathering, more substantial roots and a final beside-the-sheet pass on the painted meadow.
- The Mac ran at a load of 35 to 94 on 10 cores with twelve model builders: tests time out. Start no more than
  about eight helpers at once.

## Seams between systems (settle at the merges)

- **Two dinner tables.** The settlement owns the dinner (its rules, hearts and the approved panel in
  `ui-home.view.ts`) and emits `dinner.asked`; the talk system also opens a dinner in the dialogue box on that event
  (`talk/index.sim.ts`, the `dinner.asked` listener) and the story director plays its own `dinner.*` steps
  (`story/scenes.sim.ts`, `play`). Keep the settlement's: the story's dinner step should complete on
  `choice.dinner`. `dinner.granted` is now one event with an optional `line`.
- The story's `FLAG.need(who, bed|meal|lamp)` should be set by the settlement, for the walk-up need lines.
- Goods should start `pump.running` from `choice.pump` (the story sets only the choice).
- The end card (`menus.ui.ts`) still says "End of the first part"; `JOB_BARKS` in `people.ts` names Mira; the
  Custodian's Heartstone lines fire at 3, 6 and 10; the hall README names `tamsin.mark`; `docs/play/act1.md`,
  `tools/play-act1.mjs` and `play-ui.mjs` still play the old quests. Nothing opens the Custodian's walk-up lines
  away from the plinth.

- Build mode does not turn the hero to the cursor, so a placed building's door faces away from the camera
  (farms and machines own build mode). Found by the settlement builder.
- Tansy arrives on three `bee_box` placeables, which the farms builder makes.
- Jobs change farms through `job.<id>` flags: the farms builder reads them. Dax's watch is the fights builder's
  night visitors.
- `CUSTODIAN_HEART` in `dialogue.ts` is no longer read: the story builder removes it.
- The old cast (Odo, Mira, Juniper, Brack) still has almanac pages, voices and tests: the story builder removes them.
- Buying the 150-coin ring of land belongs to goods and coin (wave 2).

## Waiting to be wired in

- The Pump House's wheel: `pumpHouseParts()` in `builders/group-4.ts` gives the wheel apart from the house; place it at
  `[-4.8, 7, 6]` and set `rotation.z = seconds * 0.12`.
- The weir's water: `weirWater()` gives a curved sheet with UVs; draw it with a transparent, double-sided river
  material, depth writing off, foam scrolling along V.
- The Hall door: `hallDoorParts()` gives `hallFrame`, `hallLeafLeft` and `hallLeafRight` for the opening.
- The Dawn: an opaque glowing shell today; the sheet wants it translucent with a soft halo (a material for it).
- The forest stair: place it at the ground's height minus 3 (its top tread is at local y 3), and dig the ground away.
- The High Road stair meets the arch's new variant 3 `stairGap`: the land should place that variant where a stair stands.

## State

- 2026-11-12, round 6, later: he saw the trouble himself ("there is trouble building the world with the assets
  and terrain"): old plank blocks under new models, courts and rooms floating on meadows, hills that are blobs,
  stand-ins left in, costs found late, and every helper placing things its own way. `act1-place-system` (Fable)
  designs one description of a place, one pipeline, one whole-world check, one command for looking, and the skill
  `build-place`; it tests them on the old mill, a shrine and the cave mouth. Fable now also composes places; Opus
  wires them in. Every report carries pictures.

- 2026-11-12, round 6 (from dae9e81 with `act1-camera` merged): his word changed who builds what. Fable 5.2
  designs systems and builds every 3D model, and rebuilds the old ones that look bad; Sol does 2D and playtests;
  Opus the code and some testing; helpers may start helpers. Running: `act1-lead-models` (Fable: audit every prop,
  upgrade the toolkit and the skill, rebuild the worst), `act1-asset-2d` (Fable: audit every sprite, portrait and
  icon, upgrade the 2D pipeline, a redraw list for Sol), Fable carrying on Astra's `act1-hall-models-2`,
  `act1-rooms-models` and `act1-city-models-2`, the five leads (Saltgate, wilds, north, story, farms), and
  `act1-fix-1`, `act1-look`, `act1-world-2`, `act1-speed-2` finishing. Merged this round: voices, beasts, ruins,
  speed, city models, Hall models, camera (one cut-away rule, every scene staged, stage cues gone).

- 2026-11-12, round 5 (from b302a90, every wave-1 system and goods merged; goods' ledger and market-day tests
  fail since the world moved the queen): two playtests are in, `docs/playtests/2026-11-12-act1-run-1.md` (real
  keys: leaves, walls and the mill wheel hide the hero and speakers; scenes start off screen) and
  `2026-11-12-act1-feel.md` (the words land, the pictures rarely show them; ten ranked changes). Building now:
  `act1-fix-1` (goods tests, grant day's bugs, the old cast), `act1-camera` (one cut-away rule, every scene
  staged to show its lines, three panel bugs, the grey wood checkpoint), `act1-sys-ruins` (vaults, shrines,
  Echoes, Old Gate, Rootworks, Stag), `act1-voices` (the whole cast, under 8,000 credits), `act1-speed` (low and
  high budgets), `act1-city-models` (Astra: bridge, gateway, market goods, skyline), `act1-world-2` (dry plot that
  greens with water, Ilara's Hall in the hill, the lit road, a living market, the dotted lines),
  `act1-beasts-2` (Sol: the boar at cart size, the Custodian's eye, the lynx). Next: farms readable from the
  camera, Saltgate up to the title painting, then a second full playtest.

- 2026-11-12, round 4: the integration (`act1-integrate`, 42f694a) merged the foundation, region sound, the
  settlement and city-parts kits and the world sprites; every check passed (1,023 tests, 21 quests in the bots).
  Wave 1 of the systems started, sharing `docs/act1-systems.md`: the opening (`act1-sys-opening`), quests,
  scenes and dialogue (`act1-sys-story`), fights (`act1-sys-fights`), farms and machines (`act1-sys-farms`),
  people and the settlement (`act1-sys-settlement`), the world (`act1-sys-world`); plus the architecture toolkit
  (`act1-props-arch`) and scene 9's camp sheet (`act1-sprites-camp`). Wave 2 after: ruins and vaults, goods and
  coin, voices, then the test loop.

- 2026-11-12, round 3: every concept sheet approved (172). Merged: the land, the kinds of land, all creature
  sprites, 63 icons, the prop toolkit (soft forms, baked shading, painted skins; `src/features/props/README.md`).
  Model builders share `docs/act1-models.md`. Twelve Astra builders running: groups 1 to 7 rebuilt with the
  toolkit (`act1-models-<n>`), Hollowmere's buildings, parts, streets and quay (`act1-city-*`), machine parts
  (`act1-kit-parts`), the settlement (`act1-kit-settlement`). Still to start: the region kits of Saltgate, the
  forests, the north, the marsh and caves, home; the rooms; the systems (after `act1-foundation`).

- 2026-11-12, round 2: concepts reviewed by the coordinator (verdicts in the playthrough site's
  `concept-status.json`): goods, gear, parts, settlement, interface, creatures approved; twelve of the cast sent
  back for distinct faces (`act1-concept-cast`). Started: the foundation commit (`act1-foundation`, the gap map's
  "Fix these first" with the coordinator's decisions: 20-minute day, save version 2, settlement owns the
  Heartstone, the Stag's hall renamed), final creature sprites (`act1-sprites-beasts`, `act1-sprites-critters`),
  icons (`act1-icons`), region music and ElevenLabs beds (`act1-sound`, under 3,000 credits). Region packages,
  rooms and the props toolkit still painting or building. He asked for voices with ElevenLabs once lines are in
  the game, and screenshots of progress as it lands.

- 2026-11-12, later: the first model group (`world/models-8`) came back true to size but far worse than its
  sheets: facets, flat colour, boxy. The cause is the prop toolkit (vertex colour on one Lambert material, no
  smooth or organic forms, no texture). Merged as stand-ins; `act1/props-quality` (Opus) is adding organic forms,
  baked shading and painted textures and rebuilding group 8. Every Astra group gets a second round with the new
  toolkit once it lands.
- 2026-11-12: `act1` made. The world: land, kinds of land and eight model groups building; paintings and 47
  landmark concept sheets merged. Next: the concept sets above, the gap map, the dialogue's second pass.
