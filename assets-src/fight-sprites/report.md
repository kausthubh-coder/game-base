ISSUES

Branch: lab/fight-sprites-hero
Worktree: /Users/dabot/.t3/worktrees/game-base/t3-fff8bd2c-76041fe9a6d8dd91
Assigned base: 0c26a779224e1b0e6b2ec9101e8e9f81f8ae554e
No push or merge. No src/ changes relative to the assigned base.

Six published sheets and their animation names, rows, dimensions, anchors and world heights match the brief. All required automated checks passed. Visual identity and some poses remain imperfect, so this is not a visual PASS.

Generation used image_gen.imagegen with the approved PNG references attached. Each adjacent JSON records the exact prompt, tool, references, attempt and selected source. All sheets used one attempt except pebblepup, whose second attempt removed the painted background. The first pebblepup source remains for the attempt record. No pixels were drawn by hand or code. The existing builder sliced, cleaned alpha, snapped the locked palette, uniformly scaled, centered and anchored the generated images.

Rebuild preparation: run `bun assets-src/fight-sprites/restore-raw.mjs` from the repository root. This copies the committed selected attempt PNGs into the ignored assets-src/raw/<name>-3.png paths. The normal build-story.mjs preserves all existing manifest entries. It therefore skips already-published sheets.

Visual inspection:
- Opened all six final sheets on green at native resolution. Opened all three hero action sheets beside matching hero.png idle rows, also at native resolution.
- hero-cut: front poses turn slightly toward the side rather than staying squarely front. Body is slimmer and the head/hair silhouette differs from idle. Head/torso consistency within two pixels is not established visually and should be treated as failing. The sword is readable and fits, but recovery remains in a ready stance rather than returning to idle. The grey smear is angular after palette snapping.
- hero-moves: dodge head is smaller than the standing head; costume and torso shape drift with poses. The calm arm is bent toward the viewer rather than held fully straight. The tiny teal mark does not reliably read as seven points. Side reach overlaps the hands and can read as a two-hand gesture.
- hero-call: closest hero identity match, though hair highlights, face and torso still differ. Front wind-up holds the light beside the shoulder rather than clearly far behind it. Throw handedness is inconsistent between front and back. Whistle fingers and the other arm's recall wave are subtle at native size.
- leaftail-fight: more plush and round than the approved pet; apparent head/body size varies between crouch and leap. Tail strike reads primarily as a pounce, with an insufficient forward tail whip in the front/back views. Front faint is a flattened crouch rather than fully lying down. Builder anchoring places the lowest pixel on the anchor even for the leap; the lab renderer must provide airborne motion.
- pebblepup: matches the new pet concept, but front idle is fairly upright rather than very low. Palette snapping makes grey stones warm taupe and moss yellow-olive. Stone arrangement and apparent ear/head size drift slightly between views.
- pebblepup-fight: brace reads as a wide planted stance; it does not strongly show hiding behind the stone back. Headbutt reads as a forward step in front/back views. Fainted pose reads clearly; head/ear proportions still shift slightly.
- All back rows show no face. All side rows face right. No obvious clipped sword or limbs, pale halos, stray specks, weapons in nonweapon hero sheets, or teal on pebblepup were seen.

Checks, all exit 0:
`bun tools/verify-assets.mjs`
TOTAL PASS: 9 checks, 9 passed, 0 failed, 0 warnings

`bun tools/sprites/check.mjs --complete`
OK UI: panel 96x96, button 96x32, title 480x270, palette and alpha
PASS all six story sets complete

`bun tools/sprites/check-story.mjs --complete`
OK UI: panel 96x96, button 96x32, title 480x270, palette and alpha
PASS all six story sets complete

`bun run check`
Test Files  5 passed (5)
Tests  31 passed (31)
These are the final Convex-suite lines; the full check log also contains the game test results.

`PORT=5610 PLAY_PORT=5610 bun run verify assets build shots`
pass assets
pass build
pass shots
verify: 3 parts, nothing failed

The same assets/build/shots parts passed before changes. Logs are under /Users/dabot/.t3/worktrees/game-base/t3-fff8bd2c-76041fe9a6d8dd91/.artifacts/fight-sprites/. No timing or device performance claim is made.

Preservation:
`git diff origin/main --stat` and `git diff 0c26a77 --stat` were saved in that artifact folder. Both show only added sprite PNGs and no baseline-file changes. origin/main advanced independently to 30d40e1, so its direct diff also shows unrelated older code/docs differences from the assigned base. The assigned-base diff contains only this task's additions and the appended story config and manifest. The sprite checks verified frozen manifest values and file hashes, including the atlas. No baseline was refreshed.

Defaults: six sheets, as explicitly permitted. Pebblepup worldHeight is 0.9. Its idle is two frames at 4 fps and walk four frames at 10 fps, matching leaftail. Blank idle columns 2 and 3 are intentional.

Not checked: play in the coordinator's unfinished fight lab, animated transitions in that renderer, pet/combat mechanics, exact isolated head/torso pixel dimensions in every pose, weak-device performance, or deployment. The normal game screenshots/build were checked; these additions are not wired into gameplay here.

Previews:
/Users/dabot/.t3/worktrees/game-base/t3-fff8bd2c-76041fe9a6d8dd91/.artifacts/fight-sprites/hero-cut-green.png
/Users/dabot/.t3/worktrees/game-base/t3-fff8bd2c-76041fe9a6d8dd91/.artifacts/fight-sprites/hero-moves-green.png
/Users/dabot/.t3/worktrees/game-base/t3-fff8bd2c-76041fe9a6d8dd91/.artifacts/fight-sprites/hero-call-green.png
/Users/dabot/.t3/worktrees/game-base/t3-fff8bd2c-76041fe9a6d8dd91/.artifacts/fight-sprites/leaftail-fight-green.png
/Users/dabot/.t3/worktrees/game-base/t3-fff8bd2c-76041fe9a6d8dd91/.artifacts/fight-sprites/pebblepup-green.png
/Users/dabot/.t3/worktrees/game-base/t3-fff8bd2c-76041fe9a6d8dd91/.artifacts/fight-sprites/pebblepup-fight-green.png
/Users/dabot/.t3/worktrees/game-base/t3-fff8bd2c-76041fe9a6d8dd91/.artifacts/fight-sprites/hero-cut-vs-idle.png
/Users/dabot/.t3/worktrees/game-base/t3-fff8bd2c-76041fe9a6d8dd91/.artifacts/fight-sprites/hero-moves-vs-idle.png
/Users/dabot/.t3/worktrees/game-base/t3-fff8bd2c-76041fe9a6d8dd91/.artifacts/fight-sprites/hero-call-vs-idle.png

