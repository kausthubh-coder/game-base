# Farm parts concepts

Approval candidates for act 1, not approved production models. Generated with the built-in image tool. The full prompts are in `prompts.json`. The sheets propose shapes and connections. This document controls dimensions and behavior where painted lettering or perspective differs.

Sources: `docs/act1.md`, `docs/painted-world.md`, `docs/style-sheet.md`, `assets-src/concept/stone.md`, the approved Pump House sheet, `stations.ts`, `rigs.ts`, `town.ts`, and the handbook's `playthrough/farms.js` parts, partRules and farm routes plus chapter 30.

## Shared construction

One block is one metre. Use a 1.8 m hero for scale, consistent with the landmark sheets. The prop skill rounds that to two blocks. Camera looks down 35 degrees. Roots stand at y=0, fronts face +z. Rotate modules by quarter turns. The footprint is a placement reservation, not the tight mesh bounds.

Use broad beveled boxes, six-sided cylinders and swept arms. Keep plank divisions and two-rail fences visible from above. Warm wood, dark supports, copper joints and old-brass rims belong beside the existing workbench and sprinkler. Limestone feet use the landmark palette. Keep teal small and reserve luminous teal for the sensor. Ordinary lamps cast amber light.

Proposed common connection: shafts run at y=0.5 relative to their supporting cell. Hex copper ends meet brass collars flush at the cell boundary. Straight and corner modules stay inside one cell. A slope module rises one block over one block with articulated joints. Chute mouths meet flush at grid edges. These are visual defaults, not an implemented network contract.

## Sheets and footprints

Dimensions below are width x depth in blocks. Reach and clearances are additional reservations.

| Sheet | Part | Footprint and joins |
|---|---|---|
| `hands.webp` | Ditch | 1x1 tile, 0.25 deep. Open ends join flat or downhill tiles. |
| `hands.webp` | Lamp | 1x1, about 1.7 high. Freestanding or next to fence. Manual shutter; no shaft required. |
| `hands.webp` | Workbench | 2x1, counter 0.8 high, tool board about 1.4 high. Front interaction space. Existing 1.7 m tabletop fits this reservation. |
| `hands.webp` | Fence | One block along a cell edge, about 0.9 high. Share posts at ends and corners. |
| `hands.webp` | Pit | 1x1 excavation, one block deep. Reserve an adjacent pusher and an unobstructed exit ramp beyond the pit. |
| `hands.webp` | Hatch roof | 1x1 at about y=2. Shaft along hinge edge. Reserve the leaf's swing above the occupied cell. Tile a larger roof. |
| `water.webp` | Waterwheel, flat and drop | 2x1 reservation, about 1.8 diameter. One-block-wide paddle channel plus bank bearing. Axle faces a neighboring shaft. Flat flowing water gives 4; falling water gives 6. |
| `water.webp` | Straight shaft | 1x1, opposite face sockets at y=0.5. |
| `water.webp` | Corner shaft | 1x1, adjacent face sockets at y=0.5 with simple bevel housing. |
| `water.webp` | Slope shaft | 1x1 horizontal run, one-block rise. End joints align with the lower and upper cell's sockets. |
| `water.webp` | Lever | 1x1. Inline clutch on the common shaft. It switches every attached part. |
| `water.webp` | Sprinkler | 1x1, 0.7 high. Side power socket. Irrigates the surrounding eight cells. The shaft occupies a separate cell. |
| `moving.webp` | Chute, flat/downhill | 1x1 per open trough tile. Align entry and exit mouths. Gravity handles descent. |
| `moving.webp` | Chute, uphill | 1x1 per run with one-block rise. Side shaft input drives a vine-rope cleat belt. Power cost unspecified. |
| `moving.webp` | Collector chest | 1x1. Padded open lip accepts goods from within three blocks and from adjacent chute. No power input specified. |
| `moving.webp` | Pusher | 1x1 base, about 0.6 high. Shaft input, broad plate reaches the cell in front; uses 1 power. Reserve a free landing cell. |
| `moving.webp` | Clapper | 1x1. Wood paddle and spring cam, proposed shaft attachment. Sends a startled beast in a straight line away. |
| `moving.webp` | Bee box | 1x1, about 0.9 high. Unpowered landing shelf. Flowers within ten blocks; leave a flower route through crops. |
| `light.webp` | Sensor | 1x1, about 0.65 high. Direction vane and shared-shaft clutch. Detects creature, good, light, dry soil or ripe crop. |
| `light.webp` | Switchable lamp | 1x1, about 1.7 high. Same family as plain lamp, with shaft control. Separate on/off views. |
| `cutting.webp` | Harvester arm | 1x1 base plus one forward crop cell. Shaft input; uses 2 power. Cuts ripe crop and replants. |
| `cutting.webp` | Saw arm | 1x1 base plus one forward tree cell. Shaft input; uses 2 power. Reserve tree fall clearance beyond that cell. Fells and replants. |
| `farms.webp` | Four assemblies | Illustrative, editable layouts. Grid shows component reservations rather than a fixed blueprint. |

## State language

Working has visible movement or material flow. Starved has an empty inlet, missing target or reduced movement. Backed up has a visible obstruction or goods accumulated at the outlet. Shape and material changes carry the distinction without relying on color.

Power demand above supply slows every attached part proportionally. A wheel supplying 4 to demand 6 gives two-thirds speed throughout. A machine without any power may stand still. A slow machine is never depicted as damaged. There is no fuel, wear or maintenance mechanic. An off lamp obeys a command; it has not run out of wax.

