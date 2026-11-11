---
name: verify-style-lab
description: Check one art style in the style lab against the reference, with fixed shots and motion strips. Use after any change to a style behind `?style=`, and before saying a style is done.
---

# Verify a style

Read `docs/style-lab/README.md` first: the target look, the five styles, what done means.

## The loop

1. Build into your own folder: `bun x vite build --outDir dist-<style>`.
2. Serve it on your style's port and note the pid it prints: `bun tools/serve.mjs dist-<style> <port>`.

   | Style | Port |
   |---|---|
   | base | 5430 |
   | hd2d | 5431 |
   | puppet | 5432 |
   | chibi | 5433 |
   | anime | 5434 |
   | voxel | 5435 |

3. Shoot it: `bun tools/style-lab.mjs --style <style> --url http://127.0.0.1:<port>/`. It takes several
   minutes, because this Mac draws WebGL in software and other agents share it. A full shoot can pass
   30 minutes, so run it with `run_in_background` and a 2-hour timeout (7200000 ms), and wait. While you iterate, shoot less: `--skip-places` when only motion changed, `--places town` for one
   place. Run the full shoot at the end.
4. Look. Open with the Read tool, in this order:
   - `.artifacts/style-lab/<style>/card.png`: the reference first, then your places, then every clip.
   - `docs/style-lab/reference/genshin-fields.png` and two pictures from `docs/style-lab/reference/<style>/`.
   - each strip in `.artifacts/style-lab/<style>/motion/<clip>.png`: walk, run, tool, turn, talk, creature.
5. Write the three biggest gaps between your card and the reference, in plain words, into your notes. A gap
   is something a player sees: "the ground is a flat lime sheet; the reference has two greens and a lit
   rise". Judge motion by the strips: is it the same character in every frame, do the feet plant, does the
   turn read as a turn?
6. Fix the biggest gap, then go back to step 1.
7. Stop the server by its pid.

The style is done when the strips show the same character in every frame and the card passes every item in
the README's "What a style delivers". The `base` shots in `.artifacts/style-lab/base/` are the game today, for
before and after.

## Reading the counts

`counts.json` has draw calls and triangles for every place. The budget is 150 draw calls and 400,000
triangles. These are counts only: never report a frame rate from this Mac.
