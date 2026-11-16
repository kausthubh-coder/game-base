# Review of hero-braid-swing

sheet: da645bc141d1
picture: .artifacts/hero-braid-publish/hero-braid-swing-review.png
world: not asked for: the cards are the review. `--world --url <game>` in the look lane adds the game's own light and camera

## What the check found

Nothing: every rule passes.

Measured, for question 2:
- head, first front frame: hero-braid 53 pixels wide, hero-braid-swing 65 (over 2 apart: look at the hair and at anything held beside the head)
- head, first back frame: hero-braid 49 pixels wide, hero-braid-swing 67 (over 2 apart: look at the hair and at anything held beside the head)

## The rubric

Answer each from the picture, in a sentence or two, naming frames as "walk side frame 3". An answer that says
only "yes" or "fine" is not an answer. When unsure, it fails.

### 1. Who is it? Name the reference's hair shape and colour, how many eyes show from the front, the top, the bottom, the footwear and the carried thing. Then name the frame of this sheet that differs most from `hero-braid`, the reference card in any of them, and how.

Answer: This is the generated Braid base: brown high plait, clipped sides, square olive face with two front eyes, sage jacket, cream shirt, charcoal legs, brown boots and satchel. Tool side frame 0 differs most through the raised axe beside the head; it keeps Braid's clipped scalp and braid.

### 2. Size. The measured head widths are above. Where they are over 2 pixels apart, say what makes the difference (fuller hair, a bigger skull, a tool beside the head). Fuller hair or a bigger skull is another head.

Answer: The measured 65/67-pixel top silhouettes include the raised axe in front/back frame 0, versus the base's 53/49 including braid. The bare skull in strike/recovery retains the base's head scale; the axe accounts for the enlarged band, not fuller hair.

### 3. The concept sheet. Name its five or six big coloured shapes and say which this sheet changed or lost.

Answer: Option D's six shapes remain: olive square face, brown plait, pale sage jacket, cream shirt, charcoal legs, brown leather. The additional grey iron axe is neutral metal snapped alongside the base's own colours.

### 4. Height in the world. The facts line gives its height in heroes and what its sheet says. Is it right beside the hero on the green strip?

Answer: The standing body remains within one percent of base height in the measured strip. High/low diagnostic figures stand beside the unchanged Copper and cast. The diagnostic floor now leaves all boots and the axe unobscured.

### 5. Outline and light. Is every edge closed by a dark tinted line, one or two pixels, with no black and no pale rim on the night strip? Is the light from the upper left in all three directions?

Answer: All nine frames have dark tinted edges and upper-left highlights. Native front frame 1 retains cream cuffs without a white halo; back frame 2 has no face or pale outline. There is no baked shadow.

### 6. Motion. Open .artifacts/hero-braid-publish/hero-braid-swing-review.webp and the laid-over frames at the right of each row. Name any frame that slides sideways, changes size, pops, or leaves a ghost. A loop: does the last frame lead back to the first?

Answer: Inspected all nine native action frames and the three tool-to-idle native cycles, plus both game-renderer films. The axe moves shoulder to ground to lowered recovery. Native side frame 1 is the weakest pose: strike/recovery are close in silhouette, matching the three-frame Copper contract. No torso shrink or disconnected tool. The transition back to base idle preserves hair and body scale.

### 7. Game size. On the night strip (half size) is it told apart from the hero and from the nearest character like it by its big shapes alone? Which character is nearest?

Answer: The half-size night strip retains the long brown braid and pale top. Copper has orange wedge hair and navy jacket; neither is substituted. Hobb and Dax stay clearly separate in the renderer diagnostic.

### 8. The view of each row. Does the front face the camera, the back show no face, and the side face right, in every frame?

Answer: All three front frames have two eyes, all three back frames have no face, and all three profiles face right. The braid and axe are inside each cell.

## Defects left

Answer: The optional contact checker measures the actual soles with the unchanged horizontal tolerance. All native frames and ordered transitions and all high/low renderer timelines were inspected again for publication. Side strike/recovery remain close in silhouette; this is a limited three-frame tool action, not evidence of a stronger strike. No character pixels were changed.


Repair review: inspected all three native 17-frame timelines and all six high/low renderer timelines. Tool frame origins now stay within half a pixel of column 64 in all directions. Walk applies one translation per direction, preserving stride and sway. Front windup through recovery no longer drags the torso across the cell. Side tool frame 1 still leans forward slightly, as the retained source does. Head, shoulders, costume and braid remain continuous into idle. No clipping or back-facing face. The renderer diagnostic alternates the two sheets at one world location beside Copper, Hobb and Dax on a raised unobscured floor; this is not mirror integration.

Contact review: inspected both magenta region overlays against the actual pixels. Base regions include the lifted walking foot. Tool regions include the complete lateral sole support. Front/back strike has an axe between the boots, which stays within the boot extrema and cannot move their measured centre. Side strike excludes the separate grounded axe beyond the right sole. The five-row sole band avoids the axe/boot connection higher up. All soles remain complete across the sides of the regions. Regions are reviewed source data, not semantic recognition of footwear.

Verdict: PASS
