# Seed Vault preparation

PASS as source preparation only. Earned Seed Vault play is not started or accepted.

Inspected on `act1` at coordinator commit `a6aab341`, in `/Users/dabot/.t3/worktrees/game-base/act1`. This report changes only this file. No builds, browsers, simulations, verification runs, installations, save writes or product changes were performed. The Light runner and its owned files were left alone. All gameplay claims below describe inspected code, not new play proof.

## Required handoff and scope

The next input must be the coordinator's future **accepted Light save**, with its actual acceptance report, immutable bytes and recorded SHA256. That file and hash are unknown now. Reject a missing handoff. Never substitute Gallery, `skipTo`, a diagnostic fixture, or an edited save. Preserve the Light input and write every later checkpoint to a new file.

The intended result is Seed Vault cleared after fight 10, keystone 3 explicitly taken, memory 29 finished, and a return home with a successful Continue. Preserve the accepted Light work. Leave A farm that runs itself, Roofs, Rootworks and later progression unfinished. `itself` may start automatically once `seeds`, `uphill` and `lights` are done; that availability is expected, completing it is outside this chapter.

The code prerequisite is Echo, not Light. Seeds starts after Echo and has steps `brass`, `stair`, `seal`, `harvester`, `keystone`. Light is the earned chain requirement for this run. See [quest data][quests] and [chapter procedure][skill]. The handbook's quest 15 specifies the fitting, Wren, Calla's seal, the arm and pods, then scene 29. Its promised Heartstone 4 and harvester arm are design expectations, not unconditional grants in these quest rules. See [handbook][handbook].

## Inherited state, for context only

Read-only inspection of `.artifacts/gallery-chapter/attempt-06/earned/earned-gallery.save.json` found seed 41, home near `[-14.5074,22,-233.4857]`, keystones 1 and 2, scene 25 already seen, `choice.calla=shown`, Seeds at brass, and Light at hatch. The chosen weapon is staff, tier 2, padded grip; armor is tier 2. The bonded leaftail is `pet:leaftail:1`, trust 3. Ruins has six eyes, `first=pumphouse`, machines all false and deepest 0. Its pack includes 7 springs, 3 old brass, 21 copper, no glow dust and one quill strip. These are Gallery observations, **not the future Light inventory**. Light spends materials and advances needs and production. Re-read every value from the accepted Light boundary.

The Gallery acceptance and provenance are documented in [Gallery handoff][gallerydoc]. Earlier choices include pump crated, Hobb kitchen, Dax watch, burrowers Give, dinner Gus, Calla shown and gearlings Give. Compare the future boundary itself for the complete preservation set, including any new Light choices, Holt, lamp ring, bait field and hatch.

## Ordinary actions and exact targets

1. Use the quest log to track Seeds. Inspect the actual bag, weapon, food, companion and resident needs. Meet needs through the ordinary game. Keep enough bag capacity for rewards and normal pickups.
2. Stand within 5 units of an existing workbench. Open the Workbench panel, select Brass-fitted, the inherited weapon, then Spring hilt or Glow cap, and click Make. Its DOM has dialog `Workbench`, `data-key=step-3`, weapon keys `staff`/`sword`/`bow`, fitting keys `spring_hilt`/`glow_cap`, and `make`. The panel defaults to the held weapon's next tier and first fitting; record the actual selection. See [bench UI][benchui] and [bench rules][bench].
3. Walk to `ruin-stair`. Target `ruin-stair`, reach 3, and press E on `Go down the forest stair with Wren`. Observe `step.seeds.stair=true`. This interaction sets the flag and queues Wren's line; it does not transport the hero or prove the remaining trail walk.
4. Visit `seedvault`, target `ruins:seedvault`, reach 4.5, and E on `Calla's seal is on the door`. This is information, not an entrance. Seeds starting seals this door automatically. Then reach `ruins:roots`, reach 3, and E on `Go in through the roots`. Observe room `seedvault` and `step.seeds.seal=true`. Without Wren's stair the root action only explains the blockage. No lamp or key is required by this entrance rule.
5. Enter the keeper trigger on foot. Fight 10 starts in the room, not beside the map building. E wakes the fight; C holds the arm. Aim ordinary attacks at pods or the open heart, with Shift to dodge. Require fight 10 won and the keeper down, then wait for fight drawing/input ownership to finish.
6. Walk to the dais, target `ruins:seedvault:keystone`, reach 1.8, and E on `Take the keystone`, reach 1.8. Record `keystone.3=true` while `scene.29` and `memory.seedvault` are still false. Then E on `Touch the stone`, reach 1.8. Advance all four lines through the dialogue UI. Observe scene 29 and memory flag, Seeds complete, no active talk, no busy player and no remaining stage actors.
7. Before leaving, check repeat keystone/memory behavior. Then E on `Push the doors open`, reach 2, at the south door. Alternatively the root exit has reach 1.8. Require outside room, cleared and sealed flags. Return home through ordinary movement and save/reload/Continue. Do not start Rootworks or build arms for the next quest.

