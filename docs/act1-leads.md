# Act 1's leads: how a lead runs its own helpers

Kausthubh, 2026-11-12: "run more stuff in parallel, create subagents which can create subagents... and build the
game fast." So act 1 is built by a coordinator, a few leads under it, and helpers under each lead. This page is
what every lead shares; each lead's brief adds only its area.

## Who is who

- **The coordinator** owns `act1`, `AGENTS.md`, `src/engine`, `package.json` and the docs of the act. It merges
  each lead's branch into `act1` and settles clashes between leads.
- **A lead** owns one area and one branch, `act1-lead-<area>`. It designs the area's work, briefs up to **two
  helpers at once**, checks and merges their branches into its own, and keeps its branch merged with `act1`. A
  lead writes code itself only to join its helpers' work.
- **A helper** does one slice on its own branch, `act1-<area>-<slice>`, and follows `docs/act1-systems.md` (code)
  or `docs/act1-models.md` (3D models). It starts no helpers of its own.

## Starting a helper

Use T3's `delegate_task` with `isolation: "worktree"`. Its worktree is cut from the main checkout, so the brief's
first line must be `git checkout -b act1-<area>-<slice> && git merge --ff-only act1-lead-<area>`. Pick the model
by the work, as Kausthubh asked (2026-11-12):

| The work | Who | `target` |
|---|---|---|
| Architecture (a toolkit, a pipeline, a design others build on), and the hard 3D models: the ones a player stops to look at (a hall, a vault room, a bridge, a gatehouse, the Heartstone, a guild hall) | Fable 5.2 | `{"providerInstanceId": "claudeAgent", "model": "claude-fable-5-2", "options": {"effort": "high"}}` |
| Simple 3D models: anything placed many times or small (crates, fences, rocks, reeds, stall goods, baskets, wall runs, kit parts, dressing) | Astra | `{"providerInstanceId": "codex", "model": "gpt-6-astra", "options": {"reasoningEffort": "high"}}` |
| Sprites, portraits, icons, 2D art, playtests, running and writing checks | Sol | `{"providerInstanceId": "codex", "model": "gpt-6.1-sol", "options": {"reasoningEffort": "high"}}` |
| Code: rules, views, panels, composing and placing a place from its plan, wiring, tests | Opus | `{"providerInstanceId": "claudeAgent", "model": "claude-opus-5-5", "options": {"effort": "high"}}` |

**Claude usage is short** (his word, 2026-11-12, 10:10): "keep Fable only as architect and for 3D models; for
simple 3D models try to use Astra, Opus etc." So:
- Fable is for architecture and hard models only. It does not place, review, wire or test.
- Opus runs without fast mode. A lead keeps at most two helpers at once, of any model (see the machine, below).
- Give work with no taste in it (moves, renames, bulk edits, running checks, measuring) to Sol or Astra.
- Astra and Sol run on the default tier, never `priority`, which used their account up in an hour.
- An Astra model is held to its sheet like any other: the lead looks at it beside the sheet and sends it back, and
  hands it to Fable only when a second pass still falls short.

A brief names the goal in his words, the files the helper may write, the approved concept sheets it must match,
and done as checks that pass or fail. Point it at `docs/act1-systems.md` or `docs/act1-models.md` rather than
repeating them. When a helper finishes, read its diff, look at its pictures beside their sheets, and rerun its
strongest claim before merging. Send a slice back when it falls short of the sheet; Kausthubh has caught such
gaps by eye that every check passed, and asked that we catch them ourselves.

## The machine, and seeing your own work

Everyone shares one Mac mini with 10 cores and 16 GB. The thinking happens elsewhere; what loads the machine is
what agents run on it. Kausthubh, 2026-11-12: "Make sure all subagents can see what they're doing; run fewer if it
hinders the agents' performance." At 37 agents a helper waited up to 52 minutes to see one picture of its own
work, so it worked blind. So:

- **Seeing comes first.** An agent that makes anything a player sees looks at it in the game after each change,
  not once at the end. `bun tools/slot.mjs --look -- <command>` is the look lane: two at once, first come, first
  served, each job stopped after 5 minutes. Use it for `look-beside.mjs`, `props-beside.mjs`, `painted-shots.mjs`
  and your own short shooting scripts. Keep a look to a few pictures; open every picture you make. A report whose
  pictures the agent did not open is not done.
- **Checks go in the heavy lane**: `bun tools/slot.mjs -- <command>`, three at once, each stopped after 30 minutes (`bun run check` and `verify`
  queue there by themselves). Never put pictures and the full check in one job: the pictures then wait behind
  everyone's checks. Run the full check once per slice, at the end.
- `bun tools/slot.mjs --status` shows both lanes. Dev servers start outside the queue (it refuses them) and are
  stopped by pid when you finish; so is `play.mjs`.
- **Fewer agents.** A lead runs at most **two helpers at once**, of any model, and an architect at most one.
  Finish and merge a slice before starting the next. If the look lane has more than six waiting, start nobody.
- Never stop a process you or your helpers did not start.
- **The disk.** Each worktree costs real space, and the disk filled twice on 2026-11-12. Before starting a helper,
  check `df -h /System/Volumes/Data`: under 3 GB free, wait. Once a helper is merged, move its `.artifacts` into
  your worktree and `git worktree remove` its worktree.

## Pictures for Kausthubh

He asked to see progress in screenshots as the work goes. Every report from a lead or a helper names its three
best pictures (the game's own camera, beside the sheet where there is one) by absolute path, and one honest
picture of what still looks worst.

## Done for a lead

1. Every slice of the area is merged into `act1-lead-<area>`, which is merged with the latest `act1`.
2. `bun run check`, `bun run lint`, `bun run boundaries`, `bun tools/verify-assets.mjs` and
   `bun tools/sim.ts scenarios` pass on it, apart from failures that are also on `act1` (name them).
3. **The look gate** (`docs/act1-systems.md` 3b): every place the area touched, from the game's own camera,
   beside its approved sheet, in `.artifacts/lead-<area>/`, looked at by the lead.
4. Report: PASS, ISSUES or BLOCKED; the SHA; what a player can now do; each helper's branch and verdict; the
   pictures; what is left. Commit as you go; never push, never touch `main` or `playtest`.
