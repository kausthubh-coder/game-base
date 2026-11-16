# Review of hero-braid

sheet: 0938a4fad7fd
picture: .artifacts/hero-braid-publish/hero-braid-review.png
world: not asked for: the cards are the review. `--world --url <game>` in the look lane adds the game's own light and camera

## What the check found

Nothing: every rule passes.

## The rubric

Answer each from the picture, in a sentence or two, naming frames as "walk side frame 3". An answer that says
only "yes" or "fine" is not an answer. When unsure, it fails.

### 1. Who is it? Name the reference's hair shape and colour, how many eyes show from the front, the top, the bottom, the footwear and the carried thing. Then name the frame of this sheet that differs most from its own first frame in any of them, and how.

Answer: Braid: ash-brown high plait, clipped sides, two front eyes, olive square face, sage jacket and cream shirt, charcoal trousers, brown boots and satchel, brass key. Walk side frame 2 has the widest leg spread; it retains the same hair and outfit.

### 2. Size. The measured head widths are above. Where they are over 2 pixels apart, say what makes the difference (fuller hair, a bigger skull, a tool beside the head). Fuller hair or a bigger skull is another head.

Answer: The front skull and clipped hair stay the same size through idle and walk; the hanging braid widens the silhouette on the left. The 110-pixel standing height matches Copper. No tool is present on this sheet.

### 3. The concept sheet. Name its five or six big coloured shapes and say which this sheet changed or lost.

Answer: Option D supplies olive face, brown plait, pale sage jacket, cream shirt, charcoal legs and brown leather. All remain visible; the locked palette makes the sage warm and muted, consistent with the small look-d reference.

### 4. Height in the world. The facts line gives its height in heroes and what its sheet says. Is it right beside the hero on the green strip?

Answer: The native green strip and high/low diagnostic show the same standing height as Copper. Hobb is broader and Dax taller. The raised diagnostic floor leaves the full figures unobscured at high and low.

### 5. Outline and light. Is every edge closed by a dark tinted line, one or two pixels, with no black and no pale rim on the night strip? Is the light from the upper left in all three directions?

Answer: Idle front frame 0 and all back/profile rows keep tinted brown edges and upper-left highlights. The native night strip shows no white fringe or floor shadow. Fine internal highlights are chunkier than Copper but remain pixel clusters.

### 6. Motion. Open .artifacts/hero-braid-publish/hero-braid-review.webp and the laid-over frames at the right of each row. Name any frame that slides sideways, changes size, pops, or leaves a ghost. A loop: does the last frame lead back to the first?

Answer: Inspected every idle and walk frame on the green sheet and the overlaid rows, plus the direction cycles in the native film and high/low diagnostic. Walk side frames 1 and 2 hold a broad step; frame 3 passes, then 4 and 5 repeat the opposite half. No clipped braid, shrinking torso or anchor jump. The loop returns to frame 0.

### 7. Game size. On the night strip (half size) is it told apart from the hero and from the nearest character like it by its big shapes alone? Which character is nearest?

Answer: On the half-size night strip the hanging braid and pale jacket separate Braid from Copper. Mina is the nearest braided cast member; her glasses and purple clothing distinguish her.

### 8. The view of each row. Does the front face the camera, the back show no face, and the side face right, in every frame?

Answer: All four front idle and six front walk frames show two eyes. Every back frame shows the rear plait without a face; every side frame faces right.

## Defects left

Answer: The optional contact checker measures the actual soles with the unchanged horizontal tolerance. All native frames and ordered transitions and all high/low renderer timelines were inspected again for publication. Side strike/recovery remain close in silhouette; this is a limited three-frame tool action, not evidence of a stronger strike. No character pixels were changed.


Repair review: inspected all three native 17-frame timelines and all six high/low renderer timelines. Tool frame origins now stay within half a pixel of column 64 in all directions. Walk applies one translation per direction, preserving stride and sway. Front windup through recovery no longer drags the torso across the cell. Side tool frame 1 still leans forward slightly, as the retained source does. Head, shoulders, costume and braid remain continuous into idle. No clipping or back-facing face. The renderer diagnostic alternates the two sheets at one world location beside Copper, Hobb and Dax on a raised unobscured floor; this is not mirror integration.

Contact review: inspected both magenta region overlays against the actual pixels. Base regions include the lifted walking foot. Tool regions include the complete lateral sole support. Front/back strike has an axe between the boots, which stays within the boot extrema and cannot move their measured centre. Side strike excludes the separate grounded axe beyond the right sole. The five-row sole band avoids the axe/boot connection higher up. All soles remain complete across the sides of the regions. Regions are reviewed source data, not semantic recognition of footwear.

Verdict: PASS
