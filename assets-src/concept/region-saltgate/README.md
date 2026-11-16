# Saltgate and the Mere

Concept proposal for approval, 2026-11-12. Built-in image generation, eight retained paintings, compressed with cwebp. No models, runtime assets or placements changed. Base is local `act1` at `d7ee5aa`; working branch is `act1-region-saltgate`.

Saltgate is the hero's busy coastal home. Its playable grant-day quarter sits inside a much larger terraced port. Honey limestone, salt-darkened joints, oak, walnut, hemp rope, aged brass and muted teal roofs connect it to the approved water kit. Flowers and warm lamps connect it to the opening film. The Mere comes from the north hills, passes the landing, bends around Hollowmere, continues through Lantern Marsh and reaches the sea at Saltgate. The ferry travels upstream.

## Files and visual checks

| File | What was checked |
|---|---|
| [vista-harbour.webp](vista-harbour.webp) | Water approach, layered city skyline, working quay, lighthouse, ship, guild outside and open ferry. The upper city is a silhouette proposal, not extra grant-day streets. |
| [vista-guild.webp](vista-guild.webp) | Film doorstep's oak double doors, round brass rope emblem, lantern to the left, broad shallow steps, limestone arch and wisteria. Side yard has rack and dummies. |
| [vista-river.webp](vista-river.webp) | Film's open ferry, lonely landing and sealed hillside door. Ash-grey woods follow the gold-lit High Road. River remains open to navigation. |
| [vista-bend.webp](vista-bend.webp) | West bank below the plank bridge, Hollowmere across the river, Hollow Oak, quay and landing at dusk. Shrine is dormant. |
| [plan.webp](plan.webp) | North up, small playable quarter, hall and yard, streets to quay, separate ferry and cargo berths, southern sea and eastern estuary. Dimensions below govern construction. |
| [kit-port.webp](kit-port.webp) | Twelve numbered harbour pieces, three-quarter forms, footprints and sizes. P09 uses the film's open ferry. |
| [kit-saltgate.webp](kit-saltgate.webp) | Twelve numbered town pieces, three-quarter forms, footprints and sizes. S01/S08/S09 retain doorstep continuity. Guild interior belongs to `rooms/guildHall`. |
| [kit-river.webp](kit-river.webp) | Twelve numbered river pieces, three-quarter forms, footprints and sizes. R10 retains approved jetty language; R09 follows approved weir. |

All eight final WebPs were opened after conversion. Reference review included `p1-wall`, `p2-doorstep`, `p3-hall`, `p4-key`, `p7-grant`, `p8-arrival`, `p9-doorstep-day`, scenes `24-yard` and `25-quay`, map `ferry.png` and `bridge.png`, the full Greenhollow map, approved `4-water/jetty`, `weir`, `pumpHouse`, and `stone.md`. Story checks used `docs/act1.md`, `docs/greenhollow-world.md`, `docs/painted-world.md` and handbook chapters 04d, 22 and 26.

These are source concepts, outside the shipped manifest. Verification is image inspection, complete piece inventory, file dimensions and byte limits, and Git scope. The game build and play suite do not exercise these files and were not run.

## Builder contract

Sizes below are width × depth × height in blocks. One block is one metre; hero height is 1.8. These written dimensions override perspective and generated diagram lettering. Default front is +z, ground y=0. Bridge length follows z. Snap structural joins to whole blocks; smaller bevels, rails, planks and ropes can use fractions. Build broad masses from bevelled boxes, arch wedges, rounded extrusions and swept tubes. Paint masonry seams and wood grain rather than modelling every mark. Keep warm top light and lavender-grey underside shading; avoid flat facets.

Use `stone.md` cream #DEC398, light #F4DEB2 and shade #9C91A7, muted teal #648F88 and aged brass #B58C47 as proposed colours through the game's shared palette. Retain the approved wood ramps. Gold emission belongs to active ancient channels; town brass is reflective metal and lamps are amber. Buildings remain within the existing 6,000-triangle cap. These paintings do not establish measured model costs.

Large buildings are assembled from repeatable bays. A hall or ship must not consume its full budget separately for every window or rope. Rail thickness should read at game distance; use a few rope sweeps and painted net detail. Terrain banks blend into the smooth land surface, with independent water. Geometry does not provide bridge collision or a ferry boarding rule.

## Port pieces

