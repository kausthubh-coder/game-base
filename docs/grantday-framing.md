# Keep the opening cast visible

Grant day's input progression is implemented in `tools/play-grantday.mjs`.
The helper's fresh-build replay at `35ae5b1d` passed through the normal ferry
arrival after save/Continue during the spar. Its evidence is committed in
`ca6427da`. The coordinator added a separate output directory option in
`2066242b` so repeats preserve the earlier earned saves.

The next slice is the grant and quay presentation. The coordinator inspected
`.artifacts/grantday-input/15-grant.png` and `17-quay.png`: the grant's crowd
overlaps the hero and Dax is cropped at the quay's lower edge. These are
observations of those captures, not proof of persistent settled framing.
The runner waits about 470 ms before a dialogue capture, while the stage
camera eases in over 700 ms. Check both the approach and the settled shot.

## Scope

Use GPT-6.1 Sol in the existing forest checkout. Read AGENTS.md, the diagnosis,
feature, playtest and verification skills, `docs/testing.md`, the current
opening content, and the handbook's opening/staging guidance. Recover this
checkout; do not create another checkout or discard earlier changes.

Own narrow corrections to scenes 5 and 6 in `src/game/content/scenes.ts`,
Saltgate crowd/actor marks in `src/game/content/saltgate.ts` and
`src/game/opening/index.sim.ts`, and `src/game/views/story-stage.view.ts` only
if a reproduced camera/actor-selection fault needs it. Own focused regressions,
the opening replay's capture/assertion improvements, relevant verification
instructions and `.artifacts/grantday-framing/` evidence. Preserve the rest of
the current scene and visibility repairs. Avoid changing global camera values
to compensate for one misplaced person.

First reproduce the reported overlap and crop through normal input. Capture
their state and the active scene, actor IDs/positions and projected bounds at
entry, after camera settling and on each speaking turn. A local supplied
fixture can shorten diagnosis, but disclose it and finish with the fresh input
replay. The sight tool may omit opening actors with `saltgate:` IDs; verify its
coverage before trusting a green result. A useful regression must catch the
actual actor obscuration or screen cropping, not merely that dialogue ran.

Prefer authored actor/crowd placement when that resolves the cause. Keep the
crowd present and the grant recognizably a public event. Keep Hobb, Dax and the
hero visible above the film bars at the quay. Inspect the transition as well
as settled lines; do not claim a fix by delaying the only screenshot. If the
reported quay problem is only an acceptable transition, report the exact
evidence and avoid an unnecessary production change.

Preserve narrative text/order, interactions, weapon/look/name decisions,
save semantics, gifts, balance and normal ferry completion. Do not change
models, sprites, asset manifests, approved shot baselines, old Act 1 runner or
verifier selection. No new dependency or broad redesign.

## Proof

Record a failing reproduction before the fix. Verify the corrected grant and
quay at high and low, with all cast bodies and speaking faces visible. Check
camera restoration and controls when the scenes end. Inspect every affected
line. For changes to shared stage logic, rerun all dialogue scenes at high
and low, including accepted scenes 15, 16, 25 and 32. A local authored-mark
change still needs focused sight checks and the default verification.

Run the fresh Grant day input replay with a new output directory, preserving
`.artifacts/grantday-input/earned-landing.save.json` and the coordinator's
`.artifacts/grantday-review/` evidence. The complete run must earn the same
landing state, real spar hits, exact gifts, and successful middle Continue.
Keep its input restrictions from `docs/current-act1-replay.md`. Add meaningful
visibility assertions for the real opening actors where practical. Run focused
tests/typechecks, tools tests if changed, lint and all default verify parts,
with the six unchanged approved comparisons.

Commit source slices locally, then evidence separately. No helpers, push,
merge, deployment or branch changes. Finish every owned job and close only
owned browsers/servers. Report PASS/ISSUES/BLOCKED, cause and correction,
tested/evidence SHAs, exact commands, inspected before/after paths and limits.
Do not claim full Act 1, cloud, weak-device or forest-art acceptance.

## Separate follow-up

The mirror's Braid choice persists in `hero.look`, but the world retains the
copper-haired hero. `src/game/shell/player.ts` creates the actor with sprite
`hero`; the shipped hero sheets found so far cover actions and weapons, not
the other mirror looks. Do not hide/remove the choices or substitute a simple
tint for the promised hairstyle. This needs its own sprite asset and runtime
integration pass after the framing repair. Then continue stage 2 from the
unedited earned landing save, as specified in `docs/current-act1-replay.md`.
