# The props toolkit

Every prop is code. A builder in `builders/` draws parts into a `Shape` and `s.done()` joins them into one geometry. Every copy of one kind and variant is one instanced draw call, whatever parts and skins it uses. This page lists every call, when to use it, a short example and what it costs in triangles.

The space: y is up, one unit is one meter, the prop stands on y = 0 with its middle at x = 0, z = 0, and its front faces +z. Colors come only from `P` and `RAMP` in `palette.ts`. A ramp runs from dark to light.

## Start a builder

```ts
export function myRock(variant: number, _def: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(9001 + variant, detail);
  s.rock(0, 0, 0, 3, 2.4, 2.6, ROCK, { level: 3, moss: 0.5, skin: 'rock' });
  return s.done();
}
```

Pass `detail` to the `Shape`. It is `propDetail` from `src/content/quality.ts`: 1 at medium and up, 0.5 at low. The soft forms read it and cut themselves more coarsely at low, and the game builds them again when the level changes. Boxes, tubes and the other first calls ignore it. A builder that never passes it still works at full detail.

The seed makes `s.r()` and `s.rr(a, b)` give the same numbers on every machine, so a prop is the same shape everywhere.

## The soft forms

Use these for anything the concept sheets paint soft: rock, roots, logs, thatch, plaster, hewn timber. Each one bakes its shading into its vertex colors:

- faces that look up move toward the light end of the ramp (`light`, default 0.3);
- with `key`, faces toward the sheets' painted light (above, left and front) move lighter too, so a rock's broad planes take different tones whatever the sun does;
- hollows, undersides and the first 0.9 m above the ground get darker (`cavity`, default 0.45);
- slow noise moves the color along the ramp (`mottle`, default 0.18), so no face is one flat color;
- `moss` (0 to 1) covers that share of the upward faces with moss, and puts patches at the foot. `mossTone` changes its ramp.

All of them take `skin` (below), `sway`, `glow`, and `smooth: false` for flat faces.

### `rock(x, y, z, w, h, d, tone, options)`

A rock that stands on y and fills the box `w` × `h` × `d` exactly. It is a fine ball pushed out of round by noise, then cut by broad planes, the way the sheets paint rock. The first plane slopes its top. Normals are smooth within a plane and keep an edge between planes (`crease`, 0.6 radians), so the planes read as planes.

```ts
s.rock(-1, 0, 0.5, 4.6, 4.4, 3.8, [P.iron, P.pewter, P.rose, P.ash, P.pearl, P.sand],
  { level: 3, planes: 9, reach: 0.6, flat: 1, key: 0.5, moss: 0.55, skin: 'rock' });
```

Use `level` 3 for a rock a player walks up to, 2 for a rock in a heap, 1 for pebbles and for clumps of moss or leaves. `planes` (5) and `reach` (0.76) set how blocky it is: more planes and a lower reach cut deeper. `lump` (0.12) is noise. `seat: false` keeps the whole form between y and y + h, for a rock on top of another or a clump of leaves in a tree. It adds a shadow ball unless `shadow: false`.

Cost, seated: level 1 is 74 triangles, 2 is 276, 3 is 1,066, 4 is 4,180. At low detail it drops one level.

### `sweep(path, radii, tone, options)`

A smooth tube that bends through the points of `path`, as thick as `radii` at each one: a root, a log, a branch, an arch of rock. Its skin's strokes run along it, so bark follows a trunk.

```ts
// A hollow log open to the ground, with pale cut ends.
s.sweep([[-12, 1.95, 0], [0, 1.95, 0], [12, 1.95, 0]], [2.6, 2.4, 2.2], BARK, {
  sides: 28, bore: 1.6, gap: 1.3, ribs: [15, 0.08], skin: 'bark', moss: 0.55,
  innerTone: [P.umber, P.bark, P.wood], rimTone: [P.ochre, P.gold, P.butter], rimSkin: 'grain',
});
```