| ID | Piece | W × D × H | Construction and use |
|---|---|---|---|
| P01 | Quay wall | 8 × 2 × 4 | Straight repeat bay, rounded coping, salt line and brass mooring rings. Top at quay height. |
| P02 | Quay steps | 4 × 6 × 3 | Broad stair down to water; 3-block total rise, subdivided shallow treads. |
| P03 | Lighthouse | 8 × 8 × 24 | Tapered eight-sided stone tower, gallery, brass lantern and teal cap. |
| P04 | Warehouse | 12 × 16 × 12 | Arched cargo door, timber roof and small hoist. |
| P05 | Timber crane | 4 × 4 × 8 | Base footprint 4 × 4; jib overhang needs a further 4 blocks of clear swing space. Separate jib and rope load. |
| P06 | Quay mooring | 1 × 1 × 1 | Short rope-wrapped oak bollard, contrasting R11's taller river post. |
| P07 | Fishing nets | 3 × 2 × 2 | Timber drying rack, floats and nets; paint most mesh detail. |
| P08 | Cargo cluster | 3 × 3 × 2 | Separate reusable crates, barrels and sacks inside this arrangement envelope. |
| P09 | Ferry | 4 × 10 × 3 | Open flat hull, low rails, brass rings, single curved lantern, cargo and pole. Height includes lamp above water. No cabin, engine or mast. |
| P10 | Fishing boat | 3 × 7 × 5 | Curved hull, one short mast and furled cream sail; height includes mast. |
| P11 | Merchant ship | 8 × 26 × 22 | Hull footprint; mast height included. Yardarms and rigging may overhang, allow a 14-block-wide berth clearance. Harbour set dressing. |
| P12 | Breakwater | 12 × 4 × 3 | Repeat wall with sloping seaward face, broad cap and low parapet. |

## Town pieces

| ID | Piece | W × D × H | Construction and use |
|---|---|---|---|
| S01 | Guild exterior | 24 × 18 × 14 | Repeat arched bays, timber gables, teal roof, large windows and rope-emblem entrance. Keep room layout for the interior painter. |
| S02 | Fisher house | 6 × 8 × 7 | Two floors, nets and simple balcony; height to roof ridge. |
| S03 | Merchant house | 8 × 10 × 10 | Three floors, balcony, cargo hoist; hoist clearance extends outside footprint. |
| S04 | Corner shop | 8 × 8 × 10 | Two street faces and cream awning; reserve another 2 blocks in front for awning. |
| S05 | Arcade bay | 4 × 4 × 4 | Four piers and rounded arches, joins to next bay. |
| S06 | Wall bay | 4 × 1 × 4 | Honey stone and oak framing, repeat seams. |
| S07 | Roof module | 4 × 4 × 3 | Teal pitched/gently swept roof, oak eaves, optional small dormer. |
| S08 | Guild doorstep | 6 × 3 × 1 | Three broad shallow steps, total rise 1; rounded projecting corners. |
| S09 | Guild door | 3 × 1 × 4 | Round-headed double oak leaves, brass bands, rope-knot roundel and two ring handles. Split into two movable leaves. |
| S10 | Arched window | 2 × 1 × 4 | Limestone frame, warm glazing, brass mullions. Repeat along hall. |
| S11 | Yard arrangement | 8 × 6 × 3 | Two dummies, weapon rack, map/grant table and low wall. Pieces separate so the sparring circle remains clear. |
| S12 | Street arrangement | 4 × 4 × 3 | Barrel, planter, bracket lantern, rope sign and grant-day bunting. Pieces separate. |

## River pieces

| ID | Piece | W × D × H | Construction and use |
|---|---|---|---|
| R01 | Turf bank | 8 × 4 × 2 | Soft grass cap and earth slope; straight and shallow curved variants. |
| R02 | Cut bank | 8 × 4 × 3 | Exposed earth and swept roots, uneven edge. |
| R03 | Mud bank | 8 × 4 × 1 | Shallow silt margin; blend into land rather than a visible rectangular slab. |
| R04 | Reeds | 2 × 2 × 2 | Cattails and blade clump; root wind at base. |
| R05 | River rocks | 4 × 3 × 2 | Rounded mossy cluster, pale wet lower edge. |
| R06 | Ford | 8 × 12 × 1 | Shallow bed across a side creek. Never blocks the ferry's main channel. |
| R07 | Plank bridge | 4 × 18 × 6 | Width 4, length 18 along z, overall height 6. Maintain 4 blocks clearance above high water and a clear central opening at least 6 wide. |
| R08 | Stone bridge | 6 × 24 × 9 | Width 6, length 24 along z, overall height 9. Single arch, 6 blocks clearance above high water. |
| R09 | Weir edge | 6 × 4 × 4 | One quarter-width repeat of approved 24 × 4 × 4 weir. Separate water curtain. Put in side reach with navigable bypass. |
| R10 | Landing | 4 × 12 × 3 | Approved jetty footprint, oak deck, walnut crossbraces, mooring and brass lamp. Height is above deck as in approved sheet; pile depth is site-dependent. |
| R11 | River mooring | 1 × 1 × 2 | Tall oak post and rope; embed below water as site requires. |
| R12 | Punt | 2 × 6 × 2 | Open pole boat for local use, distinct from P09 passenger ferry. Height includes rail and fittings; pole separate. |

