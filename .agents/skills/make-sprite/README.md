# make-sprite

A skill for agents with an image generation tool. No game system and no code, so nothing to install in the kernel.

## What it exports

- `SKILL.md`: how to add one character, creature, block tile, icon or portrait from its approved concept sheet with the scripts in `tools/sprites/`: what to read off the sheet, the one cast style, what to register, what to generate, the build, the checks, the same-person check and the game-size check.
- `prompts.md`: the prompt pattern for each kind, with the failure each clause prevents, and how to give the concept and the set as two references.
- `check-failures.md`: every rule of `bun tools/art/check.mjs` and every message from `bun tools/sprites/check.mjs --complete`, what it means and the fix.

## Events

None.

## Wiring

1. Nothing to wire. Agents find the skill in `.agents/skills/`.
2. The checks it names are `bun tools/art/check.mjs` (rules in `tools/art/rules.mjs`, limits in `assets-src/art-style.json`), `bun tools/sprites/check.mjs --complete`, `bun tools/verify-assets.mjs`, and the pictures of `bun tools/art/review.mjs` and `bun tools/art/see.mjs`.
3. It describes `tools/sprites/` as merged at commit 53c6177 (the story art). If those scripts change, update the table in `SKILL.md` and the messages in `check-failures.md`.

## Two things in `tools/sprites/` the skill works around

- `assets-src/story-baseline-3.json` holds a hash of `blocks/atlas.png`, so adding any block tile fails `check-story.mjs` until that hash is replaced.
- `build-story-extra.mjs` and `check-story.mjs` know one extra icon sheet by name (`story`). A new icon needs a new branch in both.