For a passive fence, lamp, pit or hatch, the three pictures show contextual farm states, not invented internal machinery. A fence guides an active route, borders an empty route or holds a queue. A pit receives a spring, is empty or is occupied. A lamp is lit, deliberately off or obstructed in its route. A hatch admits sun, shades the rootsnare or lacks swing clearance. The last hatch state is a proposed placement cue.

For the bee box, no flowers or a nearby Take farm means starved. A full honey store is a proposed backed-up cue. Collector capacity and arm output waiting are also proposals. The sensor's full-chest state turns the shared shaft off, so a switchable lamp becomes dark in response. The dry lamp-trap inset is separate from the lamp pond.

## Farm rule checks

| Farm | Required reading of the scene |
|---|---|
| Gearling pit | Running machine attracts within 16 blocks. Fences route the gearling into darkness, where it pauses and drops a spring. A powered pusher clears it to a safe exit so the next can enter. Chest collects within 3. No spikes or creature killing. |
| Bait field | Nighttime carrots remain darkest in the center. Outer lamps repel burrowers toward that center. Burrowers tunnel in from all sides and leave copper. Nearby lit windows would compete with this layout. |
| Terrace | Falling water powers a wheel below. Shafts, including corners and rising joints, carry power uphill to sprinklers. Ditches do not carry water uphill. Sprinklers and shafts displace crops. Flowers in rested rows support bees. |
| Lamp pond | Progressively brighter lamps pull lanternflies across water, within their 12-block attraction range. Frogs within 3 of the path eat flies and yield slick. Competing lamps steal visits. The pond stays open on Give. |

## Defaults and unresolved choices

- Git cannot have both a local branch named `act1` and another named `act1/concept-parts`. Work uses `act1-concept-parts`, based on local `act1` at `9161b86`, preserving the integration branch.
- Footprints, socket height, slope joints, wheel axle gearing, control transmission and arm clearances are proposals for approval. The source provides verbs and power costs rather than a dimensional construction contract.
- The source says the sprinkler wets eight, not nine, while also saying the sprinkler and its shaft each occupy a block. Default: a 3x3 neighborhood with sprinkler in the center, eight wet surrounding cells, and only seven crop cells if a shaft occupies one of that ring. Confirm whether eight was intended to mean crop yield instead. Painted wet cells never authorize planting under machinery.
- Wheel strength follows flowing versus falling water. Flat stagnant pond water does not generate power. Both wheel views use the same prop, with different environmental water placement.
- Flat chute propulsion is unspecified. Default: flat handoff supported by gravity-fed throughput; only uphill requires power. The rope belt and its power cost need a gameplay decision.
- A sensor or lever switches every part on its connected shaft. The sheet's control arrows do not imply electrical wires or independent lamp-only switching on a shared network. Use a separate network where a lamp must switch independently.
- Sensor range, mode selection, inverse full-chest logic, chest capacity, clapper power demand and bee-box capacity are unspecified. The lamp-trap rule requires full-chest shutoff, so that is shown as a proposed control mode.
- Pit shading and safe exit ramps, hatch swing obstruction and cutting-arm output queues are visual defaults. Final placement and collision rules need implementation decisions.
- Workbench left-input/right-output chute ports are a proposed future handoff. The source defines crafting at the bench, not automatic bench recipes. The sheet does not authorize crafting without the player.
- A 1.8 m wheel with an axle at y=0.5 extends below its bank's surface. Reserve the channel below it; never clip the paddle sweep into solid ground. Final axle gearing may change the bearing height.
- No axe sheet is included here. It appears in the source Hands table but belongs to the separate approved gear concept assignment. Clapper, bee box, pit, hatch and fence are included here as explicitly requested.

## Verification scope

Only concept sources change. No shipped asset, model, manifest, game code or package changes. The `verify-game` skill was read; game runtime checks do not exercise these approval sheets. Verification for this task is to open all six final WebPs, compare their contents to the source tables and farm rules, decode their dimensions, check each file is below 600,000 bytes, and check the final diff is confined to this directory. Any painting errors found on inspection are recorded below before commit.

Inspection prompted targeted image-tool edits. Cutting's starved labels now refer to missing mature targets, not a power shortage. Moving's clapper power cost is marked TBD and the rising chute inset is labeled powered uphill. Light's detection range is left TBD and an empty dry trap keeps its lamp on to attract flies. Farms replaces the gearling lure lamp with an unlit running mechanism and distinguishes zero power from short power. These correction instructions supplement the original prompts in `prompts.json`.

All six final WebPs were opened and checked against the requested parts and four farm routes. Coverage, three-state views, connection diagrams and footprints are present. Remaining issues for the approval review:

- `light.webp` has garbled small introductory sensor lettering. Its clean diagram caption correctly leaves range TBD. Use that caption and this document, not the damaged introductory line.
- `farms.webp` says "Steam power" in the small gearling introduction. Read "Stream power". There is no boiler or steam system. The small bait-field rival header still says "INVALID" although its corrected caption says competing nearby light. A bad layout remains legal.
- `farms.webp` uses compressed schematic footprint diagrams. Its gearling "4x4" is not a validated packing plan for a two-cell wheel, shafts, pit and ramp. Follow the individual part reservations and allow extra space. The depicted lure crank is an illustrative running mechanism, not a newly unlocked part. In production use a running existing part for the lure.
- Small farm module miniatures retain simplified geometry and some generic no-input captions. Use the full family sheets for the final model, the farm scene for arrangement, and the source farm rules for behavior. The pit is starved when no gearling arrives; a chest is starved when no goods arrive. Neither requires power.

These are approval sheets, so remaining caption and packing issues are reported as ISSUES rather than silently treating the paintings as implementation specifications.