## Grant-day layout defaults

The plan proposes a 144 × 112 block port quarter, north up. It is a layout concept, not a survey or the entire city. Local origin is the northwest corner, x east, z south. Reserve these rectangles when turning the picture into a level:

| Space | Northwest x,z | W × D |
|---|---|---|
| Guild hall | 16,12 | 24 × 18 |
| Training yard | 44,12 | 18 × 18 |
| Doorstep | 25,30 | 6 × 3 |
| Guild street | 0,34 | 120 × 8 |
| Quay lane | 50,30 | 6 × 34 |
| Harbour quay | 0,60 | 120 × 8 |
| Ferry pier | 50,68 | 4 × 12 |
| Ferry alongside | 54,69 | 4 × 10 |
| Estuary | 120,0 | 24 × 112 |
| Harbour basin | 0,68 | 120 × 44 |
| Lighthouse | 8,92 | 8 × 8 |

Rectangles overlap intentionally at street junctions. Continue the pier lane through an open yard gate and leave the quay crossing clear. Grant day uses hall, yard, quay and ferry in that order. The yard has an 8 × 8 clear sparring area plus the separate S11 pieces around its perimeter. Hobb and Dax stand on the quay beside the berth for goodbyes. Leave 6 blocks of clear water around the ferry and an open route into the eastern estuary. Extend city mass beyond the north/west edge with repeated roofs and terraces, not extra required opening quests.

## Defaults, uncertainties and painting corrections

- Saltgate has no approved street survey. The quarter's 144 × 112 envelope, hall size, lighthouse, warehouse sizes and berth positions are proposed. The local rectangles above govern an implementation; the plan's brushwork and grid are illustrative.
- The map ferry has a roofed cabin, while scenes 25 and p8 show an open pole ferry. Chose the film's open ferry for continuity. The map icon can be updated separately after approval.
- The main map bridge is a short flat icon. Chose a longer shallow arched timber bridge so the ferry can pass. In `vista-bend` the opening looks lower than the R07 clearance. Build R07 to the written high-water clearance, not the vista's compressed perspective. The bridge and town in that vista are composition references, not surveyed positions.
- R07, R08, R10 and R12 footprint sketches rotate the long axis across the page and sometimes call it W. Their size boxes and this README retain width × depth × height; bridge length is z. Do not swap their dimensions.
- The town sheet compresses S01's hall mass to fit its panel and S09 reads like one leaf at small size. Build the full 24 × 18 hall with repeated window bays, and the film's two distinct opening door leaves. The doorway is deliberately larger than the toolkit's generic 1 × 2 doorway to match the film.
- The bend painting adds a small carved backing to the shrine basin. That shrine is context, not a new numbered model request; reuse the approved shrine kit unless its region painter replaces it.
- The river vista puts the landing on the left for readability; p8 puts it on the right of its shot. Use the map's west-bank landing east of the hero's plot. The camera can look upstream or downstream.
- The ferry passes the sealed door and grey wood, but the source story varies the lighting chronology of the High Road. The river painting shows an already lit distant stretch; the later chapter-2 event lights another stretch over the hero's land. Do not imply the whole road is active on grant day.
- A ford or full weir across the main Mere would stop this journey. Chose a side creek for R06 and a bypassed side reach for R09. The approved Pump House stays 22 × 16 × 16 with its separate wheel; this package does not replace it or the full approved weir.
- Harbour tide range and exact bank elevations are unspecified. Proposed clearance is above high water. Landing deck height must meet the ferry; pile lengths adapt to the bank. No working lock mechanism is implied.
- Town building heights include roofs, ship heights include masts. Chimney and roof finial detail may extend slightly; keep collision and navigational envelopes separate from decoration.

## Generation directions

Built-in image generation produced one retained image per request. Shared direction was cozy Genshin-like painted fantasy, organic grand terrain, honey limestone with lavender shadows, oak/walnut, hemp rope, muted teal roofs, aged brass, warm lamps and readable forms made from bevelled masses, arches and sweeps. Vistas requested wide 16:9 framing, no text or watermark. Sheets requested 4:3 parchment, twelve three-quarter panels in four columns and three rows, footprints, exact IDs and dimensions from the tables, and a 1.8-block hero for scale.

The per-image subjects were the harbour water approach; the film-matched guild street and doorstep; the open ferry travelling upstream past the landing, sealed door and grey woods below gold; the bend below Hollowmere's plank bridge at dusk; a north-up grant-day plan with a marked hall-to-ferry walk; the P01-P12 port list; the S01-S12 town list; and the R01-R12 river list. Input images were the relevant film plates, quay/yard scenes, bridge icon and approved jetty/weir sheets. The harbour and plan used the written reference findings without image inputs.
