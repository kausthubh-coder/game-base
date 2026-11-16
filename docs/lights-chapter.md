# Earn Light that works

Start from the accepted Gallery home save, `.artifacts/gallery-chapter/attempt-06/earned/earned-gallery.save.json`, SHA256 `1618cddda6e99fbd8185e916e27d3c0f3af9bd0a170a87e00325ebe7b840523d`. Keep these bytes unchanged. Gallery is complete, Light that works is active at `hatch`, Seeds is at `brass`, and only keystones 1 and 2 are earned.

The chapter ends with working rootsnare and lamp-trap farms, sensors and switchable lamps, the lit perimeter with the bait field still living, Holt at work, a second completed ledger section, and local Continue at home. Use the updated `verify-chapter` skill and a tracked `tools/chapters/lights.mjs` module. Keep the final whole-Act-1 replay.

## Authored behavior to earn

Read quest `lights` in `src/game/content/quests.ts`, farm sites and progression in `src/game/farms`, machine rules in `src/game/machines`, settlement arrivals in `src/game/settlement`, and ledger rules in `src/game/goods`. The handbook's chapters 27 and 30 describe this route. Preserve story, balance and existing choices.

- Build the rootsnare shelter and hatch through the normal building interface. Open the hatch in daylight and collect actual vine rope. Show the sleeping rootsnare and the hatch's effect, rather than relying only on the quest flag.
- Build the dry-land lamp trap over a collector chest. Earn and collect glow dust during natural night. Preserve the pond and other existing farms. Account for lamps sharing lanternflies.
- Craft sensors and switchable lamps through the workbench. Show a sensor changing its connected lamp when its observed condition changes through legitimate gameplay. Read the actual authored wiring and conditions before choosing the check.
- Place the lamp ring and keep the bait field dark and productive. The runtime counts at least six lamps and a living copper farm; check the visible arrangement and farm behavior as well.
- Earn Holt's arrival and lamps job. The arrival is settlement content, not a numbered memory scene. Cover the actual notification, resident interaction and cleanup in preflight and earned captures. Do not force an unrelated scene to create a preflight pass.
- Complete a second ledger section through delivery UI. Prefer the lamp house to fit this chapter, after confirming its material requirements and existing ledger state. Preserve the completed granary and account for every delivered item.

The input inventory contains plentiful moss fiber, oak logs, some planks, copper, springs, honey, one lamp, and two vine ropes. It contains no glow dust or wax. Obtain missing goods through authored crafting, trade or production. Existing settlers have unmet meals; check and meet needs through normal gameplay when the route requires it. Do not grant materials or silently alter the save.

## Proof and recovery

Use the shared real-time driver with awaited browser keyboard and mouse input. Preserve authored waypoint heights. Read-only state, navigation, projection and events are allowed; disclose the public save call. Earned play uses no simulation advancement, teleport, forced scenes, direct crafting, building or damage APIs.

Commit the chapter adapter and fixes before final evidence. Preflight rules, actual home/interaction presentation at desktop and phone high/low, and actual costs before the long replay. If there is no numbered scene, write a focused diagnostic fixture for these interactions. Inspect first and last interaction states and cleanup. Bind reusable evidence to unchanged inputs, renderer and full runtime hashes.

Wrap milestone actions in `run.step`. Preserve a middle raw save and Continue after a working farm, and a final home save and Continue. Repeated interactions must not duplicate rewards. Audit inventory costs, farm production, collector transfers, pickups, fox gifts, deliveries and legitimate needs. Preserve companion identity/bond, earlier choices, buildings, crop identities, jobs, equipment, prior quest completion and Rootworks state.

End with `quest.lights.done`, two ledger sections and only keystones 1 and 2. Seeds, Rootworks and later quests remain uncompleted. Export a new unedited `earned-lights.save.json`, an independent transaction audit, the accepted chapter report and inspected images. Distinguish diagnostic proof from earned progression.

## Ownership and resource hold

The active checkout is `/Users/dabot/.t3/worktrees/game-base/act1`, branch `act1`. Port 5795 is reserved. The last accepted integration HEAD is `05cdb44c`; all nine default verifier parts and six unchanged approved comparisons pass. Gallery's jobs are closed.

At preparation time the disk admission check fails. Source work and short rules tests may proceed. Launch no build, browser, default verifier, installation or heavy process until the coordinator releases the hold and a fresh resource probe admits it. Preserve all historical evidence. Immutable generated files have been deduplicated by exact hashes; do not rewrite them in place. Use a new output directory per attempt. Final verification must preserve fixed output directories by rename and restore their hashes, following the Gallery recovery procedure.

The coordinator released the disk hold on November 16 after the user freed space and the resource probe admitted work. The earlier preparation task wrote no source because of ENOSPC. Fresh probes and coordinated ownership still govern every heavy launch. The raw Gallery input hash remains unchanged.

Its read-only review found that the roof needs visual proof because rope production checks the hatch and daylight. Holt counts qualifying placed lights, so ordinary lamp blocks alone do not satisfy his arrival condition. A sensor in `good` mode can watch a collector; collecting goods through its panel can exercise the connected lamp's response. The lamp-house ledger needs twenty glow dust; a sensor and switchable lamp need two more dust, one copper and one wax. Verify these against current rules before implementing the route.

Own `tools/chapters/lights*`, a lights runner and audit with tests, this brief's implementation notes, and `.artifacts/lights-chapter`. Narrow shared input helper changes require explicit ownership coordination. Report a product defect with a focused reproduction before editing product code. Do not change authored art, dialogue, balance, approvals or other chapters. No dependencies, push, merge or deployment.

## Implementation notes

The Light tools keep their input bridge and observations separate from Gallery. `tools/play-lights.mjs` records ordinary browser keys and clicks, installs the shared driver in realtime mode, verifies exact interaction targets, preserves every diagnostic failure in a unique directory, and stops only its own server and browser. The public save entry point and raw local imports are recorded explicitly. Diagnostic fixtures stage the serialized time system as well as the displayed clock; changing only `game.clock` does not change the restored day.

`tools/audit-lights.mjs` accounts for combined bag, loose and collector goods, so moving goods between those stores cannot create a material allowance. Its focused tests deliberately mint dust and change a collector transfer to prove rejection. The boundary contract compares serialized crop species at tuple index 3 and companion trust from the actual pet schema. Natural position, clock, growth and production counters may change; equipment, earlier choices, non-Light quest records, existing buildings, farm modes and machine settings are preserved. This source slice is preparation, not an accepted chapter or earned progression result.
