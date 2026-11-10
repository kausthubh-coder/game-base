# verify-assets

A skill and the command it runs. No game system, so nothing to install in the kernel.

## What it exports

- `tools/verify-assets.mjs`: the command. `bun tools/verify-assets.mjs` prints one PASS or FAIL line for each of seven checks (manifest, sprite-check, names, block-tiles, props, palettes, sizes), a size table, the failures of the first failing check, the warnings and a total. It exits 1 when a check fails. `--strict` turns warnings into failures. `--all` lists the failures of every failing check.
- The same file exports `verify({ root, strict, self })`, `report(result, { all, strict })` and one function for each check (`checkManifest`, `checkSprites`, `checkNames`, `checkBlockTiles`, `checkProps`, `checkPalettes`, `checkSizes`), for a script that wants one check alone.
- `tools/verify-assets.mjs.test.mjs`: its tests. The file name starts with the script's path because `bun test` does not look inside dot folders, so a test in this folder would never run.
- `SKILL.md`: when to run the command, how to read each failure, and what it cannot see.

## Events

None. It reads files and prints.

## Wiring

1. Nothing is required. The command runs as it is.
2. To make it part of the repo check, add to `scripts` in `package.json`: `"verify:assets": "bun tools/verify-assets.mjs"`.
3. For a release, run `bun tools/verify-assets.mjs --strict`.
4. It runs `bun tools/sprites/check.mjs --complete` and creates `.artifacts/sprites/` first, because that script writes its result there and the folder is ignored by git.
5. It looks for asset names only in `src/game/content/**/*.ts`. Names written elsewhere are not checked.
6. Icon names are read from `icons.names` and every sheet under `icons.sheets`. Portrait names are read from `portraits.names`. A `picture` may be a sprite, an icon or a portrait.
7. `LAYER_EXEMPT` in the script lets `center` have no bass and no percussion. That is a judgement from the header of `src/content/palettes/center.ts`. Remove the entry if it is wrong.
8. `PROP_KEYS` in the script holds the field names it accepts in `src/content/props.ts` (builder: `build`, `builder`, `make`, `create`, `geometry`; budget: `triangles`, `budget`, `triangleBudget`, `maxTriangles`, `tris`, `maxTris`). No props file existed when it was written, so check that list against the real one.
9. Today it passes with four warnings: `docs/assets.md` does not describe `icons.sheets`, `portraits`, `crops` or `ui`. Adding them to the doc clears the warnings.
