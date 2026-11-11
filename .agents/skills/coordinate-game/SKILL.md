---
name: coordinate-game
description: Run a piece of work on the game with helper agents - design it, brief the helpers, check and merge their branches, put it live. Use when a task is too big for one agent, or when Kausthubh asks for helpers, subagents or work in parallel.
---

# Coordinate work on the game

The coordinator is the thread Kausthubh talks to. It designs and decides; helpers build and test. What a helper reports is the coordinator's claim once it repeats it.

## Who does what

| Work | Who | `delegate_task` target |
|---|---|---|
| The architecture, the systems' design, the plan, the briefs, the merge | The coordinator, itself | |
| Assets (sprites, 3D props, textures, sound prompts) and testing (checks, play scripts, scenarios, measurements) | A Sol helper | `{ providerInstanceId: 'codex', model: 'gpt-6.1-sol', options: { reasoningEffort: 'high' } }` |
| Everything else that gets built | An Opus helper | `{ providerInstanceId: 'claudeAgent', model: 'claude-opus-5-5', options: { effort: 'high' } }` |

Kausthubh set this split on 2026-11-11. A helper never inherits the coordinator's model. Read his `delegating` skill before starting one.

## The loop

1. **Design first, in the repo.** Write the plan where the next agent will find it (`docs/<topic>.md`): the stages, what each must prove, what is decided and by whom. `docs/multiplayer.md` is the model. A choice that is Kausthubh's taste is shown to him as two options before anything is built.
2. **Cut slices that share no writer.** One helper per folder or file set. Name what each owns and what it stays out of. Two helpers never edit one file.
3. **Commit and push what is done** before starting helpers, so each worktree starts from it (`isolation: 'worktree'` cuts from the coordinator's commit).
4. **Brief each helper.** It knows only what the brief says. A brief has: the goal in Kausthubh's words and why; what is true today, checked not remembered; what it owns; done as checks that pass or fail; what to report; and that it never pushes or merges `main`, because a push to `main` goes live.
5. **A builder is followed by a tester.** The Opus helper builds and proves what it can. A Sol helper then tests what the builder could not, from the builder's commit, and writes bugs to `docs/bugs/`. Small findings the coordinator fixes itself; a large one goes back to a builder.
6. **Check before repeating.** Read the diff. Rerun the helper's strongest claim from the main checkout. Look at its screenshots yourself.
7. **Merge one branch at a time**: `git merge --no-ff`, then `bun run check` and `bun run lint`, then fix what the merge broke before the next branch. Helpers often disagree at their seam (a path, a message shape): the coordinator settles it.
8. **`bun run verify --full` passes, then push.** A push to `main` deploys. Wait for the run, then check the live copy (`ship-game` skill, steps 3 and 4). Never end a turn while a deploy is running.
9. **Tell Kausthubh** in plain words: what changed for him, the proof, what is not checked, and the decisions that are his.

## Things that went wrong here once

- A test with a 5 second limit failed only when six helpers ran at once. Time limits in tests need room for a busy machine.
- A merge was pushed without `bun run lint`, and the check on GitHub went red. Run both before every push.
- A deploy script read the dev database's address from the environment and sent it live. `tools/deploy.mjs` now refuses that; keep the guard.
- A helper's command line showed a secret to `ps`. Secrets go in a private file or the environment, never in arguments.
- Two helpers each picked a shape for the call between them. Give both the same written shape, or have one build against an interface and settle it at merge.
