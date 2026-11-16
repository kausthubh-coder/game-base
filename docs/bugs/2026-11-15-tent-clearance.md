# Tent correction must preserve movement

The inherited camp view corrected the hero before checking whether the region had a camp. It used teleport for penetration correction, clearing all velocity and grounded state. A saved camp flag could therefore create an invisible obstacle in a region without camp, and pressure against canvas could stop sideways movement or a jump.

`bun test src/game/worldview/tent-clearance.test.ts` reproduced both defects against the extracted original callback. Both tests failed on player position or velocity. The shared callback now checks the current region on every use. The player controller's horizontal correction removes only inward velocity and shifts both interpolation positions, preserving vertical movement and grounded state.

The regression tests and first-night tests pass. Scoped typechecking of the controller, callback, tests and camp view passes. Browser proof of sustained sliding, corners, jumping, walking away, sleep and Continue remains required; these unit results do not establish that proof.

November 15 browser verification now passes from both unchanged earned copper and Gold saves. The final keyboard runner walked all sides, slept after the natural evening, woke and continued. Separate diagnostic fixtures passed explicit sustained W+D sliding, eight side/corner pressures, jumping, walking away, and no correction with a current-region stand-in that has no camp. Default verification passed all eight parts including six unchanged approvals. See `.artifacts/camp-tent-repair/nov15-sol/report.md` for provenance and limits. Tent art still has the separate visual issue in `2026-11-15-tent-visual.md`.
