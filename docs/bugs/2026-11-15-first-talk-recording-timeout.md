# First-talk recording sometimes times out

The human-input recording `tools/play/scenarios/first-talk.json` sometimes times out in `waitForFunction` after 15 seconds. Other attempts pass. The cause is not established.

Reproduced on unchanged `origin/main` at `e427350b35a6cd43d819284124777100a8b74a1e`, in a fresh detached worktree, with Chrome's Apple M4 Metal renderer. A run of all recordings passed cancel-bag-drag and festival, then timed out on first-talk. A separate isolated first-talk run passed. On the workflow branch, one run passed all three recordings and another timed out on first-talk and cancel-bag-drag.

Reproduce in an isolated checkout with its own port:

```sh
bun tools/play.mjs replay tools/play/scenarios/first-talk.json
bun tools/play.mjs stop
```

Expected: the recorded inputs complete and their checks pass. Observed: some runs stop on the timeout. The evidence does not establish a game defect or a root cause. The recordings and their timeout limits remain unchanged.

The local comparison log is `.artifacts/workflow/recording-baseline.log` in the `chapter-workflow` checkout. The full legacy Act 1 route, cloud saves, build-mode checks and camera-drag checks passed separately. The full verifier is not consistently green while this recording remains intermittent.
