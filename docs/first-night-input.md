# Earn the first night from the ferry landing

Continue the current story from the earned landing, through Ground nobody wanted and The Shut Door, ending after the morning conversation with Tamsin. The player must be able to make this journey with keys and mouse. Fix confirmed blockers and preserve the mystery, scene order and reward amounts.

## Starting evidence

Use existing act1-wilds-forest at /Users/dabot/.t3/worktrees/game-base/t3-88bc25c2-3820bcdd572e4ec5. This work depends on its unpublished commits. Do not reset to main or change checkout. Doctor assigned port 5559, but check it before starting a server.

The coordinator's unedited earned save is .artifacts/grantday-framing-review/input/earned-landing.save.json. Its report and replay document a fresh opening with real spar hits, middle save/Continue and normal ferry completion. Import these exact bytes once as the stage boundary. Record its hash and provenance. From then on, earn everything. Keep this historical file intact.

Read docs/current-act1-replay.md, current quests and dialogue, src/game/hall, src/game/machines, the current ground-related systems, docs/testing.md and the relevant handbook chapters. The handbook has older opening details; current accepted Grant day remains unchanged. The hall README also mentions the obsolete roof quest. Diagnose against current executable behavior.

The ditch has a completion hook in machines/index.sim.ts. Initial search found no brambles/camp completion writes outside generic machinery. This is a suspected gap, not a proven diagnosis. Reproduce the player's actions and trace the event path before implementing a fix.

## Work and boundaries

Add tools/play-firstnight.mjs with an output-directory option and an explicit earned-save input. Start through the title's Continue flow. Walk to the plot, dig the required water connection, clear the brambles, pitch camp and light the fire, try the shut door, encounter the fox, retreat to the door, enter the Hall, wake the Custodian, calm the fox, touch the Heartstone, sleep and meet Tamsin. Observe each actual quest transition and scene. Use the current rules to settle the precise order; do not force it by editing state.

No skipTo, teleport, supplied items, edited flags, world edits through debug, direct scene completion, direct interaction methods or forced busy clearing during the earned run. Read-only observations and the public save entry point are allowed with disclosure. Time may advance through ordinary waiting or the player's sleep control. If bounded simulation advancement is necessary for a noninteractive wait, record it separately and prove it does not replace a required action. Do not force time-of-day or weather.

Save and Continue at a meaningful unfinished checkpoint, such as after irrigation or inside the Hall. Assert that earned world changes, inventory and quest progress survive without repeated gifts or scenes. Preserve the final unedited morning save for the next stage. Record the input trace and screenshots at each milestone. Inspect actor, target, prompt and camera visibility, and confirm controls return.

Own the new runner, narrowly shared play helpers, focused regressions, docs/bugs entries, verification instructions and .artifacts/first-night-input. Narrow fixes required for this route are authorized in the relevant src/game systems, their content and view/input code. Implement missing quest hooks through real persisted actions and existing systems. Avoid one-off buttons that set completion flags without doing the requested work. Keep fixes local and explain any new completion semantics. Do not redesign narrative, balance, models, sprites or unrelated systems. Engine contracts and root configuration remain coordinator-owned; report a concrete missing contract if one is required.

Braid's seven action sheets failed identity review and remain unpublished. Its two published core sheets stay inactive. Preserve all candidates, original assets, sprite validation, prior evidence, approved screenshots, accepted scene/UI fixes and the stale full Act 1 runner. No new image generation or mirror integration in this task. Do not disable the legacy runner or change default verification selection to claim full Act 1.

## Acceptance

First capture each blocker with a failing regression or input record. Add meaningful action-to-progression tests, including persistence and repeated-action cases where relevant. Run the applicable make-feature, diagnosing-bugs, test-game, playtest-game and verify-game workflows. Document the new browser command in verify-game's browser instructions and execute it from a fresh production build. Run focused typechecks and tests plus default verification with all six unchanged approved shots. If scenes or cameras change, check the affected high/low scenes. Do not approve new baselines.

PASS requires the full earned landing-to-morning path, a successful middle Continue, final save, inspected captures and green required checks. If unfinished, report the exact last earned state and concrete cause. Never substitute a fixture to finish this acceptance run. Diagnostic fixtures may isolate a fault but must be clearly separate.

Commit completed slices locally, then evidence separately. Finish every job and stop only owned servers and browsers. No helpers, branch changes, push, merge or deployment. Report PASS, ISSUES or BLOCKED, exact tested/source/evidence SHAs, commands, fixes, provenance, best/worst inspected images and limits. This proves stage 2 only; full Act 1, art acceptance, cloud and weak-device testing remain open.
