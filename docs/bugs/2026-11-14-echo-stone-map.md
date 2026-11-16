# Echo interaction and map marks

The first memory played simply by approaching the mural. Standing at the stone for three seconds in `ruins-shrines` reproduced it before interaction. The strengthened scenario failed at input 4, with the player busy and scene 24 active. `.artifacts/echo-input/stone-red.log` retains that failure. Scene 24 now has a stone start condition; the story director leaves it to the existing interaction. Repeats still use the authored memory conversation.

The Custodian set `vaults.marked`, but the map's pin loop only admitted places within 30 blocks. It now also admits the three named vault doors after that conversation. Existing pin storage handles reloads. The earned runner checks unvisited pin coordinates and kinds, then reloads and checks all three again. It keeps the original six picture approvals and default verifier selection.

Run `bun tools/sim.ts scenarios ruins-shrines`, `bun test src/game/story src/game/ruins src/game/uiview/echo-pins.test.ts`, then the earned route documented in `docs/echo-input.md`. Browser results are recorded separately; a partial route is not acceptance.