`sides` (10) and `steps` (3 rings between two points) set how smooth it is. `squash` flattens the section (1 is round). `lump` and `ribs: [count, depth]` roughen it. `cap` rounds its ends ('both' by default). `bore` makes it hollow, and `gap` leaves an opening of that many radians along its underside. A hollow sweep ends in rims, with their own `rimTone` and `rimSkin`. `floor: 0` cuts it flat where it goes into the ground, like an arch's feet. `sways` gives sway at each point of the path, 0 at the root.

Cost: about 2 × sides × (points − 1) × steps triangles, plus about 6 × sides for each rounded end. A hollow sweep costs about twice that. Three points at the defaults is 220; the fallen oak's trunk is about 2,000. Low detail halves sides and steps.

### `lathe(x, y, z, profile, tone, options)`

A form turned round an upright axis. `profile` is a list of [radius, height above y] from the bottom up: a stilt, a post, a pot, a lantern, a round or hipped roof. Its skin's strokes run up the profile, so thatch runs down a roof.

```ts
// A soft hipped thatch roof with deep eaves.
s.lathe(0, 0, 0, [[3.3, 4.7], [4.4, 4.6], [4.5, 4.9], [2.4, 6.8], [0.4, 7.8], [0, 7.9]], THATCH,
  { sides: 20, square: 0.55, skin: 'thatch', moss: 0.2, capTone: P.umber });
```

`square` (0 to 1) turns a round lathe square, with its faces along x and z: 0.55 is a soft hipped roof. `sides` is 12 by default. `cap: false` leaves its ends open; otherwise an end that does not come to a point is closed with `capTone`.

Cost: 2 × sides × (profile points − 1), plus `sides` for each closed end. A four-point profile at 12 sides is 96 triangles, 48 at low.

### `roundBox(x, y, z, w, h, d, tone, options)`

A box with rounded edges that stands on y like `box`, shaded smooth: masonry, a plastered wall, a hewn beam. Its skin's strokes run along its longest side.

```ts
s.roundBox(0, 2, 0, 5.2, 2.9, 3.9, PLASTER, { round: 0.1, wobble: 0.03, skin: 'plaster', skip: '-y' });
```

`round` is the radius of its edges (a fifth of its smallest side by default). `segments` is the steps round each edge: 1 is 108 triangles, 2 is 300. `wobble` is hand-hewn unevenness in meters. `skip` leaves out faces, as for `box`. A plain bevelled `box` is 44 triangles and stays the right call for small planks and rails.

### `mesh(points, triangles, tone, options)`

Any surface: points as three numbers each in the pen's space, triangles as three point indices each. The forms above are made with it, and it shades its points the same way. Give `hints` (a rough outward direction for each point) and the order of a triangle's points does not matter. Give `uvs` (two numbers a point, in meters) to lay a skin's strokes along it. `crease` keeps edges sharper than that angle. `floor` leaves out triangles lying wholly at or under that height. `shifts` moves each point along the ramp, so one block of a wall can be a shade off the next.

### `weather(from, options)`: age on any part

`s.mark()` says where the next part starts; `s.weather(mark, options)` ages everything drawn since. It moves only colors and points, so it costs no triangles, and it is as fine as the part is cut: a wall cut round its openings has corners at every sill.

```ts
const start = s.mark();
s.roundBox(0, 0, 0, 1, 3, 1, PLASTER, { skin: 'plaster' });
s.weather(start, { moss: 0.8, soot: 0.6, wear: 0.5, stains: [[0, 2, 0.5, 0.9, 1.2]], sag: 0.05, lean: 0.08 });
```

| Option | What it does |
|---|---|
| `moss` | Damp and moss creeping up from the ground, this many meters, ragged. On a skinned part it wears the moss painting. |
| `soot`, `sootReach` | Darker toward the part's top, over `sootReach` meters (1.2): a chimney's mouth. |
| `wear` | Lighter edges and corners, wherever the part bevels or rounds. |
| `stains`, `stain` | Streaks fading down from points, `[x, y, z, width, length]` each in the pen's space: under a sill, a spout. |
| `sag` | Bends the part down in its middle along x, most at its top and none at its foot: an old ridge. |
| `lean` | Leans it toward +x by this much at its top. |

