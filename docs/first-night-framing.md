# Keep the first-night cast visible

The earned landing-to-morning path now passes. Fix the remaining presentation faults at the Custodian and grant stone without changing the earned progression or story.

## Evidence and starting point

Work in existing /Users/dabot/.t3/worktrees/game-base/t3-88bc25c2-3820bcdd572e4ec5 on act1-wilds-forest. Preserve unpublished dependencies and use the explicit path. Source 665c4b42, helper evidence de98c2e6 and .artifacts/first-night-input/report.md describe the implementation. The coordinator independently ran a fresh production replay at de98c2e6 and the focused region/hall/time/machines tests. Both passed. New evidence is .artifacts/first-night-review/input, with an unedited earned morning save and input trace.

Both runs reproduce overlapping bodies in 12-custodian.png and a hero partly hidden by the standing stone in 16-tamsin.png. These are early first-line captures, taken about 120 ms after dialogue starts. First establish what persists after the camera settles and throughout the dialogue. Preserve entry and settled evidence separately. Do not repair only a transient screenshot without checking the actual presentation.

Earlier scene visibility acceptance ae3a0d99 used local fixtures and a different approach. Read .artifacts/scene-visibility/report.md, the current story-stage view and sight code. sight.ts deliberately ignores sprites, so it cannot catch the hero hiding the Custodian. Scene 15 has an exact Tamsin mark but no authored hero mark. Neither observation establishes the final cause. Build a failing check on this earned approach, then diagnose. tools/lib/grantday-framing.mjs has an offline body projection/depth check that may be reused carefully; its fixed actor sizes and opening cast filter do not automatically fit the small Custodian.

## Scope

Own narrow scene staging changes in src/game/content/scenes.ts and src/game/views/story-stage.view.ts if needed, focused tests, the first-night runner and narrowly shared browser diagnostic helpers, docs/bugs and .artifacts/first-night-framing. Prefer authored scene marks when they solve the actual problem. A shared staging change requires broad scene regression checks. No new models, sprites, sound, game rules, rewards or story text. Preserve the new dry field, brambles, material costs, camp persistence, tent sleep and all earlier camera/root/UI fixes. Do not change numeric sight thresholds or baselines to accept an obscured body.

Improve tools/play-firstnight.mjs to retain the entry frame and settled line frames, check relevant actor visibility and scene identity, and record camera/control restoration after conversations. Keep the output-directory guard and earned-save requirement. Add assertions for once-only scenes and expected final rewards/state already observed in the existing report. Do not edit the historical save or substitute supplied progression into the earned run. It is fine to save new earned checkpoints to make local diagnosis cheaper.

Show the hero and Custodian as distinct bodies for scene 12, including the wake beat. Show the hero, Tamsin and speaking cast clear of the stone and dialogue bars throughout scene 15. Check the player's incoming camera headings through real Q/E camera controls where applicable, at high and low quality. Current E is interaction during dialogue, so use the actual camera bindings from input code rather than assuming. Verify the route's approach and return are still traversable. A local fixture may isolate each angle, but label it and finish with the full unedited landing-to-morning earned run.

Check the other first-night milestones for body or bar clipping, especially scene 10 and the fox film. Capture the fox after its opening fade as useful evidence; do not bypass or shorten the film. Keep unrelated art defects recorded instead of expanding this task into a world redesign.

## Acceptance

Use applicable diagnosing-bugs, make-feature, test-game, playtest-game and verify-game skills. Produce a red-to-green check for persistent overlap or occlusion and inspect every affected dialogue line at high and low. Keep actor-to-actor observations separate from scenery ray tests; do not claim pixel-perfect visibility from bounding boxes. If only the approach causes the fault, include that approach in the regression.

Run focused tests/typechecks, all dialogue sight checks at high and low when shared staging changes, affected isolated checks otherwise, default verification with six unchanged approved shots, and a fresh production full first-night input replay. Confirm the middle Continue, earned actions, normal films, exact original input-save hash, once-only scenes, final rewards and unedited morning export. Disclose any idle simulation advancement just as the existing runner does. Do not replace the stale full Act 1 runner or change default verification selection.

Commit implementation slices locally and evidence separately. No helpers, checkout changes, push, merge or deployment. Finish jobs and stop only owned browsers and servers. Report PASS/ISSUES/BLOCKED, tested and evidence SHAs, cause and repair, exact commands, inspected before/after paths, best/worst final view and coverage limits. Full Act 1, mirror looks, forest/marsh art, cloud and weak devices remain open.
