# First Echo and vault-map staging

The user wants an immersive mystery that fits the farms, companions and vanished civilisation. Keep the existing story and progression. Repair what the current scenes show: the first Echo describes a girl with a fox but stages only Auren and Ilara, and the Custodian is cropped while marking the vault map.

## Accepted work to preserve

Tent runtime f1c7e811, verified HEAD d6605412, evidence c10be621: independent warm cloth high/low day/night PASS; all eight default verifier parts and six unchanged approvals PASS. Parent independently inspected high day/night and reran the warm-canvas checker on fresh high/low images. No tent work remains in this slice.

UI runtime 2ef4e0f5: home/farm labels and vault-map names pass desktop/narrow high/low, panels/targets and pan/zoom, including fresh combined verification at9ba106ba/evidence1ae18eb2. Keep these fixes.

Earned Echo progression passes the parent's complete real-input replay and raw-save audit, evidence885cb17b under .artifacts/echo-review. Do not change rewards, gates, quests, saves or dialogue. Natural copper/Gold sleep proof stays at its historical snapshot, as .artifacts/camp-tent-independent/report.md records.

## Reproduced findings

.artifacts/echo-review/earned/replay.json framing entries named vault-marks have six failed samples (line indices0,1,4,5,6,7), each reporting npc:custodian body cropped and scenery sight out of frame. The affected spoken lines are the three stones, their directions, and Any order. This is talk.vaults, following scene24. Inspect the recorded frames and actual images, then reproduce on a fresh build. Do not hide the actor from checks or weaken framing thresholds.

src/game/content/dialogue.ts scene24 says a girl sits on the wall with a fox. src/game/content/scenes.ts stages Auren and Ilara only. The existing visible fox is the player's present-day bonded companion, not an independently staged past fox. Add a temporary memory fox using the existing asset and stage mechanisms, clearly attached to the memory scene. Preserve the actual companion's save, bond and behavior, and remove/restore temporary presentation on completion, skip and restoration. No new pet reward or duplicated persistent creature.

## Ownership

Own scene24 staging data and narrowly related stage/cutscene drawing under src/game/views/story-stage.view.ts, story-cutscene.view.ts, src/game/uiview/cutscene-stage.ts and their appropriate tests/helpers. Start by tracing existing modules and use their contracts. A necessary narrow shared camera fix is allowed if supported by a reproduction, with regression coverage of existing conversations. No engine/root config, tent/props, farm/home/map UI, rewards, dialogue prose or recorded voice changes. No new assets, dependencies, helpers, push, merge or deployment.

Use existing exact unedited Gold and middle-memory fixtures. Verify source hashes and disclose imported/debug setup separately from real key-driven interaction. Prove every relevant Custodian line frames both body and required scenery at high/low; inspect actual screenshots. Prove the past fox is a staged actor, not the player's companion; test cleanup/restoration and repeat stone interaction. Preserve vault marks and Echo audit outcomes without re-earning unchanged farming/dinner routes. Run focused checks/types, relevant sight scenes (at least24 and the affected talk, plus earlier Custodian scenes if a shared path changes), and required verification. Keep all approved pictures unchanged.

Save before/after pictures, framing reports and source/build fingerprints in .artifacts/echo-scene-repair. Parent owns acceptance. Follow docs/resource-concurrency.md, with fresh admission before every heavy launch and exclusive approved comparisons. All previous jobs are closed at handoff. Use a distinct output dist-echo-scenes and port5569. Source and light checks may overlap other work; no third heavy job. Commit exact owned files, with source and evidence separate.