These actions and reaches come from [ruin targets][targets]. Keystone and memory are independent prompts. **Scene 29 itself can supply keystone 3 through its flag listener.** Testing only the final flags would miss a skipped keystone interaction. Preserve the explicit intermediate checkpoint. See [keystone and memory rules][memory].

## Route coordinates and heights

World coordinates use x east, y up and z south. [Map conversion][map] subtracts 420 from map x and 538 from map z. Stair map `[252,256]` therefore means world column `[-168,-282]`; Vault map `[150,300]` means `[-270,-238]`. The root gap map `[150,291]` is world `[-269.5,-246.5]`, including `pointOf`'s half-block offset. Its interaction/exit height is `groundHeight(seed,floor(x),floor(z))`, rather than a guessed height or the tallest loaded floor. Region place heights for stair and door must be read at the actual accepted boundary. No numeric outdoor height or home-to-stair-to-roots path has been established by this preparation.

The room origin is `[-372,2400]`, with feet at **y=26** throughout. These are source-derived points from [room definitions][room] and `roomPoint`, not teleports to use in the earned runner:

| Target | World x, y, z | Reach or condition |
|---|---|---|
| Arrival | -369.4, 26, 2412.5 | After ordinary root interaction |
| Root exit | -370.8, 26, 2412.5 | 1.8 |
| Arm home | -359.5, 26, 2412.5 | Solid center/base; skirt it |
| Keeper start | -367.5, 26, 2412.5 | Trigger box x [-369,-349), z [2403,2423) |
| Keystone | -360.5, 26, 2402.8 | 1.8 |
| Memory | -358.5, 26, 2402.8 | 1.8 |
| Door exit | -359.5, 26, 2422.6 | 2, requires win and keystone |

The existing [diagnostic Harvester runner][oldrunner] walks to `[-365.5,2412.5]`, then after combat via `[-363,2403.8]`, `[-360.5,2403.8]`, `[-358.5,2403.8]`; it exits via `[-355,2408]`, `[-355,2420]`, `[-359.5,2422.1]`. Attach y=26 explicitly to those candidate waypoints. Its helper skirts the arm with an arc at radius 3 to 4. Its startup uses newGame, skipTo, direct room entry and clock advancement; **none of that is earned input**. Those legs need ordinary-input proof from the accepted Light chain.

The Gallery's [authored route helper][galleryroute] preserves x/y/z in both directions, including passage under the High Road. Its route JSON begins `[220.5,32,-293.5]` near the eastern caves. It is a working height-preservation pattern, not a route to the western Seed Vault. No matching outdoor forest-stair runner was found in searched tools or artifact scripts. Home to stair, stair to door/roots, and forest return are unproven. Diagnose terrain with read-only queries, preserve each selected floor, and validate each leg with the existing realtime driver. Do not clear obstacles or choose `heightAt` blindly to make navigation pass.

World landmarks convert with `x=mapX-420`, `z=mapZ-538` in `src/game/content/greenhollow.ts:29`. The forest stair is map `[252,256]`, world column `[-168,-282]`; the door is map `[150,300]`, world column `[-270,-238]`. The root target adds half a block to map `[150,291]`, giving `[-269.5,-246.5]`, and uses seed-specific `groundHeight`, not the room height. Outdoor numeric heights remain unproven. Door and stair use the region place's authored `.at`, which must be read at runtime. Root exit target is `ruins:seedvault:roots`, reach 1.8; door exit is `ruins:seedvault:door`, reach 2; memory is `ruins:seedvault:memory`, reach 1.8. Target ID prefixes come from `src/game/ruins/index.sim.ts:368`.

## Fight rules and bounded strategy

