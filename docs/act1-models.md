# Act 1's 3D models: how every model builder works

Every model of act 1 is built by a Fable 5.2 helper from an approved concept sheet (Astra built the first rounds). This page is what each of
them shares; each brief adds only its own list. Kausthubh, 2026-11-12: "I want 3D assets and terrain to be good
and on a grand scale... I want this to be a real kingdom feel." He said to use Fable 5.2 for 3D models and to rebuild the older ones that look bad.

## The bar

A model passes when a person looking at it beside its sheet, in the game's light on the painted land, would say
it is the same thing, made with care. Not "close in size": the same silhouette, proportions, materials,
softness and colour. The first round of models was true to size but faceted, flat-coloured and boxy, and failed
this bar; the toolkit has been upgraded since, so that excuse is gone.

## How to build

1. Start from your branch: `git checkout -b <your branch> && git merge --ff-only act1`, then
   `bun tools/doctor.mjs` and use the port it prints.
2. Read `AGENTS.md`, `.agents/skills/make-3d-asset/SKILL.md` (with `landmarks.md` beside it) and follow it,
   and `src/features/props/README.md`: the toolkit. Reach first for `rock` (natural stone), `sweep` (roots,
   logs, branches, rock arches, rope), `roundBox` and `skin: 'stone'` (masonry), `lathe` (turned forms, round
   roofs), `mesh` (anything else), and a `skin` on every part that has a painted material (rock, scree, moss,
   bark, old bark, dressed stone, mud, wood, thatch, plaster).
3. Your sheets are in `assets-src/concept/<set>/`, with the painter's build notes in that folder's README
   or report. The ancients' stone is `assets-src/concept/stone.md`. The notes and the sizes on the sheet win
   over a painting's perspective; the painting wins on everything a person sees.
4. Each model is an entry in `src/content/props.ts` and a builder. Put your builders in your own file
   (`src/features/props/builders/<your file>.ts`) and your entries in one block at the end of
   `src/content/props.ts` and of `src/features/props/builders/index.ts`, under a comment with your branch's
   name: those two files merge by keeping every block. Do not edit any other helper's file.
5. Triangle caps: a `landmark` may have 6,000; something placed many times (a wall face, a stall, a crate, a
   fence piece, a boardwalk) far less: say its count and how many you expect in view. Glowing parts follow the
   skill; a variant that does not glow is listed in `unlit` by its number.
6. A model that the game must move or open (a wheel, a door, a gate) exports its parts as separate geometry
   with the pivot at the origin, the way `pumpHouseParts()` in `builders/group-4.ts` does, and says how to turn
   them.

## The checks

Look at each model as you build it, not once at the end: `bun tools/slot.mjs --look -- bun tools/props-beside.mjs
<kind>` (the look lane: two at once, 5 minutes a job). Run the full check and `shots.mjs` in the heavy lane:
`bun tools/slot.mjs -- <command>` (`bun run check` queues by itself). Never put pictures and a check in one job. Many builders share one Mac mini.

1. `bun run check`, `bun run lint` and `bun tools/verify-assets.mjs` pass.
2. `bun tools/props-beside.mjs <kind>` for every model and variant: the model on the painted meadow in the
   game's light beside its sheet, and the game's own camera view. Look at every one. If a person would call it
   clearly worse than its sheet (flat colour, facets where the sheet is soft, a box where the sheet has a shape,
   wrong proportion), it is not done: improve it.
3. Pieces that join (spans, wall faces, quay walls, boardwalks, fences): a picture of three joined, with no gap
   and no doubled part.
4. Openings meant to be walked through: their clear width and height, checked as the skill says.

## Rules

Commit on your branch as you go. Never push, never merge or push `main` or `playtest`. Start servers on your
own port and stop only what you started, by its pid. Keep pictures small. A question you can't settle: pick a
default, say so in your report, keep going.

## Report

PASS, ISSUES or BLOCKED. Your last commit's SHA. Each model with its triangle count, size and any parts or
openings. Each check with its command and result. The beside picture paths. What you did not check.
