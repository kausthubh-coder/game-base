# Act 1 inventory icon redraw

Base before changes: `830a426ae01d04e7d727a7918cda568056c16390`. Branch: `act1-2d-icons`. No push or merge to another branch.

Generated with the built-in image generation tool. Every source and exact prompt is saved in this directory. `selected.json` names the kept cells. Rebuild with `bun tools/sprites/build-story-extra.mjs act1-<set>` for each of the six sets.

## Attempts and visual review

Opened `.artifacts/art/see/icons-01.png` after the final build. Inspected all twenty at 32 pixels on parchment and their 64-pixel enlargements. All twenty are identifiable; none is left unreadable.

| Set | Attempts / kept | Silhouettes visible on parchment |
|---|---|---|
| weapons | 1 / 1 | Plain bow is a smooth D; copper adds a projecting horizontal arrow; spring has broad brass mechanical limb housings; tusk has flared ivory horn tips. Staff heads are a round wooden disc, open copper petals, domed brass cage and asymmetric branching tusk fork. Shafts are short enough for the heads to read. |
| story | 1 / 1 | Pump House is a low triangle with a water curl; Lamp Gallery a tall pointed hexagon with lantern; Seed Vault a round disc with green sprout. |
| equipment | 2 / fittings from 1, jackets from 2 | Canvas is a wide flat T with horizontal sleeves; padded is a tall coat with round fur collar. Grip is an unrolled olive cloth pad; hilt a diagonal exposed spring cartridge; honey binding an open braided amber ring with a connected drip. First-attempt jackets failed the twin check and were rejected. |
| farm | 1 / 1 | Shed pelt is a broad shaggy grey fold with a dark hollow beneath its top flap, unlike the other farm goods. |
| found | 1 / 1 | Old brass is a broad toothed curved bracket with a large through-hole, unlike solid wood, boards, meals and coin. |
| kit | 1 / 1 | Quill strip is a tied grey fur roll with three upright ivory points; lamp post has a broad framed lantern head over a short pointed stake. |

## Preservation and rebuild proof

`bun assets-src/act1-icons/redraw/verify-cells.mjs` compares decoded RGBA rows of each untouched named cell against `git show 830a426:<sheet>`, the captured pre-change HEAD. All 43 untouched named cells match. The builder starts from archived baseline atlases, clears only the twenty target cells and inserts cleaned, palette-snapped generated crops using `fittedMode`. No pixel art was drawn in code. The same script rebuilds every selected sheet and asserts that the entire PNG is byte-for-byte identical. Names, cell positions and manifest are unchanged.

## Tool issue and scope

The art checker skips icon rules when a positional name filter is supplied, even for an icon name. A filtered probe printed a misleading zero-check PASS. Full unfiltered checks and the actual `iconFaults` function were used to validate the art. The first bow settlement used that filter after an independent full check had already confirmed no bow fault; subsequent settlements use full unfiltered checks. The copper bow had no ledger entry initially.

The shared command queue delayed ledger settlement. Work on the other sets proceeded after the weapons build, full art check, picture review, preservation proof and first commit, while the remaining weapons settlements waited.

No server, browser playtest, runtime build, gameplay suite, deployment or Windows check was run; this task explicitly needs no server and changes inventory assets only. No out-of-scope existing art fault was redrawn or settled. The first full asset run failed the legacy Act 1 icon bounds rule: that checker requires a 24-pixel extent and four-pixel margins, stricter than the 28-pixel art rule. Rebuilt all twenty at 24 pixels without changing any limits. Opened the rebuilt review board again; all twenty remain identifiable. The full art and asset checks were rerun after this correction. Final outcomes follow below.

## Final result: PASS

- Full unfiltered `bun tools/art/check.mjs --all`: `PASS art`, no new fault. None of the twenty target icons appears in its output or in the ledger. Unrelated known faults remain untouched.
- `bun tools/verify-assets.mjs`: `TOTAL PASS`, all 10 checks pass. One existing warning remains: the manifest's `uikit` section is not documented in `docs/assets.md`, which is outside this brief.
- All 43 untouched named cells match decoded pre-change pixels; all six selected atlases rebuild byte for byte. Manifest and art-style limits match the pre-change commit.
- Final picture: `.artifacts/art/see/icons-01.png`. Opened after the final 24-pixel rebuild and inspected all twenty on parchment. No unreadable target remains.
- Logs: `.artifacts/art/icons-final-check.log` and `.artifacts/art/icons-final-assets.log`.
- Runtime gameplay, runtime build, deployed copy and Windows were not checked. No server was started and nothing was pushed.
