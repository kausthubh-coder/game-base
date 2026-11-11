---
name: verify-game
description: Prove a change to the game works by running the checks and playing the real game. Use before saying any task in this repo is done, after a bug fix, and when a check fails and you need to know which one to run.
---

# Verify the game

```sh
bun run verify            # every part but the slow ones, about two minutes
bun run verify --full     # the slow browser plays too
bun run verify shots play # only the parts named
bun run verify --list     # the parts
```

Each part prints `pass`, `skip` or `FAIL`. A failed part names its log in `.artifacts/verify/`. Run it before your change and after: every part that passed before passes after.

## Which part for which change

| You changed | Run | Then play |
|---|---|---|
| A `.sim.ts` rule or content in `src/game/content` | `check`, `bots` | The scenario for that rule, or write one (`features/rules.md`) |
| A view, a shader, a panel, anything drawn | `check`, `shots`, `play` | The place in a browser, and look at the screenshot (`features/browser.md`) |
| `server/` or `src/engine/net` | `check`, `server`, `live` | `features/world-server.md` |
| `convex/` or `src/features/account` | `check`, `live` | `features/account.md` |
| An asset or `manifest.json` | `assets`, `build`, `shots` | The `verify-assets` skill |
| A tool in `tools/` | `tools`, and the part that uses the tool | |
| `package.json`, `vite.config.ts`, the build | everything, with `--full` | |

## Three ways to play

1. **Rules only**, no browser, thousands of steps a second: `bun tools/sim.ts`. Start here for anything the rules decide.
2. **The door**, a browser driven through `window.__game`: jumps to any point of the game in one call. Use it to reach the thing you changed.
3. **Like a person**, real keys and clicks only: use it for what a player would hit, such as a prompt that never shows.

`features/README.md` lists what to drive for each part of the game.

## Proof

- Play the real path. A unit test that passes is not proof a player can do the thing.
- Capture the action and the state after it: the door's `state()` as JSON plus a screenshot you looked at yourself. Put them in `.artifacts/<feature>/`.
- A bug fix starts with a scenario or a recording that fails. The fix makes it pass. The scenario stays in the repo.
- A picture that changed on purpose: `bun tools/shots.mjs <scene> --approve`, look at the new picture, and say so in your report.
- Draw calls, triangles and shader counts are exact on this machine. A frame rate measured here says nothing about a player's device: do not report one.

## When something looks off

Run `bun tools/doctor.mjs` (the `worktree-game` skill). A port in use, a missing build or stale packages explain most odd failures.

## Cleanup

`bun tools/play.mjs stop` closes the browser and the server a play session started. The other parts stop what they start. Stop anything else by the pid you started, never by port. Evidence in `.artifacts/` stays.