[Harvester content][numbers] gives heart guard 160, a sweep warning of 1.2 seconds with reach 6 and damage 15, and a slam warning of 1.1 seconds with radius 2 and damage 14. Pods have guard 10, grow for 5 seconds, burst over radius 1.8 for damage 10, spawn every 4 seconds up to 3, and heal the heart by 6 guard per second per standing pod. Eight beds surround the arm. The heart opens only when no pods stand. These are configured rules, not measured timings or performance results.

[Keeper logic][keeper] allows a 5-second hold followed by 3 seconds of rest. C uses the world's special Harvester hook, which calls `hold()` and consumes C even while a repeat hold is unavailable. The companion's skill event also holds it. Holding cancels the current arm threat; it does not stop pod growth, spawning or healing. Repeated C cannot extend an active hold. See [world skill hook][skillhook].

Use bounded observation/action loops. Stop on won, missing fight, timeout, repeated no progress, or a faint requiring diagnosis. Log hero health, target guard, pods, threats, held/rest state and inputs. Clear nearby pods while the arm is held, attack the heart only when open, and replan around the solid base. Prefer current weapon ranges from `weaponOf`, not the old diagnostic runner's generous distance constants. Use the Gallery pointer projection at the hero-foot plane and shared targeted action; do not write fight input or enable autoplay. The old runner's 150-second cap is a diagnostic bound, not a promised completion time.

Keepers are shut down, never calmed. F is the general Mark/calm input for beasts and is not a Harvester victory step. The internal keeper record reports `calmed` for compatibility, while world progression emits fight 10 `won`; assert the world result and keeper down. See [keeper tests][keepert]; [world reward handling][rewards]. A fall in an active keeper retains broken parts within that running encounter; fights in progress are not saved. Do not promise a mid-fight Continue preserves pods or heart guard.

## Costs, rewards and inventory audit

| Change | Exact configured debit or reward |
|---|---|
| Tier 2 to 3 weapon, Spring hilt | 7 gear_spring and 2 old_brass |
| Tier 2 to 3 weapon, Glow cap | 4 gear_spring, 2 old_brass and 2 glow_dust |
| Optional tier 3 armor | 6 quill and 2 gear_spring |
| Fight 10 win | 1 heartwood |
| Keystone | Flag keystone.3; no bag item |
| Scene 29 | scene.29 and memory.seedvault; no listed item gift |
| Harvester arm recipe after Seeds | 1 gear_spring and 2 copper per arm |
| Saw arm recipe after Seeds | 1 gear_spring and 1 old_brass per arm |

[Gear costs][gear] merge the fitting price with the weapon price. Weapons climb one tier at a time; a newly made weapon becomes wielded. `step.seeds.brass` checks the best owned weapon tier, so explicitly verify the weapon actually used. The tier 3 armor is optional and does not satisfy brass. [Recipe unlocks][recipes] require quest.seeds.done; the handbook's arm reward is a recipe unlock in current code, not an automatic arm item. There is no coin price for these bench operations or vault entry. Do not craft the arm merely to make the handbook inventory appear true.

Exact combined costs from `src/game/content/gear.ts:75` are 7 gear springs plus 2 old brass for a tier 3 weapon with Spring hilt, or 4 gear springs plus 2 old brass plus 2 glow dust with Glow cap. Tier 3 armor costs 6 quills and 2 gear springs. These operations consume inventory and update equipment, rather than adding a weapon item stack. Fight 10 grants exactly one heartwood. Keystone 3 is a flag, not a pack stack. Memory adds `scene.29`, `memory.seedvault` and quest progress without an item gift.

The existing mill cache gives two brass once after fight 6; fight 6 separately gives two, fight 9 gives one. The Gallery save has already taken the cache. Do not budget another cache or repeat fight reward. Springs can come from the inherited Give spring farm; record actual production, storage and pickups. Obtain any deficit through ordinary play after seeing the accepted Light bag. Avoid taking Bramble's later farm as a source in this chapter.

Adapt the [Gallery auditor][audit] narrowly. Its fight whitelist only recognizes 8 and 9; its equipment invariant forbids all changes, and its ending forbids keystone 3. Those are correct Gallery assertions and must not be reused unchanged. Add exact tier 3 costs, fight 10 heartwood once, and the selected gear delta in Seed-owned files. [The observer][observer] currently omits `gear.made`; the future Seed observer should capture it without changing shared or Light tools. Reconcile every gained/lost item across scopes, including pet seed gifts, farm drops, chest transfers, meals and kit use. Auto-filled kit slots can consume the inherited quill strip even when saved bench kit slots are empty. Bag capacity matters because the fight gift calls inventory.add without retry accounting. Keep unexplained deltas as failures.

