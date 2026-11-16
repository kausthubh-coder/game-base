# Creature concepts

Pending Kausthubh's approval. These are concept sheets, not approved or production sprites.

Painted with the built-in `image_gen.imagegen` tool. The brief and selected source hashes are in
`provenance.json`. Each sheet has front, right side and back views, pose studies, named palette,
hero scale at 1.8 blocks, and a native-size sprite study in the footer. Small studies also appear at
2x with nearest-neighbor scaling. Existing sprites in the footer are actual first-frame crops from
the manifest, not generated copies. The boar keeps its existing 192-square frame; other studies use
96-square frames. A study is a downsample of the generated pixel mock, not a finished animation frame.

## Sheets and decisions

| Sheet | Change from today's sprite and reason | Combat and farm check | Default or uncertainty |
|---|---|---|---|
| [fox.webp](fox.webp) | Keeps large ears, cream bib and broad tail. Adds the story painting's leaf tail to the well form; the current grey sprite has no healthy counterpart. | Crouch before pounce, lowered ears on recoil, grey coat left after calming. Fed fox brings buried seeds; calmed companion heals. | Leaf tail is proposed. Healthy pose studies describe the same anatomy; the grey tell and hurt are shown separately. Pounce is a proposed tell because chapter 23 specifies stepping out of its shape without naming the motion. Ear-tip height 0.75 blocks. |
| [thistlehog.webp](thistlehog.webp) | Keeps cream face and thistle mound. Separates drained grey combat form from green calmed form, which today's green fight sheet does not distinguish. | Puff before radial needles, curl before line roll, flattened hurt. Grazes thistles, rubs posts, sheds quills, bolts straight at noise. | Leaves remain quill-shaped for readability. Quills and shed grey coat are separate goods despite their proximity in the farm vignette. Height 0.65 blocks. |
| [boar.webp](boar.webp) | Keeps tusks, snout and arched mane. Gives cart-sized Bramble living brambles and a distinct grey Blighted coat, instead of today's brown coat in combat. | Paws ground before charge, lowers head sideways for sweep, rears before stomp, staggers onto knees. Roots furrows, follows Wren, leaves tusk tips. | Bramble is one individual before and after calming. Flowering brambles are proposed ornament. Shoulder 1.6 blocks, length 2.8. The upper mock's approximate occupancy label is illustrative; the footer uses the actual 192-square frame. |
| [lynx.webp](lynx.webp) | No dedicated shipped sprite. Keeps painting's tufted ears, cheek ruff, bobtail and low silhouette. | Quick circling stride, deep crouch before pounce, extended landing and hurt recoil. Quill strip and lamp explain counters. | No farm output invented. Recovered thumbnail indicates calming only; its healthy design is not a separate request. Shoulder 0.95 blocks. |
| [gearling.webp](gearling.webp) | Keeps sprite's winding key, round shell and stubby feet. Adds painting's teal core and exposed rear mechanism so charge recovery has a visible target. | Wind-key tell, straight stomp, spin-up, tipped hurt, inert shutdown. Follows running machines; dark pit stops it and releases a spring; fence and pusher guide return. | Rear mechanism is a proposed weak-point design. No Blight, calming or pelt. Body 0.85 blocks excluding key. Front core and side ports need consistent placement in final animation. |
| [rootsnare.webp](rootsnare.webp) | No dedicated shipped sprite. Keeps painting's woody pod, amber slit heart and curling vines. | Vine coils before binding companion; hurt opens heart. Sun through hatch closes eye and grows usable vine coils. | Pod height 1.15 blocks, reach 1.6. Grey shed covering is treated as dry bark fiber because this is a plant beast. Exact shedding material needs approval. |
| [mossling.webp](mossling.webp) | Uses shipped `critter` as a clearly labelled comparison proxy. Keeps sprouts and round body; adds painting's yellow-olive moss and damp stone habitat. | Peaceful idle, waddle, feed and shaded rest. Fed pair brings a third; loose moss fiber is its good. | Height 0.45 blocks. Rocks are habitat, not a shell attached to its feet. Small final sprite should simplify flowers and omit stone while moving. |
| [burrower.webp](burrower.webp) | No dedicated shipped sprite. Keeps painting's russet mole body, cream snout and large pale digging claws. | Peaceful dig and surface poses; recoils from lamp. Night carrots attract it; copper is left in soil. | Height 0.55 blocks. Copper glints are soil goods, not body armor. No combat or calming form proposed. |
| [lanternfly.webp](lanternfly.webp) | Keeps today's brown face, cream wings and golden abdomen; strengthens four-wing silhouette and warm glow. | Peaceful hover, flight, light-follow and rest. Brightest light within 12 blocks draws it; frog pond and dry dust lamp compete. | Body 0.18 blocks, wingspan 0.35. Sprite is deliberately exaggerated for visibility. Glow is amber, reserving teal for lume. |
| [frog.webp](frog.webp) | No dedicated shipped sprite. Keeps painting's cream throat, moss-olive haunches and gold eyes. | Peaceful hop, feeding tongue and rest. Eats lanternflies within 3 blocks; yields slick after feeding. | Sitting height 0.4 blocks. Slick bead on reed is a proposed collection cue, not eggs. |
| [bee.webp](bee.webp) | No dedicated shipped sprite. Keeps painting's golden fuzz, russet stripes and translucent wings. Adds readable pollen baskets. | Peaceful hover, flight, flower visit and startle. Box-to-flower route within 10 blocks, living land required, Take drives it away. Honey and wax shown. | Body length 0.22 blocks, wingspan 0.35. Sprite deliberately larger for readability; final wing and leg clusters need simplification. |

All sizes above are art proposals against the requested 1.8-block hero, not changes to manifest values.
The hero repeats as a scale reference; these sheets do not choose a new hero design.

## Review

Read `docs/act1.md`, `docs/style-sheet.md`, `docs/assets.md`, handbook chapters 23, 30 and 04d, and
`playthrough/farms.js`. Opened the six named shipped sheets and available fight sheets as contact
sheets, and all eleven creature paintings. There is no `fox-blighted-fight.png` at this base.
Compared each generated sheet with these sources, then opened every exported WebP.

Corrections removed invented rare variants, false approval stamps and inappropriate Blight/pelt
panels for peaceful wild creatures and the machine. Corrected left-facing turnarounds, grey combat
poses and the boar frame label. Blight stays drained and weary, with ash flecks and no wounds.
Palette swatches are painting direction; final sprites still need the locked palette, binary alpha,
anchors, consistent directional anatomy and motion checks after approval. Small veins, flowers,
fur and brass bolts must become fewer pixel clusters at that stage.

Checked WebP decoding, exact width 1600, all eleven expected names and each file below 600,000 bytes.
Only this folder changed. No runtime, manifest or shipped assets changed, so gameplay/build verification
does not exercise these unreferenced approval sheets. No game server or repo tool was needed.

## Branch

Based on local `act1` at `9161b86`. Git cannot create `act1/concept-creatures` while a local branch named
`act1` exists, so the working branch is `act1-concept-creatures`. Nothing was pushed or merged back.
