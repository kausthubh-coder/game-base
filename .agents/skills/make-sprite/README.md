# make-sprite

A skill for agents with an image generation tool. No game system and no code, so nothing to install in the kernel.

## What it exports

- `SKILL.md`: how to add one character, creature, block tile, icon or portrait with the scripts in `tools/sprites/`: what to register, what to generate, the build, the checks, the lesson of the second run and what to look at in the preview sheets.
- `prompts.md`: the prompt pattern for each kind, with the failure each clause prevents.
- `check-failures.md`: every message from `bun tools/sprites/check.mjs --complete`, what it means and the fix.

## Events

None.

## Wiring

1. Nothing to wire. Agents find the skill in `.agents/skills/`.
2. The checks it names are `bun tools/sprites/check.mjs --complete` and `bun tools/verify-assets.mjs`.
3. It describes `tools/sprites/` as merged at commit 53c6177 (the story art). If those scripts change, update the table in `SKILL.md` and the messages in `check-failures.md`.

## Three things in `tools/sprites/` the skill works around

Its author could not edit that folder. Each is a small fix for whoever owns it.

- `preview.mjs` crashes at the first story sprite (`c.size` of undefined, line 12), so the block sheets `blocks-<n>.png` are no longer rebuilt. Fix: in both loops, `Object.entries(m.sprites).filter(([n])=>sprites[n])`. Tested on a copy.
- `assets-src/story-baseline-3.json` holds a hash of `blocks/atlas.png`, so adding any block tile fails `check-story.mjs` until that hash is replaced.
- `build-story-extra.mjs` and `check-story.mjs` know one extra icon sheet by name (`story`). A new icon needs a new branch in both.