## Architecture: `arch.ts`

Buildings and ruins are drawn with the calls in `arch.ts`, made from the soft forms above. Every call takes the `Shape` first and draws in its pen, so turn the pen with `s.at` for a wall that faces another way. A wall's face looks toward +z and stands on y. All are cut more coarsely at low detail: blocks lose their chamfers, roofs their rafter ends and half their courses, walls their plaster patches and glazing bars. The materials are ramps exported beside them: `HONEY` (the town's stone), `HEARTH` (the ancients' limestone, `assets-src/concept/stone.md`), `PLASTER`, `TIMBER`, `TEAL` (roof tiles), `SLATE`, `STRAW` and `GLASS`.

```ts
import * as arch from '../arch.ts';
```

The costs below are measured on the example shown, at full and at low detail.

### Roofs

`roof(s, x, wallTop, z, w, d, options)` covers walls `w` along x by `d` along z whose top is at `wallTop`, its ridge along x. Each slope is cut into courses whose lower edges step out, so the eave and the verge read as tiles, with the cover's painted skin between and a dark underside. It brings its ridge and hip caps, barge boards, the ridge beam's ends, purlin ends, rafter tails under the eaves, plaster gable ends with their timbers, and dormers.

```ts
// A cottage roof: ridge along z, gable to the front, an old bent ridge, a little moss.
s.at(0, 0, 0, Math.PI / 2, () => arch.roof(s, 0, 3, 0, 4.4, 5.6, { rise: 2.25, overhang: 0.55, verge: 0.75, sag: 0.1, gables: 'king', moss: 0.12 }));
// A hall's hip roof with a dormer on its front slope.
arch.roof(s, 0, 7.2, 0, 17, 9, { kind: 'hip', rise: 4, overhang: 0.8, course: 1.1, dormers: [{ x: -5.2, side: 1, w: 2, h: 1.7 }] });
```

`kind` is `'gable'`, `'hip'` or `'half-hip'` (a gable hipped back above `hip`, 0.62 of the rise). `cover` is `'tiles'` (teal), `'slate'` or `'thatch'`, each with its skin; `tone` changes the ramp. `rise`, `overhang` (0.6) and `verge` (the gable's reach past its end walls) set its shape; `course` (0.9 m) and `thick` (0.18) its edge; `belly` (0.08) bows each slope and `sag` bends the ridge. `gables` frames the gable ends (`'king'`, `'queen'`, `'cross'`, `'plain'`) or leaves them open (`'none'`); `gableEnd: -1` draws only the -x end, for a porch whose back is in its wall. `tails` spaces the rafter ends (1.4 m, 0 for none). `dormers` lists `{ x, side, w, h }`.

| Example | Full | Low |
|---|---:|---:|
| Gable 7 × 6, with gable ends and rafter tails | 564 | 276 |
| The same with neither | 304 | 160 |
| Hip 17 × 9, no tails | 674 | 254 |
| Half-hip 8 × 6, thatch | 444 | 300 |
| A dormer | about 340 | about 240 |

### Gable ends and timber

`gable(s, x, y, z, w, rise, { frame, clip })` is a plaster triangle facing +z with its timbers: `'king'` a tie, a king post and struts; `'queen'` two posts and a collar; `'cross'` a collar with an X over it; `'plain'` the tie. `clip` stops it short for a half-hip. 58 triangles at both levels. `roof` draws its own; call it alone for a gable wall under someone else's roof.

`timber(s, a, b, size, tone, { height, skin })` is one hewn beam, post or brace from point a to point b, square or `height` deep, its grain along it. 12 triangles. Framing, porches, barge boards and glazing bars are made of it.

### Walls and openings

`wall(s, x, y, z, w, h, options)` is a wall face with its openings cut through, their reveals, frames, sills, glass and shutters. A plaster wall stands on a coursed `plinth` and carries timber `frame`; a `material: 'stone'` wall is coursed all the way up. It ages itself (moss at its foot, streaks under each sill, worn edges) and is cut only where its openings need it: a plain plaster face is 4 triangles.

```ts
arch.wall(s, 0, 0, 2.2, 5.6, 3, {
  plinth: 0.55, frame: 'cottage',
  openings: [
    { kind: 'door', x: 0.35, w: 1.1, h: 2.25, frame: 'stone' },
    { kind: 'window', x: -1.65, y: 1.05, w: 0.62, h: 1, top: 'arch', frame: 'stone', shutters: false },
  ],
});
```

`frame` is `'cottage'` (posts, a head and knee braces), `'close'` (with long diagonals in the lower bays), `'civic'` (close posts, a sill, X braces in the top band) or `'none'`; `rails` adds rails at those heights and `bay` spaces the posts. `posts: false` leaves the corners to someone else. `patches` (2) adds plaster repairs and places fallen away to the stone. `moss` (0.6 m) and `stains` age it; `depth` (0.25) is how deep its reveals are; `stone` passes `StoneOptions` to its plinth and stonework.

An opening is `{ kind, x, y, w, h }` from the wall's middle and foot: `w` by `h` clear, `h` to the top of its head or arch.

- `kind: 'window'`: glass that glows at night (it places its own `s.light`), glazing `bars` (`'cross'`, `'grid'`, `'none'`), a sill, open `shutters` on square windows, `pair: true` for two lights under one head. `glow: 0` keeps it dark.
- `kind: 'door'`: planks each their own shade, iron straps, a ring, a threshold; `leaves: 2` for a double door (the default over 1.6 m).
- `kind: 'arch'`: an open archway, dark inside for `inside` meters; `insideGlow: 1` lights its back like an oven's fire.
- `top` is `'square'` or `'arch'`; `frame` is `'timber'`, `'stone'` (voussoirs and jambs, a lintel on square heads) or `'none'`.

| Example | Full | Low |
|---|---:|---:|
| Plaster wall 5 × 3, plinth, cottage frame, a shuttered window | 342 | 218 |
| Plaster wall 8 × 6, civic frame with a rail | 352 | 352 |
| Stone wall 5 × 3 with an arched door | 318 | 136 |
| A square window with timber frame and shutters | about 130 | about 95 |
| An arched window in stone | about 245 | about 125 |
| A pair of arched lights in stone | about 360 | about 165 |
| An arched door in stone | about 270 | about 135 |
| A square door in timber | about 70 | about 50 |
| An oven arch, glowing | about 260 | about 135 |

### Masonry

Blocks are laid in courses of uneven height and length, staggered, each a little proud with chamfered edges so neighbours meet in a groove, each its own shade, some with a broken corner. At low detail each block is one flat face, still its own shade. `StoneOptions` set the look: `tone` (`HONEY`), `skin` (`limestone`), `course` (0.9 m), `long` ([1.2, 2.2] m), `chamfer` (0.07), `relief` (0.045), `chip` (0.25 of the blocks), `vary` (0.22 along the ramp), `moss` (0; 0.1 to 0.4 for a ruin) and `flat`.

- `ashlar(s, x, y, z, w, h, d, { faces, holes })`: a coursed mass standing on y, its `faces` ('+z+x-x-z+y') laid in blocks; `holes` leaves openings in its +z face. A 4 × 1 × 1 plinth is 110 triangles, 22 at low.
- `stoneBlock(s, x, y, z, w, h, d, { faces })`: one dressed block, for a pedestal, a step or a coping. 40, 8 at low.
- `quoins(s, x, y, z, h)`: corner stones up a building's corner, alternately long on each face. 90 for 2 m, 18 at low.
- `ashlarRing(s, x, y, z, r, h, { thick, from, to, tops, holes })`: a round wall coursed inside and out, its crown stepping down stretch by stretch as `tops` says (each stretch moved onto a joint), with clean jambs and sills at its `holes`, given by angle from +z toward +x. A full ring 4 in radius and 10 high is 3,206, 1,198 at low.
- `stoneArch(s, x, y, z, span, spring, { ring, depth, stones, key, jambs, spandrels, behind })`: a round arch of voussoirs with a proud keystone on jambs, each stone showing its face, soffit and back. `spandrels` fills the corners up to its crown; `behind(x)` is where the wall face is behind it, so a portal on a round tower reaches back to the curve. A 2.8 m span is 426, 114 at low.

```ts
const tops = [10.4, 9.5, 8.4, 7.2, 6.4, 7.2, 6.4, 7.6, 8.6, 9.5, 10.4, 10.4, 11.4, 10.4, 11.4, 11.4, 10.4, 10.4];
arch.ashlarRing(s, 0, 0, 0, 4, 11, { tone: arch.HEARTH, thick: 0.9, tops, moss: 0.42, holes: [{ from: -0.57, to: 0.57, bottom: 0, top: 4.6 }] });
arch.stoneArch(s, 0, 0, 4.15, 2.8, 2.5, { tone: arch.HEARTH, ring: 0.68, spandrels: true, behind: (x) => Math.sqrt(3.1 * 3.1 - x * x) - 4.15 });
```

### Porches, steps, chimneys and the rest

| Call | What | Full | Low |
|---|---|---:|---:|
| `portico(s, x, y, z, w, d, h, { floor, steps, run, posts, pedestal, rise, frame, banners })` | A columned porch reaching `d` out from a wall at z: posts on pedestals, knee braces, a gabled roof with its truss shown, a raised floor and steps, banners. 7.2 × 2.8 × 6.4, a 1.2 floor and banners: | 1,244 | 572 |
| `steps(s, x, y, z, w, rise, run, { n })` | A stone flight climbing to its top at z, in blocks of about 1.6 m. 1.7 wide, 0.3 rise: | 80 | 16 |
| `chimney(s, x, y, z, w, d, top, { material, pots })` | A coursed or plaster stack with a corbelled band and pots, sooted at its mouth: | 282 | 90 |
| `balcony(s, x, y, z, w, d)` | A deck on brackets with balusters and a rail. 3 × 1: | 224 | 144 |
| `awning(s, x, y, z, w, d, { drop, stripes, posts })` | Striped cloth from the wall with a scalloped valance, on arms or posts. 2.3 × 0.9: | 54 | 54 |
| `banner(s, x, y, z, w, h, { tone, emblem })` | A cloth banner on a rod, with a swallowtail and a wheat sprig: | 70 | 70 |

```ts
arch.portico(s, 0, 0, 4.5, 7.2, 2.8, 6.4, { floor: 1.2, steps: 4, run: 1.5, rise: 2.8, banners: 2.3 });
arch.chimney(s, 1.35, 3.9, -0.7, 0.85, 0.85, 5.8);
s.at(2.8, 0, -0.4, Math.PI / 2, () => arch.awning(s, 0, 2.2, 0, 2.3, 0.9, { posts: true, drop: 0.3 }));
```

### Built with it

`cityCottage`, `cityBakery` and `cityCivicHall` in `builders/city-buildings.ts` and `sunkTower` in `builders/group-6.ts` are built this way and are the examples to copy. A house is its four walls (each turned with `s.at`), `quoins` at its corners, a `roof`, then its porch, chimney and dressing. A roof, a stone surround or a porch costs far more than a wall face, so spend them on the faces the camera sees.

## Skins: painted textures

A part with `skin` wears that painted texture and is lit by the painted world's one light (`src/features/painted/paint.ts`), as the land, the trees and the town are. A part without one draws exactly as props always did, lit by Lambert. Every call takes `skin`, the first calls (`box`, `tube`, `blob`, `cone`, `poly`) too.

| Skin | What it is | Strokes |
|---|---|---|
| `rock` | Lavender-grey planes of weathered rock | painted from three sides |
| `scree` | Small broken stones | three sides |
| `moss` | A cushion of moss | three sides |
| `stone` | The ancients' dressed blocks, with cracks between (`terrace-stone.webp`) | three sides |
| `mud` | Wet earth | three sides |
| `plaster` | Lime plaster, drawn in code | three sides |
| `bark` | Ridged oak bark | along the part |
| `barkOld` | Old bark with moss in its furrows | along the part |
| `grain` | Wood grain, drawn in code | along the part |
| `thatch` | Straw laid in courses, drawn in code | along the part |
| `tiles` | Roof tiles in rows, each its own shade, drawn in code | along the part: rows across a roof |
| `slate` | Small grey slates in rows, drawn in code | along the part |
| `limestone` | Dressed limestone without joints (blocks model their own), drawn in code | three sides |
| `flat` | No texture, only the painted light | |

A skin carries only light and dark: each one is divided by its own average color when it loads, so the part keeps its palette color and the painting adds strokes. Moss baked onto a skinned part (`moss` in the options) wears the moss texture on its mossy faces. "Along the part" means along a sweep, up a lathe's profile and along a box's longest side. On a `blob`, `cone` or `poly` every skin is painted from three sides.

The skins live in `skins.ts` (name, painting, meters a repeat covers, how strongly it shows). To add one, add a line there. A painting goes in `public/assets/painted/` with an entry under `painted.textures` in `public/assets/manifest.json`, and the skin names that entry; the loader finds the file through the manifest, so it also works in a build, which renames every file. A drawn one goes in `skins.view.ts`.

Cost: no draw call. All skins are layers of one 256-pixel texture array, about 4.9 MB of graphics memory with its mipmaps (14 layers), loaded the first time a level wants it. A skinned pixel takes three texture reads, four with moss. At low (`propTextures` is false) no texture is read and skinned parts keep their baked shading and the painted light.

## The first calls

These are unchanged and every builder written before the soft forms still works with them. Their faces are flat and one color each, with a ramp chosen face by face.

| Call | What | Cost |
|---|---|---|
| `box(x, y, z, w, h, d, tone, { bevel, skip, top })` | A box standing on y | 12 triangles, 44 with `bevel` |
| `tube(path, radii, sides, tone, { cap, flat, inside })` | A straight-segment tube | 2 × sides a segment |
| `cyl(x, y, z, r0, r1, h, sides, tone)` | An upright tube | 2 × sides, plus caps |
| `blob(x, y, z, rx, ry, rz, tone, { sides, rings, jitter, floor })` | A lumpy ball with flat faces | 2 × sides × rings |
| `cone(x, y, z, r, h, sides, tone, { star, cap })` | A cone: a pine tier, a spike | `sides` |
| `poly(points, tone, { two, toward })` | One flat face | points − 2 |
| `disc(x, y, z, r, sides, tone)` | A flat disc looking up | sides − 2 |
| `at(x, y, z, turn, draw)` | Draws what `draw` adds moved, turned (`ry`, `rx`, `rz`) and scaled | none |
| `shadowBlob`, `shadowBox` | A ball or box that casts the prop's shadow | 20 or 12 in the shadow pass |
| `light(x, y, z)` | Where the prop's light sits | none |

## Budgets

A prop's entry in `src/content/props.ts` holds its triangle budget, at most 300 for small props, 1,500 for trees and 6,000 for a landmark. A test holds every variant to it at full detail, and holds the low detail to no more than full. Count with `propExtras(buildProp(kind, variant)).triangles`. The whole scene is held to 150 draw calls and 400,000 triangles at high, 80 and 150,000 at low (`docs/fast-everywhere.md`).

## Look at it in the game

`bun tools/props-quality.mjs` starts the game's dev server on `PORT`, stands each group 8 model on the painted land in the game's own light, shoots it from its sheet's three-quarter angle and sets the picture beside the sheet in `.artifacts/act1/props-quality/`. Add a line to its `SHOTS` table for a new model. `--costs` also reads `window.__game.costs()` in the town and the meadow at high and low.
