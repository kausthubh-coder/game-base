---
name: make-3d-asset
description: Add or change one 3D prop made in code for the game base, such as a tree, plant, rock, town piece, clutter or station. Use when asked for a new prop, 3D asset or model, or a new variant of one.
---

# Make a 3D asset

A prop is one entry in `src/content/props.ts` plus one builder function that draws it with a `Shape`. There are no model files and no textures. The work is done when the prop looks right from the game's camera beside its neighbors, and the checks pass.

Work from the repo root. Call the prop by its key, written like `lampPost`. Below it is `<kind>`.

## Steps

1. **Read the neighbors.** Find the group the prop belongs to (`tree`, `plant`, `ground`, `town`, `clutter`, `station`). Read that group's builders in `src/features/props/builders/` and its rows in `src/content/props.ts`. Done when you can name the neighbor closest to your prop and its triangle count.

2. **Add the entry** to `PROPS` in `src/content/props.ts`, in its group, copying the row of that neighbor. Set:
   - `builder`: the key itself.
   - `variants`: a name for each shape or color. Start with one.
   - `triangles`: a guess for now. Step 5 sets it.
   - `wind` and `light`: `false` and `0` unless a part sways or glows.
   - `vary`: `WILD` for things that grow or lie about, `LOOSE` for things somebody put down, `SNUG` for things that must keep the turn they are placed with: fixed to a wall, joined to each other, or pointing somewhere.
   - `crown`, for a tree only: the height and reach of each variant. The builder reads them.

3. **Write the builder** in the group's file in `src/features/props/builders/`. Import it in `builders/index.ts` and add it to `BUILDERS` under the same key. It takes the variant's index, makes `new Shape(seed)` with the next number after its neighbors' seeds, adds parts, and returns `s.done()`. Follow "Rules of the shape" below. Done when `bun tools/typecheck.mjs props` passes.

4. **Look at it.** Run `bun tools/props-preview.mjs <kind>`. It builds the demo, takes three pictures into `.artifacts/props/` and stops. Open all three with the Read tool:
   - `only-<kind>.png`: every variant on a turntable, with its triangle count.
   - `only-<kind>-night.png`: the same at night.
   - `sheet-<group>.png`: the whole group at one scale.

   Change the builder and run it again until every line holds:
   - On the sheet, you can tell what it is without reading its label, and it is the right size beside its neighbors.
   - Its colors and chunkiness match the neighbors. Nothing looks thinner, smoother or brighter than they do.
   - It casts a shadow on the turntable if it stands taller than a bush.
   - At night it glows if its entry gives light, and is dark if not.
   - Its label is not red. Red means a variant is over its budget.

5. **Set the budget.** In the entry, set `triangles` to the largest count on the turntable plus about a fifth, rounded to ten. The cap is 300, or 1,500 for a tree, and most neighbors use far less: match them.

6. **Run the checks.** `bun test src/features/props` and `bun tools/typecheck.mjs props` must pass. The tests hold every variant to its budget, every color to the palette, sway to `wind` and glow to `light`. Fix the prop, never the test.

7. **Put it in the world**, if the task asks for that. A wild thing gets a rule in `src/features/props/scatter.sim.ts`. A thing that belongs to a building goes in that building's `props` in `src/content/blueprints.ts`. Anything else is placed by the caller with `props.place(kind, variant, position, rotation, scale)`. The demo's village places its own in `demos/props/village.ts`.

To change an existing prop, start at step 3. To add a variant, add its name to `variants`, handle the new index in the builder, and start at step 4.

## Rules of the shape

**Space.** One unit is one meter and one block. The hero is 2 tall and a doorway is 1 wide and 2 high. The prop stands on y = 0 with its middle at x = 0, z = 0, and its front faces +z. A thing fixed to a wall (door, window, sign) has the wall's outer face at z = 0 and sticks out toward +z.

**Chunky.** The camera looks down from 35 degrees and a prop is often 60 pixels tall. Give it one clear outline, put what tells you what it is on its top, and make every part at least 0.03 thick. Use `bevel` on its largest box so it catches light on its edges.

**Color.** Use only the names in `src/features/props/palette.ts`: `P.timber` for one color, `RAMP.oakLeaf` for a ramp. A ramp runs from dark to light, and a blob or cone picks from it face by face. To add a color, copy its hex from `assets-src/palette.json` into `P`. The bright lume teal is for magic and old machines only.

**Triangles.** Each part costs what `src/features/props/shape.ts` says at its definition. A plain box is 12, a beveled one 44, a blob about 40. Leave out faces nobody sees with `skip: '-y'`, and give round things 5 to 8 sides.

**Wind.** A part with `sway` moves: 0.3 for a bush, 0.5 for a grass tip, up to 1 for leaves at the top of a tree. A part that touches the ground has none. Set `wind: true` in the entry exactly when some part sways.

**Light.** A part with `glow: 1` lights up warm when it is dark, and `glow: 2` glows always, like coals. Call `s.light(x, y, z)` once where the light sits, and set `light` in the entry to its block light level, 1 to 15. Add `alwaysLit: true` for `glow: 2`.

**Shadow.** A prop casts no shadow by itself. Add one or two `s.shadowBox(...)` or `s.shadowBlob(...)` around its main mass. `blob(..., { shadow: true })` adds its own.

**Chance.** Use `s.r()` and `s.rr(a, b)` for any random number, so the prop is the same shape on every machine.

## The parts of a Shape

Each is a method on `Shape` in `src/features/props/shape.ts`, where its options are listed.

| Part | Draws |
|---|---|
| `box(x, y, z, w, h, d, tone)` | A box standing on y. Options: `bevel`, `skip`, `top` for another color on top. |
| `cyl(x, y, z, r0, r1, h, sides, tone)` | An upright tube, `r0` wide at the bottom and `r1` at the top. |
| `tube(path, radii, sides, tone)` | A tube through points: a leaning trunk, a branch, a blade of grass. A radius of 0 ends it in a point. |
| `blob(x, y, z, rx, ry, rz, tone)` | A lumpy ball around its middle: leaves, bushes, rocks, sacks. `floor: 0` cuts it flat on the ground. |
| `cone(x, y, z, r, h, sides, tone)` | A cone standing on y: a pine's tier, a flower head, a cap. |
| `poly(points, tone)` | One flat face. `two: true` draws its back for cloth. `toward: [0, 1, 0]` makes it face up. |
| `disc(x, y, z, r, sides, tone)` | A flat face that looks up: water in a well. |
| `at(x, y, z, turn, draw)` | Draws what `draw` adds at another place, turned or tipped: an open door, a log on its side. |
