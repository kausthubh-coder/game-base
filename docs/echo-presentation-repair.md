# Readable home, farms and vault map

The earned Echo route exposed overlapping farm labels, a clipped home label and a vault pin crowded by the compass. Repair these in the current interface style while preserving every gameplay action and saved marker. This is separate from camp geometry and resident placement.

Evidence to inspect:

- `.artifacts/echo-input/nov15-complete-route/04-honey.png`: the fox and bait labels overlap over the hero, and the upper farm label collides with the Almanac notice.
- `.artifacts/echo-input/nov15-complete-route/05-earned-home.png`: the home needs label clips above the viewport.
- `.artifacts/echo-input/nov15-presentation-settled/high-middle-memory.png`: the Pump House marker sits under the decorative compass after zooming out to see all three vaults.

Own `src/game/views/ui-home.view.ts`, `src/game/views/ui-farms.view.ts`, relevant map UI files under `src/features/map`, narrowly required layout helpers/tests, dedicated presentation tools, verification instructions for these checks and `.artifacts/echo-presentation-repair`. Do not edit gameplay rules, resident positions, story/camera staging, tent files, earned-route runners, approved shots or root configuration. Ask the coordinator about a missing seam.

Use the exact unedited earned Echo and middle-memory saves from the completed route. These are input fixtures for layout checks, not a new claim of earned progression. Inspect existing UI layout and approved interface language before editing. Diagnose first and preserve failing evidence. Keep labels inside safe screen bounds and readable around nearby labels and HUD controls. Preserve access to farm production/status and resident needs; do not solve crowding by deleting information or hiding all labels. Avoid jitter while walking and do not allocate per frame. Make the three promised vault pins and labels readable at useful zoom levels without decorative UI covering them.

Prove at desktop and narrow viewport sizes, both high and low graphics, walking from home to bees with ordinary keys, moving/zooming the map normally, and opening/closing the affected panels. Include affected input targets and readable text in the browser assertions. Inspect the new screenshots yourself. Run focused checks, types and applicable verify-game parts. Coordinate shared approved-shot verification rather than racing another task's output; never approve changed baseline images in this task.

Follow `docs/resource-concurrency.md`. Source work and light checks may overlap the parent's Echo replay and the tent tester. Start a heavy job only after a fresh admission sample permits it and the total active jobs stay within that limit. Use a distinct build output and unused task port; never rebuild another task's served output. No new dependencies, helpers, checkout changes, push, merge or deployment. Stage exact owned files and keep source and evidence commits separate. Report source/tested/evidence SHAs, red/green checks, inspected before/after pictures and remaining issues. The Custodian's body/scenery framing warnings and absent staged past fox remain separate story-staging work.