Bound combat by a deadline and lack-of-progress checks, retain failure evidence, and release every held key on exit. Prefer the nearest live pod while the heart is closed, then attack the open heart; replan after each short movement. Skirt the central solid base instead of walking through it. Project aim onto the hero-foot plane as Gallery does, and read the actual weapon's range through `weaponOf`; do not copy the diagnostic script's hard-coded staff distances for another weapon. The Harvester is never calmed with F. Its internal record reports `calmed` on shutdown, which the world translates to `fight.10.won`, not a beast tame or home reward. C's world hook is `src/game/fightview/world.ts:93`; controls are in `src/game/fightview/keys.ts:67`. A hold stops the arm, not pod growth or healing. Repeat C only after its cooldown, and dodge active warnings. These tactics need earned play validation.

## Memory, choices, cleanup and Continue

`src/game/content/dialogue.ts:547` has four scene-29 lines: narrator describes the young woman's hand on the giant Stag; Ilara says he wants to meet Auren; Auren says he is being respectful from a distance; narrator describes his hand on the lowered head. The repeat line at `:670` is Ilara's instruction to keep a flat hand. No choice occurs in either conversation. Do not add the handbook's Ilara revelation as a new reward flag or extra dialogue.

Scene 29 is `The Stag's nose`, a wide memory film with Stag, Ilara and Auren, [scene data][scene]. Its four lines show Ilara's hand on the Stag, Ilara introducing Auren, his fear/respect joke, and his touch of the lowered head. The repeat line is `Put your hand flat. Flat. He isn't a dog.` See [dialogue][dialogue]. There is no choice in scene 29. Spring hilt versus Glow cap is this chapter's explicit fitting choice. Preserve every prior story choice.

Scene 25 Calla is owed only on the first cleared vault if unseen. The inherited chain already has scene 25 and shown. Seed exit should not reopen Calla's two-choice conversation. Do not fabricate choice branches here. If the accepted Light state differs, stop and reconcile its provenance before play. `outOfVault` marks cleared only after win plus keystone, once, and preserves the first vault. Both root exit and door exit use it. Run repeat keeper/key/memory assertions before the final exit: cleared vaults hide the outdoor root entry. The door's cracking-seal line still leaves the sealed flag true; do not assert it becomes false.

Record a middle Continue after stair/root entry but before triggering fight 10. Verify the room, y=26, brass fitting, stair/seal flags, inventory and inherited home state. A second useful checkpoint is after taking the keystone but before the memory. Reinstall the realtime driver and input bridge after reload. Verify the memory remains an ordinary prompt, not auto-played on Continue.

For repeats, preserve raw checkpoints and event scopes around each test. Re-enter the trigger before exit to prove no second keeper reward. After taking the keystone prove no second Take prompt or key count increase. Repeat the memory before exit because cleared roots cannot be used to re-enter. Require only its short repeat line, no second scene-29 reward, and no changes in keystones, hearts or inventory beyond explained realtime production. On final Continue require three keys, Seeds done, no active dialogue/busy/stages, vault clear/sealed, first=pumphouse, Gallery eyes 6 and unchanged Rootworks machines/deepest. Compare buildings by identity and content, crops by identity and soil/crop type, pets by identity/bond/trust, settlers/jobs, farm Give modes, ledger and Light structures against the actual Light boundary. Permit elapsed growth and needs only with evidence.

Two progression shortcuts must be detected by the runner rather than accepted as proof. `src/game/quests/quests.test.ts:255` documents that later non-gated steps can advance earlier steps. `src/game/ruins/index.sim.ts:254` maps scene 29 directly to key 3 and memory. Therefore record the fitting and stair before entering, then a raw key checkpoint with `keystone.3=true` and `scene.29=false` before touching memory. The scene metadata says `start=near`; the story director can auto-start it when near the outdoor place after fight completion. The interior room is far away, but leaving before the explicit key/memory checks risks this shortcut. See `src/game/story/scenes.sim.ts:128`.

Heartstone is recomputed from living land, homes, needs, hearts and pump state by [settlement rules][heart]. Rank 3 needs three living farms and every settler need met; rank 4 also needs a turning wheel and the terrace, with lower ranks satisfied. See `src/game/settlement/ladder.sim.ts:43`. It is not assigned 4 by taking the keystone. Report the observed rank and cause; do not grant rank 4 to match the handbook.

## Presentation and cost fixtures

Future preflight must cover scene 29 at desktop 1366x768 and phone 390x844, high and low, all four lines plus cleanup. [play-sight][sight] already supports `scenes --only 29 --shots --bodies --costs --dialogue-hud`, using diagnostic scene setup. That setup is allowed for presentation only and cannot prove the earned route. Its generic fixture may stage the scene outdoors near the quest place rather than at the earned interior memory spot. Add an interior diagnostic capture through the existing fixture mechanism or Seed-owned runner, and compare actual earned staging before accepting. Do not change the shared tool in this preparation.

Inspect all speakers and the large Stag, body framing, last line, text and phone controls, correct hidden player during memory, restored player after memory, released camera/control ownership, removed stage actors and restored HUD. Capture the repeat stone's Auren/Ilara staging too. [Story staging][stage] hides the real player for memories; a passing scene flag alone says nothing about restored visibility.

Use [Gallery preflight validation][preflight] as a pattern, replacing scenes 25/28 and their 6/4 counts with scene 29 and four lines. Capture actual costs for arrival, active arm/pods, held arm, post-fight dais, all memory lines and return, at high and low. Compare to `QUALITY_BUDGETS` in [the quality table][quality], keep raw samples and renderer identity, and require sums to match. No budget samples were collected here. There is no speedup or frame-rate claim.

## Existing tests and meaningful gaps

Read, not run:

- [ruins-gallery-and-seeds scenario][scenario], especially lines 62 onward, covers the sealed entrance, Wren gate, room fight, key, memory and exit. It teleports, grants the brass step and uses the harness, so it does not prove earned UI crafting or outdoor reachability.
- `src/game/ruins/ruins.test.ts:28`, `:43`, `:71`, `:112`, `:120` cover room separation, keeper positions, floor height, scene-to-key behavior and room persistence.
- [keepers.test.ts:98][keepert] covers pod closure and hold, then bot victories. That first test maintains hero health directly; it is not a player survival demonstration.
- `src/game/fights/fights.test.ts:177`, `:190`, `:313` cover keepers waiting for rooms, custom rooms, and loss of an in-progress fight on load.
- `src/game/bench/bench.test.ts:28`, `:52`, `:95` cover costs/fittings, weapon ownership and save/load. `src/game/quests/quests.test.ts:12`, `:255`, `:385` cover dependencies, later non-gated steps and quest persistence.
- `src/game/story/story.test.ts:241` covers repeat Pump memory staging, not Seed memory. `src/game/views/story-stage.view.test.ts` covers staging helpers, not a four-view Seed acceptance.
- `tools/workflow` and `tools/chapters/gallery.test.mjs` cover chapter preflight/evidence contracts. Gallery combat/audit tests remain Gallery-specific.

Missing meaningful Seed checks should reject wrong or absent Light provenance, underpaid tier 3 crafting, an unchanged wielded weapon, duplicate heartwood, memory before explicit key pickup, early clear, a repeated Calla choice, lost companion/home/Light state, wrong-floor arrival, and an accidental Rootworks or itself completion. Add behavior checks for hold expiry/rest, pod healing and reopening, and a real save/Continue before the keeper and after the memory. Add transaction-auditor negative cases for fabricated farm gifts and unaccounted kit usage. Exercise scene-29 cleanup on its last line and repeat, including hidden/restored hero and phone HUD. These are proposals; none were written or run here.

## Minimal next adaptation

Create Seed-owned `tools/play-seed-vault.mjs`, a `tools/chapters/seed-vault.mjs` adapter and a narrow auditor/contract test. Reuse `tools/workflow/replay.mjs` in realtime mode and `tools/workflow/chapter.mjs`; do not create a new driver or acceptance framework. Follow `installDriver`, `targeted`, milestone, branch, Continue, raw transactions and save patterns in [Gallery runner][galleryrunner]. Bridge awaited browser key down/up through `window.__replayInput`, bridge targeted aim/press through actual mouse/keyboard, and require `walk.ok === true` plus exact height and authored reach. Read-only observations and saving are allowed; grants, direct crafts, damage, direct room entry, forced scenes and simulation advancement are not earned actions.

First consume and validate the future accepted Light report and bytes. Commit the Seed adapter before evidence collection. Run focused rules, diagnostic presentation and budgets as the three preflight gates, then earned steps, independent audit and final Continue. Record the standard eight evidence names plus raw preflight, image review, transactions, chain and runtime provenance. Acceptance checks hashes and presence; the Seed assertions and image inspection must judge contents. Preserve failed attempts. Later verification remains required before claiming the chapter done, per [verify-chapter][skill] and [testing guide][testing].

Remaining unknowns are the accepted Light path/hash/state, selected fitting and supply deficits, numeric outdoor heights and navigable forest legs, player survival with inherited equipment, interior scene-29 framing and costs, actual Heartstone rank, final inventory deltas, and successful Continue. No Seed chapter PASS is claimed. Static review checked this report's reference targets and patch whitespace. The verify-game skill was read; its executable checks were not run because this brief explicitly prohibits verification runs.

[quests]: /Users/dabot/.t3/worktrees/game-base/act1/src/game/content/quests.ts:443
[skill]: /Users/dabot/.t3/worktrees/game-base/act1/.agents/skills/verify-chapter/SKILL.md:1
[handbook]: /Users/dabot/dev/sandbox/game-look-test/design/27-act-1-quest-by-quest.md:315
[gallerydoc]: /Users/dabot/.t3/worktrees/game-base/act1/docs/gallery-input.md:34
[benchui]: /Users/dabot/.t3/worktrees/game-base/act1/src/game/views/ui-farms.view.ts:316
[bench]: /Users/dabot/.t3/worktrees/game-base/act1/src/game/bench/index.sim.ts:54
[oldrunner]: /Users/dabot/.t3/worktrees/game-base/act1/.artifacts/rooms-gameplay/finish-harvester.mjs:39
[galleryroute]: /Users/dabot/.t3/worktrees/game-base/act1/tools/play-gallery.mjs:120
[numbers]: /Users/dabot/.t3/worktrees/game-base/act1/src/game/content/fight.ts:628
[keeper]: /Users/dabot/.t3/worktrees/game-base/act1/src/game/fight/keepers.sim.ts:351
[recipes]: /Users/dabot/.t3/worktrees/game-base/act1/src/game/content/recipes.ts:36
[audit]: /Users/dabot/.t3/worktrees/game-base/act1/tools/audit-gallery.mjs:15
[observer]: /Users/dabot/.t3/worktrees/game-base/act1/tools/gallery-observation.mjs:1
[heart]: /Users/dabot/.t3/worktrees/game-base/act1/src/game/settlement/index.sim.ts:360
[sight]: /Users/dabot/.t3/worktrees/game-base/act1/tools/play-sight.mjs:190
[stage]: /Users/dabot/.t3/worktrees/game-base/act1/src/game/story/scenes.sim.ts:169
[preflight]: /Users/dabot/.t3/worktrees/game-base/act1/tools/chapters/gallery-preflight.mjs:15
[quality]: /Users/dabot/.t3/worktrees/game-base/act1/src/content/quality.ts:1
[scenario]: /Users/dabot/.t3/worktrees/game-base/act1/src/game/scenarios/ruins-gallery-and-seeds.sim.ts:62
[keepert]: /Users/dabot/.t3/worktrees/game-base/act1/src/game/fight/keepers.test.ts:98
[galleryrunner]: /Users/dabot/.t3/worktrees/game-base/act1/tools/play-gallery.mjs:434
[testing]: /Users/dabot/.t3/worktrees/game-base/act1/docs/testing.md:1
[targets]: /Users/dabot/.t3/worktrees/game-base/act1/src/game/ruins/index.sim.ts:360
[memory]: /Users/dabot/.t3/worktrees/game-base/act1/src/game/ruins/index.sim.ts:225
[map]: /Users/dabot/.t3/worktrees/game-base/act1/src/game/content/greenhollow.ts:29
[room]: /Users/dabot/.t3/worktrees/game-base/act1/src/game/ruins/rooms.sim.ts:360
[skillhook]: /Users/dabot/.t3/worktrees/game-base/act1/src/game/fightview/world.ts:93
[rewards]: /Users/dabot/.t3/worktrees/game-base/act1/src/game/fights/index.sim.ts:349
[gear]: /Users/dabot/.t3/worktrees/game-base/act1/src/game/content/gear.ts:75
[scene]: /Users/dabot/.t3/worktrees/game-base/act1/src/game/content/scenes.ts:177
[dialogue]: /Users/dabot/.t3/worktrees/game-base/act1/src/game/content/dialogue.ts:547
