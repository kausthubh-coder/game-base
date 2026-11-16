# Post-fight conversation lost on reload

Saving after a victory but before its conversation ended could leave the quest incomplete after Continue.
Fight victory and gifts were saved, but the director's pending conversation queue was not. Loading flags does
not emit `flag.changed`, so the lost queue entry was never restored. This affected the queued delay and an
already open conversation. A stale queue could also survive loading an earlier save in the same kernel.

The scene runner now checks saved win/denial flags for unfinished post-fight conversations before ordinary
quest conversations. Completed scene flags prevent replay. Existing queued post-fight entries require the
matching win/denial flag in the current save. Fight rewards and the save format are unchanged.

## Evidence

The regression uses the full game kernel and real save/load. Its earned-victory case wins fight 2 before
reloading during scene 19. The tests cover a save before the scene starts, an interrupted earned victory,
gift conservation, completed-scene reload, denied fight 4 after completed scene 19, and loading an earlier
state into the same kernel.

- Before: `.artifacts/post-fight-recovery/red.log`, four failing tests on `f985d05802d262832b23045d1647313055f82fde`.
- Fix: `4cd8931bd1223cdd732791fd378c74922eaef669`.
- After: `.artifacts/post-fight-recovery/green-story-talk.log`, 46 passing story/talk tests, including all four regressions.
- Types: `bun tools/typecheck.mjs --paths src/game/story`, exit 0; no diagnostics.
- Exact file hashes and commands: `.artifacts/post-fight-recovery/evidence.json`.

The operator independently reproduced ordinary pagehide/reload losing scene 19 before this fix in the release
checkout's `.artifacts/beta-final/attempt-01/normal-save-red/`. Browser verification after adopting the fix is
owned by the release operator; this report does not claim that result.
